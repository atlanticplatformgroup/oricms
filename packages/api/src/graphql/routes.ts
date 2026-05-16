import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { graphql, getIntrospectionQuery, printSchema } from 'graphql';
import { requirePermission } from '../permissions/middleware';
import { prisma } from '../lib/prisma';
import { hashGraphQlQuery, validateGraphQlDocument } from './guards';
import { buildSchemaSnapshot, mergeGraphQlSettings, parseGraphQlSettings, upsertSchemaSnapshot, type GraphQlPersistedQuery } from './settings';
import { executeWithTimeout, graphqlRuntime, loadContentTypes, type GraphQlContext } from './runtime';

const router = Router({ mergeParams: true });
const GRAPHQL_MAX_QUERY_LENGTH = 20_000;
const GRAPHQL_MAX_DEPTH = 12;
const GRAPHQL_MAX_COST = 6_000;
const GRAPHQL_EXECUTION_TIMEOUT_MS = 8000;
const GRAPHQL_SCHEMA_SNAPSHOT_LIMIT = 30;

async function findProjectRuntime(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true, defaultBranch: true },
  });
  return project ? { ...project, repoUrl: project.repoUrl ?? '' } : null;
}

async function findProjectSettings(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });
}

async function findProjectRuntimeWithSettings(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true, defaultBranch: true, settings: true },
  });
  return project ? { ...project, repoUrl: project.repoUrl ?? '' } : null;
}

function projectNotFound(res: Response) {
  return res.status(404).json({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } });
}

router.get('/schema', requirePermission('collections', 'read'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findProjectRuntime(projectId);
  if (!project) return projectNotFound(res);
  const contentTypes = await loadContentTypes(projectId, project.repoUrl, project.defaultBranch);
  const schema = graphqlRuntime.buildForContentTypes(contentTypes);
  res.type('text/plain').send(printSchema(schema));
});

router.get('/schema/snapshots', requirePermission('collections', 'read'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findProjectSettings(projectId);
  if (!project) return projectNotFound(res);
  const graphQlSettings = parseGraphQlSettings(project.settings);
  res.json({ success: true, data: { latestVersion: graphQlSettings.schemaRegistry.latestVersion, latestHash: graphQlSettings.schemaRegistry.latestHash, snapshots: graphQlSettings.schemaRegistry.snapshots.map((snapshot) => ({ version: snapshot.version, hash: snapshot.hash, createdAt: snapshot.createdAt })) } });
});

router.post('/schema/snapshots', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findProjectRuntimeWithSettings(projectId);
  if (!project) return projectNotFound(res);
  const contentTypes = await loadContentTypes(projectId, project.repoUrl, project.defaultBranch);
  const schema = graphqlRuntime.buildForContentTypes(contentTypes);
  const sdl = printSchema(schema);
  const graphQlSettings = parseGraphQlSettings(project.settings);
  const nextSnapshot = buildSchemaSnapshot(sdl, graphQlSettings.schemaRegistry.latestVersion);
  const { created, snapshot } = upsertSchemaSnapshot(graphQlSettings, nextSnapshot, GRAPHQL_SCHEMA_SNAPSHOT_LIMIT);
  await prisma.project.update({ where: { id: projectId }, data: { settings: mergeGraphQlSettings(project.settings, graphQlSettings) } });
  res.status(created ? 201 : 200).json({ success: true, data: { created, snapshot: { version: snapshot.version, hash: snapshot.hash, createdAt: snapshot.createdAt, sdl: snapshot.sdl } } });
});

router.get('/schema/snapshots/:version', requirePermission('collections', 'read'), async (req: Request, res: Response) => {
  const { projectId, version } = req.params as { projectId: string; version: string };
  const parsedVersion = Number(version);
  if (!Number.isInteger(parsedVersion) || parsedVersion <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Schema snapshot version must be a positive integer' } });
  }
  const project = await findProjectSettings(projectId);
  if (!project) return projectNotFound(res);
  const graphQlSettings = parseGraphQlSettings(project.settings);
  const snapshot = graphQlSettings.schemaRegistry.snapshots.find((item) => item.version === parsedVersion);
  if (!snapshot) {
    return res.status(404).json({ success: false, error: { code: 'SCHEMA_SNAPSHOT_NOT_FOUND', message: 'Schema snapshot not found' } });
  }
  res.json({ success: true, data: snapshot });
});

router.get('/schema/introspection', requirePermission('collections', 'read'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findProjectRuntime(projectId);
  if (!project) return projectNotFound(res);
  const contentTypes = await loadContentTypes(projectId, project.repoUrl, project.defaultBranch);
  const schema = graphqlRuntime.buildForContentTypes(contentTypes);
  const introspection = await graphql({ schema, source: getIntrospectionQuery() });
  if (introspection.errors?.length) {
    return res.status(500).json({ success: false, error: { code: 'GRAPHQL_INTROSPECTION_ERROR', message: 'Failed to generate GraphQL introspection schema', details: introspection.errors.map((error) => error.message) } });
  }
  res.json({ success: true, data: introspection.data });
});

