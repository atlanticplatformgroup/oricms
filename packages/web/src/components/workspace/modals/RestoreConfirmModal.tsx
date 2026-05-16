import { Badge, Button, Group, Modal, Paper, Stack, Text } from '@mantine/core';

interface RestoreConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  currentBranchName: string;
  selectedHistoryHash?: string | null;
  selectedHistoryMessage?: string | null;
  loading: boolean;
  disabled: boolean;
  onConfirm: () => void;
}

export function RestoreConfirmModal({ opened, onClose, currentBranchName, selectedHistoryHash, selectedHistoryMessage, loading, disabled, onConfirm }: RestoreConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Restore this revision" centered>
      <Stack gap="md">
        <Paper withBorder p="sm">
          <Stack gap="xs">
            <Group gap="xs">
              <Badge variant="filled" color="gray">{selectedHistoryHash?.slice(0, 8) || 'Revision'}</Badge>
              <Badge variant="light" color="gray">{`Branch ${currentBranchName}`}</Badge>
            </Group>
            {selectedHistoryMessage ? <Text fw={500}>{selectedHistoryMessage}</Text> : null}
            <Text size="sm" c="dimmed">
              Restoring writes this revision back to the current branch as a new commit. Earlier history is preserved.
            </Text>
          </Stack>
        </Paper>
        <Text size="sm">
          The selected revision will become the latest version of this entry on <Text span fw={600}>{currentBranchName}</Text>.
        </Text>
        <Text size="sm" c="dimmed">
          OriCMS does not overwrite history when restoring. It appends a new commit that matches the selected revision.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} loading={loading} disabled={disabled}>Confirm restore</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
