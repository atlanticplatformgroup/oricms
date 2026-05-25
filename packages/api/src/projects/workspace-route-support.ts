import type { Request } from 'express';
import type { UiGroup } from '@ori/shared';
import { prisma } from '../lib/prisma';
export { buildWorkspaceCatalog } from './workspace-catalog';
export { createCapabilities, SYSTEM_SURFACES } from './workspace-capabilities';
export {
  getWorkspaceProject,
  getWorkspaceProjectAndRole,
  getWorkspaceRoleForRequest,
  type WorkspaceProjectRecord,
} from './workspace-project-access';
export {
  createUiGroupFromPayload,
  normalizeUiGroups,
  updateUiGroupFromBody,
} from './workspace-ui-groups';

export async function persistUiGroups(
  projectId: string,
  nextUiGroups: UiGroup[],
  req: Request,
) {
  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, description: true, settings: true },
  });

  if (!existingProject) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const nextSettings = {
    ...((existingProject.settings || {}) as Record<string, unknown>),
    uiGroups: nextUiGroups,
  };

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { settings: nextSettings as never },
  });

  const configService = new (await import('./config-service')).ProjectConfigService(projectId);
  await configService.save(
    {
      name: existingProject.name,
      description: existingProject.description,
      settings: project.settings as never,
    },
    {
      name: req.user?.name || 'System',
      email: req.user?.email || 'system@oricms.local',
    },
  );

  return project;
}
