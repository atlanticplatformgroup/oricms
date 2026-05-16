import type { GitBranch, GitCommit, GitFile } from '@ori/shared';
import {
  applyConflictResolutionsWorkflow,
  compareBranchesWorkflow,
  createBranchWorkflow,
  deleteBranchWorkflow,
  getBranchDiffSummaryWorkflow,
  getMergeBaseWorkflow,
  promoteBranchWorkflow,
  renameBranchWorkflow,
  switchBranchWorkflow,
} from './branch-workflows';
import { getStatusWorkflow, listBranchesWorkflow } from './metadata-workflows';
import {
  deleteFileWorkflow,
  getCommitDiffWorkflow,
  getFileAtCommitWorkflow,
  getHistoryWorkflow,
  revertCommitWorkflow,
  syncWorkflow,
  writeFileWorkflow,
  writeFilesBatchWorkflow,
} from './repository-workflows';
import {
  createGitRuntimeState,
  ensureProjectCloned,
  getProjectBranchSettings,
  withLockedPreparedGit,
  withLockedPreparedWorkspaceGit,
  withPreparedGit,
  withPreparedWorkspaceGit,
} from './runtime';
import {
  getFileAtBranchWorkflow,
  getFileAtRefWorkflow,
  listFilePathsWorkflow,
  listFilesWorkflow,
  readFileWorkflow,
} from './read-workflows';
import type { CommitOptions, ConflictResolution } from './types';
import { getWorkspacePath } from './workspace-utils';
import {
  applyFileChangesOnBranchOperation,
  checkoutProjectRef,
  cleanupProjectWorkspace,
  cloneOrPullProject,
  commitAndPushProject,
  getCurrentCommitOperation,
  getCurrentRevisionOperation,
  initRepoOperation,
} from './service-operations';

export class GitService {
  private readonly runtime = createGitRuntimeState();

  async initRepo(projectId: string, defaultBranch = 'main'): Promise<void> {
    await initRepoOperation(this.runtime, projectId, defaultBranch);
  }

  async ensureCloned(projectId: string): Promise<void> {
    await ensureProjectCloned(this.runtime, projectId);
  }

  async getStatus(projectId: string): Promise<{
    ahead: number;
    behind: number;
    modified: string[];
    staged: string[];
  }> {
    return withPreparedGit(this.runtime, projectId, getStatusWorkflow);
  }

  async listBranches(projectId: string): Promise<GitBranch[]> {
    const { defaultBranch } = await getProjectBranchSettings(projectId);
    return withPreparedGit(this.runtime, projectId, (git) => listBranchesWorkflow(git, defaultBranch));
  }

  async createBranch(projectId: string, branchName: string, fromBranch?: string): Promise<void> {
    await withLockedPreparedGit(this.runtime, projectId, (git) => createBranchWorkflow(git, branchName, fromBranch));
  }

  async renameBranch(projectId: string, branchName: string, nextBranchName: string): Promise<void> {
    const { defaultBranch } = await getProjectBranchSettings(projectId);
    await withLockedPreparedGit(this.runtime, projectId, (git) =>
      renameBranchWorkflow(git, branchName, nextBranchName, defaultBranch),
    );
  }

  async deleteBranch(projectId: string, branchName: string): Promise<void> {
    const { defaultBranch } = await getProjectBranchSettings(projectId);
    await withLockedPreparedGit(this.runtime, projectId, (git) => deleteBranchWorkflow(git, branchName, defaultBranch));
  }

  async switchBranch(projectId: string, branchName: string): Promise<void> {
    await withLockedPreparedGit(this.runtime, projectId, (git) => switchBranchWorkflow(git, branchName));
  }

  async compareBranches(projectId: string, baseBranch: string, headBranch: string): Promise<{ ahead: number; behind: number }> {
    return withPreparedGit(this.runtime, projectId, (git) => compareBranchesWorkflow(git, baseBranch, headBranch));
  }

  async getMergeBase(projectId: string, leftBranch: string, rightBranch: string): Promise<string | null> {
    return withPreparedGit(this.runtime, projectId, (git) => getMergeBaseWorkflow(git, leftBranch, rightBranch));
  }

  async getFileAtRef(projectId: string, ref: string, filePath: string): Promise<string | null> {
    return withPreparedGit(this.runtime, projectId, (git) => getFileAtRefWorkflow(git, ref, filePath));
  }

  async getFileAtBranch(projectId: string, branch: string, filePath: string): Promise<string | null> {
    return withPreparedGit(this.runtime, projectId, (git) => getFileAtBranchWorkflow(git, branch, filePath));
  }

