import { Button, Group, Modal, Stack, Textarea } from '@mantine/core';

interface SchemaJsonModalProps {
  opened: boolean;
  onClose: () => void;
  json: string;
}

export function SchemaJsonModal({ opened, onClose, json }: SchemaJsonModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Schema JSON" centered size="xl">
      <Stack gap="sm">
        <Textarea value={json} readOnly autosize minRows={16} maxRows={28} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Close</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