router.get('/persisted-queries', requirePermission('collections', 'read'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findProjectSettings(projectId);
  if (!project) return projectNotFound(res);
  const graphQlSettings = parseGraphQlSettings(project.settings);
  res.json({ success: true, data: { enabled: graphQlSettings.deliveryPersistedQueries.enabled, requirePersistedOnly: graphQlSettings.deliveryPersistedQueries.requirePersistedOnly, queries: graphQlSettings.deliveryPersistedQueries.queries.map((entry) => ({ id: entry.id, sha256: entry.sha256, operationName: entry.operationName || null, createdAt: entry.createdAt })) } });
});

router.put('/persisted-queries', requirePermission('settings', 'update'), [body('enabled').optional().isBoolean(), body('requirePersistedOnly').optional().isBoolean(), body('queries').isArray(), body('queries.*.id').isString().trim().notEmpty(), body('queries.*.query').isString().trim().notEmpty(), body('queries.*.operationName').optional().isString()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Persisted query payload is invalid', details: validation.mapped() } });
  }
  const { projectId } = req.params as { projectId: string };
  const project = await findProjectSettings(projectId);
  if (!project) return projectNotFound(res);
  const bodyValue = req.body as { enabled?: boolean; requirePersistedOnly?: boolean; queries: Array<{ id: string; query: string; operationName?: string }> };
  const seen = new Set<string>();
  const normalizedQueries: GraphQlPersistedQuery[] = [];
  for (const query of bodyValue.queries) {
    const id = query.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const normalizedQuery = query.query.trim();
    normalizedQueries.push({ id, query: normalizedQuery, sha256: crypto.createHash('sha256').update(normalizedQuery).digest('hex'), operationName: query.operationName?.trim() || undefined, createdAt: new Date().toISOString() });
  }
  const graphQlSettings = parseGraphQlSettings(project.settings);
  graphQlSettings.deliveryPersistedQueries.enabled = bodyValue.enabled ?? graphQlSettings.deliveryPersistedQueries.enabled;
  graphQlSettings.deliveryPersistedQueries.requirePersistedOnly = bodyValue.requirePersistedOnly ?? graphQlSettings.deliveryPersistedQueries.requirePersistedOnly;
  graphQlSettings.deliveryPersistedQueries.queries = normalizedQueries;
  await prisma.project.update({ where: { id: projectId }, data: { settings: mergeGraphQlSettings(project.settings, graphQlSettings) } });
  res.json({ success: true, data: { enabled: graphQlSettings.deliveryPersistedQueries.enabled, requirePersistedOnly: graphQlSettings.deliveryPersistedQueries.requirePersistedOnly, queries: graphQlSettings.deliveryPersistedQueries.queries.map((entry) => ({ id: entry.id, sha256: entry.sha256, operationName: entry.operationName || null, createdAt: entry.createdAt })) } });
});

router.post('/', requirePermission('collections', 'read'), [body('query').isString().trim().notEmpty(), body('variables').optional().isObject(), body('operationName').optional().isString()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'GraphQL query payload is invalid', details: validation.mapped() } });
  }
  const { projectId } = req.params as { projectId: string };
  const user = req.user;
  if (!user?.id || !user?.email || !user?.name) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }
  const project = await findProjectRuntime(projectId);
  if (!project) return projectNotFound(res);
  const { query, variables, operationName } = req.body as { query: string; variables?: Record<string, unknown>; operationName?: string };
  const requestStartedAt = Date.now();
  const queryHash = hashGraphQlQuery(query);
  const guard = validateGraphQlDocument(query, { maxQueryLength: GRAPHQL_MAX_QUERY_LENGTH, maxDepth: GRAPHQL_MAX_DEPTH, maxCost: GRAPHQL_MAX_COST, variables, operationName });
  if (!guard.valid) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'message' in guard ? guard.message : 'GraphQL query is invalid' } });
  }
  const contentTypes = await loadContentTypes(projectId, project.repoUrl, project.defaultBranch);
  const schema = graphqlRuntime.buildForContentTypes(contentTypes);
  let result: Awaited<ReturnType<typeof graphql>>;
  try {
    result = await executeWithTimeout(graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
      contextValue: { projectId, repoUrl: project.repoUrl, defaultBranch: project.defaultBranch, userId: user.id, userName: user.name, userEmail: user.email } satisfies GraphQlContext,
    }), GRAPHQL_EXECUTION_TIMEOUT_MS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GraphQL execution failed';
    const code = message.includes('timed out') ? 'GRAPHQL_TIMEOUT' : 'GRAPHQL_EXECUTION_ERROR';
    const status = message.includes('timed out') ? 408 : 400;
    return res.status(status).json({ success: false, error: { code, message }, meta: { queryHash, operationName: operationName || null, executionMs: Date.now() - requestStartedAt } });
  }
  if (result.errors?.length) {
    return res.status(400).json({ success: false, error: { code: 'GRAPHQL_EXECUTION_ERROR', message: 'GraphQL execution failed', details: result.errors.map((error) => error.message) }, data: result.data || null, meta: { queryHash, operationName: operationName || null, executionMs: Date.now() - requestStartedAt } });
  }
  res.json({ success: true, data: result.data, meta: { queryHash, operationName: operationName || null, executionMs: Date.now() - requestStartedAt } });
});

export default router;
