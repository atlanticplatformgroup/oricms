import { Alert, Badge, Button, Checkbox, Divider, Group, Modal, Radio, Select, Stack, Text, TextInput } from '@mantine/core';
import type { EntryBranchTransferDiffNode, EntryBranchTransferResolution } from '@ori/shared';

interface EntryBranchTransferModalProps {
  opened: boolean;
  onClose: () => void;
  fromBranch: string;
  branchOptions: Array<{ value: string; label: string }>;
  branchesLoading: boolean;
  targetBranch: string | null;
  onTargetBranchChange: (value: string | null) => void;
  mode: 'entire_entry' | 'selected_paths';
  onModeChange: (value: 'entire_entry' | 'selected_paths') => void;
  message: string;
  onMessageChange: (value: string) => void;
  preview: {
    targetExists: boolean;
    modeAvailability: { entire_entry: boolean; selected_paths: boolean };
    diffTree: EntryBranchTransferDiffNode[];
    conflicts: Array<{ pointer: string; label: string }>;
    schemaCompatibility: { matches: boolean; message: string | null };
  } | null;
  previewLoading: boolean;
  previewError: boolean;
  onRetryPreview: () => void;
  selectedPointers: string[];
  onSelectedPointersChange: (value: string[]) => void;
  resolutions: Record<string, EntryBranchTransferResolution['strategy']>;
  onResolutionChange: (pointer: string, strategy: EntryBranchTransferResolution['strategy']) => void;
  applyPending: boolean;
  canApply: boolean;
  onApply: () => void;
}

function togglePointerSelection(selectedPointers: string[], pointer: string): string[] {
  return selectedPointers.includes(pointer)
    ? selectedPointers.filter((value) => value !== pointer)
    : [...selectedPointers, pointer];
}

function DiffTree({
  nodes,
  selectedPointers,
  onSelectedPointersChange,
  conflicts,
  resolutions,
  onResolutionChange,
  depth = 0,
}: {
  nodes: EntryBranchTransferDiffNode[];
  selectedPointers: string[];
  onSelectedPointersChange: (value: string[]) => void;
  conflicts: Map<string, string>;
  resolutions: Record<string, EntryBranchTransferResolution['strategy']>;
  onResolutionChange: (pointer: string, strategy: EntryBranchTransferResolution['strategy']) => void;
  depth?: number;
}) {
  return (
    <Stack gap="xs">
      {nodes.map((node) => {
        const selected = selectedPointers.includes(node.pointer);
        const conflictLabel = conflicts.get(node.pointer);
        return (
          <Stack
            key={node.pointer}
            gap="xs"
            style={{
              paddingLeft: depth ? `calc(${depth} * var(--mantine-spacing-md))` : 0,
              borderLeft: depth ? '1px solid var(--mantine-color-gray-3)' : undefined,
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Checkbox
                checked={selected}
                onChange={() => onSelectedPointersChange(togglePointerSelection(selectedPointers, node.pointer))}
                label={
                  <Group gap="xs">
                    <Text size="sm">{node.label}</Text>
                    <Badge variant="light" color={node.kind === 'added' ? 'green' : node.kind === 'removed' ? 'red' : 'blue'}>
                      {node.kind}
                    </Badge>
                    {node.field ? <Badge variant="light" color="gray">{node.field.type}</Badge> : null}
                  </Group>
                }
              />
            </Group>

            {selected && conflictLabel ? (
              <Stack gap={4} ml="xl">
                <Text size="xs" c="red">{conflictLabel}</Text>
                <Radio.Group
                  value={resolutions[node.pointer] ?? ''}
                  onChange={(value) => onResolutionChange(node.pointer, value as EntryBranchTransferResolution['strategy'])}
                >
                  <Group gap="md">
                    <Radio value="source" label="Use source" />
                    <Radio value="target" label="Keep target" />
                  </Group>
                </Radio.Group>
              </Stack>
            ) : null}

            {node.children?.length ? (
              <DiffTree
                nodes={node.children}
                selectedPointers={selectedPointers}
                onSelectedPointersChange={onSelectedPointersChange}
                conflicts={conflicts}
                resolutions={resolutions}
                onResolutionChange={onResolutionChange}
                depth={depth + 1}
              />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

export function EntryBranchTransferModal(props: EntryBranchTransferModalProps) {
  const conflictMap = new Map(props.preview?.conflicts.map((conflict) => [conflict.pointer, `Conflict detected for ${conflict.label}`]) ?? []);

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Copy to branch" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">Apply content from the current entry to another branch.</Text>

        <TextInput label="From branch" value={props.fromBranch} readOnly />
        <Select
          label="To branch"
          placeholder={props.branchesLoading ? 'Loading branches' : 'Select a target branch'}
          data={props.branchOptions}
          value={props.targetBranch}
          onChange={props.onTargetBranchChange}
          nothingFoundMessage="No other branches available"
        />

        <Radio.Group label="Scope" value={props.mode} onChange={(value) => props.onModeChange(value as 'entire_entry' | 'selected_paths')}>
          <Stack gap="xs">
            <Radio value="entire_entry" label="Entire entry" />
            <Radio value="selected_paths" label="Selected changes" disabled={!props.preview?.modeAvailability.selected_paths} />
          </Stack>
        </Radio.Group>

        <TextInput label="Commit message" value={props.message} onChange={(event) => props.onMessageChange(event.currentTarget.value)} />

        {!props.targetBranch ? (
          <Alert color="blue">Select a target branch to preview the transfer.</Alert>
        ) : props.previewLoading ? (
          <Alert color="gray">Loading branch copy preview…</Alert>
        ) : props.previewError ? (
          <Alert color="red" title="Unable to load preview">
            <Group justify="space-between" align="center">
              <Text size="sm">Try reloading the preview.</Text>
              <Button size="xs" variant="default" onClick={props.onRetryPreview}>Retry</Button>
            </Group>
          </Alert>
        ) : props.preview ? (
          <>
            {!props.preview.schemaCompatibility.matches && props.preview.schemaCompatibility.message ? (
              <Alert color="red" title="Schema mismatch between branches">
                {props.preview.schemaCompatibility.message}
              </Alert>
            ) : null}

            {!props.preview.targetExists ? (
              <Alert color="yellow">The entry does not exist on the target branch yet. Use <strong>Entire entry</strong> to create it there.</Alert>
            ) : null}

            {props.preview.schemaCompatibility.matches && props.mode === 'entire_entry' ? (
              <Alert color="blue">
                Copy the full entry into the target branch. Existing entry content on that branch will be replaced with the source branch version.
              </Alert>
            ) : props.preview.schemaCompatibility.matches ? (
              <>
                <Divider />
                {props.preview.diffTree.length === 0 ? (
                  <Alert color="gray">No content differences were found for this entry.</Alert>
                ) : (
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>Changed content</Text>
                      <Text size="xs" c="dimmed">{props.selectedPointers.length} selected</Text>
                    </Group>
                    <DiffTree
                      nodes={props.preview.diffTree}
                      selectedPointers={props.selectedPointers}
                      onSelectedPointersChange={props.onSelectedPointersChange}
                      conflicts={conflictMap}
                      resolutions={props.resolutions}
                      onResolutionChange={props.onResolutionChange}
                    />
                  </Stack>
                )}
              </>
            ) : null}
          </>
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button loading={props.applyPending} disabled={!props.canApply} onClick={props.onApply}>
            {props.mode === 'entire_entry' ? 'Copy entry' : 'Apply selected changes'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
