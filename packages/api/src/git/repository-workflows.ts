import type { SimpleGit } from 'simple-git';
export {
  cloneOrPullWorkflow,
  ensureClonedWorkflow,
  initializeManagedLocalRepo,
} from './repository-clone-workflows';
export {
  commitAndPushWorkflow,
  deleteFileWorkflow,
  getCommitDiffWorkflow,
  getCurrentCommitWorkflow,
  getFileAtCommitWorkflow,
  getHistoryWorkflow,
  writeFileWorkflow,
  writeFilesBatchWorkflow,
} from './repository-file-workflows';

export async function syncWorkflow(git: SimpleGit): Promise<void> {
  await git.pull();
  const status = await git.status();
  if (status.ahead > 0) {
    await git.push();
  }
}

export async function revertCommitWorkflow(
  git: SimpleGit,
  commitHash: string,
): Promise<{ hash: string; message: string }> {
  await git.pull();
  await git.raw(['revert', '--no-edit', commitHash]);
  await git.push();

  const log = await git.log({ maxCount: 1 });
  return {
    hash: log.latest?.hash || '',
    message: log.latest?.message || `Revert ${commitHash}`,
  };
}
