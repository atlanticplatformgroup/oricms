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
  private static isWarming = false;

  /**
   * Warm up all active projects in the background
   */
  static async warmAll(): Promise<void> {
    if (this.isWarming) return;
    this.isWarming = true;

    logger.info({ msg: 'Starting collection warming for active projects' });
    const startTime = Date.now();

    try {
      // Find projects that have been active recently (e.g., created or updated in last 30 days)
      // or just all projects for now if the count is small.
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          repoUrl: true,
          defaultBranch: true,
        }
      });

      logger.info({ msg: 'Loaded projects for collection warming', projectCount: projects.length });

      // Process projects in parallel with a concurrency limit
      const limit = 5;
      for (let i = 0; i < projects.length; i += limit) {
        const chunk = projects.slice(i, i + limit);
        await Promise.all(chunk.map(project => this.warmProject(project)));
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info({ msg: 'Finished collection warming', projectCount: projects.length, durationSeconds: duration });
    } catch (error) {
      logger.error({ msg: 'Collection warming failed', error });
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm up a single project
   */
  static async warmProject(project: { id: string; name: string; repoUrl?: string | null; defaultBranch: string }): Promise<void> {
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
      
      // Eagerly index the first few collections if any
      // We don't need to load every single record for every collection if there are many,
      // but listCollections + init already does the heavy lifting of Git cloning.
      if (collections.length > 0) {
        // Just triggering listCollections and init is 90% of the work.
        // We'll index the first one just to be sure.
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
    }
  }
}
