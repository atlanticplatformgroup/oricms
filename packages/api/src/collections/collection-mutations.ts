import fs from 'fs/promises';
import path from 'path';
import type { CollectionConfig, CollectionEntry, ContentType } from '@ori/shared';
import type { GitService } from '../git/service';
import { StaleEntryRevisionError } from './collection-errors';
import {
  computeCollectionEntryRevision,
  generateCollectionEntryId,
  validateCollectionEntry,
} from './service-support';

type Author = { name: string; email: string };

type ResolvedPaths = { absolute: string; repoRelative: string };

type MutationContext = {
  projectId: string;
  gitService: GitService;
  getResolvedPaths: (relativePath: string) => Promise<ResolvedPaths>;
};

export async function createCollectionEntryMutation(input: {
  context: MutationContext;
  collectionId: string;
  config: CollectionConfig;
  contentType: ContentType;
  data: Record<string, unknown>;
  author: Author;
}): Promise<{
  entry: CollectionEntry;
  revision: string;
  commitHash?: string;
  commitMessage: string;
  changedFiles: string[];
}> {
  const id = generateCollectionEntryId(input.data, input.contentType);
  const now = new Date().toISOString();

  const { id: _legacyId, ...cleanData } = input.data as Record<string, unknown> & { id?: string };
  const normalizedStatus = cleanData.$status === 'published' ? 'published' : 'draft';
  const publishedAt = normalizedStatus === 'published'
    ? (typeof cleanData.$publishedAt === 'string' ? cleanData.$publishedAt : now)
    : undefined;

  const entry: CollectionEntry = {
    ...cleanData,
    $id: id,
    $type: input.config.contentType,
    $status: normalizedStatus,
    $createdAt: now,
    $updatedAt: now,
    ...(publishedAt ? { $publishedAt: publishedAt } : {}),
  };

  validateCollectionEntry(entry, input.contentType);

  const { absolute: entryFile, repoRelative } = await input.context.getResolvedPaths(
    path.join(input.config.path, `${id}.json`),
  );

  await fs.mkdir(path.dirname(entryFile), { recursive: true });

  try {
    await fs.access(entryFile);
    throw new Error(`Entry with id '${id}' already exists`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
  }

  const jsonContent = JSON.stringify(entry, null, 2) + '\n';
  await fs.writeFile(entryFile, jsonContent, 'utf-8');

  const commitMessage = `Create ${input.contentType.label} entry in ${input.config.label}: ${id}`;
  await input.context.gitService.commitAndPush(
    input.context.projectId,
    [repoRelative],
    commitMessage,
    input.author,
  );
  const commit = await input.context.gitService.getCurrentCommit(input.context.projectId);

  return {
    entry,
    revision: computeCollectionEntryRevision(entry),
    commitHash: commit.hash,
    commitMessage,
    changedFiles: [repoRelative],
  };
}

export async function updateCollectionEntryMutation(input: {
  context: MutationContext;
  config: CollectionConfig;
  contentType: ContentType;
  id: string;
  data: Record<string, unknown>;
  author: Author;
  baseRevision?: string;
}): Promise<{
  entry: CollectionEntry;
  revision: string;
  commitHash?: string;
  commitMessage: string;
  changedFiles: string[];
}> {
  const { absolute: entryFile, repoRelative } = await input.context.getResolvedPaths(
    path.join(input.config.path, `${input.id}.json`),
  );

  let existing: CollectionEntry;
  try {
    const content = await fs.readFile(entryFile, 'utf-8');
    existing = JSON.parse(content) as CollectionEntry;
  } catch {
    throw new Error(`Entry '${input.id}' not found in collection '${input.config.id}' at ${repoRelative}`);
  }

  const currentRevision = computeCollectionEntryRevision(existing);
  if (input.baseRevision && input.baseRevision !== currentRevision) {
    throw new StaleEntryRevisionError(input.id, currentRevision);
  }

  const { id: _legacyId, ...cleanData } = input.data as Record<string, unknown> & { id?: string };
  const updated: CollectionEntry = {
    ...existing,
    ...cleanData,
    $id: existing.$id || input.id,
    $type: existing.$type || input.config.contentType,
    $createdAt: existing.$createdAt,
    $updatedAt: new Date().toISOString(),
  };

  validateCollectionEntry(updated, input.contentType);

  const jsonContent = JSON.stringify(updated, null, 2) + '\n';
  await fs.writeFile(entryFile, jsonContent, 'utf-8');

  const commitMessage = `Update ${input.contentType.label} entry in ${input.config.label}: ${input.id}`;
  await input.context.gitService.commitAndPush(
    input.context.projectId,
    [repoRelative],
    commitMessage,
    input.author,
  );
  const commit = await input.context.gitService.getCurrentCommit(input.context.projectId);

  return {
    entry: updated,
    revision: computeCollectionEntryRevision(updated),
    commitHash: commit.hash,
    commitMessage,
    changedFiles: [repoRelative],
  };
}

export async function deleteCollectionEntryMutation(input: {
  context: MutationContext;
  config: CollectionConfig;
  contentTypeLabel: string;
  id: string;
  author: Author;
  baseRevision?: string;
}): Promise<{
  previousEntry: CollectionEntry;
  revision: string;
  commitHash?: string;
  commitMessage: string;
  changedFiles: string[];
}> {
  const { absolute: entryFile, repoRelative } = await input.context.getResolvedPaths(
    path.join(input.config.path, `${input.id}.json`),
  );

  let previousEntry: CollectionEntry;
  try {
    const content = await fs.readFile(entryFile, 'utf-8');
    previousEntry = JSON.parse(content) as CollectionEntry;
  } catch {
    throw new Error(`Entry '${input.id}' not found in collection '${input.config.id}' at ${repoRelative}`);
  }

  const currentRevision = computeCollectionEntryRevision(previousEntry);
  if (input.baseRevision && input.baseRevision !== currentRevision) {
    throw new StaleEntryRevisionError(input.id, currentRevision);
  }

  try {
    await fs.unlink(entryFile);
    const commitMessage = `Delete ${input.contentTypeLabel} entry from ${input.config.label}: ${input.id}`;
    await input.context.gitService.commitAndPush(
      input.context.projectId,
      [repoRelative],
      commitMessage,
      input.author,
      true,
    );
    const commit = await input.context.gitService.getCurrentCommit(input.context.projectId);

    return {
      previousEntry,
      revision: currentRevision,
      commitHash: commit.hash,
      commitMessage,
      changedFiles: [repoRelative],
    };
  } catch {
    throw new Error(`Entry '${input.id}' not found in collection '${input.config.id}' at ${repoRelative}`);
  }
}
