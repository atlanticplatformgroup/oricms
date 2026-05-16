import type {
  AgentAccessConfig,
  AgentSessionBootstrap,
  CollectionConfig,
  CollectionEntry,
  CollectionQuery,
  ContentType,
  ProjectRole,
} from '@ori/shared';
import type { CollectionService } from '../collections/service';
import type { GitService } from '../git/service';
import { AgentAccessError } from './errors';
import type { AgentGatewayGitLoader } from './git-loader';
import { buildSessionBootstrapPayload } from './session-bootstrap';
import {
  loadCollectionEntriesResult,
  loadEntryResult,
  loadGitHistoryResult,
  loadRawFileResult,
  loadRepositoryStructureResult,
} from './read-operations';
import { loadGatewaySessionBootstrapInputs } from './gateway-bootstrap';
import {
  buildGatewayConfigStatus,
  loadCollectionConfigResult,
  loadContentTypeResult,
  loadContentTypesResult,
} from './schema-operations';
import {
  assertCanReadCollections,
  assertCanReadHistory,
  assertCanReadRawFiles,
  assertCanReadSchemas,
  assertCollectionAllowed,
  hasGatewayPermission,
  validateAllowedBranch,
} from './access-support';

type ContentAccessResult<T> = {
  data: T;
  metadata: {
    role: ProjectRole;
    wasRedacted: boolean;
    piiPatternsFound: string[];
    fieldsHidden?: string[];
  };
};

type GatewayLogger = {
  auditContentAccess: (filePath: string, branch: string, queryType: string) => Promise<void>;
  logContentFileAccess: (
    filePath: string,
    branch: string,
    contentRead: boolean,
    wasRedacted: boolean,
    piiPatternsFound: string[],
  ) => Promise<void>;
};

type CollectionServiceFactory = (branch: string) => Promise<CollectionService>;

export async function getGatewayContentTypes(args: {
  branch: string;
  config: AgentAccessConfig;
  getCollectionService: CollectionServiceFactory;
  gitLoader: AgentGatewayGitLoader;
  logger: GatewayLogger;
  role: ProjectRole;
}): Promise<ContentAccessResult<ContentType[]>> {
  assertCanReadSchemas(args.role);
  validateAllowedBranch(args.branch, args.config);
  await args.logger.auditContentAccess('', args.branch, 'schema_list');

  return loadContentTypesResult({
    branch: args.branch,
    role: args.role,
    gitLoader: args.gitLoader,
    getCollectionService: args.getCollectionService,
  });
}

export async function getGatewayContentType(args: {
  branch: string;
  config: AgentAccessConfig;
  contentTypeId: string;
  getCollectionService: CollectionServiceFactory;
  gitLoader: AgentGatewayGitLoader;
  logger: GatewayLogger;
  role: ProjectRole;
}): Promise<ContentAccessResult<ContentType | null>> {
  assertCanReadSchemas(args.role);
  validateAllowedBranch(args.branch, args.config);

  return loadContentTypeResult({
    branch: args.branch,
    contentTypeId: args.contentTypeId,
    role: args.role,
    gitLoader: args.gitLoader,
    getCollectionService: args.getCollectionService,
    logFileAccess: (filePath, branch, contentRead, wasRedacted, piiPatternsFound) =>
      args.logger.logContentFileAccess(filePath, branch, contentRead, wasRedacted, piiPatternsFound),
  });
}

export async function getGatewayCollectionConfig(args: {
  branch: string;
  collectionId: string;
  config: AgentAccessConfig;
  getCollectionService: CollectionServiceFactory;
  role: ProjectRole;
}): Promise<ContentAccessResult<CollectionConfig | null>> {
  assertCanReadSchemas(args.role);
  validateAllowedBranch(args.branch, args.config);

  return loadCollectionConfigResult({
    branch: args.branch,
    collectionId: args.collectionId,
    role: args.role,
    getCollectionService: args.getCollectionService,
  });
}

export async function getGatewayCollectionEntries(args: {
  branch: string;
  collectionId: string;
  config: AgentAccessConfig;
  contentType: ContentType;
  getCollectionService: CollectionServiceFactory;
  gitLoader: AgentGatewayGitLoader;
  logger: GatewayLogger;
  query: CollectionQuery;
  role: ProjectRole;
}): Promise<ContentAccessResult<CollectionEntry[]>> {
  assertCanReadCollections(args.role);
  validateAllowedBranch(args.branch, args.config);
  assertCollectionAllowed(args.collectionId, args.config);

  return loadCollectionEntriesResult({
    branch: args.branch,
    collectionId: args.collectionId,
    query: args.query,
    contentType: args.contentType,
    role: args.role,
    config: args.config,
    gitLoader: args.gitLoader,
    getCollectionService: args.getCollectionService,
    logFileAccess: (filePath, branch, contentRead, wasRedacted, piiPatternsFound) =>
      args.logger.logContentFileAccess(filePath, branch, contentRead, wasRedacted, piiPatternsFound),
  });
}

