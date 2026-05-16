import { Badge, Code, Group, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { SchemaField } from '@ori/shared';
import { resolveRegisteredFieldCapability } from '../../lib/fields/capabilities';
import { normalizeAssetReference } from '../../lib/assets/references';
import { getDisplayText, toLabel } from '../../lib/workspace/format';
import { inferFieldType } from '../../lib/fields/display';
import { getRefId } from '../../lib/entries/transforms';
import type { ReadonlyFieldValueProps, ReadonlyFieldValueContext } from './contracts';

function stringifyStructuredValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function renderPrimitiveFieldValue(
  value: string | number | boolean,
  fieldType: SchemaField['type'],
  field?: SchemaField,
): ReactNode {
  const capability = resolveRegisteredFieldCapability({
    field,
    fieldType,
    value,
  });

  if (fieldType === 'boolean') {
    return (
      <Badge variant="light" color={value ? 'green' : 'gray'}>
        {capability.displayText}
      </Badge>
    );
  }

  if (fieldType === 'enum' || fieldType === 'select') {
    return <Badge variant="light">{capability.displayText}</Badge>;
  }

  const text = capability.readonly.text || getDisplayText(value);
  const isLongform =
    fieldType === 'textarea' ||
    fieldType === 'markdown' ||
    fieldType === 'richtext' ||
    text.includes('\n') ||
    text.length > 140;

  if (isLongform) {
    return (
      <Paper withBorder p="sm">
        <Text component="pre" ff="monospace" size="sm" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {text}
        </Text>
      </Paper>
    );
  }

  return <Text size="sm">{text}</Text>;
}

function StructuredRows({
  record,
  context,
  depth,
}: {
  record: Record<string, unknown>;
  context: ReadonlyFieldValueContext;
  depth: number;
}) {
  const entries = Object.entries(record).filter(([key]) => !key.startsWith('$'));
  if (!entries.length) {
    return (
      <Text size="sm" c="dimmed">
        (empty)
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {entries.map(([key, nestedValue]) => (
        <Paper key={key} withBorder p="xs">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {toLabel(key)}
            </Text>
            <ReadonlyFieldValue value={nestedValue} context={context} depth={depth + 1} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function ReadonlyFieldValue({
  value,
  field,
  context = {},
  depth = 0,
}: ReadonlyFieldValueProps) {
  if (value === null || value === undefined || value === '') {
    return (
      <Text size="sm" c="dimmed">
        (empty)
      </Text>
    );
  }

  const fieldType = field?.type ?? inferFieldType(value);
  const assetReference = fieldType === 'media' || fieldType === 'image' ? normalizeAssetReference(value) : null;

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    if (assetReference) {
      const capability = resolveRegisteredFieldCapability({
        field,
        fieldType,
        value,
      });
      return (
        <Paper withBorder p="sm">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {assetReference.scope === 'global'
                ? 'Global asset reference'
                : fieldType === 'image'
                  ? 'Image asset'
                  : 'Media asset'}
            </Text>
            <Text size="sm" fw={500}>
              {capability.displayText}
            </Text>
            <Code>{assetReference.scope === 'project' ? assetReference.path : assetReference.assetId}</Code>
          </Stack>
        </Paper>
      );
    }

    if ((fieldType === 'reference' || fieldType === 'relation') && typeof value === 'string') {
      const capability = resolveRegisteredFieldCapability({
        field,
        fieldType,
        value,
        context,
      });
      const resolvedLabel = capability.displayText || value;
      return (
        <Paper withBorder p="sm">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {fieldType === 'reference' ? 'Referenced entry' : 'Related entry'}
            </Text>
            <Text size="sm" fw={500}>
              {resolvedLabel}
            </Text>
            {resolvedLabel !== value ? <Code>{value}</Code> : null}
          </Stack>
        </Paper>
      );
    }

    return <>{renderPrimitiveFieldValue(value, fieldType, field)}</>;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return (
        <Text size="sm" c="dimmed">
          (empty)
        </Text>
      );
    }

    if (fieldType === 'media' || fieldType === 'image') {
      const assetReferences = value
        .map((item) => normalizeAssetReference(item))
        .filter((item): item is NonNullable<ReturnType<typeof normalizeAssetReference>> => Boolean(item));
      if (assetReferences.length) {
        return (
          <Stack gap="xs">
            {assetReferences.map((reference, index) => (
              <Paper
                key={reference.scope === 'project' ? `${reference.path}-${index}` : `${reference.assetId}-${index}`}
                withBorder
                p="xs"
              >
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {reference.scope === 'global'
                      ? 'Global asset reference'
                      : fieldType === 'image'
                        ? 'Image asset'
                        : 'Media asset'}
                  </Text>
                  <Text size="sm" fw={500}>
                    {resolveRegisteredFieldCapability({
                      field,
                      fieldType,
                      value: reference,
                    }).displayText}
                  </Text>
                  <Code>{reference.scope === 'project' ? reference.path : reference.assetId}</Code>
                </Stack>
              </Paper>
            ))}
          </Stack>
        );
      }
    }

    const primitiveArray = value.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
    if (primitiveArray && (fieldType === 'select' || fieldType === 'enum')) {
      return (
        <Group gap="xs">
          {value.map((item, index) => (
            <Badge key={`${field?.key || 'value'}-${index}`} variant="light">
              {resolveRegisteredFieldCapability({
                field,
                fieldType,
                value: item,
              }).displayText}
            </Badge>
          ))}
        </Group>
      );
    }

    if (primitiveArray && (fieldType === 'relation' || fieldType === 'reference')) {
      return (
        <Stack gap="xs">
          {value.map((item, index) => {
            const itemId = getRefId(item);
            const resolvedLabel = resolveRegisteredFieldCapability({
              field,
              fieldType,
              value: item,
              context,
            }).displayText || itemId || getDisplayText(item);

            return (
              <Paper key={`${field?.key || 'value'}-${index}`} withBorder p="xs">
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="light" color="gray">
                    {index + 1}
                  </Badge>
                  <Text size="sm" fw={500}>
                    {resolvedLabel}
                  </Text>
                  {resolvedLabel !== itemId && itemId ? <Code>{itemId}</Code> : null}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      );
    }

    return (
      <Stack gap="xs">
        {value.map((item, index) => {
          const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
          const blockType = typeof record?.$type === 'string' ? record.$type : null;

          return (
            <Paper key={`${field?.key || 'value'}-${index}`} withBorder p="sm">
              <Stack gap="xs">
                <Group gap="xs">
                  <Badge variant="light" color="gray">
                    {index + 1}
                  </Badge>
                  {blockType ? <Badge variant="outline">{toLabel(blockType)}</Badge> : null}
                </Group>
                <ReadonlyFieldValue value={item} context={context} depth={depth + 1} />
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    );
  }

  if (typeof value === 'object') {
    if (assetReference) {
      const capability = resolveRegisteredFieldCapability({
        field,
        fieldType,
        value,
      });

      return (
        <Paper withBorder p="sm">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {assetReference.scope === 'global'
                ? 'Global asset reference'
                : fieldType === 'image'
                  ? 'Image asset'
                  : 'Media asset'}
            </Text>
            <Text size="sm" fw={500}>
              {capability.displayText}
            </Text>
            <Code>{assetReference.scope === 'project' ? assetReference.path : assetReference.assetId}</Code>
          </Stack>
        </Paper>
      );
    }

    if (depth >= 2) {
      return (
        <Paper withBorder p="sm">
          <Text component="pre" ff="monospace" size="xs" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {stringifyStructuredValue(value)}
          </Text>
        </Paper>
      );
    }

    const record = value as Record<string, unknown>;
    const blockType = typeof record.$type === 'string' ? record.$type : null;

    if (blockType || fieldType === 'component' || fieldType === 'blocks') {
      return (
        <Paper withBorder p="sm">
          <Stack gap="xs">
            {blockType ? <Badge variant="outline">{toLabel(blockType)}</Badge> : null}
            <StructuredRows record={record} context={context} depth={depth} />
          </Stack>
        </Paper>
      );
    }

    if (fieldType === 'json' || fieldType === 'object') {
      return (
        <Paper withBorder p="sm">
          <Stack gap="xs">
            <StructuredRows record={record} context={context} depth={depth} />
          </Stack>
        </Paper>
      );
    }

    const refId = getRefId(value);
    if ((fieldType === 'reference' || fieldType === 'relation') && refId) {
      const resolvedLabel = resolveRegisteredFieldCapability({
        field,
        fieldType,
        value,
        context,
      }).displayText || refId;
      return (
        <Paper withBorder p="sm">
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {resolvedLabel}
            </Text>
            {resolvedLabel !== refId ? <Code>{refId}</Code> : null}
          </Stack>
        </Paper>
      );
    }

    return (
      <Paper withBorder p="sm">
        <Text component="pre" ff="monospace" size="xs" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {stringifyStructuredValue(value)}
        </Text>
      </Paper>
    );
  }

  return <Text size="sm">{getDisplayText(value)}</Text>;
}
