import type { CollectionEntry, EntryBranchTransferApplyRequest } from '@ori/shared';
import { GitService } from '../git/service';
import {
  cloneValue,
  deepEqual,
  deletePointerValue,
  getValueAtPointer,
  isAncestorPointer,
  normalizeSelectedPointers,
  setPointerValue,
} from './entry-branch-transfer-support';
import { loadTransferState } from './entry-branch-transfer-state';
import { previewEntryBranchTransfer } from './entry-branch-transfer-preview';

export async function applyEntryBranchTransfer(options: {
  gitService: GitService;
  projectId: string;
  collectionId: string;
  entryId: string;
  request: EntryBranchTransferApplyRequest;
  author: { name: string; email: string };
}) {
  const preview = await previewEntryBranchTransfer({
    gitService: options.gitService,
    projectId: options.projectId,
    collectionId: options.collectionId,
    entryId: options.entryId,
    sourceBranch: options.request.sourceBranch,
    targetBranch: options.request.targetBranch,
  });
  const state = await loadTransferState(
    options.gitService,
    options.projectId,
    options.collectionId,
    options.entryId,
    options.request.sourceBranch,
    options.request.targetBranch,
  );

  const sourceEntry = state.sourceEntry;
  const targetEntry = state.targetEntry;
  if (!sourceEntry) {
    throw new Error(`Entry '${options.entryId}' not found on branch '${options.request.sourceBranch}'`);
  }

  if (!preview.schemaCompatibility.matches) {
    throw new Error(preview.schemaCompatibility.message || 'Schema mismatch between branches');
  }

  if (options.request.mode === 'selected_paths' && !preview.targetExists) {
    throw new Error('Selected changes require the entry to exist on the target branch');
  }

  const resolutions = new Map((options.request.resolutions ?? []).map((item) => [item.pointer, item.strategy]));
  const selectedPointers = options.request.mode === 'selected_paths'
    ? normalizeSelectedPointers(options.request.selectedPointers ?? [])
    : [];

  if (options.request.mode === 'selected_paths' && selectedPointers.length === 0) {
    throw new Error('Select at least one change to apply');
  }

  const unresolvedConflicts = preview.conflicts.filter((conflict) => {
    const selected = selectedPointers.some(
      (pointer) => isAncestorPointer(pointer, conflict.pointer) || isAncestorPointer(conflict.pointer, pointer),
    );
    return selected && !resolutions.has(conflict.pointer);
  });
  if (unresolvedConflicts.length > 0) {
    throw new Error('Resolve all selected conflicts before applying changes');
  }

  const nextEntry = buildNextEntry(sourceEntry, targetEntry, options.request, selectedPointers, resolutions, options.entryId);

  if (deepEqual(nextEntry, targetEntry)) {
    return {
      committed: false,
      hash: '',
      message: options.request.message,
      appliedPointerCount: options.request.mode === 'entire_entry' ? 1 : selectedPointers.length,
    };
  }

  const content = `${JSON.stringify(nextEntry, null, 2)}\n`;
  const commit = await options.gitService.applyFileChangesOnBranch(
    options.projectId,
    options.request.targetBranch,
    [{ path: state.sourceFilePath, content }],
    {
      message: options.request.message,
      author: options.author,
    },
  );

  return {
    committed: commit.committed,
    hash: commit.hash,
    message: commit.message,
    appliedPointerCount: options.request.mode === 'entire_entry' ? 1 : selectedPointers.length,
  };
}

function buildNextEntry(
  sourceEntry: CollectionEntry,
  targetEntry: CollectionEntry | null,
  request: EntryBranchTransferApplyRequest,
  selectedPointers: string[],
  resolutions: Map<string, 'source' | 'target'>,
  entryId: string,
): CollectionEntry {
  let nextEntry: CollectionEntry;
  if (request.mode === 'entire_entry') {
    nextEntry = cloneValue(sourceEntry);
  } else {
    nextEntry = cloneValue(targetEntry) as CollectionEntry;
    selectedPointers.forEach((pointer) => {
      if (resolutions.get(pointer) === 'target') {
        return;
      }

      const sourceState = getValueAtPointer(sourceEntry, pointer);
      nextEntry = sourceState.exists
        ? setPointerValue(nextEntry as Record<string, unknown>, pointer, sourceState.value) as CollectionEntry
        : deletePointerValue(nextEntry as Record<string, unknown>, pointer) as CollectionEntry;
    });
  }

  const now = new Date().toISOString();
  nextEntry.$id = targetEntry?.$id || sourceEntry.$id || entryId;
  nextEntry.$type = targetEntry?.$type || sourceEntry.$type;
  nextEntry.$createdAt = targetEntry?.$createdAt || sourceEntry.$createdAt || now;
  nextEntry.$updatedAt = now;
  return nextEntry;
}
