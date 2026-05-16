import { ActionIcon, Alert, Badge, Button, Group, Paper, Select, Stack, Text } from '@mantine/core';
import type { ComponentSchema } from '@ori/shared';
import { WorkspaceDragHandle } from '../../ui/WorkspacePrimitives';
import { toLabel } from '../../../lib/workspace/format';
import type { FieldRendererProps } from '../contracts';
import { ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

export function BlocksField({ field, value, disabled, context }: FieldRendererProps) {
  const blockSchemas = (field.options?.allowedComponents || [])
    .map((componentId) => context.componentSchemaMap?.get(componentId) ?? null)
    .filter((schema): schema is ComponentSchema => Boolean(schema));
  const blocks = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const renderEmbedded = context.renderEmbeddedFieldControl;
  const drag = context.structuredDrag;
  const actions = context.structuredActions;
  const getTitle = context.getStructuredItemTitle ?? ((_: unknown, fallback: string) => fallback);

  if (!renderEmbedded) {
    return <Alert color="yellow" title="Blocks unavailable">This blocks field cannot be edited right now.</Alert>;
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

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Group gap="xs" wrap="wrap">
          <Badge variant="outline" color="gray">Blocks</Badge>
          <Text size="xs" c="dimmed">{blocks.length === 0 ? 'No blocks yet' : `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}`}</Text>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">Add block</Text>
          <Select
            placeholder="Select type"
            data={blockSchemas.map((schema) => ({ value: schema.$id, label: schema.label || schema.name }))}
            value={null}
            clearable
            disabled={disabled || !blockSchemas.length}
            onChange={(nextValue) => {
              if (!nextValue) return;
              actions?.addBlock?.(field.key, nextValue);
            }}
          />
        </Group>
      </Group>
      {!blocks.length ? (
        <Alert color="gray" title="No blocks yet">
          Add a block to build this content zone.
        </Alert>
      ) : (
        blocks.map((block, index) => {
          const componentId = typeof block.$type === 'string' ? block.$type : '';
          const schema = componentId ? context.componentSchemaMap?.get(componentId) ?? null : null;
          const dragItem = { kind: 'blocks' as const, fieldKey: field.key, index };
          const itemState = context.getStructuredItemState?.(dragItem) ?? { collapsed: false, changed: false, invalid: false };
          const isDropTarget =
            drag?.dropTarget?.kind === dragItem.kind &&
            drag.dropTarget.fieldKey === dragItem.fieldKey &&
            drag.dropTarget.index === dragItem.index &&
            drag.draggedItem?.index !== dragItem.index;

          return (
            <Group key={`${field.key}-${index}-${componentId || 'block'}`} align="flex-start" gap="sm" wrap="nowrap">
              <Stack pt={4} gap="xs" align="center">
                <WorkspaceDragHandle
                  label="Drag block"
                  draggable={!disabled}
                  onDragStart={(event) => drag?.startDrag(event, dragItem)}
                  onDragEnd={() => drag?.endDrag()}
                />
              </Stack>
              <div
                style={{ flex: 1, minWidth: 0 }}
                onDragOver={(event) => drag?.dragOver(event, dragItem)}
                onDragLeave={() => drag?.dragLeave(dragItem)}
                onDrop={() => drag?.drop(dragItem)}
              >
                <div style={isDropTarget ? { outline: '1px solid var(--mantine-color-blue-5)', borderRadius: 'var(--mantine-radius-md)' } : undefined}>
                  {renderFrame({
                    eyebrow: (
                      <>
                        <Badge variant="light" color="gray">{index + 1}</Badge>
                        <Badge variant="outline">{schema?.label || schema?.name || toLabel(componentId || 'Block')}</Badge>
                        {itemState.changed ? <Badge variant="light" color="orange">Changed</Badge> : null}
                        {itemState.invalid ? <Badge variant="light" color="red">Invalid</Badge> : null}
                      </>
                    ),
                    title: getTitle(block, schema?.label || schema?.name || `Block ${index + 1}`),
                    description: `Block ${index + 1} of ${blocks.length}`,
                    actionsNode: (
                      <>
                        <ActionIcon variant="default" disabled={disabled} aria-label="Duplicate block" onClick={() => actions?.duplicateBlock?.(field.key, index)}>
                          <DocumentDuplicateIcon width={16} height={16} />
                        </ActionIcon>
                        <ActionIcon variant="default" disabled={disabled} aria-label={itemState.collapsed ? 'Expand block' : 'Collapse block'} onClick={() => actions?.toggleStructuredItemCollapsed?.(dragItem)}>
                          {itemState.collapsed ? <ChevronDownIcon width={16} height={16} /> : <ChevronUpIcon width={16} height={16} />}
                        </ActionIcon>
                        <Button variant="default" color="red" size="xs" disabled={disabled} onClick={() => actions?.removeBlock?.(field.key, index)}>
                          Remove
                        </Button>
                      </>
                    ),
                    children: itemState.collapsed ? null : schema ? (
                      <Stack gap="sm">
                        {schema.fields.map((embeddedField) => (
                          <div key={`${field.key}-${index}-${embeddedField.key}`}>
                            {renderEmbedded(
                              embeddedField,
                              block[embeddedField.key],
                              (nextValue) => actions?.updateBlockField?.(field.key, index, embeddedField.key, nextValue),
                            )}
                          </div>
                        ))}
                      </Stack>
                    ) : (
                      <Alert color="yellow" title="Unknown block type">
                        This block type is not available in the loaded component schemas.
                      </Alert>
                    ),
                  })}
                </div>
              </div>
            </Group>
          );
        })
      )}
    </Stack>
  );
}
