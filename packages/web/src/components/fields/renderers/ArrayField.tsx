import { memo, useCallback } from 'react';
import { ActionIcon, Alert, Badge, Button, Group, NumberInput, Paper, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { WorkspaceDragHandle } from '../../ui/WorkspacePrimitives';
import { getDisplayText } from '../../../lib/workspace/format';
import type { FieldRendererProps, StructuredDragItem } from '../contracts';
import { ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

interface ArrayFieldItemProps {
  fieldKey: string;
  index: number;
  item: unknown;
  itemType: string;
  label: string;
  disabled?: boolean;
  dragItem: StructuredDragItem;
  itemState: { collapsed: boolean; changed: boolean; invalid: boolean };
  isDropTarget: boolean;
  getTitle: (item: unknown, fallback: string) => string;
  actions: FieldRendererProps['context']['structuredActions'];
  drag: FieldRendererProps['context']['structuredDrag'];
  renderFrame: (props: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actionsNode?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
}

const ArrayFieldItem = memo(function ArrayFieldItem({
  fieldKey, index, item, itemType, label, disabled, dragItem, itemState, isDropTarget,
  getTitle, actions, drag, renderFrame,
}: ArrayFieldItemProps) {
  const itemLabel = `${label} ${index + 1}`;

  const handleDuplicate = useCallback(() => {
    actions?.duplicateArrayItem?.(fieldKey, index);
  }, [actions, fieldKey, index]);

  const handleToggleCollapsed = useCallback(() => {
    actions?.toggleStructuredItemCollapsed?.(dragItem);
  }, [actions, dragItem]);

  const handleRemove = useCallback(() => {
    actions?.removeArrayItem?.(fieldKey, index);
  }, [actions, fieldKey, index]);

  const handleUpdateBoolean = useCallback((checked: boolean) => {
    actions?.updateArrayItem?.(fieldKey, index, checked);
  }, [actions, fieldKey, index]);

  const handleUpdateNumber = useCallback((nextValue: string | number) => {
    actions?.updateArrayItem?.(fieldKey, index, nextValue === '' ? 0 : nextValue);
  }, [actions, fieldKey, index]);

  const handleUpdateText = useCallback((nextValue: string) => {
    actions?.updateArrayItem?.(fieldKey, index, nextValue);
  }, [actions, fieldKey, index]);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>) => {
    drag?.startDrag(event, dragItem);
  }, [drag, dragItem]);

  const handleDragEnd = useCallback(() => {
    drag?.endDrag();
  }, [drag]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    drag?.dragOver(event, dragItem);
  }, [drag, dragItem]);

  const handleDragLeave = useCallback(() => {
    drag?.dragLeave(dragItem);
  }, [drag, dragItem]);

  const handleDrop = useCallback(() => {
    drag?.drop(dragItem);
  }, [drag, dragItem]);

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <Stack pt={4} gap="xs" align="center">
        <WorkspaceDragHandle
          label="Drag array item"
          draggable={!disabled}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </Stack>
      <div
        style={{ flex: 1, minWidth: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div style={isDropTarget ? { outline: '1px solid var(--mantine-color-blue-5)', borderRadius: 'var(--mantine-radius-md)' } : undefined}>
          {renderFrame({
            eyebrow: (
              <>
                <Badge variant="light" color="gray">{index + 1}</Badge>
                <Badge variant="outline" color="gray">{itemType === 'boolean' ? 'Boolean' : itemType === 'number' ? 'Number' : 'Text'}</Badge>
                {itemState.changed ? <Badge variant="light" color="orange">Changed</Badge> : null}
                {itemState.invalid ? <Badge variant="light" color="red">Invalid</Badge> : null}
              </>
            ),
            title: getTitle(item, `${label} ${index + 1}`),
            description: `Item ${index + 1} of ${items.length}`,
            actionsNode: (
              <>
                <ActionIcon variant="default" disabled={disabled} aria-label="Duplicate array item" onClick={handleDuplicate}>
                  <DocumentDuplicateIcon width={16} height={16} />
                </ActionIcon>
                <ActionIcon variant="default" disabled={disabled} aria-label={itemState.collapsed ? 'Expand array item' : 'Collapse array item'} onClick={handleToggleCollapsed}>
                  {itemState.collapsed ? <ChevronDownIcon width={16} height={16} /> : <ChevronUpIcon width={16} height={16} />}
                </ActionIcon>
                <Button variant="default" color="red" size="xs" disabled={disabled} onClick={handleRemove}>
                  Remove
                </Button>
              </>
            ),
            children: itemState.collapsed ? null : itemType === 'boolean' ? (
              <Switch aria-label={itemLabel} checked={Boolean(item)} disabled={disabled} onChange={(event) => handleUpdateBoolean(event.currentTarget.checked)} />
            ) : itemType === 'number' ? (
              <NumberInput aria-label={itemLabel} value={typeof item === 'number' ? item : undefined} disabled={disabled} onChange={handleUpdateNumber} />
            ) : (
              <TextInput aria-label={itemLabel} value={typeof item === 'string' ? item : getDisplayText(item)} disabled={disabled} onChange={(event) => handleUpdateText(event.currentTarget.value)} />
            ),
          })}
        </div>
      </div>
    </Group>
  );
});

export function ArrayField({ field, value, error, disabled, onChange, context }: FieldRendererProps) {
  const items = Array.isArray(value) ? value : [];
  const supportsPrimitiveRepeater = items.length === 0 || items.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
  const sampleItem = items.find((item) => item !== null && item !== undefined);
  const drag = context.structuredDrag;
  const actions = context.structuredActions;
  const getTitle = context.getStructuredItemTitle ?? ((_: unknown, fallback: string) => fallback);
  const label = field.label || field.key;

  const handleAddItem = useCallback(() => {
    actions?.addArrayItem?.(field.key, sampleItem);
  }, [actions, field.key, sampleItem]);

  const renderFrame = ({ eyebrow, title, description, actionsNode, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actionsNode?: React.ReactNode; children: React.ReactNode }) => (
    <Paper withBorder p="sm">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? <Group gap="xs">{eyebrow}</Group> : null}
            <Text size="sm" fw={600} lineClamp={1}>{title}</Text>
            {description ? <Text size="xs" c="dimmed">{description}</Text> : null}
          </Stack>
          {actionsNode ? <Group gap="xs" wrap="nowrap">{actionsNode}</Group> : null}
        </Group>
        {children}
      </Stack>
    </Paper>
  );

  if (!supportsPrimitiveRepeater) {
    return (
      <Textarea
        aria-label={label}
        value={typeof value === 'string' ? value : getDisplayText(value)}
        autosize
        minRows={3}
        error={error}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Group gap="xs" wrap="wrap">
          <Badge variant="outline" color="gray">List</Badge>
          <Text size="xs" c="dimmed">{items.length === 0 ? 'No items yet' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}</Text>
        </Group>
        <Button variant="default" size="xs" disabled={disabled} onClick={handleAddItem}>
          Add item
        </Button>
      </Group>
      {!items.length ? (
        <Alert color="gray" title="No items yet">
          Add an item to populate this list.
        </Alert>
      ) : (
        items.map((item, index) => {
          const itemType = sampleItem !== undefined ? typeof sampleItem : typeof item;
          const dragItem = { kind: 'array' as const, fieldKey: field.key, index };
          const itemState = context.getStructuredItemState?.(dragItem) ?? { collapsed: false, changed: false, invalid: false };
          const isDropTarget =
            drag?.dropTarget?.kind === dragItem.kind &&
            drag.dropTarget.fieldKey === dragItem.fieldKey &&
            drag.dropTarget.index === dragItem.index &&
            drag.draggedItem?.index !== dragItem.index;

          return (
            <ArrayFieldItem
              key={`${field.key}-${index}`}
              fieldKey={field.key}
              index={index}
              item={item}
              itemType={itemType}
              label={label}
              disabled={disabled}
              dragItem={dragItem}
              itemState={itemState}
              isDropTarget={isDropTarget}
              getTitle={getTitle}
              actions={actions}
              drag={drag}
              renderFrame={renderFrame}
            />
          );
        })
      )}
    </Stack>
  );
}
