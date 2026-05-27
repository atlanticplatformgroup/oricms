import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';

interface SchemaHistoryModalProps {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  history: Array<{ hash: string; message: string; author: string; date: string }>;
}

export function SchemaHistoryModal({ opened, onClose, loading, history }: SchemaHistoryModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Schema history" centered size="lg">
      <Stack gap="sm">
        {loading ? (
          <Text size="sm" c="dimmed">Loading schema history...</Text>
        ) : history.length === 0 ? (
          <Text size="sm" c="dimmed">No schema history is available yet.</Text>
        ) : (
          history.map((item) => (
            <Group key={item.hash} justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={2} miw={0} flex={1}>
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="outline" color="gray">{item.hash.slice(0, 8).toUpperCase()}</Badge>
                  <Text size="sm" truncate="end">{item.message}</Text>
                </Group>
                <Text size="xs" c="dimmed">{item.author} · {new Date(item.date).toLocaleString()}</Text>
              </Stack>
            </Group>
          ))
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Close</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