  async applyConflictResolutions(
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    resolutions: ConflictResolution[],
    commitOptions: CommitOptions
  ): Promise<{ committedFiles: string[] }> {
    return withLockedPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      applyConflictResolutionsWorkflow(git, workspacePath, sourceBranch, targetBranch, resolutions, commitOptions),
    );
  }

  async getBranchDiffSummary(
    projectId: string,
    baseBranch: string,
    headBranch: string,
    limit = 200
  ): Promise<{ files: string[]; total: number }> {
    return withPreparedGit(this.runtime, projectId, (git) => getBranchDiffSummaryWorkflow(git, baseBranch, headBranch, limit));
  }

  async promoteBranch(
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    commitOptions: CommitOptions
  ): Promise<{ hash: string; message: string }> {
    return withLockedPreparedGit(this.runtime, projectId, (git) =>
      promoteBranchWorkflow(git, sourceBranch, targetBranch, commitOptions),
    );
  }

  async listFiles(projectId: string, dirPath: string, branch?: string, recursive = false): Promise<GitFile[]> {
    return withPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      listFilesWorkflow(git, workspacePath, dirPath, recursive, branch),
    );
  }

  async listFilePaths(projectId: string, dirPath: string, branch?: string): Promise<string[]> {
    return withPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      listFilePathsWorkflow(git, workspacePath, dirPath, branch),
    );
  }

  async readFile(projectId: string, filePath: string, branch?: string): Promise<string | null> {
    return withPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      readFileWorkflow(git, workspacePath, filePath, branch),
    );
  }

  async writeFile(
    projectId: string,
    filePath: string,
    content: string,
    commitOptions: CommitOptions
  ): Promise<void> {
    await withLockedPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      writeFileWorkflow(git, workspacePath, filePath, content, commitOptions),
    );
  }

  async deleteFile(
    projectId: string,
    filePath: string,
    commitOptions: CommitOptions
  ): Promise<void> {
    await withLockedPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      deleteFileWorkflow(git, workspacePath, filePath, commitOptions),
    );
  }

  async writeFilesBatch(
    projectId: string,
    files: Array<{
      path: string;
      content: string | Buffer;
      action: 'create' | 'update' | 'delete';
    }>,
    commitOptions: CommitOptions
  ): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
    return withLockedPreparedWorkspaceGit(this.runtime, projectId, (git, workspacePath) =>
      writeFilesBatchWorkflow(git, workspacePath, files, commitOptions),
    );
  }

  async getHistory(projectId: string, limit: number = 20, path?: string, branch?: string): Promise<GitCommit[]> {
    return withPreparedGit(this.runtime, projectId, (git) => getHistoryWorkflow(git, limit, path, branch));
  }

  async getCommitDiff(projectId: string, commitHash: string, path: string): Promise<string> {
    return withPreparedGit(this.runtime, projectId, (git) => getCommitDiffWorkflow(git, commitHash, path));
  }

  async getFileAtCommit(projectId: string, commitHash: string, filePath: string): Promise<string | null> {
    return withPreparedGit(this.runtime, projectId, (git) => getFileAtCommitWorkflow(git, commitHash, filePath));
  }

  async sync(projectId: string): Promise<void> {
    await withLockedPreparedGit(this.runtime, projectId, syncWorkflow);
  }

  async revertCommit(
    projectId: string,
    commitHash: string,
    _commitOptions: CommitOptions
  ): Promise<{ hash: string; message: string }> {
    return withLockedPreparedGit(this.runtime, projectId, (git) => revertCommitWorkflow(git, commitHash));
  }

  /**
   * Clean up workspace for a project
   */
  async cleanup(projectId: string): Promise<void> {
    await cleanupProjectWorkspace(this.runtime, projectId);
  }

  public getWorkspaceDir(projectId: string): string {
    return getWorkspacePath(projectId);
  }

  async cloneOrPull(projectId: string, repoUrl: string, branch: string = 'main'): Promise<void> {
    await cloneOrPullProject(this.runtime, projectId, repoUrl, branch);
  }

  async checkoutRef(projectId: string, ref: string): Promise<void> {
    await checkoutProjectRef(this.runtime, projectId, ref);
  }

  async getCurrentCommit(projectId: string): Promise<{
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    email: string;
    date: string;
    branch: string;
  }> {
    return getCurrentCommitOperation(this.runtime, projectId);
  }

  async getCurrentRevision(projectId: string): Promise<string> {
    return getCurrentRevisionOperation(this.runtime, projectId);
  }

  /**
   * Commit and push files
   */
  async commitAndPush(
    projectId: string,
    files: string[],
    message: string,
    author?: { name: string; email: string },
    force = false
  ): Promise<void> {
    await commitAndPushProject(this.runtime, projectId, files, message, author, force);
  }

  async applyFileChangesOnBranch(
    projectId: string,
    branch: string,
    changes: Array<{ path: string; content: string | null }>,
    commitOptions: CommitOptions,
  ): Promise<{ committed: boolean; hash: string; message: string }> {
    return applyFileChangesOnBranchOperation(this.runtime, projectId, branch, changes, commitOptions);
  }
}
