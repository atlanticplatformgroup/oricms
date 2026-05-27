import type { GitBranch } from '@ori/shared';
import type { SimpleGit } from 'simple-git';
import { isProtectedBranchName, normalizeBranchName } from './branch-utils';

export async function getStatusWorkflow(git: SimpleGit): Promise<{
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
}> {
  const status = await git.status();

  return {
    ahead: status.ahead,
    behind: status.behind,
    modified: status.modified,
    staged: status.staged,
  };
}

export async function listBranchesWorkflow(
  git: SimpleGit,
  defaultBranch: string,
): Promise<GitBranch[]> {
  const branches = await git.branch(['-a']);
  const currentBranch = normalizeBranchName(branches.current);
  const seen = new Set<string>();

  return branches.all.reduce<GitBranch[]>((items, name) => {
    const normalizedName = normalizeBranchName(name);
    if (!normalizedName || seen.has(normalizedName)) {
      return items;
    }

    seen.add(normalizedName);
    items.push({
      name: normalizedName,
      isCurrent: normalizedName === currentBranch,
      isDefault: normalizedName === defaultBranch,
      isProtected: isProtectedBranchName(normalizedName, defaultBranch),
      lastCommit: {
        hash: '',
        message: '',
        author: '',
        date: '',
      },
    });

    return items;
  }, []).sort((left, right) => left.name.localeCompare(right.name));
}
