import type { Prisma } from '@prisma/client';
import type { CollectionEntry, CollectionQuery, CollectionQueryResult } from '@ori/shared';
import { logger } from '../middleware/logger';
import { CollectionService, type CollectionServiceOptions } from '../collections/service';
import {
  buildProjectedRecordInput,
  isProjectedEntryPublished,
  projectionKey,
  type ProjectionSnapshot,
} from './service-support';
import {
  createProjectionRepoService,
  getProjectionCollectionContentType,
  loadAllProjectionEntries,
} from './repo-service';
import { getProjectedRecord, listProjectedRecords } from './read-operations';
import {
  findProjectionState,
  recordProjectionFailure,
  replaceProjectionRecords,
  toProjectionSnapshot,
} from './store';

const inFlightProjectionMap = new Map<string, Promise<ProjectionSnapshot>>();

export class DeliveryProjectionService {
  private readonly projectId: string;
  private readonly branch: string;
  private readonly repoUrl: string;

  constructor(options: CollectionServiceOptions) {
    this.projectId = options.projectId;
    this.branch = options.branch || 'main';
    this.repoUrl = options.repoUrl ?? '';
  }

  async ensureCurrent(): Promise<ProjectionSnapshot> {
    const state = await findProjectionState(this.projectId, this.branch);

    const repoService = await this.createRepoService();
    const revision = await repoService.getCurrentRevision();
    if (state && state.revision === revision && !state.lastError) {
      return toProjectionSnapshot(state);
    }

    return this.projectRevision(repoService, revision);
  }

  async reconcile(): Promise<ProjectionSnapshot> {
    const repoService = await this.createRepoService();
    const revision = await repoService.getCurrentRevision();
    return this.projectRevision(repoService, revision);
  }

  async listRecords(collectionId: string, query: CollectionQuery = {}): Promise<CollectionQueryResult> {
    await this.ensureCurrent();
    const repoService = await this.createRepoService();
    const contentType = await getProjectionCollectionContentType(repoService, collectionId);
    return listProjectedRecords({
      projectId: this.projectId,
      branch: this.branch,
      collectionId,
      query,
      contentType,
      repoService,
      getRecord: (targetCollectionId, entryId) => this.getRecord(targetCollectionId, entryId),
    });
  }

  async getRecord(collectionId: string, entryId: string, populate?: string | string[]): Promise<CollectionEntry | null> {
    await this.ensureCurrent();
    const repoService = populate ? await this.createRepoService() : undefined;
    return getProjectedRecord({
      projectId: this.projectId,
      branch: this.branch,
      collectionId,
      entryId,
      populate,
      repoService,
      getRecord: (targetCollectionId, relatedEntryId) => this.getRecord(targetCollectionId, relatedEntryId),
    });
  }

  private async projectRevision(
    repoService: CollectionService,
    revision: string,
  ): Promise<ProjectionSnapshot> {
    const key = projectionKey(this.projectId, this.branch);
    const inFlight = inFlightProjectionMap.get(key);
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      const startedAt = new Date();
      try {
        const records = await this.buildProjectedRecords(repoService, startedAt);
        await replaceProjectionRecords({
          projectId: this.projectId,
          branch: this.branch,
          revision,
          records,
          startedAt,
        });

        logger.info({
          msg: 'Delivery projection reconciled',
          projectId: this.projectId,
          branch: this.branch,
          revision,
          recordCount: records.length,
        });

        return {
          projectId: this.projectId,
          branch: this.branch,
          revision,
          recordCount: records.length,
          lastProjectedAt: startedAt,
        } satisfies ProjectionSnapshot;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Delivery projection failed';
        await recordProjectionFailure({
          projectId: this.projectId,
          branch: this.branch,
          revision,
          startedAt,
          message,
        });

        logger.error({
          msg: 'Delivery projection failed',
          projectId: this.projectId,
          branch: this.branch,
          revision,
          error,
        });
        throw error;
      }
    })().finally(() => {
      inFlightProjectionMap.delete(key);
    });

    inFlightProjectionMap.set(key, promise);
    return promise;
  }

  private async buildProjectedRecords(repoService: CollectionService, projectedAt: Date): Promise<Prisma.DeliveryProjectionRecordCreateManyInput[]> {
    const collections = await repoService.listCollections();
    const nowIso = new Date().toISOString();
    const records: Prisma.DeliveryProjectionRecordCreateManyInput[] = [];

    for (const collection of collections) {
      const entries = await loadAllProjectionEntries(repoService, collection.id);
      for (const entry of entries) {
        if (!isProjectedEntryPublished(entry as Record<string, unknown>, nowIso)) continue;

        records.push(
          buildProjectedRecordInput({
            projectId: this.projectId,
            branch: this.branch,
            collectionId: collection.id,
            contentType: collection.contentType,
            entry,
            projectedAt,
          }),
        );
      }
    }

    return records;
  }

  private async createRepoService(): Promise<CollectionService> {
    return createProjectionRepoService({
      projectId: this.projectId,
      repoUrl: this.repoUrl,
      branch: this.branch,
    });
  }
}
