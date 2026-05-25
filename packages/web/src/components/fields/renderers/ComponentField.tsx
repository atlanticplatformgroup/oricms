import { memo, useCallback } from 'react';
import { ActionIcon, Alert, Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { WorkspaceDragHandle } from '../../ui/WorkspacePrimitives';
import type { FieldRendererProps, StructuredDragItem } from '../contracts';
import type { SchemaField } from '@ori/shared';

interface ComponentFieldItemProps {
  fieldKey: string;
  index: number;
  item: Record<string, unknown>;
  componentSchema: { label?: string; name: string; fields: Array<{ key: string }> };
  disabled?: boolean;
  dragItem: StructuredDragItem;
  itemState: { collapsed: boolean; changed: boolean; invalid: boolean };
  isDropTarget: boolean;
  getTitle: (item: unknown, fallback: string) => string;
  actions: FieldRendererProps['context']['structuredActions'];
  drag: FieldRendererProps['context']['structuredDrag'];
  renderEmbedded: NonNullable<FieldRendererProps['context']['renderEmbeddedFieldControl']>;
  renderFrame: (props: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actionsNode?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
}

const ComponentFieldItem = memo(function ComponentFieldItem({
  fieldKey, index, item, componentSchema, disabled, dragItem, itemState, isDropTarget,
  getTitle, actions, drag, renderEmbedded, renderFrame,
}: ComponentFieldItemProps) {
  const handleDuplicate = useCallback(() => {
    actions?.duplicateRepeatableComponent?.(fieldKey, index);
  }, [actions, fieldKey, index]);

  const handleToggleCollapsed = useCallback(() => {
    actions?.toggleStructuredItemCollapsed?.(dragItem);
  }, [actions, dragItem]);

  const handleRemove = useCallback(() => {
    actions?.removeRepeatableComponent?.(fieldKey, index);
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
          label="Drag component item"
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
                <Badge variant="outline">{componentSchema.label || componentSchema.name}</Badge>
                {itemState.changed ? <Badge variant="light" color="orange">Changed</Badge> : null}
                {itemState.invalid ? <Badge variant="light" color="red">Invalid</Badge> : null}
              </>
            ),
            title: getTitle(item, `${componentSchema.label || componentSchema.name} ${index + 1}`),
            description: `Item ${index + 1} of ${repeatableItems.length}`,
            actionsNode: (
              <>
                <ActionIcon variant="default" disabled={disabled} aria-label="Duplicate component item" onClick={handleDuplicate}>
                  <DocumentDuplicateIcon width={16} height={16} />
                </ActionIcon>
                <ActionIcon variant="default" disabled={disabled} aria-label={itemState.collapsed ? 'Expand component item' : 'Collapse component item'} onClick={handleToggleCollapsed}>
                  {itemState.collapsed ? <ChevronDownIcon width={16} height={16} /> : <ChevronUpIcon width={16} height={16} />}
                </ActionIcon>
                <Button variant="default" color="red" size="xs" disabled={disabled} onClick={handleRemove}>
                  Remove
                </Button>
              </>
            ),
            children: itemState.collapsed ? null : (
              <Stack gap="sm">
                {componentSchema.fields.map((embeddedField) => (
                  <div key={`${fieldKey}-${index}-${embeddedField.key}`}>
                    {renderEmbedded(
                      embeddedField as SchemaField,
                      item?.[embeddedField.key],
                      (nextValue) => actions?.updateRepeatableComponentField?.(fieldKey, index, embeddedField.key, nextValue),
                    )}
                  </div>
                ))}
              </Stack>
            ),
          })}
        </div>
      </div>
    </Group>
  );
});

export function ComponentField({ field, value, disabled, context }: FieldRendererProps) {
  const componentId = field.component || '';
  const componentSchema = componentId ? context.componentSchemaMap?.get(componentId) ?? null : null;
  const componentValue = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const repeatableItems = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const getTitle = context.getStructuredItemTitle ?? ((_: unknown, fallback: string) => fallback);
  const renderEmbedded = context.renderEmbeddedFieldControl;
  const drag = context.structuredDrag;
  const actions = context.structuredActions;

  const handleAddItem = useCallback(() => {
    actions?.addRepeatableComponent?.(field.key, componentId);
  }, [actions, field.key, componentId]);

  if (!componentSchema || !renderEmbedded) {
    return (
      <Alert color="yellow" title="Component schema unavailable">
        This component field cannot be edited until its schema definition is available.
      </Alert>
    );
  }

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

  if (field.repeatable) {
    return (
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Badge variant="outline">{componentSchema.label || componentSchema.name}</Badge>
            <Text size="xs" c="dimmed">Repeatable component</Text>
          </Group>
          <Button
            variant="default"
            size="xs"
            disabled={disabled}
            onClick={handleAddItem}
          >
            Add item
          </Button>
        </Group>
        {!repeatableItems.length ? (
          <Alert color="gray" title="No items yet">
            Add an item to populate this repeatable component field.
          </Alert>
        ) : (
          repeatableItems.map((item, index) => {
            const dragItem = { kind: 'component' as const, fieldKey: field.key, index };
            const itemState = context.getStructuredItemState?.(dragItem) ?? { collapsed: false, changed: false, invalid: false };
            const isDropTarget =
              drag?.dropTarget?.kind === dragItem.kind &&
              drag.dropTarget.fieldKey === dragItem.fieldKey &&
              drag.dropTarget.index === dragItem.index &&
              drag.draggedItem?.index !== dragItem.index;

            return (
              <ComponentFieldItem
                key={`${field.key}-${index}`}
                fieldKey={field.key}
                index={index}
                item={item}
                componentSchema={componentSchema}
                disabled={disabled}
                dragItem={dragItem}
                itemState={itemState}
                isDropTarget={isDropTarget}
                getTitle={getTitle}
                actions={actions}
                drag={drag}
                renderEmbedded={renderEmbedded}
                renderFrame={renderFrame}
              />
            );
          })
        )}
      </Stack>
    );
  }

  return (
    <Paper withBorder p="sm">
      <Stack gap="sm">
        <Group gap="xs">
          <Badge variant="outline">{componentSchema.label || componentSchema.name}</Badge>
          <Text size="xs" c="dimmed">Single component</Text>
        </Group>
        {componentSchema.fields.map((embeddedField) => (
          <div key={`${field.key}-${embeddedField.key}`}>
            {renderEmbedded(
              embeddedField,
              componentValue[embeddedField.key],
              (nextValue) => actions?.updateComponentField?.(field.key, embeddedField.key, nextValue),
            )}
          </div>
        ))}
      </Stack>
    </Paper>
  );
}
