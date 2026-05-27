import * as fs from 'fs/promises';
import * as path from 'path';
import type { SimpleGit } from 'simple-git';
import { resolveBranchRef } from './branch-utils';
import { checkoutExistingBranch, getConflictedFiles, getFileAtResolvedBranch } from './branch-workflow-support';
import { hasTrackedStatusChanges, toCommitAuthorOption } from './commit-utils';
import type { CommitOptions, ConflictResolution } from './types';
import { validateWorkspacePath } from './workspace-utils';
export {
  compareBranchesWorkflow,
  createBranchWorkflow,
  deleteBranchWorkflow,
  getBranchDiffSummaryWorkflow,
  getMergeBaseWorkflow,
  renameBranchWorkflow,
  switchBranchWorkflow,
} from './branch-management-workflows';

export async function applyConflictResolutionsWorkflow(
  git: SimpleGit,
  workspacePath: string,
  sourceBranch: string,
  targetBranch: string,
  resolutions: ConflictResolution[],
  commitOptions: CommitOptions,
): Promise<{ committedFiles: string[] }> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  await checkoutExistingBranch(git, branchSummary.all, sourceBranch);

  const committedFiles: string[] = [];
  for (const resolution of resolutions) {
    const normalizedPath = resolution.path.replace(/^\/+/, '');
    const resolvedFilePath = validateWorkspacePath(workspacePath, normalizedPath);

    let nextContent = '';
    if (resolution.strategy === 'manual') {
      nextContent = resolution.content || '';
    } else if (resolution.strategy === 'target') {
      const targetContent = await getFileAtResolvedBranch(git, branchSummary.all, targetBranch, normalizedPath);
      nextContent = targetContent || '';
    } else {
      const sourceContent = await getFileAtResolvedBranch(git, branchSummary.all, sourceBranch, normalizedPath);
      nextContent = sourceContent || '';
    }

    await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
    await fs.writeFile(resolvedFilePath, nextContent, 'utf-8');
    await git.add(normalizedPath);
    committedFiles.push(normalizedPath);
  }

  if (committedFiles.length > 0) {
    await git.commit(commitOptions.message, toCommitAuthorOption(commitOptions));
    await git.push('origin', sourceBranch);
  }

  return { committedFiles };
}

export async function promoteBranchWorkflow(
  git: SimpleGit,
  sourceBranch: string,
  targetBranch: string,
  commitOptions: CommitOptions,
): Promise<{ hash: string; message: string }> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  const sourceRef = resolveBranchRef(branchSummary.all, sourceBranch);
  const targetRef = resolveBranchRef(branchSummary.all, targetBranch);

  await git.checkout(targetRef);
  if (targetRef.startsWith('origin/')) {
    await git.checkout(['-B', targetBranch, targetRef]);
  }

  await git.pull('origin', targetBranch);

  try {
    await git.merge([
      '--no-ff',
      sourceRef,
      '-m',
      commitOptions.message,
    ]);
  } catch (error) {
    const conflictedFiles = await getConflictedFiles(git);

    try {
      await git.merge(['--abort']);
    } catch {
      // no-op: merge might not be in-progress
    }
    const message = error instanceof Error ? error.message : 'Merge failed';
    if (/CONFLICT|Merge conflict/i.test(message)) {
      throw new Error(`MERGE_CONFLICT:${conflictedFiles.join(',')}`);
    }
    throw error;
  }

  await git.push('origin', targetBranch);
  const log = await git.log({ maxCount: 1 });

  return {
    hash: log.latest?.hash || '',
    message: log.latest?.message || commitOptions.message,
  };
}

export async function applyFileChangesOnBranchWorkflow(
  git: SimpleGit,
  workspacePath: string,
  branch: string,
  changes: Array<{ path: string; content: string | null }>,
  commitOptions: CommitOptions,
): Promise<{ committed: boolean; hash: string; message: string }> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  await checkoutExistingBranch(git, branchSummary.all, branch);

  try {
    await git.pull('origin', branch);
  } catch {
    // no-op: pull failure is acceptable, continue with local state
  }

  for (const change of changes) {
    const normalizedPath = change.path.replace(/^\/+/, '');
    const resolvedPath = validateWorkspacePath(workspacePath, normalizedPath);

    if (change.content === null) {
      try {
        await fs.unlink(resolvedPath);
      } catch {
        // no-op: file may not exist locally
      }
      try {
        await git.rm(normalizedPath);
      } catch {
        // no-op: file may not be tracked
      }
      continue;
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, change.content, 'utf-8');
    await git.add(normalizedPath);
  }

  const status = await git.status();
  if (!hasTrackedStatusChanges(status)) {
    return { committed: false, hash: '', message: commitOptions.message };
  }

  await git.commit(commitOptions.message, toCommitAuthorOption(commitOptions));
  await git.push('origin', branch);

  const log = await git.log({ maxCount: 1 });
  return {
    committed: true,
    hash: log.latest?.hash || '',
    message: log.latest?.message || commitOptions.message,
  };
}
