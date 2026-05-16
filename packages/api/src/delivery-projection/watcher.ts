import fs from 'fs';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { GitService } from '../git/service';
import { apiServices } from '../lib/api-services';
import { DeliveryProjectionService } from './service';

const watchers = new Map<string, fs.FSWatcher>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

function watchKey(projectId: string, branch: string): string {
  return `${projectId}:${branch || 'main'}`;
}

function scheduleProjection(projectId: string, repoUrl: string, branch: string): void {
  const key = watchKey(projectId, branch);
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    debounceTimers.delete(key);
    apiServices.runBackgroundTask(
      'delivery-projection-watch',
      new DeliveryProjectionService({
        projectId,
        repoUrl,
        branch,
      }).reconcile(),
    );
  }, 750);
  timer.unref();
  debounceTimers.set(key, timer);
}

export async function startDeliveryProjectionWatchers(): Promise<void> {
  if (process.env.ENABLE_DELIVERY_PROJECTION_WATCHER !== 'true') {
    return;
  }

  const gitService = new GitService();
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      repoUrl: true,
      defaultBranch: true,
    },
  });

  for (const project of projects) {
    const key = watchKey(project.id, project.defaultBranch);
    if (watchers.has(key)) continue;

    const workspaceDir = gitService.getWorkspaceDir(project.id);
    const target = workspaceDir;

    try {
      const watcher = fs.watch(target, { recursive: true }, (_eventType, filename) => {
        const relative = typeof filename === 'string' ? filename.replace(/\\/g, '/') : '';
        if (
          relative.startsWith('content/')
          || relative.startsWith('schemas/')
          || relative.startsWith('oricms/')
        ) {
          scheduleProjection(project.id, project.repoUrl ?? '', project.defaultBranch);
        }
      });

      watchers.set(key, watcher);
      logger.info({ msg: 'Delivery projection watcher started', projectId: project.id, branch: project.defaultBranch, target });
    } catch (error) {
      logger.warn({
        msg: 'Delivery projection watcher unavailable',
        projectId: project.id,
        branch: project.defaultBranch,
        target,
        error,
      });
    }
  }
}

export function stopDeliveryProjectionWatchers(): void {
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();

  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}
