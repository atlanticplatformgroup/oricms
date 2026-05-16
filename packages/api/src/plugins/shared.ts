import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { PluginRegistryService } from './service';
import type { PluginManifest } from '@ori/shared';

export interface PluginProjectRuntime {
  id: string;
  repoUrl: string;
  defaultBranch: string;
  settings?: unknown;
}

export function respondProjectNotFound(res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
  });
}

export async function findPluginProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true, defaultBranch: true, settings: true },
  });
  return project
    ? { ...project, repoUrl: project.repoUrl ?? '' }
    : null;
}

export async function findPluginProjectRuntime(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true, defaultBranch: true },
  });
  return project
    ? { ...project, repoUrl: project.repoUrl ?? '' }
    : null;
}

export async function findPluginProjectSettings(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });
}

export async function loadValidatedManifestsOrRespond(
  res: Response,
  project: { id: string; repoUrl: string; defaultBranch: string },
): Promise<PluginManifest[] | null> {
  const registry = new PluginRegistryService();
  const result = await registry.listWithDiagnostics(project.id, project.repoUrl, project.defaultBranch);
  if (result.invalidManifests.length > 0) {
    res.status(409).json({
      success: false,
      error: {
        code: 'PLUGIN_MANIFEST_INVALID',
        message: 'One or more plugin manifests are invalid',
        details: { invalidManifests: result.invalidManifests },
      },
    });
    return null;
  }
  return result.manifests;
}

export async function writePluginAuditEvent(input: {
  projectId: string;
  userId?: string;
  action:
    | 'plugin.policy.execution.updated'
    | 'plugin.policy.ui.updated'
    | 'plugin.runtime.reconciled'
    | 'plugin.policy.execution.rolled_back'
    | 'plugin.policy.ui.rolled_back';
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        projectId: input.projectId,
        userId: input.userId || null,
        action: input.action,
        resourceType: 'plugin',
        resourceId: null,
        oldValue: input.oldValue ?? Prisma.JsonNull,
        newValue: input.newValue ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    logger.error({ msg: 'Failed to write plugin audit event', error, projectId: input.projectId, action: input.action });
  }
}
