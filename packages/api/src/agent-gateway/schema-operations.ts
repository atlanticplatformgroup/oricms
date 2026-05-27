import type {
  AgentAccessConfig,
  CollectionConfig,
  ContentType,
  ProjectRole,
} from '@ori/shared';
import type { CollectionService } from '../collections/service';
import type { AgentGatewayGitLoader } from './git-loader';
import { loadContentTypeFromCollections, loadContentTypesFromCollections } from './collection-readers';

type GetCollectionService = (branch: string) => Promise<CollectionService>;
type LogFileAccess = (
  filePath: string,
  branch: string,
  contentRead: boolean,
  wasRedacted: boolean,
  piiPatternsFound: string[],
) => Promise<void>;

type Metadata = {
  role: ProjectRole;
  wasRedacted: boolean;
  piiPatternsFound: string[];
  fieldsHidden?: string[];
};

type ContentAccessResult<T> = {
  data: T;
  metadata: Metadata;
};

function buildMetadata(
  role: ProjectRole,
  overrides: {
    wasRedacted: boolean;
    piiPatternsFound: string[];
    fieldsHidden?: string[];
  },
): Metadata {
  return {
    role,
    ...overrides,
  };
}

export async function loadContentTypesResult(input: {
  branch: string;
  role: ProjectRole;
  gitLoader: AgentGatewayGitLoader;
  getCollectionService: GetCollectionService;
}): Promise<ContentAccessResult<ContentType[]>> {
  const contentTypes = input.gitLoader.usesDirectGitAdapter()
    ? await input.gitLoader.loadContentTypesFromGit(input.branch)
    : await loadContentTypesFromCollections(input.branch, input.getCollectionService);

  return {
    data: contentTypes,
    metadata: buildMetadata(input.role, { wasRedacted: false, piiPatternsFound: [] }),
  };
}

export async function loadContentTypeResult(input: {
  branch: string;
  contentTypeId: string;
  role: ProjectRole;
  gitLoader: AgentGatewayGitLoader;
  getCollectionService: GetCollectionService;
  logFileAccess: LogFileAccess;
}): Promise<ContentAccessResult<ContentType | null>> {
  const result = input.gitLoader.usesDirectGitAdapter()
    ? await input.gitLoader.loadContentTypeFromGit(input.contentTypeId, input.branch)
    : await loadContentTypeFromCollections(input.contentTypeId, input.branch, input.getCollectionService);

  if (result) {
    await input.logFileAccess(result.filePath, input.branch, true, false, []);
  }

  return {
    data: result?.contentType ?? null,
    metadata: buildMetadata(input.role, { wasRedacted: false, piiPatternsFound: [] }),
  };
}

export async function loadCollectionConfigResult(input: {
  branch: string;
  collectionId: string;
  role: ProjectRole;
  getCollectionService: GetCollectionService;
}): Promise<ContentAccessResult<CollectionConfig | null>> {
  const service = await input.getCollectionService(input.branch);
  const config = await service.getCollectionConfig(input.collectionId);

  return {
    data: config,
    metadata: buildMetadata(input.role, { wasRedacted: false, piiPatternsFound: [] }),
  };
}

export function buildGatewayConfigStatus(input: {
  config: AgentAccessConfig;
  role: ProjectRole;
}): {
  enabled: boolean;
  role: ProjectRole;
  allowedCollections: string[];
  allowedBranches: string[];
  historyDays: number;
  historyDepth: number;
  deploymentMode: 'cloud' | 'on-premise';
} {
  return {
    enabled: input.config.enabled,
    role: input.role,
    allowedCollections: input.config.allowedCollections,
    allowedBranches: input.config.allowedBranches,
    historyDays: input.config.historyDays,
    historyDepth: input.config.historyDepth,
    deploymentMode: input.config.deploymentMode,
  };
}
