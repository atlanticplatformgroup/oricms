import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
  graphql,
  getIntrospectionQuery,
  printSchema,
} from 'graphql';
import { hashGraphQlQuery, validateGraphQlDocument } from './guards';
import {
  createDeliveryEtag,
  executeWithTimeout,
  getAccessibleDeliveryProject,
  getDeliveryPersistedQuerySettings,
  loadDeliverySnapshot,
  matchesIfNoneMatch,
  resolveDeliveryQueryPayload,
} from './delivery-route-support';
import { loadDeliverySchema, type DeliveryGraphQlContext } from './delivery-schema';

const router = Router({ mergeParams: true });
const DELIVERY_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
const GRAPHQL_MAX_QUERY_LENGTH = 20_000;
const GRAPHQL_MAX_DEPTH = 12;
const GRAPHQL_MAX_COST = 4_000;
const GRAPHQL_EXECUTION_TIMEOUT_MS = 8000;

router.post(
  '/',
  [
    body('query').optional().isString(),
    body('variables').optional().isObject(),
    body('operationName').optional().isString(),
    body('persistedQueryId').optional().isString().trim().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'GraphQL query payload is invalid',
          details: validation.mapped(),
        },
      });
      return;
    }

    const { projectId } = req.params as { projectId: string };
    const access = await getAccessibleDeliveryProject(req, res, projectId);
    if (!access) return;
    const { project, settings } = access;

    const { query: rawQuery, variables, operationName: rawOperationName, persistedQueryId } = req.body as {
      query: string;
      variables?: Record<string, unknown>;
      operationName?: string;
      persistedQueryId?: string;
    };
    const persistedSettings = getDeliveryPersistedQuerySettings(settings);
    const resolved = resolveDeliveryQueryPayload(rawQuery, rawOperationName, persistedQueryId, persistedSettings);
    if (!resolved.ok) {
      const failure = resolved as Extract<typeof resolved, { ok: false }>;
      res.status(failure.code === 'VALIDATION_ERROR' ? 400 : 403).json({
        success: false,
        error: {
          code: failure.code,
          message: failure.message,
        },
      });
      return;
    }

    const context = {
      projectId,
      repoUrl: project.repoUrl ?? '',
      defaultBranch: project.defaultBranch,
    } satisfies DeliveryGraphQlContext;
    const query = resolved.query;
    const operationName = resolved.operationName;
    const requestStartedAt = Date.now();
    const queryHash = hashGraphQlQuery(query);
    const guard = validateGraphQlDocument(query, {
      maxQueryLength: GRAPHQL_MAX_QUERY_LENGTH,
      maxDepth: GRAPHQL_MAX_DEPTH,
      maxCost: GRAPHQL_MAX_COST,
      variables,
      operationName,
    });
    if (!guard.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'message' in guard ? guard.message : 'GraphQL query is invalid',
        },
      });
      return;
    }

    const snapshot = await loadDeliverySnapshot(context);
    const etag = createDeliveryEtag(JSON.stringify({
      projectId,
      revision: snapshot.revision,
      query,
      variables: variables || null,
      operationName: operationName || null,
      persistedQueryId: persistedQueryId || null,
    }));
    res.setHeader('Cache-Control', DELIVERY_CACHE_CONTROL);
    res.setHeader('ETag', etag);
    if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
      res.status(304).end();
      return;
    }

    const schema = await loadDeliverySchema(context);
    let result: Awaited<ReturnType<typeof graphql>>;
    try {
      result = await executeWithTimeout(graphql({
        schema,
        source: query,
        variableValues: variables,
        operationName,
        contextValue: context,
      }), GRAPHQL_EXECUTION_TIMEOUT_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GraphQL execution failed';
      if (message.includes('timed out')) {
        res.status(408).json({
          success: false,
          error: {
            code: 'GRAPHQL_TIMEOUT',
            message,
          },
          meta: {
            queryHash,
            operationName: operationName || null,
            executionMs: Date.now() - requestStartedAt,
          },
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: {
          code: 'GRAPHQL_EXECUTION_ERROR',
          message,
        },
        meta: {
          queryHash,
          operationName: operationName || null,
          executionMs: Date.now() - requestStartedAt,
        },
      });
      return;
    }

    if (result.errors && result.errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'GRAPHQL_EXECUTION_ERROR',
          message: 'GraphQL execution failed',
          details: result.errors.map((error) => error.message),
        },
        data: result.data || null,
        meta: {
          queryHash,
          operationName: operationName || null,
          executionMs: Date.now() - requestStartedAt,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      meta: {
        queryHash,
        operationName: operationName || null,
        executionMs: Date.now() - requestStartedAt,
      },
    });
  }
);

router.get(
  '/schema',
  async (req: Request, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const access = await getAccessibleDeliveryProject(req, res, projectId);
    if (!access) return;

    const context = {
      projectId,
      repoUrl: access.project.repoUrl ?? '',
      defaultBranch: access.project.defaultBranch,
    } satisfies DeliveryGraphQlContext;
    const snapshot = await loadDeliverySnapshot(context);
    const etag = createDeliveryEtag(JSON.stringify({ projectId, revision: snapshot.revision, scope: 'delivery-graphql-schema' }));
    res.setHeader('Cache-Control', DELIVERY_CACHE_CONTROL);
    res.setHeader('ETag', etag);
    if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
      res.status(304).end();
      return;
    }

    const schema = await loadDeliverySchema(context);
    res.type('text/plain').send(printSchema(schema));
  }
);

router.get(
  '/schema/introspection',
  async (req: Request, res: Response) => {
    const { projectId } = req.params as { projectId: string };
    const access = await getAccessibleDeliveryProject(req, res, projectId);
    if (!access) return;

    const context = {
      projectId,
      repoUrl: access.project.repoUrl ?? '',
      defaultBranch: access.project.defaultBranch,
    } satisfies DeliveryGraphQlContext;
    const snapshot = await loadDeliverySnapshot(context);
    const etag = createDeliveryEtag(JSON.stringify({ projectId, revision: snapshot.revision, scope: 'delivery-graphql-introspection' }));
    res.setHeader('Cache-Control', DELIVERY_CACHE_CONTROL);
    res.setHeader('ETag', etag);
    if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
      res.status(304).end();
      return;
    }

    const schema = await loadDeliverySchema(context);
    const introspection = await graphql({
      schema,
      source: getIntrospectionQuery(),
    });

    if (introspection.errors && introspection.errors.length > 0) {
      res.status(500).json({
        success: false,
        error: {
          code: 'GRAPHQL_INTROSPECTION_ERROR',
          message: 'Failed to generate GraphQL introspection schema',
          details: introspection.errors.map((error) => error.message),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: introspection.data,
    });
  }
);

export default router;
