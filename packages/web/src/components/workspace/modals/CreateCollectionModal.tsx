import { Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import type { ContentType } from '@ori/shared';

interface NewCollectionState {
  id: string;
  label: string;
  singularLabel: string;
  contentType: string;
  path: string;
  description: string;
}

interface CreateCollectionModalProps {
  opened: boolean;
  onClose: () => void;
  newCollection: NewCollectionState;
  setNewCollection: React.Dispatch<React.SetStateAction<NewCollectionState>>;
  contentTypes: ContentType[];
  pathError: string | null;
  loading: boolean;
  onCreate: () => void;
}

export function CreateCollectionModal({
  opened,
  onClose,
  newCollection,
  setNewCollection,
  contentTypes,
  pathError,
  loading,
  onCreate,
}: CreateCollectionModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Create collection" centered>
      <Stack gap="sm">
        <TextInput
          label="Collection id"
          value={newCollection.id}
          onChange={(event) => setNewCollection((previous) => ({ ...previous, id: event.currentTarget.value }))}
        />
        <TextInput
          label="Label"
          value={newCollection.label}
          onChange={(event) => setNewCollection((previous) => ({ ...previous, label: event.currentTarget.value }))}
        />
        <TextInput
          label="Singular label"
          value={newCollection.singularLabel}
          onChange={(event) => setNewCollection((previous) => ({ ...previous, singularLabel: event.currentTarget.value }))}
        />
        <Select
          label="Content type"
          data={contentTypes.map((type) => ({
            value: type.$id,
            label: type.label || type.name || type.$id,
          }))}
          value={newCollection.contentType || null}
          onChange={(nextValue) =>
            setNewCollection((previous) => {
              const selectedType = contentTypes.find((type) => type.$id === nextValue);
              const nextId = previous.id || selectedType?.name || '';
              return {
                ...previous,
                contentType: nextValue || '',
                id: previous.id || nextId,
                label: previous.label || selectedType?.labelPlural || selectedType?.label || '',
                singularLabel: previous.singularLabel || selectedType?.label || '',
                path: previous.path || (nextId ? `content/${nextId}s` : ''),
              };
            })}
        />
        <TextInput
          label="Path"
          value={newCollection.path}
          error={newCollection.path ? pathError || undefined : undefined}
          description="Use a repo-relative folder path like content/blog-posts."
          onChange={(event) => setNewCollection((previous) => ({ ...previous, path: event.currentTarget.value }))}
        />
        <TextInput
          label="Description"
          value={newCollection.description}
          onChange={(event) => setNewCollection((previous) => ({ ...previous, description: event.currentTarget.value }))}
        />
        <Text size="xs" c="dimmed">
          Creating a collection adds a new collection config tied to an existing content type. It does not create or delete schemas.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onCreate} loading={loading} disabled={Boolean(newCollection.path) && Boolean(pathError)}>
            Create collection
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
