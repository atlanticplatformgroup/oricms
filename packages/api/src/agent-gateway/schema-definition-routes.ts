import type { Request, Response } from 'express';
import type { CollectionConfig } from '@ori/shared';
import { saveCollectionsConfig } from '../application/collections/save-collections-config';
import { CollectionService } from '../collections/service';
import { prisma } from '../lib/prisma';
import { badRequest, created, forbidden, internalError, ok, notFound } from '../lib/responses';
import { checkPermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';

export type AgentSchemaDefinitionAction = 'createSchema' | 'updateSchema';

function isSchemaDefinitionAction(action: unknown): action is AgentSchemaDefinitionAction {
  return action === 'createSchema' || action === 'updateSchema';
}

function getSchemaFromBody(body: unknown): CollectionConfig | null {
  const payload = body as { schema?: unknown; data?: { schema?: unknown } } | null | undefined;
  const schema = payload?.schema ?? payload?.data?.schema;
  if (!schema || typeof schema !== 'object') {
    return null;
  }
  const candidate = schema as Partial<CollectionConfig>;
  if (!candidate.id || !candidate.label || !candidate.contentType || !candidate.path) {
    return null;
  }
  return candidate as CollectionConfig;
}

async function getProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true, defaultBranch: true },
  });
}

function getActor(req: Request) {
  return {
    id: req.userId,
    name: req.user?.name,
    email: req.user?.email,
  };
}

async function getExistingSchemas(params: { projectId: string; repoUrl?: string | null; branch: string }): Promise<CollectionConfig[]> {
  const service = new CollectionService({
    projectId: params.projectId,
    repoUrl: params.repoUrl ?? '',
    branch: params.branch,
  });
  await service.init();
  return service.listCollections();
}

function buildPreflightResponse(params: {
  action: AgentSchemaDefinitionAction;
  schemaName: string;
  branch?: string;
  allowed: boolean;
  message?: string;
  configFreshness?: { generatedAt?: string; configVersion?: string; configUpdatedAt?: string };
}) {
  return {
    allowed: params.allowed,
    action: params.action,
    schemaName: params.schemaName,
    branch: params.branch,
    structural: true,
    autoPublish: params.allowed,
    requiresConfirmation: false,
    ...(params.message ? { details: { _errors: [params.message] } } : {}),
    generatedAt: params.configFreshness?.generatedAt ?? new Date().toISOString(),
    configVersion: params.configFreshness?.configVersion ?? 'structural-schema-definition',
    ...(params.configFreshness?.configUpdatedAt ? { configUpdatedAt: params.configFreshness.configUpdatedAt } : {}),
  };
}

export async function runSchemaDefinitionPreflight(req: Request, res: Response): Promise<boolean> {
  const body = req.body as { action?: unknown; schemaName?: string; data?: { schema?: unknown }; branch?: string };
  if (!isSchemaDefinitionAction(body?.action)) {
    return false;
  }

  try {
    const schema = getSchemaFromBody(body);
    const schemaName = body.schemaName || schema?.id;
    if (!schemaName) {
      badRequest(res, 'schemaName or data.schema.id is required', 'INVALID_PREFLIGHT_REQUEST');
      return true;
    }

    const permissionAllowed = await checkPermission(req.userId!, req.projectId!, 'schemas', 'update', req.projectRole);
    const bootstrap = await req.agentGateway?.getSessionBootstrap(body.branch);
    const branch = body.branch ?? bootstrap?.project.branch;
    const branchAllowed = !body.branch || !bootstrap?.capabilities.allowedBranches?.length || bootstrap.capabilities.allowedBranches.includes(body.branch);

    if (!permissionAllowed) {
      ok(res, buildPreflightResponse({
        action: body.action,
        schemaName,
        branch,
        allowed: false,
        message: "You don't have permission to update schemas",
        configFreshness: bootstrap,
      }));
      return true;
    }

    if (!branchAllowed) {
      ok(res, buildPreflightResponse({
        action: body.action,
        schemaName,
        branch,
        allowed: false,
        message: `Branch ${body.branch} is not allowed for this agent`,
        configFreshness: bootstrap,
      }));
      return true;
    }

    if (!schema) {
      ok(res, buildPreflightResponse({
        action: body.action,
        schemaName,
        branch,
        allowed: false,
        message: 'data.schema must include id, label, contentType, and path',
        configFreshness: bootstrap,
      }));
      return true;
    }

    ok(res, buildPreflightResponse({
      action: body.action,
      schemaName,
      branch,
      allowed: true,
      configFreshness: bootstrap,
    }));
    return true;
  } catch (error) {
    logger.error({ msg: 'Agent schema definition preflight error', error });
    internalError(res, 'Failed to run schema definition preflight');
    return true;
  }
}

