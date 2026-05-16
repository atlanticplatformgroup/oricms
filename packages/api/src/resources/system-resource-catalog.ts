import path from 'path';
import type { ContentType, ResourceCollectionDetail } from '@ori/shared';
import { prisma } from '../lib/prisma';
import { readJsonFiles } from './system-resource-support';
import {
  createResourceCollectionDetail,
  createSystemResourceView,
  RESOURCE_COLLECTION_IDS,
  type SystemResourceContext,
} from './system-resource-definitions';

export async function listSystemResourceCollections(
  context: SystemResourceContext,
): Promise<ResourceCollectionDetail[]> {
  const typeSchemas = await readJsonFiles<ContentType>(path.join(context.workspacePath, 'schemas', 'types'));
  const componentSchemas = await readJsonFiles<Record<string, unknown>>(
    path.join(context.workspacePath, 'schemas', 'components'),
  );
  const assetResult = await context.assetService.listAssets(context.projectId, {
    folder: 'all',
    limit: 1,
    offset: 0,
  });
  const memberCount = await prisma.projectMember.count({ where: { projectId: context.projectId } });
  const buildCount = await prisma.build.count({ where: { projectId: context.projectId } });

  return [
    createResourceCollectionDetail(
      context.role,
      RESOURCE_COLLECTION_IDS.schemaTypes,
      'schemas',
      'system',
      'Content Types',
      {
        description: 'Project content type definitions.',
        schemaId: 'content-type-v1',
        viewId: 'schemas.types',
        recordCount: typeSchemas.length,
        path: 'schemas/types',
        source: 'git',
        view: createSystemResourceView('schemas.types', 'schemas'),
      },
    ),
    createResourceCollectionDetail(
      context.role,
      RESOURCE_COLLECTION_IDS.schemaComponents,
      'schemas',
      'system',
      'Component Schemas',
      {
        description: 'Reusable nested schema definitions.',
        schemaId: 'component-v1',
        viewId: 'schemas.components',
        recordCount: componentSchemas.length,
        path: 'schemas/components',
        source: 'git',
        view: createSystemResourceView('schemas.components', 'schemas'),
      },
    ),
    createResourceCollectionDetail(
      context.role,
      RESOURCE_COLLECTION_IDS.assets,
      'assets',
      'operational',
      'Project Assets',
      {
        description: 'Asset metadata records backed by repository files.',
        schemaId: 'asset.metadata',
        viewId: 'assets.library',
        recordCount: assetResult.pagination.total,
        path: 'assets',
        source: 'hybrid',
        view: createSystemResourceView('assets.library', 'assets'),
      },
    ),
    createResourceCollectionDetail(
      context.role,
      RESOURCE_COLLECTION_IDS.members,
      'members',
      'system',
      'Project Members',
      {
        description: 'Human and agent memberships for the project.',
        schemaId: 'project.member',
        viewId: 'members.directory',
        recordCount: memberCount,
        source: 'database',
        view: createSystemResourceView('members.directory', 'members'),
      },
    ),
    createResourceCollectionDetail(
      context.role,
      RESOURCE_COLLECTION_IDS.builds,
      'builds',
      'operational',
      'Build Runs',
      {
        description: 'Operational build and deployment records.',
        schemaId: 'project.build',
        viewId: 'builds.runs',
        recordCount: buildCount,
        source: 'database',
        view: createSystemResourceView('builds.runs', 'builds'),
      },
    ),
    createResourceCollectionDetail(
      context.role,
      RESOURCE_COLLECTION_IDS.settings,
      'settings',
      'system',
      'Project Settings',
      {
        description: 'Project-level configuration and delivery settings.',
        schemaId: 'project.settings',
        viewId: 'settings.project',
        recordCount: 1,
        source: 'hybrid',
        view: createSystemResourceView('settings.project', 'settings'),
      },
    ),
  ];
}
