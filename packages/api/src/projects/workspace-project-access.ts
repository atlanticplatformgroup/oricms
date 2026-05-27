import type { Request } from 'express';
import type { ProjectRole } from '@ori/shared';
import { prisma } from '../lib/prisma';
import { getUserRole } from '../permissions/middleware';

export type WorkspaceProjectRecord = {
  id: string;
  name: string;
  defaultBranch: string;
  repoUrl: string | null;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export async function getWorkspaceProject(projectId: string): Promise<WorkspaceProjectRecord | null> {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      defaultBranch: true,
      repoUrl: true,
      settings: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getWorkspaceRoleForRequest(req: Request): Promise<ProjectRole | null> {
  if (req.projectRole) {
    return req.projectRole;
  }
  if (!req.userId) {
    return null;
  }
  return getUserRole(req.userId, req.params.projectId);
}

export async function getWorkspaceProjectAndRole(req: Request): Promise<{
  project: WorkspaceProjectRecord;
  role: ProjectRole;
} | null> {
  const project = await getWorkspaceProject(req.params.projectId);
  if (!project) {
    return null;
  }

  const role = await getWorkspaceRoleForRequest(req);
  if (!role) {
    return null;
  }

  return { project, role };
}
