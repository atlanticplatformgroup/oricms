import fs from 'fs/promises';
import path from 'path';
import type { ContentType } from '@ori/shared';
import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { GitService } from '../git/service';
import { createResourceCollectionLink, RESOURCE_COLLECTION_IDS } from '../resources/service';

const CONTENT_TYPE_SCHEMA = 'content-type-v1';

function normalizeContentTypeFields(fields: ContentType['fields']): ContentType['fields'] {
  return fields.map((field) => {
    const normalized = { ...field } as Record<string, unknown>;
    if ('name' in normalized && !('key' in normalized)) {
      normalized.key = normalized.name as string;
      delete normalized.name;
    }
    if (!normalized.label) {
      normalized.label = normalized.key;
    }
    return normalized as unknown as ContentType['fields'][number];
  });
}

export function getContentTypeRequestActor(req: Request) {
  return {
    id: req.user?.id,
    name: req.user?.name,
    email: req.user?.email,
  };
}

export function buildContentTypeDefinition(
  body: Record<string, unknown>,
): ContentType {
  const { name, plural, label, labelPlural, description, fields, ...rest } = body;
  return {
    $schema: 'content-type-v1',
    $id: String(name),
    name: String(name),
    plural: String(plural),
    label: String(label),
    labelPlural: String(labelPlural),
    description: typeof description === 'string' ? description : undefined,
    fields: normalizeContentTypeFields((fields as ContentType['fields']) ?? []),
    ...rest,
  } as ContentType;
}

export function buildUpdatedContentTypeDefinition(
  existing: ContentType,
  typeId: string,
  body: Record<string, unknown>,
): ContentType {
  return {
    ...existing,
    ...body,
    $schema: 'content-type-v1',
    $id: typeId,
    name: typeId,
    ...(Array.isArray(body.fields)
      ? { fields: normalizeContentTypeFields(body.fields as ContentType['fields']) }
      : {}),
  };
}

export function normalizeContentTypeDefinition(contentType: ContentType): ContentType {
  return {
    ...contentType,
    fields: normalizeContentTypeFields(contentType.fields ?? []),
  };
}

export function attachContentTypeResource(contentType: ContentType): ContentType & {
  resource: ReturnType<typeof createResourceCollectionLink>;
} {
  return {
    ...contentType,
    resource: createResourceCollectionLink(
      RESOURCE_COLLECTION_IDS.schemaTypes,
      'schemas',
      'system',
    ),
  };
}

export function getContentTypeFilePath(workspacePath: string, typeId: string): string {
  return path.join(workspacePath, 'schemas', 'types', `${typeId}.json`);
}

export async function resolveContentTypesWorkspace(projectId: string): Promise<{
  project: {
    id: string;
    repoUrl: string | null;
    defaultBranch: string;
  };
  gitService: GitService;
  workspacePath: string;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      repoUrl: true,
      defaultBranch: true,
    },
  });

  if (!project) {
    return null;
  }

  const gitService = new GitService();
  if (project.repoUrl) {
    await gitService.cloneOrPull(projectId, project.repoUrl, project.defaultBranch);
  }

  return {
    project,
    gitService,
    workspacePath: gitService.getWorkspaceDir(projectId),
  };
}

export async function contentTypeExists(workspacePath: string, typeId: string): Promise<boolean> {
  try {
    await fs.access(getContentTypeFilePath(workspacePath, typeId));
    return true;
  } catch {
    return false;
  }
}

export async function readContentTypeDefinition(
  workspacePath: string,
  typeId: string,
): Promise<ContentType | null> {
  try {
    const content = await fs.readFile(getContentTypeFilePath(workspacePath, typeId), 'utf-8');
    const typeDef = JSON.parse(content) as ContentType;

    if (typeDef.$schema !== CONTENT_TYPE_SCHEMA) {
      return null;
    }

    return normalizeContentTypeDefinition(typeDef);
  } catch {
    return null;
  }
}

export async function listContentTypeDefinitions(workspacePath: string): Promise<ContentType[]> {
  const typesDir = path.join(workspacePath, 'schemas', 'types');
  const contentTypes: ContentType[] = [];

  try {
    const files = await fs.readdir(typesDir);

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(typesDir, file), 'utf-8');
        const typeDef = JSON.parse(content) as ContentType;
        if (typeDef.$schema === CONTENT_TYPE_SCHEMA) {
          contentTypes.push(normalizeContentTypeDefinition(typeDef));
        }
      } catch {
        // Let the route layer decide whether to log noisy parse failures.
      }
    }
  } catch {
    return [];
  }

  return contentTypes;
}
