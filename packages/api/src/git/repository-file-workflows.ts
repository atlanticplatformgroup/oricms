import * as fs from 'fs/promises';
import * as path from 'path';
import type { SimpleGit } from 'simple-git';
import { logger } from '../middleware/logger';
import { hasGitRemotes, toCommitAuthorOption } from './commit-utils';
import { checkoutBranchIfProvided } from './read-workflows';
import type { CommitOptions } from './types';
import { validateWorkspacePath } from './workspace-utils';

type BatchFile = {
  path: string;
  content: string | Buffer;
  action: 'create' | 'update' | 'delete';
};

function toHistoryEntry(commit: unknown): {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
} {
  const line = commit as {
    hash: string;
    message: string;
    author_name: string;
    author_email: string;
    date: string;
  };

  return {
    hash: line.hash,
    message: line.message,
    author: line.author_name,
    email: line.author_email,
    date: line.date,
  };
}

export async function writeFileWorkflow(
  git: SimpleGit,
  workspacePath: string,
  filePath: string,
  content: string,
  commitOptions: CommitOptions,
): Promise<void> {
  const fullPath = validateWorkspacePath(workspacePath, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
  await git.add(filePath);
  await git.commit(commitOptions.message, toCommitAuthorOption(commitOptions));

  if (await hasGitRemotes(git)) {
    await git.push();
  }
}

export async function deleteFileWorkflow(
  git: SimpleGit,
  workspacePath: string,
  filePath: string,
  commitOptions: CommitOptions,
): Promise<void> {
  const fullPath = validateWorkspacePath(workspacePath, filePath);
  await fs.unlink(fullPath);
  await git.rm(filePath);
  await git.commit(commitOptions.message, toCommitAuthorOption(commitOptions));

  if (await hasGitRemotes(git)) {
    await git.push();
  }
}

export async function writeFilesBatchWorkflow(
  git: SimpleGit,
  workspacePath: string,
  files: BatchFile[],
  commitOptions: CommitOptions,
): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
  const success: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  for (const file of files) {
    try {
      const fullPath = validateWorkspacePath(workspacePath, file.path);

      if (file.action === 'delete') {
        await fs.unlink(fullPath).catch(() => {});
        await git.rm(file.path).catch(() => {});
      } else {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        if (typeof file.content === 'string') {
          await fs.writeFile(fullPath, file.content, 'utf-8');
        } else {
          await fs.writeFile(fullPath, file.content);
        }
        await git.add(file.path);
      }

      success.push(file.path);
    } catch (error) {
      failed.push({
        path: file.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (success.length > 0) {
    try {
      await git.commit(commitOptions.message, toCommitAuthorOption(commitOptions));

      if (await hasGitRemotes(git)) {
        await git.push();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Commit failed';
      for (const successPath of success) {
        failed.push({ path: successPath, error: errorMsg });
      }
      success.length = 0;
    }
  }

  return { success, failed };
}

export async function getHistoryWorkflow(
  git: SimpleGit,
  limit = 20,
  filePath?: string,
  branch?: string,
): Promise<Array<{ hash: string; message: string; author: string; email: string; date: string }>> {
  await checkoutBranchIfProvided(git, branch);

  const options: Parameters<typeof git.log>[0] = { maxCount: limit };
  if (filePath && filePath.trim().length > 0) {
    (options as Record<string, unknown>).file = filePath;
  }

  const log = await git.log(options);
  return log.all.map(toHistoryEntry);
}

export async function getCommitDiffWorkflow(
  git: SimpleGit,
  commitHash: string,
  filePath: string,
): Promise<string> {
  return git.raw(['show', '--format=', commitHash, '--', filePath]);
}

export async function getFileAtCommitWorkflow(
  git: SimpleGit,
  commitHash: string,
  filePath: string,
): Promise<string | null> {
  try {
    return await git.show([`${commitHash}:${filePath}`]);
  } catch {
    return null;
  }
}

export async function getCurrentCommitWorkflow(git: SimpleGit): Promise<{
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  branch: string;
}> {
  const [log, branchSummary] = await Promise.all([
    git.log({ maxCount: 1 }),
    git.branch(),
  ]);

  const commit = log.latest;
  if (!commit) {
    throw new Error('No commits found');
  }

  return {
    hash: commit.hash,
    shortHash: commit.hash.slice(0, 7),
    message: commit.message,
    author: commit.author_name,
    email: commit.author_email,
    date: commit.date,
    branch: branchSummary.current,
  };
}

export async function commitAndPushWorkflow(
  git: SimpleGit,
  projectId: string,
  files: string[],
  message: string,
  author?: { name: string; email: string },
  force = false,
): Promise<void> {
  const branchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  logger.info({ msg: 'Committing repository changes', projectId, branch: currentBranch, fileCount: files.length, force });
  await git.add(files);

  const commitOptions: Record<string, string> = {};
  if (author) {
    commitOptions['--author'] = `${author.name} <${author.email}>`;
  }

  await git.commit(message, commitOptions);

  try {
    if (await hasGitRemotes(git)) {
      logger.info({ msg: 'Pushing repository changes', projectId, branch: currentBranch, remote: 'origin', force });
      await git.push('origin', currentBranch, force ? { '--force': null } : undefined);
    } else {
      logger.info({ msg: 'Skipping push for local-only project', projectId, branch: currentBranch });
    }
  } catch (pushError) {
    logger.error({ msg: 'Push failed', projectId, branch: currentBranch, error: pushError });
    throw pushError;
  }
}
