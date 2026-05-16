import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ensureResourceNotLocked } from '../locks/middleware';
import type { GitService } from './service';

export function normalizeBranchNameParam(branchName: string): string {
  return decodeURIComponent(branchName).trim();
}

export function formatBranchMutationError(error: unknown): { status: number; code: string; message: string } | null {
  const message = error instanceof Error ? error.message : '';

  if (/already exists/i.test(message)) {
    return { status: 409, code: 'BRANCH_EXISTS', message };
  }

  if (/not found/i.test(message)) {
    return { status: 404, code: 'BRANCH_NOT_FOUND', message };
  }

  if (/cannot be renamed/i.test(message) || /cannot rename/i.test(message)) {
    if (/current branch/i.test(message)) return { status: 409, code: 'CURRENT_BRANCH_LOCKED', message };
    if (/default branches?/i.test(message)) return { status: 409, code: 'DEFAULT_BRANCH_LOCKED', message };
    if (/protected branches?/i.test(message)) return { status: 409, code: 'PROTECTED_BRANCH_LOCKED', message };
    return { status: 409, code: 'BRANCH_RENAME_BLOCKED', message };
  }

  if (/cannot be deleted/i.test(message) || /cannot delete/i.test(message)) {
    if (/current branch/i.test(message)) return { status: 409, code: 'CURRENT_BRANCH_LOCKED', message };
    if (/default branches?/i.test(message)) return { status: 409, code: 'DEFAULT_BRANCH_LOCKED', message };
    if (/protected branches?/i.test(message)) return { status: 409, code: 'PROTECTED_BRANCH_LOCKED', message };
    return { status: 409, code: 'BRANCH_DELETE_BLOCKED', message };
  }

  return null;
}

export async function getBranchListResponse(
  gitService: GitService,
  projectId: string,
): Promise<{ branches: Awaited<ReturnType<GitService['listBranches']>>; current: string | null }> {
  const branches = await gitService.listBranches(projectId);
  const current = branches.find((branch) => branch.isCurrent)?.name || null;
  return { branches, current };
}

export async function ensureBranchSettingsUnlocked(
  req: Request,
  res: Response,
  projectId: string,
): Promise<boolean> {
  return ensureResourceNotLocked(req, res, {
    projectId,
    resourceType: 'projectSettings',
    resourceId: 'branch-settings',
  });
}

export async function createBranchAndList(
  gitService: GitService,
  projectId: string,
  name: string,
  fromBranch?: string,
) {
  await gitService.createBranch(projectId, name.trim(), fromBranch?.trim());
  return getBranchListResponse(gitService, projectId);
}

export async function switchBranchAndList(
  gitService: GitService,
  projectId: string,
  name: string,
) {
  await gitService.switchBranch(projectId, name.trim());
  return getBranchListResponse(gitService, projectId);
}

export async function renameBranchAndMappings(
  gitService: GitService,
  projectId: string,
  branchName: string,
  newName: string,
) {
  const trimmedName = newName.trim();
  await gitService.renameBranch(projectId, branchName, trimmedName);
  const mappingResult = await prisma.branchEnvironmentMapping.updateMany({
    where: { projectId, branchPattern: branchName },
    data: { branchPattern: trimmedName },
  });

  return {
    branch: { name: trimmedName },
    updatedMappings: mappingResult.count,
  };
}

export async function deleteBranchAndMappings(
  gitService: GitService,
  projectId: string,
  branchName: string,
) {
  await gitService.deleteBranch(projectId, branchName);
  const mappingResult = await prisma.branchEnvironmentMapping.deleteMany({
    where: { projectId, branchPattern: branchName },
  });

  return {
    deleted: true,
    removedMappings: mappingResult.count,
  };
}
