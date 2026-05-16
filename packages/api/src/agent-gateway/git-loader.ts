import type {
  AgentAccessConfig,
  CollectionEntry,
  CollectionQuery,
  ContentType,
} from '@ori/shared';
import YAML from 'yaml';
import { GitService } from '../git/service';
import { filterEntry, isCollectionAllowed } from './filter';

export interface AgentGatewayGitLoaderContext {
  config: AgentAccessConfig;
  gitService: GitService;
  projectId: string;
}

export interface AgentGatewayAuditedFile {
  filePath: string;
  wasRedacted: boolean;
  piiPatternsFound: string[];
}

export interface AgentGatewayLoadedEntry {
  entry: CollectionEntry;
  filePath: string;
  wasRedacted: boolean;
  piiPatternsFound: string[];
  fieldsHidden: string[];
}

function parseStructuredFile<T>(content: string, filePath: string): T | null {
  try {
    if (filePath.endsWith('.json')) {
      return JSON.parse(content) as T;
    }

    return YAML.parse(content) as T;
  } catch {
    return null;
  }
}

function getSchemaFileCandidates(contentTypeId: string): string[] {
  return [
    `schemas/${contentTypeId}.yaml`,
    `schemas/${contentTypeId}.yml`,
    `schemas/${contentTypeId}.json`,
    `schemas/types/${contentTypeId}.yaml`,
    `schemas/types/${contentTypeId}.yml`,
    `schemas/types/${contentTypeId}.json`,
  ];
}

function getEntryFileCandidates(collectionId: string, entryId: string): string[] {
  return [
    `content/${collectionId}/${entryId}.yaml`,
    `content/${collectionId}/${entryId}.yml`,
    `content/${collectionId}/${entryId}.json`,
  ];
}

export class AgentGatewayGitLoader {
  constructor(private readonly context: AgentGatewayGitLoaderContext) {}

  usesDirectGitAdapter(): boolean {
    return typeof (this.context.gitService as GitService & { getWorkspaceDir?: unknown }).getWorkspaceDir !== 'function';
  }

  async readGitFile(filePath: string, branch: string): Promise<string | null> {
    return this.context.gitService.readFile(this.context.projectId, filePath, branch);
  }

  async listGitFiles(directory: string, branch: string): Promise<string[]> {
    const gitServiceWithList = this.context.gitService as GitService & {
      listFilePaths?: (projectId: string, directory: string, branch?: string) => Promise<string[]>;
    };

    if (typeof gitServiceWithList.listFilePaths !== 'function') {
      return [];
    }

    const paths = await gitServiceWithList.listFilePaths(this.context.projectId, directory, branch);
    return paths.filter((filePath) => !filePath.includes(':'));
  }

  async loadContentTypesFromGit(branch: string): Promise<ContentType[]> {
    const schemaPaths = await this.listGitFiles('schemas', branch);
    const contentTypes: ContentType[] = [];

    for (const schemaPath of schemaPaths) {
      if (!/\.(json|ya?ml)$/i.test(schemaPath)) {
        continue;
      }

      const content = await this.readGitFile(schemaPath, branch);
      if (!content) {
        continue;
      }

      const parsed = parseStructuredFile<ContentType>(content, schemaPath);
      if (parsed?.$schema === 'content-type-v1') {
        contentTypes.push(parsed);
      }
    }

    return contentTypes;
  }

  async loadContentTypeFromGit(contentTypeId: string, branch: string): Promise<{ filePath: string; contentType: ContentType } | null> {
    for (const filePath of getSchemaFileCandidates(contentTypeId)) {
      const content = await this.readGitFile(filePath, branch);
      if (!content) {
        continue;
      }

      const parsed = parseStructuredFile<ContentType>(content, filePath);
      if (parsed?.$schema === 'content-type-v1') {
        return { filePath, contentType: parsed };
      }
    }

    return null;
  }

