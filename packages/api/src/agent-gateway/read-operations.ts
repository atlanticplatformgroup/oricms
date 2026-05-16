import type {
  AgentAccessConfig,
  CollectionEntry,
  CollectionQuery,
  ContentType,
  ProjectRole,
} from '@ori/shared';
import type { GitService } from '../git/service';
import type { CollectionService } from '../collections/service';
import { scanAndRedact } from './pii';
import type { AgentGatewayGitLoader } from './git-loader';
import {
  loadCollectionEntriesFromCollections,
  loadEntryFromCollections,
  loadRepositoryStructureFromCollections,
} from './collection-readers';

type GetCollectionService = (branch: string) => Promise<CollectionService>;
type LogFileAccess = (
  filePath: string,
  branch: string,
  contentRead: boolean,
  wasRedacted: boolean,
  piiPatternsFound: string[],
) => Promise<void>;
type AuditContentAccess = (filePath: string, branch: string, queryType: string) => Promise<void>;

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

export async function loadCollectionEntriesResult(input: {
  branch: string;
  collectionId: string;
  query: CollectionQuery;
  contentType: ContentType;
  role: ProjectRole;
  config: AgentAccessConfig;
  gitLoader: AgentGatewayGitLoader;
  getCollectionService: GetCollectionService;
  logFileAccess: LogFileAccess;
}): Promise<ContentAccessResult<CollectionEntry[]>> {
  const allFieldsHidden: string[] = [];
  const allPiiPatterns = new Set<string>();
  let anyRedacted = false;

  const processedEntries = input.gitLoader.usesDirectGitAdapter()
    ? await (async () => {
        const result = await input.gitLoader.loadCollectionEntriesFromGit(
          input.collectionId,
          input.query,
          input.contentType,
          input.branch,
        );

        for (const auditedFile of result.auditedFiles) {
          anyRedacted = anyRedacted || auditedFile.wasRedacted;
          auditedFile.piiPatternsFound.forEach((pattern) => allPiiPatterns.add(pattern));
          await input.logFileAccess(
            auditedFile.filePath,
            input.branch,
            true,
            auditedFile.wasRedacted,
            auditedFile.piiPatternsFound,
          );
        }

        return result.entries;
      })()
    : await (async () => {
        const result = await loadCollectionEntriesFromCollections({
          branch: input.branch,
          collectionId: input.collectionId,
          query: input.query,
          contentType: input.contentType,
          config: input.config,
          getCollectionService: input.getCollectionService,
          logFileAccess: input.logFileAccess,
        });

        anyRedacted = result.wasRedacted;
        result.piiPatternsFound.forEach((pattern) => allPiiPatterns.add(pattern));
        result.fieldsHidden.forEach((field) => {
          if (!allFieldsHidden.includes(field)) allFieldsHidden.push(field);
        });

        return result.entries;
      })();

  return {
    data: processedEntries,
    metadata: buildMetadata(input.role, {
      wasRedacted: anyRedacted,
      piiPatternsFound: Array.from(allPiiPatterns),
      fieldsHidden: allFieldsHidden,
    }),
  };
}

export async function loadEntryResult(input: {
  branch: string;
  collectionId: string;
  entryId: string;
  contentType: ContentType;
  role: ProjectRole;
  config: AgentAccessConfig;
  gitLoader: AgentGatewayGitLoader;
  getCollectionService: GetCollectionService;
  logFileAccess: LogFileAccess;
}): Promise<ContentAccessResult<CollectionEntry | null>> {
  const result = input.gitLoader.usesDirectGitAdapter()
    ? await input.gitLoader.loadEntryFromGit(
        input.collectionId,
        input.entryId,
        input.contentType,
        input.branch,
      )
    : await loadEntryFromCollections({
        branch: input.branch,
        collectionId: input.collectionId,
        entryId: input.entryId,
        contentType: input.contentType,
        config: input.config,
        getCollectionService: input.getCollectionService,
      });

  if (!result) {
    return {
      data: null,
      metadata: buildMetadata(input.role, { wasRedacted: false, piiPatternsFound: [] }),
    };
  }

  await input.logFileAccess(
    result.filePath,
    input.branch,
    true,
    result.wasRedacted,
    result.piiPatternsFound,
  );

  return {
    data: result.entry,
    metadata: buildMetadata(input.role, {
      wasRedacted: result.wasRedacted,
      piiPatternsFound: result.piiPatternsFound,
      fieldsHidden: result.fieldsHidden,
    }),
  };
}

export async function loadGitHistoryResult(input: {
  branch: string;
  role: ProjectRole;
  projectId: string;
  gitService: GitService;
  historyDepth: number;
  historyDays: number;
  auditContentAccess: AuditContentAccess;
}): Promise<ContentAccessResult<Array<{
  hash: string;
  message: string;
  author: string;
  date: string;
  files?: string[];
}>>> {
  await input.auditContentAccess('', input.branch, 'git_history');

  const commits = await input.gitService.getHistory(
    input.projectId,
    input.historyDepth,
    undefined,
    input.branch,
  );

  const maxAge = new Date();
  maxAge.setDate(maxAge.getDate() - input.historyDays);

  const filtered = commits
    .filter((commit) => new Date(commit.date) >= maxAge)
    .map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author,
      date: commit.date,
      files: undefined as string[] | undefined,
    }));

  return {
    data: filtered,
    metadata: buildMetadata(input.role, { wasRedacted: false, piiPatternsFound: [] }),
  };
}

export async function loadRepositoryStructureResult(input: {
  branch: string;
  role: ProjectRole;
  config: AgentAccessConfig;
  gitLoader: AgentGatewayGitLoader;
  getCollectionService: GetCollectionService;
  auditContentAccess: AuditContentAccess;
}): Promise<ContentAccessResult<{
  schemas: string[];
  collections: Array<{ name: string; allowed: boolean; count?: number }>;
}>> {
  await input.auditContentAccess('', input.branch, 'repo_structure');

  const { schemas, collections } = input.gitLoader.usesDirectGitAdapter()
    ? await input.gitLoader.getRepositoryStructureFromGit(input.branch)
    : await loadRepositoryStructureFromCollections({
        branch: input.branch,
        config: input.config,
        getCollectionService: input.getCollectionService,
      });

  return {
    data: { schemas, collections },
    metadata: buildMetadata(input.role, { wasRedacted: false, piiPatternsFound: [] }),
  };
}

export async function loadRawFileResult(input: {
  branch: string;
  filePath: string;
  role: ProjectRole;
  gitLoader: AgentGatewayGitLoader;
  logFileAccess: LogFileAccess;
}): Promise<ContentAccessResult<string>> {
  const content = await input.gitLoader.readGitFile(input.filePath, input.branch);

  if (!content) {
    throw new Error('File not found');
  }

  const scanResult = scanAndRedact(content);

  await input.logFileAccess(
    input.filePath,
    input.branch,
    true,
    scanResult.redactionCount > 0,
    scanResult.patternsFound,
  );

  return {
    data: scanResult.redactedText,
    metadata: buildMetadata(input.role, {
      wasRedacted: scanResult.redactionCount > 0,
      piiPatternsFound: scanResult.patternsFound,
    }),
  };
}
