import { logger } from '../middleware/logger';
import { GitService } from '../git/service';
import type { CollectionProject } from './collection-repository-types';

export class CollectionWorkspaceThrottle {
  private readonly lastPullMap = new Map<string, number>();

  constructor(private readonly pullThrottleMs = 30000) {}

  async syncProjectWorkspace(
    gitService: GitService,
    projectId: string,
    branch: string,
    project: CollectionProject,
  ): Promise<string> {
    const workspacePath = gitService.getWorkspaceDir(projectId);
    await gitService.ensureCloned(projectId);

    const cacheKey = `${projectId}:${branch || 'main'}`;
    const lastPull = this.lastPullMap.get(cacheKey) || 0;
    const now = Date.now();

    if (project.repoUrl && now - lastPull > this.pullThrottleMs) {
      logger.info({
        msg: 'Collection service syncing repository',
        projectId,
        branch: branch || project.defaultBranch,
      });
      await gitService.cloneOrPull(projectId, project.repoUrl, branch || project.defaultBranch);
      this.lastPullMap.set(cacheKey, now);
    }

    return workspacePath;
  }
}
