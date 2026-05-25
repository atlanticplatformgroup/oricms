/**
 * Warming Service - Eagerly indexes project content on startup
 * 
 * This service ensures that Git repositories are cloned and content 
 * is parsed into memory before the first request arrives.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { CollectionService } from './service';

export class WarmingService {
  private static warmingProjects = new Map<string, number>();
  private static readonly WARMING_TIMEOUT_MS = 5 * 60 * 1000;

  private static isProjectWarming(projectId: string): boolean {
    const startedAt = this.warmingProjects.get(projectId);
    if (!startedAt) return false;
    if (Date.now() - startedAt > this.WARMING_TIMEOUT_MS) {
      this.warmingProjects.delete(projectId);
      return false;
    }
    return true;
  }

  /**
   * Warm up all active projects in the background
   */
  static async warmAll(): Promise<void> {
    logger.info({ msg: 'Starting collection warming for active projects' });
    const startTime = Date.now();

    try {
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          repoUrl: true,
          defaultBranch: true,
        }
      });

      logger.info({ msg: 'Loaded projects for collection warming', projectCount: projects.length });

      const limit = 5;
      for (let i = 0; i < projects.length; i += limit) {
        const chunk = projects.slice(i, i + limit);
        await Promise.all(chunk.map(project => this.warmProject(project)));
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info({ msg: 'Finished collection warming', projectCount: projects.length, durationSeconds: duration });
    } catch (error) {
      logger.error({ msg: 'Collection warming failed', error });
    }
  }

  /**
   * Warm up a single project
   */
  static async warmProject(project: { id: string; name: string; repoUrl?: string | null; defaultBranch: string }): Promise<void> {
    if (this.isProjectWarming(project.id)) {
      return;
    }
    this.warmingProjects.set(project.id, Date.now());

    try {
      logger.info({ msg: 'Warming project collections', projectId: project.id, projectName: project.name, branch: project.defaultBranch });
      
      const service = new CollectionService({
        projectId: project.id,
        repoUrl: project.repoUrl ?? "",
        branch: project.defaultBranch
      });

      // 1. Ensure cloned and pulled (disk warm)
      await service.init();

      // 2. Load and index all collections (memory warm)
      const collections = await service.listCollections();
      
      if (collections.length > 0) {
        await service.findMany(collections[0].id, { limit: 1 });
      }

    } catch (error) {
      logger.warn({
        msg: 'Failed to warm project collections',
        projectId: project.id,
        projectName: project.name,
        branch: project.defaultBranch,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.warmingProjects.delete(project.id);
    }
  }
}
