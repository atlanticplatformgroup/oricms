/**
 * Agent Gateway Service
 * 
 * Main service that orchestrates agent access with:
 * - Role-based permission enforcement
 * - Content filtering and redaction
 * - Audit logging
 * - PII scanning
 */

import { GitService } from '../git/service';
import type {
  AgentAccessConfig,
  AgentSessionBootstrap,
  CollectionConfig,
  CollectionEntry,
  CollectionQuery,
  ContentType,
  ProjectRole,
} from '@ori/shared';
import { CollectionService } from '../collections/service';
import { AgentGatewayGitLoader } from './git-loader';
import { createGatewayCollectionService } from './gateway-bootstrap';
import { loadAgentGatewayConfig } from './gateway-factory-support';
import {
  createGatewayAuditLogger,
} from './access-support';
import {
  getGatewayCollectionConfig,
  getGatewayCollectionEntries,
  getGatewayConfigStatus,
  getGatewayContentType,
  getGatewayContentTypes,
  getGatewayEntry,
  getGatewayGitHistory,
  getGatewayRawFile,
  getGatewayRepositoryStructure,
  getGatewaySessionBootstrap,
} from './service-operations';

export interface AgentGatewayContext {
  projectId: string;
  agentSessionId: string;
  projectRole: ProjectRole;
  config: AgentAccessConfig;
  gitService: GitService;
}

export interface ContentAccessResult<T> {
  data: T;
  metadata: {
    role: ProjectRole;
    wasRedacted: boolean;
    piiPatternsFound: string[];
    fieldsHidden?: string[];
  };
}

export class AgentGatewayService {
  private gitService: GitService;
  private gitLoader: AgentGatewayGitLoader;
  private projectId: string;
  private readonly auditLogger: ReturnType<typeof createGatewayAuditLogger>;
  public config: AgentAccessConfig;

  constructor(
    private context: AgentGatewayContext
  ) {
    this.gitService = context.gitService;
    this.projectId = context.projectId;
    this.config = context.config;
    this.auditLogger = createGatewayAuditLogger({
      projectId: context.projectId,
      agentSessionId: context.agentSessionId,
      projectRole: context.projectRole,
    });
    this.gitLoader = new AgentGatewayGitLoader({
      config: context.config,
      gitService: context.gitService,
      projectId: context.projectId,
    });
  }

  getGitService(): GitService {
    return this.gitService;
  }

  private async getCollectionService(branch: string): Promise<CollectionService> {
    return createGatewayCollectionService(this.projectId, branch);
  }

  async getContentTypes(branch: string = 'main'): Promise<ContentAccessResult<ContentType[]>> {
    return getGatewayContentTypes({
      branch,
      config: this.config,
      gitLoader: this.gitLoader,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      logger: this.auditLogger,
      role: this.context.projectRole,
    });
  }

  async getContentType(contentTypeId: string, branch: string = 'main'): Promise<ContentAccessResult<ContentType | null>> {
    return getGatewayContentType({
      branch,
      config: this.config,
      contentTypeId,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      gitLoader: this.gitLoader,
      logger: this.auditLogger,
      role: this.context.projectRole,
    });
  }

  async getCollectionConfig(collectionId: string, branch: string = 'main'): Promise<ContentAccessResult<CollectionConfig | null>> {
    return getGatewayCollectionConfig({
      branch,
      collectionId,
      config: this.config,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      role: this.context.projectRole,
    });
  }

  async getCollectionEntries(
    collectionId: string,
    query: CollectionQuery,
    contentType: ContentType,
    branch: string = 'main',
  ): Promise<ContentAccessResult<CollectionEntry[]>> {
    return getGatewayCollectionEntries({
      branch,
      collectionId,
      query,
      contentType,
      config: this.config,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      gitLoader: this.gitLoader,
      logger: this.auditLogger,
      role: this.context.projectRole,
    });
  }

  async getEntry(
    collectionId: string,
    entryId: string,
    contentType: ContentType,
    branch: string = 'main',
  ): Promise<ContentAccessResult<CollectionEntry | null>> {
    return getGatewayEntry({
      branch,
      collectionId,
      entryId,
      contentType,
      config: this.config,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      gitLoader: this.gitLoader,
      logger: this.auditLogger,
      role: this.context.projectRole,
    });
  }

  async getCollectionEntry(collectionId: string, entryId: string, branch: string = 'main'): Promise<CollectionEntry | null> {
    const service = await this.getCollectionService(branch);
    return service.findOne(collectionId, entryId);
  }

  async getCollectionEntrys(
    collectionId: string,
    query: CollectionQuery,
    contentType: ContentType,
    branch: string = 'main',
  ): Promise<ContentAccessResult<CollectionEntry[]>> {
    return this.getCollectionEntries(collectionId, query, contentType, branch);
  }

  async getRecord(
    collectionId: string,
    entryId: string,
    contentType: ContentType,
    branch: string = 'main',
  ): Promise<ContentAccessResult<CollectionEntry | null>> {
    return this.getEntry(collectionId, entryId, contentType, branch);
  }

  async getGitHistory(branch: string = 'main'): Promise<ContentAccessResult<Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
    files?: string[];
  }>>> {
    return getGatewayGitHistory({
      branch,
      config: this.config,
      gitService: this.gitService,
      logger: this.auditLogger,
      projectId: this.projectId,
      role: this.context.projectRole,
    });
  }

  async getRepositoryStructure(branch: string = 'main'): Promise<ContentAccessResult<{
    schemas: string[];
    collections: Array<{ name: string; allowed: boolean; count?: number }>;
  }>> {
    return getGatewayRepositoryStructure({
      branch,
      config: this.config,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      gitLoader: this.gitLoader,
      logger: this.auditLogger,
      role: this.context.projectRole,
    });
  }

  async getRawFile(filePath: string, branch: string = 'main'): Promise<ContentAccessResult<string>> {
    return getGatewayRawFile({
      branch,
      config: this.config,
      filePath,
      gitLoader: this.gitLoader,
      logger: this.auditLogger,
      role: this.context.projectRole,
    });
  }

  async getConfigStatus(): Promise<{
    enabled: boolean;
    role: ProjectRole;
    allowedCollections: string[];
    allowedBranches: string[];
    historyDays: number;
    historyDepth: number;
    deploymentMode: 'cloud' | 'on-premise';
  }> {
    return getGatewayConfigStatus({
      config: this.config,
      role: this.context.projectRole,
    });
  }

  async getSessionBootstrap(branch?: string): Promise<AgentSessionBootstrap> {
    return getGatewaySessionBootstrap({
      config: this.config,
      getCollectionService: (selectedBranch) => this.getCollectionService(selectedBranch),
      projectId: this.projectId,
      role: this.context.projectRole,
      selectedBranch: branch,
    });
  }
}

export { AgentAccessError } from './errors';

export async function createAgentGateway(
  projectId: string,
  agentSessionId: string,
  projectRole: ProjectRole,
  gitService?: GitService,
): Promise<AgentGatewayService> {
  const config = await loadAgentGatewayConfig(projectId);

  const context: AgentGatewayContext = {
    projectId,
    agentSessionId,
    projectRole,
    config,
    gitService: gitService || new GitService(),
  };

  return new AgentGatewayService(context);
}
