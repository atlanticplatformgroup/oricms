import { GitService } from '../git/service';
import type {
  EntryBranchTransferApplyRequest,
  EntryBranchTransferResolution,
} from '@ori/shared';
import { applyEntryBranchTransfer, previewEntryBranchTransfer } from './entry-branch-transfer-operations';

export class EntryBranchTransferService {
  private readonly gitService = new GitService();

  constructor(private readonly projectId: string) {}
  async preview(collectionId: string, entryId: string, sourceBranch: string, targetBranch: string) {
    return previewEntryBranchTransfer({
      gitService: this.gitService,
      projectId: this.projectId,
      collectionId,
      entryId,
      sourceBranch,
      targetBranch,
    });
  }

  async apply(
    collectionId: string,
    entryId: string,
    request: EntryBranchTransferApplyRequest,
    author: { name: string; email: string },
  ): Promise<{ committed: boolean; hash: string; message: string; appliedPointerCount: number }> {
    return applyEntryBranchTransfer({
      gitService: this.gitService,
      projectId: this.projectId,
      collectionId,
      entryId,
      request,
      author,
    });
  }
}

export function isValidEntryBranchTransferResolution(
  value: EntryBranchTransferResolution | undefined,
): value is EntryBranchTransferResolution {
  return Boolean(value && value.pointer && (value.strategy === 'source' || value.strategy === 'target'));
}
