/**
 * Collections Service - CRUD for collection entries
 * 
 * Collection entries are stored as JSON files in the Git repository at:
 * {project.settings.contentRoot}/{config.path}/{entryId}.json
 */

import type { CollectionEntry, ContentType, CollectionQuery, CollectionQueryResult, CollectionConfig } from '@ori/shared';
import { GitService } from '../git/service';
import {
  type BranchCollectionIndex,
  getCollectionBranchCacheKey,
  getOrBuildCollectionBranchIndex,
} from './collection-index';
import { computeCollectionEntryRevision } from './service-support';
import {
  createCollectionEntryMutation,
  deleteCollectionEntryMutation,
  updateCollectionEntryMutation,
} from './collection-mutations';
import {
  findCollectionConfig,
  getCollectionProject,
  listCollectionConfigs,
  readCollectionContentType,
  resolveCollectionPaths,
} from './collection-read-operations';
import {
  CollectionWorkspaceThrottle,
  deleteCollectionConfig,
  getCollectionEntryAtCommitForBranch,
  getCollectionEntryHistoryForBranch,
  requireCollectionWithContentType,
  saveCollectionConfigs,
} from './collection-repository';
import {
  findCollectionEntry,
  findCollectionEntryWithRevision,
  findManyCollectionEntries,
  loadCollectionEntriesByIdForService,
  loadCollectionEntriesForService,
  populateCollectionRelations,
} from './collection-query-operations';

export interface CollectionServiceOptions {
  projectId: string;
  repoUrl?: string | null;
  branch: string;
}

export class CollectionService {
  private static indexCache: Map<string, BranchCollectionIndex> = new Map();
  private static workspaceThrottle = new CollectionWorkspaceThrottle();
  private gitService: GitService;
  private workspacePath = '';
  private projectId: string;
  private branch: string;

  constructor(options: CollectionServiceOptions) {
    this.projectId = options.projectId;
    this.branch = options.branch;
    this.gitService = new GitService();
  }

  async init(): Promise<void> {
    const project = await this.getProject();
    this.workspacePath = await CollectionService.workspaceThrottle.syncProjectWorkspace(
      this.gitService,
      this.projectId,
      this.branch,
      project,
    );
  }

  async getCurrentRevision(): Promise<string> {
    return this.gitService.getCurrentRevision(this.projectId);
  }

