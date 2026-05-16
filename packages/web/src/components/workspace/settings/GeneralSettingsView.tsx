import { Button, Stack, TextInput, Textarea } from '@mantine/core';
import { WorkspaceFieldGrid, WorkspaceFormSection, WorkspaceMain, WorkspaceMetricBadge } from '../../ui/WorkspacePrimitives';
import type { GeneralSettingsViewProps } from './types';

export function GeneralSettingsView({
  project,
  projectName,
  projectDescription,
  contentRoot,
  generalDirty,
  savePending,
  readOnly = false,
  onProjectNameChange,
  onProjectDescriptionChange,
  onContentRootChange,
  onSave,
}: GeneralSettingsViewProps) {
  return (
    <WorkspaceMain>
      <WorkspaceFormSection
        title="Project defaults"
        description="Project identity and repository defaults used throughout the workspace shell."
        badge={<WorkspaceMetricBadge>{generalDirty ? 'Unsaved changes' : 'Up to date'}</WorkspaceMetricBadge>}
        actions={
          <Button onClick={onSave} loading={savePending} disabled={readOnly || !generalDirty || !projectName.trim()}>
            Save settings
          </Button>
        }
      >
        <Stack gap="md">
          <TextInput
            label="Project name"
            description="Used in the workspace shell and switchers."
            value={projectName}
            disabled={readOnly}
            onChange={(event) => onProjectNameChange(event.currentTarget.value)}
          />
          <Textarea
            label="Description"
            description="Internal context for editors and project administrators."
            minRows={3}
            value={projectDescription}
            disabled={readOnly}
            onChange={(event) => onProjectDescriptionChange(event.currentTarget.value)}
          />
          <TextInput
            label="Content root"
            description="Repo-relative root used by default for collection content."
            value={contentRoot}
            disabled={readOnly}
            onChange={(event) => onContentRootChange(event.currentTarget.value)}
          />
          <WorkspaceFieldGrid>
            <TextInput
              label="Default branch"
              description="Set in project configuration and used as the default branch baseline."
              value={project.defaultBranch || 'main'}
              readOnly
            />
            <TextInput
              label="Repository"
              description="Managed by the connected Git repository integration."
              value={project.repoUrl || 'Managed project'}
              readOnly
            />
          </WorkspaceFieldGrid>
        </Stack>
      </WorkspaceFormSection>
    </WorkspaceMain>
  );
}
