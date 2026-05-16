export function normalizeBranchName(branchName: string): string {
  return branchName.replace(/^remotes\/origin\//, '').replace(/^origin\//, '').trim();
}

export function isProtectedBranchName(branchName: string, defaultBranch: string): boolean {
  const normalized = normalizeBranchName(branchName);
  return normalized === defaultBranch || normalized === 'main' || normalized === 'master';
}

export function assertBranchMutationAllowed(
  branchName: string,
  currentBranch: string,
  defaultBranch: string,
  operation: 'rename' | 'delete',
): void {
  const normalized = normalizeBranchName(branchName);
  const normalizedCurrent = normalizeBranchName(currentBranch);
  const verb = operation === 'rename' ? 'renamed' : 'deleted';

  if (normalized === normalizedCurrent) {
    throw new Error(`You cannot ${operation} the current branch`);
  }

  if (normalized === defaultBranch) {
    throw new Error(`Default branches cannot be ${verb}`);
  }

  if (isProtectedBranchName(normalized, defaultBranch)) {
    throw new Error(`Protected branches cannot be ${verb}`);
  }
}

export function resolveBranchRef(branches: string[], branchName: string): string {
  const normalizedName = normalizeBranchName(branchName);
  if (branches.includes(normalizedName)) return normalizedName;
  const remoteRef = `remotes/origin/${normalizedName}`;
  if (branches.includes(remoteRef)) return `origin/${normalizedName}`;
  return normalizedName;
}

export function branchExists(branches: string[], branchName: string): boolean {
  const normalizedName = normalizeBranchName(branchName);
  return branches.includes(normalizedName) || branches.includes(`remotes/origin/${normalizedName}`);
}
