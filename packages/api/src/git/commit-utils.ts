import type { SimpleGit } from 'simple-git';
import type { CommitOptions } from './types';

export function toCommitAuthorOption(commitOptions: CommitOptions): { '--author': string } {
  return {
    '--author': `${commitOptions.author.name} <${commitOptions.author.email}>`,
  };
}

export async function hasGitRemotes(git: SimpleGit): Promise<boolean> {
  const remotes = await git.getRemotes();
  return remotes.length > 0;
}

export function hasTrackedStatusChanges(status: {
  created: string[];
  deleted: string[];
  modified: string[];
  renamed: unknown[];
  staged: string[];
}): boolean {
  return (
    status.created.length > 0 ||
    status.deleted.length > 0 ||
    status.modified.length > 0 ||
    status.renamed.length > 0 ||
    status.staged.length > 0
  );
}
