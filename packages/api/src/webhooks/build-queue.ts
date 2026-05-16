import { prisma } from '../lib/prisma';
import { apiServices } from '../lib/api-services';
import { WarmingService } from '../collections/warming';
import { logger } from '../middleware/logger';
import { triggerMappedEnvironmentActions } from './dispatch';

export async function queueBuildJob(
  buildId: string,
  projectId: string,
  options: { branch: string; commit: string; repoUrl: string },
): Promise<void> {
  setImmediate(async () => {
    const startTime = Date.now();
    try {
      await prisma.build.update({ where: { id: buildId }, data: { status: 'running', startedAt: new Date() } });

      const { GitService } = await import('../git/service');
      const { CollectionService } = await import('../collections/service');
      const gitService = new GitService();
      if (options.repoUrl) {
        await gitService.cloneOrPull(projectId, options.repoUrl, options.branch);
      }
      CollectionService.invalidateIndex(projectId);

      const workspacePath = gitService.getWorkspaceDir(projectId);
      const duration = Date.now() - startTime;
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project) {
        apiServices.runBackgroundTask(
          'warm-project-after-build',
          WarmingService.warmProject({ id: projectId, name: project.name, repoUrl: project.repoUrl ?? "", defaultBranch: options.branch }),
        );
        try {
          const actionResult = await triggerMappedEnvironmentActions(projectId, options.branch, options.commit, 'Manual build trigger', []);
          logger.info({ msg: 'Build environment actions dispatched', buildId, projectId, branch: options.branch, actionResult });
        } catch (dispatchError) {
          logger.error({ msg: 'Build environment actions failed', buildId, projectId, branch: options.branch, error: dispatchError });
        }
      }

      await prisma.build.update({
        where: { id: buildId },
        data: {
          status: 'success',
          completedAt: new Date(),
          duration,
          outputPath: workspacePath,
          logs: `Build completed in ${duration}ms\nBranch: ${options.branch}\nCommit: ${options.commit}`,
        },
      });

      logger.info({ msg: 'Build completed', buildId, projectId, branch: options.branch, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      await prisma.build.update({
        where: { id: buildId },
        data: { status: 'failed', completedAt: new Date(), duration, logs: `Build failed after ${duration}ms\nError: ${errorMsg}` },
      }).catch((updateError) => {
        logger.error({ msg: 'Failed to persist build failure state', buildId, projectId, error: updateError });
      });
      logger.error({ msg: 'Build failed', buildId, projectId, branch: options.branch, duration, error: errorMsg });
    }
  });
}
