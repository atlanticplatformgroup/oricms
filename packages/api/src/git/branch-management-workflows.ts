import type { SimpleGit } from 'simple-git';
import { assertBranchMutationAllowed, branchExists, normalizeBranchName, resolveBranchRef } from './branch-utils';
import { checkoutExistingBranch, hasOriginRemote } from './branch-workflow-support';

export async function createBranchWorkflow(
  git: SimpleGit,
  branchName: string,
  fromBranch?: string,
): Promise<void> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  const normalizedBranchName = normalizeBranchName(branchName);
  const fromRef = fromBranch
    ? resolveBranchRef(branchSummary.all, fromBranch)
    : normalizeBranchName(branchSummary.current);
  const remoteBranchInfo = await hasOriginRemote(git)
    ? await git.listRemote(['--heads', 'origin', normalizedBranchName])
    : '';
  const remoteBranchExists = remoteBranchInfo.includes(`refs/heads/${normalizedBranchName}`);

  if (
    remoteBranchExists ||
    branchSummary.all.includes(normalizedBranchName) ||
    branchSummary.all.includes(`remotes/origin/${normalizedBranchName}`)
  ) {
    throw new Error(`Branch "${normalizedBranchName}" already exists`);
  }

  await git.raw(['branch', normalizedBranchName, fromRef]);

  if (await hasOriginRemote(git)) {
    await git.push(['-u', 'origin', normalizedBranchName]);
  }
}

export async function renameBranchWorkflow(
  git: SimpleGit,
  branchName: string,
  nextBranchName: string,
  defaultBranch: string,
): Promise<void> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  const currentBranch = normalizeBranchName(branchSummary.current);
  const normalizedBranchName = normalizeBranchName(branchName);
  const normalizedNextBranchName = normalizeBranchName(nextBranchName);

  if (!branchExists(branchSummary.all, normalizedBranchName)) {
    throw new Error(`Branch "${normalizedBranchName}" not found`);
  }

  if (branchExists(branchSummary.all, normalizedNextBranchName)) {
    throw new Error(`Branch "${normalizedNextBranchName}" already exists`);
  }

  assertBranchMutationAllowed(normalizedBranchName, currentBranch, defaultBranch, 'rename');

  const hasLocalBranch = branchSummary.all.includes(normalizedBranchName);
  const hasRemoteBranch = branchSummary.all.includes(`remotes/origin/${normalizedBranchName}`);

  if (!hasLocalBranch && hasRemoteBranch) {
    await git.raw(['branch', normalizedBranchName, `origin/${normalizedBranchName}`]);
  }

  await git.branch(['-m', normalizedBranchName, normalizedNextBranchName]);

  if (await hasOriginRemote(git)) {
    await git.push(['-u', 'origin', normalizedNextBranchName]);
    if (hasRemoteBranch) {
      await git.push(['origin', '--delete', normalizedBranchName]);
    }
    await git.fetch(['--prune', 'origin']);
  }
}

export async function deleteBranchWorkflow(
  git: SimpleGit,
  branchName: string,
  defaultBranch: string,
): Promise<void> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  const currentBranch = normalizeBranchName(branchSummary.current);
  const normalizedBranchName = normalizeBranchName(branchName);

  if (!branchExists(branchSummary.all, normalizedBranchName)) {
    throw new Error(`Branch "${normalizedBranchName}" not found`);
  }

  assertBranchMutationAllowed(normalizedBranchName, currentBranch, defaultBranch, 'delete');

  const hasLocalBranch = branchSummary.all.includes(normalizedBranchName);
  const hasRemoteBranch = branchSummary.all.includes(`remotes/origin/${normalizedBranchName}`);

  if (hasLocalBranch) {
    await git.deleteLocalBranch(normalizedBranchName, true);
  }

  if (hasRemoteBranch && await hasOriginRemote(git)) {
    await git.push(['origin', '--delete', normalizedBranchName]);
    await git.fetch(['--prune', 'origin']);
  }
}

export async function switchBranchWorkflow(git: SimpleGit, branchName: string): Promise<void> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  await checkoutExistingBranch(git, branchSummary.all, branchName);
}

export async function compareBranchesWorkflow(
  git: SimpleGit,
  baseBranch: string,
  headBranch: string,
): Promise<{ ahead: number; behind: number }> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  if (!branchExists(branchSummary.all, baseBranch) || !branchExists(branchSummary.all, headBranch)) {
    return { ahead: 0, behind: 0 };
  }

  const baseRef = resolveBranchRef(branchSummary.all, baseBranch);
  const headRef = resolveBranchRef(branchSummary.all, headBranch);
  const output = await git.raw(['rev-list', '--left-right', '--count', `${baseRef}...${headRef}`]);
  const [behindRaw, aheadRaw] = output.trim().split(/\s+/);

  return {
    behind: Number.parseInt(behindRaw || '0', 10),
    ahead: Number.parseInt(aheadRaw || '0', 10),
  };
}

export async function getMergeBaseWorkflow(
  git: SimpleGit,
  leftBranch: string,
  rightBranch: string,
): Promise<string | null> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  if (!branchExists(branchSummary.all, leftBranch) || !branchExists(branchSummary.all, rightBranch)) {
    return null;
  }

  const leftRef = resolveBranchRef(branchSummary.all, leftBranch);
  const rightRef = resolveBranchRef(branchSummary.all, rightBranch);

  try {
    const output = await git.raw(['merge-base', leftRef, rightRef]);
    return output.trim() || null;
  } catch {
    return null;
  }
}

export async function getBranchDiffSummaryWorkflow(
  git: SimpleGit,
  baseBranch: string,
  headBranch: string,
  limit = 200,
): Promise<{ files: string[]; total: number }> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  if (!branchExists(branchSummary.all, baseBranch) || !branchExists(branchSummary.all, headBranch)) {
    return { files: [], total: 0 };
  }

  const baseRef = resolveBranchRef(branchSummary.all, baseBranch);
  const headRef = resolveBranchRef(branchSummary.all, headBranch);
  const output = await git.raw(['diff', '--name-only', `${baseRef}...${headRef}`]);
  const allFiles = output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);

  return {
    files: allFiles.slice(0, limit),
    total: allFiles.length,
  };
}
