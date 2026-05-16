import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';

interface CreateSchemaModalProps {
  opened: boolean;
  onClose: () => void;
  mode: 'types' | 'components';
  name: string;
  setName: (value: string) => void;
  label: string;
  setLabel: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  loading: boolean;
  onCreate: () => void;
}

export function CreateSchemaModal({ opened, onClose, mode, name, setName, label, setLabel, description, setDescription, loading, onCreate }: CreateSchemaModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={mode === 'components' ? 'Create component' : 'Create content type'} centered>
      <Stack gap="sm">
        <TextInput label="Name" placeholder={mode === 'components' ? 'quote_block' : 'blog_post'} value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <TextInput label="Label" placeholder={mode === 'components' ? 'Quote Block' : 'Blog Post'} value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
        <TextInput label="Description" value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
        <Text size="xs" c="dimmed">
          {mode === 'components'
            ? 'Components are reusable field groups. Make them repeatable from content-type fields when you need structured repeater behavior.'
            : 'Content types define entry models. Prefer repeatable components for structured repeaters and blocks only for mixed-type zones.'}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={onCreate} loading={loading}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
