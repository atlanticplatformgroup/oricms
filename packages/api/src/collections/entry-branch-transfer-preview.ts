import type { EntryBranchTransferPreview } from '@ori/shared';
import { GitService } from '../git/service';
import {
  buildEntryBranchTransferDiffTree,
  collectConflictPointers,
} from './entry-branch-transfer-support';
import { loadTransferState } from './entry-branch-transfer-state';

export async function previewEntryBranchTransfer(options: {
  gitService: GitService;
  projectId: string;
  collectionId: string;
  entryId: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<EntryBranchTransferPreview> {
  const state = await loadTransferState(
    options.gitService,
    options.projectId,
    options.collectionId,
    options.entryId,
    options.sourceBranch,
    options.targetBranch,
  );

  if (!state.sourceEntry) {
    throw new Error(`Entry '${options.entryId}' not found on branch '${options.sourceBranch}'`);
  }

  const diffTree = buildEntryBranchTransferDiffTree(state.sourceEntry, state.targetEntry, state.contentType);
  const conflicts = collectConflictPointers(diffTree, state.sourceEntry, state.targetEntry, state.baseEntry);
  const entryLabel = String(state.sourceEntry.title || state.sourceEntry.name || state.sourceEntry.$id || options.entryId);

  return {
    sourceBranch: options.sourceBranch,
    targetBranch: options.targetBranch,
    entryId: options.entryId,
    collectionId: state.collection.id,
    sourceExists: true,
    targetExists: Boolean(state.targetEntry),
    modeAvailability: {
      entire_entry: state.schemaCompatibility.matches,
      selected_paths: state.schemaCompatibility.matches && Boolean(state.targetEntry),
    },
    diffTree,
    conflicts,
    schemaCompatibility: {
      matches: state.schemaCompatibility.matches,
      message: state.schemaCompatibility.message,
    },
    defaultCommitMessage: `Copy ${entryLabel} to ${options.targetBranch}`,
  };
}
