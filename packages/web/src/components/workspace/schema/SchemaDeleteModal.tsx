import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';

interface SchemaDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  label: string;
  mode: 'types' | 'components';
  loading: boolean;
  onConfirm: () => void;
}

export function SchemaDeleteModal({ opened, onClose, label, mode, loading, onConfirm }: SchemaDeleteModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={`Delete ${mode === 'components' ? 'component' : 'content type'}`} centered>
      <Stack gap="sm">
        <Text size="sm">
          Delete <strong>{label}</strong>. This removes the schema file from the repository.
        </Text>
        <Alert color="yellow" title="Dependency check is conservative">
          OriCMS does not yet analyze every dependency here. Delete only when you are confident this schema is no longer in use.
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="red" onClick={onConfirm} loading={loading}>Delete schema</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