export async function getGatewayEntry(args: {
  branch: string;
  collectionId: string;
  config: AgentAccessConfig;
  contentType: ContentType;
  entryId: string;
  getCollectionService: CollectionServiceFactory;
  gitLoader: AgentGatewayGitLoader;
  logger: GatewayLogger;
  role: ProjectRole;
}): Promise<ContentAccessResult<CollectionEntry | null>> {
  assertCanReadCollections(args.role);
  validateAllowedBranch(args.branch, args.config);
  assertCollectionAllowed(args.collectionId, args.config);

  return loadEntryResult({
    branch: args.branch,
    collectionId: args.collectionId,
    entryId: args.entryId,
    contentType: args.contentType,
    role: args.role,
    config: args.config,
    gitLoader: args.gitLoader,
    getCollectionService: args.getCollectionService,
    logFileAccess: (filePath, branch, contentRead, wasRedacted, piiPatternsFound) =>
      args.logger.logContentFileAccess(filePath, branch, contentRead, wasRedacted, piiPatternsFound),
  });
}

export async function getGatewayGitHistory(args: {
  branch: string;
  config: AgentAccessConfig;
  gitService: GitService;
  logger: GatewayLogger;
  projectId: string;
  role: ProjectRole;
}): Promise<ContentAccessResult<Array<{
  hash: string;
  message: string;
  author: string;
  date: string;
  files?: string[];
}>>> {
  assertCanReadHistory(args.role);
  validateAllowedBranch(args.branch, args.config);

  return loadGitHistoryResult({
    branch: args.branch,
    role: args.role,
    projectId: args.projectId,
    gitService: args.gitService,
    historyDepth: args.config.historyDepth,
    historyDays: args.config.historyDays,
    auditContentAccess: (filePath, branch, queryType) =>
      args.logger.auditContentAccess(filePath, branch, queryType),
  });
}

export async function getGatewayRepositoryStructure(args: {
  branch: string;
  config: AgentAccessConfig;
  getCollectionService: CollectionServiceFactory;
  gitLoader: AgentGatewayGitLoader;
  logger: GatewayLogger;
  role: ProjectRole;
}): Promise<ContentAccessResult<{
  schemas: string[];
  collections: Array<{ name: string; allowed: boolean; count?: number }>;
}>> {
  assertCanReadHistory(args.role);
  validateAllowedBranch(args.branch, args.config);

  return loadRepositoryStructureResult({
    branch: args.branch,
    role: args.role,
    config: args.config,
    gitLoader: args.gitLoader,
    getCollectionService: args.getCollectionService,
    auditContentAccess: (filePath, branch, queryType) =>
      args.logger.auditContentAccess(filePath, branch, queryType),
  });
}

export async function getGatewayRawFile(args: {
  branch: string;
  config: AgentAccessConfig;
  filePath: string;
  gitLoader: AgentGatewayGitLoader;
  logger: GatewayLogger;
  role: ProjectRole;
}): Promise<ContentAccessResult<string>> {
  assertCanReadRawFiles(args.role);
  validateAllowedBranch(args.branch, args.config);

  if (args.filePath.includes('..') || args.filePath.startsWith('/')) {
    throw new AgentAccessError('Invalid file path');
  }

  try {
    return await loadRawFileResult({
      branch: args.branch,
      filePath: args.filePath,
      role: args.role,
      gitLoader: args.gitLoader,
      logFileAccess: (filePath, branch, contentRead, wasRedacted, piiPatternsFound) =>
        args.logger.logContentFileAccess(filePath, branch, contentRead, wasRedacted, piiPatternsFound),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'File not found') {
      throw new AgentAccessError('File not found');
    }
    throw error;
  }
}

export function getGatewayConfigStatus(args: {
  config: AgentAccessConfig;
  role: ProjectRole;
}) {
  return buildGatewayConfigStatus({
    config: args.config,
    role: args.role,
  });
}

export async function getGatewaySessionBootstrap(args: {
  config: AgentAccessConfig;
  getCollectionService: CollectionServiceFactory;
  projectId: string;
  role: ProjectRole;
  selectedBranch?: string;
}): Promise<AgentSessionBootstrap> {
  const branch = args.selectedBranch ?? args.config.allowedBranches[0] ?? 'main';
  validateAllowedBranch(branch, args.config);

  const { project, allowedCollectionConfigs, writeConfigs } = await loadGatewaySessionBootstrapInputs({
    projectId: args.projectId,
    selectedBranch: branch,
    projectRole: args.role,
    config: args.config,
    hasPermission: (resource, action) => hasGatewayPermission(args.role, resource, action),
    getCollectionService: args.getCollectionService,
  });

  return buildSessionBootstrapPayload({
    project,
    selectedBranch: branch,
    projectRole: args.role,
    config: args.config,
    allowedCollectionConfigs,
    writeConfigs,
    hasPermission: (resource, action) => hasGatewayPermission(args.role, resource, action),
  });
}
