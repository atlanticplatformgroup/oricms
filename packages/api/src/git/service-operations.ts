import * as fs from 'fs/promises';
import { applyFileChangesOnBranchWorkflow } from './branch-workflows';
import type { GitRuntimeState } from './runtime';
import {
  clearProjectGitRuntime,
  getProjectForGit,
  getProjectGit,
  withLockedPreparedWorkspaceGit,
  withLockedProjectGit,
  withProjectGit,
  withProjectLock,
  withPreparedGit,
} from './runtime';
import {
  cloneOrPullWorkflow,
  commitAndPushWorkflow,
  getCurrentCommitWorkflow,
  initializeManagedLocalRepo,
} from './repository-workflows';
import type { CommitOptions } from './types';
import { getWorkspacePath } from './workspace-utils';

export async function initRepoOperation(
  runtime: GitRuntimeState,
  projectId: string,
  defaultBranch: string,
): Promise<void> {
  await withProjectLock(runtime, projectId, async () => {
    const workspacePath = getWorkspacePath(projectId);
    const git = await getProjectGit(runtime, projectId);
    await initializeManagedLocalRepo(git, workspacePath, defaultBranch);
  });
}

export async function cleanupProjectWorkspace(
  runtime: GitRuntimeState,
  projectId: string,
): Promise<void> {
  const workspacePath = getWorkspacePath(projectId);

  clearProjectGitRuntime(runtime, projectId);

  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors.
  }
}

export async function cloneOrPullProject(
  runtime: GitRuntimeState,
  projectId: string,
  repoUrl: string,
  branch: string,
): Promise<void> {
  await withProjectLock(runtime, projectId, async () => {
    const workspacePath = getWorkspacePath(projectId);
    const git = await getProjectGit(runtime, projectId);
    const project = await getProjectForGit(projectId);
    await cloneOrPullWorkflow(git, workspacePath, repoUrl, branch, project?.gitConfig?.encryptedToken);
  });
}

export async function checkoutProjectRef(
  runtime: GitRuntimeState,
  projectId: string,
  ref: string,
): Promise<void> {
  await withProjectGit(runtime, projectId, (git) => git.checkout(ref));
}

export async function getCurrentCommitOperation(
  runtime: GitRuntimeState,
  projectId: string,
) {
  return withProjectGit(runtime, projectId, getCurrentCommitWorkflow);
}

export async function getCurrentRevisionOperation(
  runtime: GitRuntimeState,
  projectId: string,
): Promise<string> {
  return withPreparedGit(runtime, projectId, (git) => git.revparse(['HEAD']));
}

export async function commitAndPushProject(
  runtime: GitRuntimeState,
  projectId: string,
  files: string[],
  message: string,
  author?: { name: string; email: string },
  force = false,
): Promise<void> {
  await withLockedProjectGit(runtime, projectId, async (git) => {
    await commitAndPushWorkflow(git, projectId, files, message, author, force);
  });
}

export async function applyFileChangesOnBranchOperation(
  runtime: GitRuntimeState,
  projectId: string,
  branch: string,
  changes: Array<{ path: string; content: string | null }>,
  commitOptions: CommitOptions,
): Promise<{ committed: boolean; hash: string; message: string }> {
  return withLockedPreparedWorkspaceGit(runtime, projectId, (git, workspacePath) =>
    applyFileChangesOnBranchWorkflow(git, workspacePath, branch, changes, commitOptions),
  );
}
