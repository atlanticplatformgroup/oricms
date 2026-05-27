import type { SimpleGit } from 'simple-git';
import { resolveBranchRef } from './branch-utils';
import {
  listWorkspaceFilePaths,
  listWorkspaceFiles,
  readWorkspaceFile,
} from './workspace-utils';

export async function checkoutBranchIfProvided(git: SimpleGit, branch?: string): Promise<void> {
  if (branch) {
    await git.checkout(branch);
  }
}

export async function getFileAtRefWorkflow(
  git: SimpleGit,
  ref: string,
  filePath: string,
): Promise<string | null> {
  try {
    return await git.show([`${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

export async function getFileAtBranchWorkflow(
  git: SimpleGit,
  branch: string,
  filePath: string,
): Promise<string | null> {
  await git.fetch(['--all']);
  const branchSummary = await git.branch(['-a']);
  const ref = resolveBranchRef(branchSummary.all, branch);
  return getFileAtRefWorkflow(git, ref, filePath);
}

export async function listFilesWorkflow(
  git: SimpleGit,
  workspacePath: string,
  dirPath: string,
  recursive = false,
  branch?: string,
) {
  await checkoutBranchIfProvided(git, branch);
  return listWorkspaceFiles(workspacePath, dirPath, recursive);
}

export async function listFilePathsWorkflow(
  git: SimpleGit,
  workspacePath: string,
  dirPath: string,
  branch?: string,
): Promise<string[]> {
  await checkoutBranchIfProvided(git, branch);
  return listWorkspaceFilePaths(workspacePath, dirPath);
}

export async function readFileWorkflow(
  git: SimpleGit,
  workspacePath: string,
  filePath: string,
  branch?: string,
): Promise<string | null> {
  await checkoutBranchIfProvided(git, branch);
  return readWorkspaceFile(workspacePath, filePath);
}
