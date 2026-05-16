import type {
  ProjectRole,
  ResourceCollectionDetail,
  ResourceRecordDetail,
  ResourceRecordSummary,
  ResourceSchemaDefinition,
} from '@ori/shared';
import { prisma } from '../lib/prisma';
import { CollectionService } from '../collections/service';
import { GitAssetService } from '../assets/service';
import { GitService } from '../git/service';
import {
  getContentRecord,
  getContentResourceSchema,
  listContentRecords,
  listContentResourceCollections,
} from './content-resources';
import {
  listSystemResourceCollections,
  type ResourceProjectRecord,
  type SystemResourceContext,
} from './system-resources';
import { getSystemRecord, listSystemRecords } from './system-resource-records';
import { getSystemResourceSchema } from './system-resource-schemas';

export {
  createResourceCollectionLink,
  getContentCollectionIdFromResource,
  getContentResourceCollectionId,
  RESOURCE_COLLECTION_IDS,
} from './system-resources';

export class ResourceService {
  private collectionService: CollectionService | null = null;
  private readonly assetService: GitAssetService;
  private readonly gitService: GitService;

  constructor(
    private readonly projectId: string,
    private readonly role: ProjectRole,
  ) {
    this.assetService = new GitAssetService();
    this.gitService = new GitService();
  }

  private async getProject(): Promise<ResourceProjectRecord> {
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: {
        id: true,
        name: true,
        repoUrl: true,
        defaultBranch: true,
        settings: true,
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return project;
  }

  private async getWorkspacePath(project: Awaited<ReturnType<ResourceService['getProject']>>) {
    await this.gitService.ensureCloned(this.projectId);
    if (project.repoUrl) {
      await this.gitService.cloneOrPull(this.projectId, project.repoUrl, project.defaultBranch);
    }
    return this.gitService.getWorkspaceDir(this.projectId);
  }

  private async getCollectionService(project: Awaited<ReturnType<ResourceService['getProject']>>) {
    if (!this.collectionService) {
      this.collectionService = new CollectionService({
        projectId: this.projectId,
        branch: project.defaultBranch,
      });
      await this.collectionService.init();
    }

    return this.collectionService;
  }

  private async getSystemContext(project: ResourceProjectRecord): Promise<SystemResourceContext> {
    return {
      projectId: this.projectId,
      role: this.role,
      project,
      workspacePath: await this.getWorkspacePath(project),
      assetService: this.assetService,
    };
  }

  async listResourceCollections(): Promise<ResourceCollectionDetail[]> {
    const project = await this.getProject();
    const collectionService = await this.getCollectionService(project);
    const contentCollections = await listContentResourceCollections(collectionService, this.role);

    return [
      ...contentCollections,
      ...(await listSystemResourceCollections(await this.getSystemContext(project))),
    ];
  }

  async getResourceCollection(resourceCollectionId: string): Promise<ResourceCollectionDetail | null> {
    const resources = await this.listResourceCollections();
    return resources.find((resource) => resource.id === resourceCollectionId) ?? null;
  }

  async getResourceSchema(resourceCollectionId: string): Promise<ResourceSchemaDefinition | null> {
    const detail = await this.getResourceCollection(resourceCollectionId);
    if (!detail?.schemaId) {
      return null;
    }

    const project = await this.getProject();
    const systemSchema = await getSystemResourceSchema(await this.getSystemContext(project), resourceCollectionId);
    if (systemSchema) {
      return systemSchema;
    }

    const collectionService = await this.getCollectionService(project);
    return getContentResourceSchema(collectionService, resourceCollectionId);
  }

  async listRecords(
    resourceCollectionId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ records: ResourceRecordSummary[]; total: number }> {
    const project = await this.getProject();
    const collectionService = await this.getCollectionService(project);
    const contentRecords = await listContentRecords(collectionService, resourceCollectionId, options);
    if (contentRecords) {
      return {
        records: contentRecords.records,
        total: contentRecords.total,
      };
    }

    const systemRecords = await listSystemRecords(
      await this.getSystemContext(project),
      resourceCollectionId,
      options,
    );
    if (systemRecords) {
      return systemRecords;
    }

    throw new Error('RESOURCE_NOT_FOUND');
  }

  async getRecord(resourceCollectionId: string, recordId: string): Promise<ResourceRecordDetail | null> {
    const project = await this.getProject();
    const collectionService = await this.getCollectionService(project);
    const contentRecord = await getContentRecord(collectionService, resourceCollectionId, recordId);
    if (contentRecord) {
      return contentRecord;
    }
    return getSystemRecord(await this.getSystemContext(project), resourceCollectionId, recordId);
  }
}
