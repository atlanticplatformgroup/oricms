import { ActionIcon, Alert, Badge, Button, Divider, Group, Paper, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { Plus, Trash2 } from 'lucide-react';
import type { Environment } from '@ori/shared';
import {
  WorkspaceFieldGrid,
  WorkspaceMetricBadge,
  WorkspaceSection,
  WorkspaceToggleRow,
} from '../../ui/WorkspacePrimitives';
import type { EnvironmentSettingsViewProps } from './types';

function getEnvironmentTypeMeta(type: Environment['type']) {
  if (type === 'live') {
    return {
      label: 'Live',
      color: 'teal',
      description: 'Published content only',
    } as const;
  }

  return {
    label: 'Preview',
    color: 'blue',
    description: 'Draft content allowed for previews',
  } as const;
}

export function ConfiguredEnvironmentsSection(props: EnvironmentSettingsViewProps & {
  hasValidationIssues: boolean;
}) {
  return (
    <WorkspaceSection
      title="Configured environments"
      description="Preview and live targets drive preview buttons, publishing defaults, and deploy triggers."
      badge={<WorkspaceMetricBadge>{`${props.environments.length} environments`}</WorkspaceMetricBadge>}
      actions={(
        <Group gap="xs" wrap="wrap">
          <Button variant="default" leftSection={<Plus size={14} />} onClick={props.onAddEnvironment} disabled={props.readOnly}>
            Add environment
          </Button>
          <Button
            onClick={props.onSave}
            loading={props.savePending}
            disabled={props.readOnly || !props.environmentsDirty || props.hasValidationIssues || props.environments.length === 0}
          >
            Save environments
          </Button>
        </Group>
      )}
    >
      <Stack gap="md">
        {props.hasValidationIssues ? (
          <Alert color="orange" title="Review environment details">
            Fix invalid URLs and missing names before saving environment changes.
          </Alert>
        ) : null}
        {props.environments.length === 0 ? (
          <Alert color="gray" title="No environments configured">
            Add at least one preview or live environment before mapping branches.
          </Alert>
        ) : (
          <Stack gap="md">
            <Paper withBorder p="md" radius="md">
              <WorkspaceSection
                title="Default environment"
                description="Used when branch mappings do not choose an explicit environment."
              >
                <Select
                  label="Default environment"
                  placeholder="Select environment"
                  data={props.environmentOptions}
                  value={props.defaultEnvironmentId || null}
                  disabled={props.readOnly}
                  onChange={(value) => props.onDefaultEnvironmentChange(value || '')}
                />
              </WorkspaceSection>
            </Paper>

            {props.environments.map((environment, index) => {
              const environmentErrors = props.validation[environment.id] || {};
              const typeMeta = getEnvironmentTypeMeta(environment.type);

              return (
                <Paper key={environment.id} withBorder p="md" radius="md">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
                      <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                        <Group gap="xs" wrap="wrap">
                          <Text fw={600}>{environment.name || `Environment ${index + 1}`}</Text>
                          <Badge variant="light" color={typeMeta.color}>{typeMeta.label}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">{typeMeta.description}</Text>
                      </Stack>
                      <ActionIcon
                        variant="default"
                        color="red"
                        aria-label={`Delete environment ${environment.name}`}
                        disabled={props.readOnly}
                        onClick={() => props.onDeleteEnvironment(environment.id)}
                      >
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Group>

                    <Divider />

                    <WorkspaceSection
                      title="Basics"
                      description="Name this target and choose whether it is a preview or live destination."
                    >
                      <WorkspaceFieldGrid>
                        <TextInput
                          label="Name"
                          value={environment.name}
                          error={environmentErrors.name}
                          disabled={props.readOnly}
                          onChange={(event) => props.onUpdateEnvironment(environment.id, { name: event.currentTarget.value })}
                        />
                        <Select
                          label="Type"
                          data={[
                            { value: 'preview', label: 'Preview' },
                            { value: 'live', label: 'Live' },
                          ]}
                          value={environment.type}
                          disabled={props.readOnly}
                          onChange={(value) => {
                            if (!value) return;
                            props.onUpdateEnvironment(environment.id, { type: value as Environment['type'] });
                          }}
                        />
                      </WorkspaceFieldGrid>
                    </WorkspaceSection>

                    <Divider />

                    <WorkspaceSection
                      title="URLs"
                      description="Base URLs and webhook targets used by previews, deploys, and revalidation."
                    >
                      <Stack gap="sm">
                        <TextInput
                          label="URL"
                          description="Base URL used for previews, links, and deployment context."
                          placeholder="https://preview.example.com"
                          value={environment.url}
                          error={environmentErrors.url}
                          disabled={props.readOnly}
                          onChange={(event) => props.onUpdateEnvironment(environment.id, { url: event.currentTarget.value })}
                        />
                        <WorkspaceFieldGrid>
                          <TextInput
                            label="Build webhook"
                            placeholder="https://..."
                            value={environment.buildWebhook || ''}
                            error={environmentErrors.buildWebhook}
                            disabled={props.readOnly}
                            onChange={(event) => props.onUpdateEnvironment(environment.id, { buildWebhook: event.currentTarget.value || undefined })}
                          />
                          <TextInput
                            label="Revalidation URL"
                            placeholder="https://..."
                            value={environment.revalidationUrl || ''}
                            error={environmentErrors.revalidationUrl}
                            disabled={props.readOnly}
                            onChange={(event) => props.onUpdateEnvironment(environment.id, { revalidationUrl: event.currentTarget.value || undefined })}
                          />
                        </WorkspaceFieldGrid>
                      </Stack>
                    </WorkspaceSection>

                    <Divider />

                    <WorkspaceSection
                      title="Automation"
                      description="Choose what should happen automatically when changes reach the default branch."
                    >
                      <WorkspaceToggleRow
                        label="Auto-publish on default branch"
                        description="Publish automatically when changes land on the project’s default branch."
                        control={(
                          <Switch
                            aria-label="Auto-publish on default branch"
                            checked={Boolean(environment.autoPublish)}
                            disabled={props.readOnly}
                            onChange={(event) => props.onUpdateEnvironment(environment.id, { autoPublish: event.currentTarget.checked })}
                          />
                        )}
                      />
                    </WorkspaceSection>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </WorkspaceSection>
  );
}

export function BranchMappingsSection(props: EnvironmentSettingsViewProps) {
  return (
    <WorkspaceSection
      title="Branch mappings"
      description="Connect branch patterns to environments and deployment behavior."
      badge={<WorkspaceMetricBadge>{`${props.mappings.length} mappings`}</WorkspaceMetricBadge>}
    >
      <Stack gap="md">
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <WorkspaceSection
              title="Add mapping"
              description="Connect a branch pattern to an environment and an optional deploy policy."
            >
              <Stack gap="md">
                <WorkspaceFieldGrid>
                  <TextInput
                    label="Branch pattern"
                    placeholder="main or release/*"
                    value={props.newMapping.branchPattern}
                    disabled={props.readOnly}
                    onChange={(event) => props.onNewMappingChange({ branchPattern: event.currentTarget.value })}
                  />
                  <Select
                    label="Environment"
                    placeholder="Optional"
                    data={props.environmentOptions}
                    value={props.newMapping.environmentId || null}
                    disabled={props.readOnly}
                    onChange={(value) => props.onNewMappingChange({ environmentId: value || '' })}
                  />
                </WorkspaceFieldGrid>
                <WorkspaceFieldGrid>
                  <WorkspaceToggleRow
                    label="Auto deploy on push"
                    description="Trigger deployment automatically whenever a matching branch receives a push."
                    control={(
                      <Switch
                        aria-label="Auto deploy on push"
                        checked={props.newMapping.autoDeploy}
                        disabled={props.readOnly}
                        onChange={(event) => props.onNewMappingChange({ autoDeploy: event.currentTarget.checked })}
                      />
                    )}
                  />
                  <WorkspaceToggleRow
                    label="Deploy on merge commit"
                    description="Trigger deployment only when changes land as a merge commit."
                    control={(
                      <Switch
                        aria-label="Deploy on merge commit"
                        checked={props.newMapping.deployOnMerge}
                        disabled={props.readOnly}
                        onChange={(event) => props.onNewMappingChange({ deployOnMerge: event.currentTarget.checked })}
                      />
                    )}
                  />
                </WorkspaceFieldGrid>
              </Stack>
            </WorkspaceSection>
            <Group justify="flex-end">
              <Button onClick={props.onCreateMapping} loading={props.createPending} disabled={props.readOnly || !props.canCreateMapping}>
                Save mapping
              </Button>
            </Group>
          </Stack>
        </Paper>

        {props.mappingsLoading ? (
          <Group justify="center" py="xl"><Text size="sm" c="dimmed">Loading branch mappings…</Text></Group>
        ) : props.mappingsError ? (
          <Alert color="red" title="Failed to load branch mappings">
            Branch mapping data is unavailable right now.
          </Alert>
        ) : props.mappings.length === 0 ? (
          <Alert color="gray" title="No branch mappings">
            Add a mapping to connect branches to your configured environments.
          </Alert>
        ) : (
          <Stack gap="sm">
            {props.mappings.map((mapping) => (
              <Paper key={mapping.id} withBorder p="md" radius="md">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
                    <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={600}>{mapping.branchPattern}</Text>
                        {mapping.environmentId ? (
                          <Badge variant="light" color="gray">
                            {props.environmentOptions.find((option) => option.value === mapping.environmentId)?.label || 'Mapped environment'}
                          </Badge>
                        ) : null}
                      </Group>
                      <Text size="sm" c="dimmed">Map this branch pattern to an environment and deploy policy.</Text>
                    </Stack>
                    <ActionIcon
                      variant="default"
                      color="red"
                      aria-label={`Delete mapping ${mapping.branchPattern}`}
                      disabled={props.readOnly}
                      onClick={() => props.onDeleteMapping(mapping.id)}
                      loading={props.deletePending}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Group>

                  <Divider />

                  <WorkspaceSection
                    title="Pattern"
                    description="Choose which branches this mapping applies to and which environment it targets."
                  >
                    <WorkspaceFieldGrid>
                      <TextInput
                        label="Branch pattern"
                        defaultValue={mapping.branchPattern}
                        disabled={props.readOnly}
                        onBlur={(event) => {
                          const nextValue = event.currentTarget.value.trim();
                          if (nextValue && nextValue !== mapping.branchPattern) {
                            props.onUpdateMapping(mapping.id, { branchPattern: nextValue });
                          }
                        }}
                      />
                      <Select
                        label="Environment"
                        data={props.environmentOptions}
                        value={mapping.environmentId || null}
                        clearable
                        disabled={props.readOnly}
                        onChange={(value) => props.onUpdateMapping(mapping.id, { environmentId: value || null })}
                      />
                    </WorkspaceFieldGrid>
                  </WorkspaceSection>

                  <Divider />

                  <WorkspaceSection
                    title="Automation"
                    description="Control whether matching branches deploy immediately or only after merge commits."
                  >
                    <WorkspaceFieldGrid>
                      <WorkspaceToggleRow
                        label="Auto deploy"
                        description="Deploy immediately when matching branches receive updates."
                        control={(
                          <Switch
                            aria-label="Auto deploy"
                            checked={mapping.autoDeploy}
                            disabled={props.readOnly || props.updatePending}
                            onChange={(event) => props.onUpdateMapping(mapping.id, { autoDeploy: event.currentTarget.checked })}
                          />
                        )}
                      />
                      <WorkspaceToggleRow
                        label="Deploy on merge"
                        description="Only deploy when the matching branch receives a merge commit."
                        control={(
                          <Switch
                            aria-label="Deploy on merge"
                            checked={mapping.deployOnMerge}
                            disabled={props.readOnly || props.updatePending}
                            onChange={(event) => props.onUpdateMapping(mapping.id, { deployOnMerge: event.currentTarget.checked })}
                          />
                        )}
                      />
                    </WorkspaceFieldGrid>
                  </WorkspaceSection>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </WorkspaceSection>
  );
}
