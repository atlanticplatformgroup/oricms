/**
 * Project Config Service - Manages the git-native oricms/config.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../lib/prisma';
import { GitService } from '../git/service';
import { logger } from '../middleware/logger';
import { queueDeliveryProjectionReconcile } from '../delivery-projection/shared';

export interface ProjectConfig {
  name: string;
  description?: string | null;
  settings: {
    contentRoot?: string;
    environments?: Array<{
      id: string;
      name: string;
      url: string;
      type: 'preview' | 'live';
      order?: number;
    }>;
    features?: Record<string, boolean>;
  };
}

export class ProjectConfigService {
  private gitService: GitService;
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.gitService = new GitService();
  }

  private getWorkspaceDir(): string {
    return this.gitService.getWorkspaceDir(this.projectId);
  }

  private async getDefaultBranch(): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: { defaultBranch: true },
    });
    return project?.defaultBranch || 'main';
  }

  private getConfigPath(): string {
    return path.join(this.getWorkspaceDir(), 'oricms', 'config.json');
  }

  /**
   * Load config from Git
   */
  async load(): Promise<ProjectConfig | null> {
    await this.gitService.ensureCloned(this.projectId);
    const configPath = this.getConfigPath();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content) as ProjectConfig;
    } catch {
      return null;
    }
  }

  /**
   * Save config to Git
   */
  async save(
    config: ProjectConfig, 
    author: { name: string; email: string },
    message = 'Update project configuration'
  ): Promise<void> {
    const workspaceDir = this.getWorkspaceDir();
    const oricmsDir = path.join(workspaceDir, 'oricms');
    const configPath = this.getConfigPath();

    // Ensure directory exists
    await fs.mkdir(oricmsDir, { recursive: true });

    // Sanitize config before saving to Git (remove secrets if any leaked in)
    const sanitizedConfig = this.sanitizeForGit(config);
    const content = JSON.stringify(sanitizedConfig, null, 2) + '\n';

    await fs.writeFile(configPath, content);

    // Commit and push
    await this.gitService.commitAndPush(
      this.projectId, 
      ['oricms/config.json'], 
      message, 
      author
    );

    // Sync back to database cache
    await this.syncToDb(sanitizedConfig);

    queueDeliveryProjectionReconcile({
      projectId: this.projectId,
      branch: await this.getDefaultBranch(),
      label: 'delivery-projection:project-config-save',
    });
  }

  /**
   * Remove sensitive fields that should never be in Git
   */
  private sanitizeForGit(config: ProjectConfig): ProjectConfig {
    const next = { ...config };
    if (next.settings?.environments) {
      next.settings.environments = next.settings.environments.map(env => {
        const { ...safeEnv } = env as any;
        // Strip secrets
        delete safeEnv.revalidationSecret;
        delete safeEnv.revalidationSecretEncrypted;
        delete safeEnv.webhookSecret;
        return safeEnv;
      });
    }
    return next;
  }

  /**
   * Update the database cache to match Git truth
   */
  private async syncToDb(config: ProjectConfig): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: { settings: true }
    });

    if (!project) return;

    const currentSettings = (project.settings || {}) as any;
    
    // Merge Git settings into DB settings
    // We preserve DB-only fields like revalidationSecretEncrypted
    const nextSettings = {
      ...currentSettings,
      ...config.settings,
      environments: this.mergeEnvironments(currentSettings.environments || [], config.settings?.environments || [])
    };

    await prisma.project.update({
      where: { id: this.projectId },
      data: {
        name: config.name,
        description: config.description,
        settings: nextSettings
      }
    });
  }

  private mergeEnvironments(dbEnvs: any[], gitEnvs: any[]): any[] {
    return gitEnvs.map(gitEnv => {
      const dbEnv = dbEnvs.find(e => e.id === gitEnv.id);
      return {
        ...gitEnv,
        // Carry over secrets from DB
        revalidationSecretEncrypted: dbEnv?.revalidationSecretEncrypted,
        buildWebhook: gitEnv.buildWebhook || dbEnv?.buildWebhook // Webhooks are safe for git if public, but we prefer keeping them in git if provided
      };
    });
  }

  /**
   * Initial bootstrap: Read git config if it exists and hydrate DB
   */
  async bootstrap(): Promise<void> {
    const config = await this.load();
    if (config) {
      logger.info({ msg: 'Bootstrapping project from git config', projectId: this.projectId });
      await this.syncToDb(config);
      queueDeliveryProjectionReconcile({
        projectId: this.projectId,
        branch: await this.getDefaultBranch(),
        label: 'delivery-projection:project-config-bootstrap',
      });
    }
  }
}