export async function handleCreateSchemaDefinition(req: Request, res: Response): Promise<void> {
  await handleSchemaDefinitionMutation(req, res, 'createSchema');
}

export async function handleUpdateSchemaDefinition(req: Request, res: Response): Promise<void> {
  await handleSchemaDefinitionMutation(req, res, 'updateSchema', req.params.name);
}

async function handleSchemaDefinitionMutation(
  req: Request,
  res: Response,
  action: AgentSchemaDefinitionAction,
  routeSchemaName?: string,
): Promise<void> {
  try {
    const schema = getSchemaFromBody(req.body);
    if (!schema) {
      badRequest(res, 'schema must include id, label, contentType, and path', 'INVALID_SCHEMA_DEFINITION');
      return;
    }

    if (routeSchemaName && routeSchemaName !== schema.id) {
      badRequest(res, 'Route schema name must match schema.id', 'SCHEMA_ID_MISMATCH');
      return;
    }

    const project = await getProject(req.projectId!);
    if (!project) {
      notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
      return;
    }

    const requestedBranch = (req.body as { branch?: string } | undefined)?.branch;
    const bootstrap = await req.agentGateway?.getSessionBootstrap(requestedBranch);
    const allowedBranches = bootstrap?.capabilities.allowedBranches ?? [];
    if (requestedBranch && allowedBranches.length > 0 && !allowedBranches.includes(requestedBranch)) {
      forbidden(res, `Branch ${requestedBranch} is not allowed for this agent`, 'BRANCH_NOT_ALLOWED');
      return;
    }
    const branch = requestedBranch ?? bootstrap?.project.branch ?? project.defaultBranch;
    const existingSchemas = await getExistingSchemas({
      projectId: req.projectId!,
      repoUrl: project.repoUrl,
      branch,
    });
    const existingIndex = existingSchemas.findIndex((item) => item.id === schema.id);
    if (action === 'createSchema' && existingIndex >= 0) {
      badRequest(res, `Schema ${schema.id} already exists`, 'SCHEMA_ALREADY_EXISTS');
      return;
    }
    if (action === 'updateSchema' && existingIndex < 0) {
      notFound(res, `Schema ${schema.id} not found`, 'SCHEMA_NOT_FOUND');
      return;
    }

    const nextSchemas = existingIndex >= 0
      ? existingSchemas.map((item) => (item.id === schema.id ? schema : item))
      : [...existingSchemas, schema];

    const result = await saveCollectionsConfig({
      projectId: req.projectId!,
      repoUrl: project.repoUrl ?? '',
      branch,
      actor: getActor(req),
    }, nextSchemas);

    const commit = await req.agentGateway?.getGitService().getCurrentCommit(req.projectId!);
    await prisma.auditLog.create({
      data: {
        projectId: req.projectId!,
        userId: req.userId,
        action: action === 'createSchema' ? 'agent.schema.create' : 'agent.schema.update',
        resourceType: 'schemaDefinition',
        resourceId: schema.id,
        oldValue: existingIndex >= 0 ? existingSchemas[existingIndex] as object : undefined,
        newValue: schema as object,
      },
    });

    const response = {
      action,
      schemaName: schema.id,
      branch,
      structural: true,
      schema,
      createdSchemas: result.createdCollections.map((item) => item.id),
      persistence: {
        persisted: true,
        commitSha: commit?.hash ?? null,
      },
      generatedAt: new Date().toISOString(),
      configVersion: commit?.hash ?? 'structural-schema-definition',
    };

    if (action === 'createSchema') {
      created(res, response);
      return;
    }
    ok(res, response);
  } catch (error) {
    logger.error({ msg: 'Agent schema definition mutation error', error });
    internalError(res, 'Failed to mutate schema definition');
  }
}
