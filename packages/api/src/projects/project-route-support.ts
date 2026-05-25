import type { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { prisma } from '../lib/prisma';
import { apiServices } from '../lib/api-services';
import { logger } from '../middleware/logger';
import { forbidden } from '../lib/responses';
import { projectSettingsSchema } from '../lib/validation';
import { ProjectConfigService } from './configService';
import { gitService } from './runtime';
import { isValidRepoUrl, sanitizeSettingsForStorage } from './settings';
import { sendValidationError } from './shared';

export async function listProjectsForUser(userId: string) {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: { project: true },
    orderBy: { createdAt: 'desc' },
  });

  return memberships.map((membership) => ({
    ...membership.project,
    role: membership.role,
  }));
}

export function validateProjectRepoUrl(value: unknown): boolean {
  if (value && !isValidRepoUrl(value)) {
    throw new Error('repoUrl must be an http(s) URL. For local file:// repos, set ALLOW_FILE_REPO_URLS=true.');
  }
  return true;
}

export async function ensureProjectSlugAvailable(slug: string): Promise<boolean> {
  const existing = await prisma.project.findUnique({ where: { slug } });
  return !existing;
}

export async function createProjectWithOwner(
  input: {
    name: string;
    slug: string;
    repoUrl?: string | null;
    description?: string | null;
    repoProvider?: string;
  },
  userId: string,
) {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      slug: input.slug,
      repoUrl: input.repoUrl,
      repoProvider: input.repoProvider || 'github',
      description: input.description,
      settings: { contentRoot: 'content' },
      members: { create: { userId, role: 'owner' } },
    },
  });

  if (!input.repoUrl) {
    await gitService.initRepo(project.id);
  }

  return project;
}

export function queueProjectConfigBootstrap(projectId: string): void {
  const configService = new ProjectConfigService(projectId);
  apiServices.runBackgroundTask(
    'project-config-bootstrap',
    configService.bootstrap().catch((err) => {
      logger.error({ msg: 'Failed to bootstrap project from git', error: err, projectId });
    }),
  );
}

export async function findProjectByIdWithMemberCount(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { _count: { select: { members: true } } },
  });
}

export async function findProjectSettings(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });
}

export function sanitizeProjectSettingsOrRespond(
  res: Response,
  settings: unknown,
  existingSettings: unknown,
): Record<string, unknown> | null {
  const settingsValidation = projectSettingsSchema.safeParse(settings);
  if (!settingsValidation.success) {
    sendValidationError(res, settingsValidation.error.errors, 'Invalid settings');
    return null;
  }

  try {
    return sanitizeSettingsForStorage(
      settings as Record<string, unknown>,
      (existingSettings || {}) as Record<string, unknown>,
    );
  } catch (error) {
    sendValidationError(
      res,
      undefined,
      error instanceof Error ? error.message : 'Invalid settings payload',
    );
    return null;
  }
}

export async function updateProjectRecord(
  projectId: string,
  input: { name?: string; description?: string | null; settings?: Record<string, unknown> },
) {
  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.settings && { settings: input.settings as Prisma.InputJsonValue }),
    },
  });
}

export async function saveProjectConfigToGit(
  project: { id: string; name: string; description?: string | null; settings: unknown },
  user: { name?: string | null; email?: string | null } | undefined,
) {
  const configService = new ProjectConfigService(project.id);
  try {
    await configService.save(
      {
        name: project.name,
        description: project.description,
        settings: project.settings as never,
      },
      {
        name: user?.name || 'System',
        email: user?.email || 'system@oricms.local',
      },
    );
  } catch (error) {
    logger.error({ msg: 'Failed to save project config to git', error, projectId: project.id });
  }
}

export async function ensureOwnerProjectDeleteAccess(
  userId: string,
  projectId: string,
  res: Response,
): Promise<boolean> {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (membership?.role !== 'owner') {
    forbidden(res, 'Only owners can delete a project');
    return false;
  }

  return true;
}

export async function deleteProject(projectId: string) {
  await prisma.project.delete({ where: { id: projectId } });
}
