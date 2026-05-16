import * as fs from 'fs/promises';
import { Mutex } from 'async-mutex';
import simpleGit, { type SimpleGit } from 'simple-git';
import { prisma } from '../lib/prisma';
import { ensureClonedWorkflow } from './repository-workflows';
import { getWorkspacePath } from './workspace-utils';

type GitProjectConfig = {
  defaultBranch: string | null;
  repoUrl: string | null;
  gitConfig: {
    encryptedToken: string | null;
  } | null;
};

export type GitRuntimeState = {
  gitInstances: Map<string, SimpleGit>;
  locks: Map<string, Mutex>;
};

export function createGitRuntimeState(): GitRuntimeState {
  return {
    gitInstances: new Map(),
    locks: new Map(),
  };
}

export async function getProjectForGit(projectId: string): Promise<GitProjectConfig> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      defaultBranch: true,
      repoUrl: true,
      gitConfig: {
        select: {
          encryptedToken: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

export async function getProjectBranchSettings(projectId: string): Promise<{ defaultBranch: string }> {
  const project = await getProjectForGit(projectId);

  return {
    defaultBranch: project.defaultBranch || 'main',
  };
}

function getProjectLock(state: GitRuntimeState, projectId: string): Mutex {
  if (!state.locks.has(projectId)) {
    state.locks.set(projectId, new Mutex());
  }

  return state.locks.get(projectId)!;
}

export async function withProjectLock<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return getProjectLock(state, projectId).runExclusive(fn);
}

export async function getProjectGit(state: GitRuntimeState, projectId: string): Promise<SimpleGit> {
  if (state.gitInstances.has(projectId)) {
    return state.gitInstances.get(projectId)!;
  }

  const workspacePath = getWorkspacePath(projectId);
  await fs.mkdir(workspacePath, { recursive: true });

  const git = simpleGit(workspacePath);
  state.gitInstances.set(projectId, git);

  return git;
}

export async function ensureProjectCloned(state: GitRuntimeState, projectId: string): Promise<void> {
  const workspacePath = getWorkspacePath(projectId);
  const git = await getProjectGit(state, projectId);
  const project = await getProjectForGit(projectId);
  await ensureClonedWorkflow(git, workspacePath, project);
}

export async function withProjectGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit) => Promise<T>,
): Promise<T> {
  return fn(await getProjectGit(state, projectId));
}

export async function withProjectWorkspaceGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit, workspacePath: string) => Promise<T>,
): Promise<T> {
  return withProjectGit(state, projectId, (git) => fn(git, getWorkspacePath(projectId)));
}

export async function withPreparedGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit) => Promise<T>,
): Promise<T> {
  await ensureProjectCloned(state, projectId);
  return withProjectGit(state, projectId, fn);
}

export async function withPreparedWorkspaceGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit, workspacePath: string) => Promise<T>,
): Promise<T> {
  return withPreparedGit(state, projectId, (git) => fn(git, getWorkspacePath(projectId)));
}

export async function withLockedProjectGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit) => Promise<T>,
): Promise<T> {
  return withProjectLock(state, projectId, () => withProjectGit(state, projectId, fn));
}

export async function withLockedPreparedGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit) => Promise<T>,
): Promise<T> {
  return withProjectLock(state, projectId, () => withPreparedGit(state, projectId, fn));
}

export async function withLockedPreparedWorkspaceGit<T>(
  state: GitRuntimeState,
  projectId: string,
  fn: (git: SimpleGit, workspacePath: string) => Promise<T>,
): Promise<T> {
  return withProjectLock(state, projectId, async () => {
    await ensureProjectCloned(state, projectId);
    return withProjectWorkspaceGit(state, projectId, fn);
  });
}

export function clearProjectGitRuntime(state: GitRuntimeState, projectId: string): void {
  state.gitInstances.delete(projectId);
}