  async loadCollectionEntriesFromGit(
    collectionId: string,
    query: CollectionQuery,
    contentType: ContentType,
    branch: string,
  ): Promise<{ entries: CollectionEntry[]; auditedFiles: AgentGatewayAuditedFile[] }> {
    const filePaths = await this.listGitFiles(`content/${collectionId}`, branch);
    const parsedEntries: Array<{ entry: CollectionEntry; filePath: string }> = [];

    for (const filePath of filePaths) {
      if (!/\.(json|ya?ml)$/i.test(filePath)) {
        continue;
      }

      const content = await this.readGitFile(filePath, branch);
      if (!content) {
        continue;
      }

      const parsed = parseStructuredFile<CollectionEntry>(content, filePath);
      if (parsed && typeof parsed === 'object') {
        parsedEntries.push({ entry: parsed, filePath });
      }
    }

    let filteredEntries = parsedEntries;
    if (query.filter) {
      filteredEntries = filteredEntries.filter(({ entry }) =>
        Object.entries(query.filter ?? {}).every(([key, value]) => entry[key] === value),
      );
    }

    if (query.search) {
      const normalizedSearch = query.search.toLowerCase();
      filteredEntries = filteredEntries.filter(({ entry }) =>
        Object.values(entry).some((value) => typeof value === 'string' && value.toLowerCase().includes(normalizedSearch)),
      );
    }

    const sortEntries = Object.entries(query.sort ?? {});
    if (sortEntries.length > 0) {
      filteredEntries = [...filteredEntries].sort((left, right) => {
        for (const [field, direction] of sortEntries) {
          const leftValue = left.entry[field];
          const rightValue = right.entry[field];
          if (leftValue === rightValue) {
            continue;
          }

          if (leftValue == null) {
            return direction === 'asc' ? -1 : 1;
          }

          if (rightValue == null) {
            return direction === 'asc' ? 1 : -1;
          }

          const comparison = String(leftValue).localeCompare(String(rightValue));
          return direction === 'asc' ? comparison : -comparison;
        }

        return 0;
      });
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? (filteredEntries.length || 20), 100);
    const start = (page - 1) * limit;
    const pagedEntries = filteredEntries.slice(start, start + limit);

    const auditedFiles: AgentGatewayAuditedFile[] = [];
    const entries = pagedEntries.map(({ entry, filePath }) => {
      const filterResult = filterEntry(entry, contentType, { config: this.context.config });
      auditedFiles.push({
        filePath,
        wasRedacted: filterResult.wasRedacted,
        piiPatternsFound: filterResult.piiPatternsFound,
      });
      return filterResult.data;
    });

    return { entries, auditedFiles };
  }

  async loadEntryFromGit(
    collectionId: string,
    entryId: string,
    contentType: ContentType,
    branch: string,
  ): Promise<AgentGatewayLoadedEntry | null> {
    for (const filePath of getEntryFileCandidates(collectionId, entryId)) {
      const content = await this.readGitFile(filePath, branch);
      if (!content) {
        continue;
      }

      const parsed = parseStructuredFile<CollectionEntry>(content, filePath);
      if (!parsed) {
        continue;
      }

      const filterResult = filterEntry(parsed, contentType, { config: this.context.config });
      return {
        entry: filterResult.data,
        filePath,
        wasRedacted: filterResult.wasRedacted,
        piiPatternsFound: filterResult.piiPatternsFound,
        fieldsHidden: filterResult.fieldsHidden,
      };
    }

    return null;
  }

  async getRepositoryStructureFromGit(branch: string): Promise<{
    schemas: string[];
    collections: Array<{ name: string; allowed: boolean; count?: number }>;
  }> {
    const schemaFiles = await this.listGitFiles('schemas', branch);
    const parsedSchemas = await Promise.all(
      schemaFiles
        .filter((filePath) => /\.(json|ya?ml)$/i.test(filePath))
        .map(async (filePath) => {
          const content = await this.readGitFile(filePath, branch);
          if (!content) {
            return null;
          }

          return parseStructuredFile<ContentType>(content, filePath);
        }),
    );

    const schemaNames = parsedSchemas
      .filter((schema): schema is ContentType => Boolean(schema?.name))
      .map((schema) => schema.name);

    const contentFiles = await this.listGitFiles('content', branch);
    const collectionCounts = new Map<string, number>();
    for (const filePath of contentFiles) {
      const [, collectionName] = filePath.split('/');
      if (!collectionName) {
        continue;
      }

      collectionCounts.set(collectionName, (collectionCounts.get(collectionName) ?? 0) + 1);
    }

    return {
      schemas: schemaNames,
      collections: Array.from(collectionCounts.entries()).map(([name, count]) => ({
        name,
        allowed: isCollectionAllowed(name, this.context.config),
        count,
      })),
    };
  }
}
