import { Badge, Button, Center, Loader, Modal, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

interface RelationOption {
  value: string;
  label: string;
}

interface RelationPickerModalProps {
  opened: boolean;
  onClose: () => void;
  fieldLabel?: string;
  collectionLabel?: string;
  multiple: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  options: RelationOption[];
  selectedValues: string[];
  onSelect: (nextValue: string[] | string) => void;
}

export function RelationPickerModal({
  opened,
  onClose,
  fieldLabel,
  collectionLabel,
  multiple,
  search,
  onSearchChange,
  loading,
  options,
  selectedValues,
  onSelect,
}: RelationPickerModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const selectedSet = new Set(selectedValues);

  const handleToggle = (value: string) => {
    if (!multiple) {
      onSelect(value);
      onClose();
      return;
    }

    if (selectedSet.has(value)) {
      onSelect(selectedValues.filter((current) => current !== value));
      return;
    }

    onSelect([...selectedValues, value]);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Browse entries" centered size="lg" fullScreen={isMobile}>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text size="sm" fw={500}>{fieldLabel || 'Relation field'}</Text>
          <Text size="xs" c="dimmed">
            {collectionLabel ? `Select entries from ${collectionLabel}.` : 'Select entries from the target collection.'}
          </Text>
        </Stack>
        <TextInput
          placeholder="Search entries"
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
        {loading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : (
          <ScrollArea h={420}>
            <Stack gap="xs">
              {options.map((option) => {
                const selected = selectedSet.has(option.value);
                return (
                  <Paper
                    key={option.value}
                    withBorder
                    p="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleToggle(option.value)}
                  >
                    <Stack gap={4}>
                      <Text fw={600} size="sm">{option.label}</Text>
                      <Text size="xs" c="dimmed">{option.value}</Text>
                      {selected ? <Badge variant="light">Selected</Badge> : null}
                    </Stack>
                  </Paper>
                );
              })}
              {!options.length ? (
                <Paper withBorder p="md">
                  <Text size="sm" c="dimmed">No entries found.</Text>
                </Paper>
              ) : null}
            </Stack>
          </ScrollArea>
        )}
        {multiple ? (
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
        ) : null}
      </Stack>
    </Modal>
  );
}
