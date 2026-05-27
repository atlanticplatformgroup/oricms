import type { SimpleGit } from 'simple-git';
import { resolveBranchRef } from './branch-utils';

export async function hasOriginRemote(git: SimpleGit): Promise<boolean> {
  const remotes = await git.getRemotes();
  return remotes.some((remote) => remote.name === 'origin');
}

export async function checkoutExistingBranch(git: SimpleGit, branches: string[], branchName: string): Promise<void> {
  if (branches.includes(branchName)) {
    await git.checkout(branchName);
    return;
  }

  if (branches.includes(`remotes/origin/${branchName}`)) {
    await git.checkout(['-B', branchName, `origin/${branchName}`]);
    return;
  }

  throw new Error(`Branch "${branchName}" not found`);
}

export async function getFileAtResolvedBranch(
  git: SimpleGit,
  branches: string[],
  branchName: string,
  filePath: string,
): Promise<string | null> {
  try {
    const ref = resolveBranchRef(branches, branchName);
    return await git.show([`${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

export async function getConflictedFiles(git: SimpleGit): Promise<string[]> {
  try {
    const rawConflicts = await git.raw(['diff', '--name-only', '--diff-filter=U']);
    return rawConflicts
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
