import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { decrypt } from '../lib/crypto';
import { logger } from '../middleware/logger';

type RepoCloneConfig = {
  defaultBranch?: string | null;
  repoUrl?: string | null;
  gitConfig?: {
    encryptedToken?: string | null;
  } | null;
};

function addAuthToUrl(repoUrl: string, token: string): string {
  if (repoUrl.startsWith('https://')) {
    return repoUrl.replace('https://', `https://${token}@`);
  }
  return repoUrl;
}

function resolveRemoteUrl(repoUrl: string, encryptedToken?: string | null): string {
  if (!encryptedToken) {
    return repoUrl;
  }

  return addAuthToUrl(repoUrl, decrypt(encryptedToken));
}

async function configureLocalRemote(remoteUrl: string): Promise<void> {
  if (!remoteUrl.startsWith('file://')) {
    return;
  }

  const remotePath = remoteUrl.replace('file://', '');
  try {
    const remoteGit = simpleGit(remotePath);
    await remoteGit.addConfig('receive.denyCurrentBranch', 'ignore');
  } catch (error) {
    logger.warn({ msg: 'Failed to configure local remote repository', remotePath, error });
  }
}

export async function initializeManagedLocalRepo(
  git: SimpleGit,
  workspacePath: string,
  defaultBranch = 'main',
): Promise<void> {
  await fs.mkdir(workspacePath, { recursive: true });
  await git.init();

  try {
    await git.addConfig('init.defaultBranch', defaultBranch);
  } catch {
    // Fallback for older git versions
  }

  const readmePath = path.join(workspacePath, 'README.md');
  await fs.writeFile(readmePath, '# OriCMS Project\n\nManaged local project storage.\n');
  await git.add('README.md');
  await git.commit('Initial commit (OriCMS Setup)', {
    '--author': 'OriCMS <system@oricms.local>',
  });

  const status = await git.status();
  if (status.current !== defaultBranch) {
    await git.branch(['-m', defaultBranch]);
  }
}

export async function ensureClonedWorkflow(
  git: SimpleGit,
  workspacePath: string,
  project: RepoCloneConfig,
): Promise<void> {
  try {
    await fs.access(path.join(workspacePath, '.git'));
    return;
  } catch {
    // Need to clone or initialize
  }

  if (!project.repoUrl) {
    await initializeManagedLocalRepo(git, workspacePath, project.defaultBranch || 'main');
    return;
  }

  const remoteUrl = resolveRemoteUrl(project.repoUrl, project.gitConfig?.encryptedToken);
  await git.clone(remoteUrl, workspacePath, [
    '--branch', project.defaultBranch || 'main',
    '--single-branch',
  ]);

  await configureLocalRemote(remoteUrl);
}

export async function cloneOrPullWorkflow(
  git: SimpleGit,
  workspacePath: string,
  repoUrl: string,
  branch = 'main',
  encryptedToken?: string | null,
): Promise<void> {
  try {
    await fs.access(path.join(workspacePath, '.git'));
    await git.fetch(['origin']);
    await git.checkout(branch);
    await git.pull('origin', branch);
    return;
  } catch {
    // Need to clone
  }

  await fs.mkdir(workspacePath, { recursive: true });
  const remoteUrl = resolveRemoteUrl(repoUrl, encryptedToken);
  await git.clone(remoteUrl, workspacePath, [
    '--branch', branch,
    '--single-branch',
    '--depth', '100',
  ]);

  await configureLocalRemote(remoteUrl);
}