  static invalidateIndex(projectId: string): void {
    for (const key of this.indexCache.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        this.indexCache.delete(key);
      }
    }
  }

  private async getProject() {
    return getCollectionProject(this.projectId);
  }

  private async getResolvedPaths(relativePath: string): Promise<{ absolute: string; repoRelative: string }> {
    return resolveCollectionPaths({
      workspacePath: this.workspacePath,
      projectId: this.projectId,
      relativePath,
    });
  }

  /**
   * List all explicit collections. Returns defaults generated from schemas if none defined.
   */
  async listCollections(): Promise<CollectionConfig[]> {
    return listCollectionConfigs(this.workspacePath);
  }

  async saveCollections(collections: CollectionConfig[], author: { name: string; email: string }, message = 'Update collection configurations'): Promise<void> {
    await saveCollectionConfigs({
      workspacePath: this.workspacePath,
      projectId: this.projectId,
      gitService: this.gitService,
      collections,
      author,
      message,
    });
    CollectionService.invalidateIndex(this.projectId);
  }

  async deleteCollection(collectionId: string, author: { name: string; email: string }): Promise<void> {
    await deleteCollectionConfig({
      workspacePath: this.workspacePath,
      projectId: this.projectId,
      gitService: this.gitService,
      collectionId,
      author,
      listCollections: () => this.listCollections(),
      getResolvedPaths: (relativePath) => this.getResolvedPaths(relativePath),
    });
    CollectionService.invalidateIndex(this.projectId);
  }

  async getCollectionConfig(collectionId: string): Promise<CollectionConfig | null> {
    return findCollectionConfig(await this.listCollections(), collectionId);
  }

  async getContentType(typeName: string): Promise<ContentType | null> {
    return readCollectionContentType(this.workspacePath, typeName);
  }

  async findMany(
    collectionId: string,
    query: CollectionQuery = {}
  ): Promise<CollectionQueryResult> {
    return findManyCollectionEntries({
      branch: this.branch,
      collectionId,
      getCollectionConfig: (id) => this.getCollectionConfig(id),
      getContentType: (typeName) => this.getContentType(typeName),
      getCurrentRevision: () => this.getCurrentRevision(),
      getEntries: (config) => this.getIndexedEntries(config),
      listCollections: () => this.listCollections(),
      projectId: this.projectId,
      populateRelations: (entries, populate) => this.populateRelations(entries, populate),
      query,
    });
  }

  async findOne(collectionId: string, id: string, populate?: string | string[]): Promise<CollectionEntry | null> {
    return findCollectionEntry({
      collectionId,
      getCollectionConfig: (targetCollectionId) => this.getCollectionConfig(targetCollectionId),
      getEntriesById: (config) => this.getIndexedEntriesById(config),
      id,
      populate,
      populateRelations: (entries, targetPopulate) => this.populateRelations(entries, targetPopulate),
    });
  }

  async findOneWithRevision(
    collectionId: string,
    id: string,
    populate?: string | string[],
  ): Promise<{ entry: CollectionEntry; revision: string } | null> {
    return findCollectionEntryWithRevision({
      collectionId,
      findOne: (targetCollectionId, targetId, targetPopulate) => this.findOne(targetCollectionId, targetId, targetPopulate),
      id,
      populate,
    });
  }

  async create(
    collectionId: string,
    data: Record<string, unknown>,
    author: { name: string; email: string },
  ): Promise<{ entry: CollectionEntry; revision: string; commitHash?: string; commitMessage: string; changedFiles: string[] }> {
    const { config, contentType } = await requireCollectionWithContentType({
      collectionId,
      getCollectionConfig: (id) => this.getCollectionConfig(id),
      getContentType: (typeName) => this.getContentType(typeName),
    });
    const result = await createCollectionEntryMutation({
      context: this.createMutationContext(),
      collectionId,
      config,
      contentType,
      data,
      author,
    });
    CollectionService.invalidateIndex(this.projectId);
    return result;
  }

  async update(
    collectionId: string,
    id: string,
    data: Record<string, unknown>,
    author: { name: string; email: string },
    options: { baseRevision?: string } = {},
  ): Promise<{ entry: CollectionEntry; revision: string; commitHash?: string; commitMessage: string; changedFiles: string[] }> {
    const { config, contentType } = await requireCollectionWithContentType({
      collectionId,
      getCollectionConfig: (id) => this.getCollectionConfig(id),
      getContentType: (typeName) => this.getContentType(typeName),
    });
    const result = await updateCollectionEntryMutation({
      context: this.createMutationContext(),
      config,
      contentType,
      id,
      data,
      author,
      baseRevision: options.baseRevision,
    });
    CollectionService.invalidateIndex(this.projectId);
    return result;
  }

  async delete(
    collectionId: string,
    id: string,
    author: { name: string; email: string },
    options: { baseRevision?: string } = {},
  ): Promise<{ previousEntry: CollectionEntry; revision: string; commitHash?: string; commitMessage: string; changedFiles: string[] }> {
    const config = await this.requireCollectionConfig(collectionId);
    const contentType = await this.getContentType(config.contentType);
    const result = await deleteCollectionEntryMutation({
      context: this.createMutationContext(),
      config,
      contentTypeLabel: contentType?.label || config.contentType,
      id,
      author,
      baseRevision: options.baseRevision,
    });
    CollectionService.invalidateIndex(this.projectId);
    return result;
  }

  /**
   * Get commit history for a specific entry
   */
  async getHistory(collectionId: string, entryId: string, limit = 20) {
    this.workspacePath = this.gitService.getWorkspaceDir(this.projectId);
    return getCollectionEntryHistoryForBranch({
      gitService: this.gitService,
      projectId: this.projectId,
      branch: this.branch,
      collectionId,
      entryId,
      limit,
      getCollectionConfig: (id) => this.getCollectionConfig(id),
      getResolvedPaths: (relativePath) => this.getResolvedPaths(relativePath),
    });
  }

  /**
   * Get entry content at a specific commit hash
   */
  async getFileAtCommit(collectionId: string, entryId: string, hash: string) {
    this.workspacePath = this.gitService.getWorkspaceDir(this.projectId);
    return getCollectionEntryAtCommitForBranch({
      gitService: this.gitService,
      projectId: this.projectId,
      branch: this.branch,
      collectionId,
      entryId,
      hash,
      getCollectionConfig: (id) => this.getCollectionConfig(id),
      getResolvedPaths: (relativePath) => this.getResolvedPaths(relativePath),
    });
  }

  // =============================================================================
  // Private helpers
  // =============================================================================

  private getBranchCacheKey(): string {
    return getCollectionBranchCacheKey(this.projectId, this.branch);
  }

  private async getOrBuildBranchIndex(): Promise<BranchCollectionIndex> {
    const cacheKey = this.getBranchCacheKey();
    const revision = await this.getCurrentRevision();
    return getOrBuildCollectionBranchIndex(CollectionService.indexCache, cacheKey, revision);
  }

  private async loadEntriesForCollection(config: CollectionConfig): Promise<CollectionEntry[]> {
    return loadCollectionEntriesForService({
      index: await this.getOrBuildBranchIndex(),
      projectId: this.projectId,
      branch: this.branch,
      config,
      getResolvedPaths: (relativePath) => this.getResolvedPaths(relativePath),
    });
  }

  private async getIndexedEntries(config: CollectionConfig): Promise<CollectionEntry[]> {
    return this.loadEntriesForCollection(config);
  }

  private async getIndexedEntriesById(config: CollectionConfig): Promise<Map<string, CollectionEntry>> {
    return loadCollectionEntriesByIdForService({
      index: await this.getOrBuildBranchIndex(),
      projectId: this.projectId,
      branch: this.branch,
      config,
      getResolvedPaths: (relativePath) => this.getResolvedPaths(relativePath),
    });
  }

  static computeEntryRevision(entry: CollectionEntry): string {
    return computeCollectionEntryRevision(entry);
  }

  private async populateRelations(entries: CollectionEntry[], populate: string | string[]): Promise<void> {
    await populateCollectionRelations({
      entries,
      populate,
      getContentType: (typeName) => this.getContentType(typeName),
      findOne: (collectionId, id) => this.findOne(collectionId, id),
    });
  }

  private createMutationContext() {
    return {
      projectId: this.projectId,
      gitService: this.gitService,
      getResolvedPaths: (relativePath: string) => this.getResolvedPaths(relativePath),
    };
  }

  private async requireCollectionConfig(collectionId: string): Promise<CollectionConfig> {
    const config = await this.getCollectionConfig(collectionId);
    if (!config) {
      throw new Error(`Collection '${collectionId}' not found`);
    }
    return config;
  }

}

export { CollectionValidationError, StaleEntryRevisionError } from './collection-errors';
