import { apiServices } from '../../lib/api-services';
import { triggerMappedEnvironmentActions } from '../../webhooks/dispatch';

interface TriggerEntryEnvironmentActionsInput {
  projectId: string;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  changedFiles?: string[];
}

export function triggerEntryEnvironmentActions(input: TriggerEntryEnvironmentActionsInput): void {
  if (!input.commitHash || !input.commitMessage || !input.changedFiles || input.changedFiles.length === 0) {
    return;
  }

  apiServices.runBackgroundTask(
    'entry-environment-actions',
    triggerMappedEnvironmentActions(
      input.projectId,
      input.branch,
      input.commitHash,
      input.commitMessage,
      input.changedFiles,
    ),
  );
}
