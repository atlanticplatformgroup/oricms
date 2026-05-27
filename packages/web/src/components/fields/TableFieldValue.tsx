import { memo } from 'react';
import { Badge, Group, Stack, Text } from '@mantine/core';
import { getAssetTags, type Asset, type SchemaField } from '@ori/shared';
import { getProjectAssetPath, normalizeAssetReference } from '../../lib/assets/references';
import { getAssetTypeLabel } from '../../lib/assets/display';
import { getFieldChoiceLabel, getRefId, getRefIds } from '@ori/shared';
import { resolveRegisteredFieldCapability } from '../../lib/fields/capabilities';
import { getDisplayText } from '../../lib/workspace/format';
import { AuthenticatedImage } from '../ui/AuthenticatedImage';

export interface TableFieldValueContext {
  assetMap?: Map<string, Asset>;
  relationLabels?: Record<string, string>;
}

interface TableFieldValueProps {
  field?: SchemaField;
  fieldType: SchemaField['type'] | '$id';
  value: unknown;
  context?: TableFieldValueContext;
}

function formatDateValue(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date)) return getDisplayText(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return getDisplayText(value);
  return date.toLocaleDateString();
}

function renderRelationValue(value: unknown, relationLabels?: Record<string, string>) {
  const refIds = getRefIds(value);
  if (!refIds.length) {
    const single = getRefId(value);
    if (!single) {
      return (
        <Text size="sm" c="dimmed">
          —
        </Text>
      );
    }

    return <Text size="sm">{relationLabels?.[single] || single}</Text>;
  }

  const visible = refIds.slice(0, 2);
  const remaining = refIds.length - visible.length;

  return (
    <Group gap="xs">
      {visible.map((refId) => (
        <Badge key={refId} variant="light">
          {relationLabels?.[refId] || refId}
        </Badge>
      ))}
      {remaining > 0 ? (
        <Text size="sm" c="dimmed">
          +{remaining}
        </Text>
      ) : null}
    </Group>
  );
}

function renderAssetValue(value: unknown, fieldType: SchemaField['type'] | '$id', assetMap?: Map<string, Asset>) {
  const reference = normalizeAssetReference(value);
  if (!reference) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }

  if (reference.scope === 'global') {
    return (
      <Group gap="xs" wrap="nowrap">
        <Badge variant="light" color="gray">Global</Badge>
        <Text size="sm" lineClamp={1}>
          {reference.assetId}
        </Text>
      </Group>
    );
  }

  const path = reference.path;
  const asset = assetMap?.get(path);

  if ((fieldType === 'image' || asset?.type === 'image') && asset?.url) {
    const tags = getAssetTags(asset?.metadata);
    return (
      <Group gap="sm" wrap="nowrap">
        <AuthenticatedImage
          src={asset.url}
          alt={asset.metadata?.altText || asset.name}
          w={45}
          h={45}
          radius="sm"
          fit="cover"
        />
        <Stack gap={0}>
          <Text size="sm" fw={500} lineClamp={1}>
            {asset.name}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {tags.join(', ') || asset.folder || path}
          </Text>
        </Stack>
      </Group>
    );
  }

  return (
    <Group gap="xs" wrap="nowrap">
      {asset ? <Badge variant="light">{getAssetTypeLabel(asset.type)}</Badge> : null}
      <Text size="sm" lineClamp={1}>
        {asset?.name || path.split('/').pop() || path}
      </Text>
    </Group>
  );
}

function renderAssetCollectionValue(values: unknown[], fieldType: SchemaField['type'] | '$id', assetMap?: Map<string, Asset>) {
  const references = values.map((item) => normalizeAssetReference(item)).filter((item): item is NonNullable<ReturnType<typeof normalizeAssetReference>> => Boolean(item));
  const visible = references.slice(0, 2);
  const remaining = references.length - visible.length;
  const visibleProjectPaths = visible.map((reference) => getProjectAssetPath(reference)).filter((path): path is string => Boolean(path));

  if ((fieldType === 'image' || visibleProjectPaths.some((path) => assetMap?.get(path)?.type === 'image')) && visibleProjectPaths.length > 0) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          {visibleProjectPaths.map((path) => {
            const asset = assetMap?.get(path);
            return (
              <AuthenticatedImage
                key={path}
                src={asset?.url || path}
                alt={asset?.metadata?.altText || asset?.name || path}
                w={45}
                h={45}
                radius="sm"
                fit="cover"
              />
            );
          })}
        </Group>
        <Stack gap={0}>
          <Text size="sm" fw={500} lineClamp={1}>
            {visible
              .map((reference) => {
                if (reference.scope === 'global') return reference.assetId;
                return assetMap?.get(reference.path)?.name || reference.path.split('/').pop() || reference.path;
              })
              .join(', ')}
          </Text>
          <Text size="xs" c="dimmed">{remaining > 0 ? `+${remaining} more` : `${references.length} selected`}</Text>
        </Stack>
      </Group>
    );
  }

  return (
    <Group gap="xs">
      {visible.map((reference) => {
        const path = reference.scope === 'project' ? reference.path : null;
        const asset = path ? assetMap?.get(path) : null;
        return (
          <Badge key={reference.scope === 'project' ? reference.path : reference.assetId} variant="light" color="gray">
            {reference.scope === 'global' ? reference.assetId : asset?.name || path?.split('/').pop() || path}
          </Badge>
        );
      })}
      {remaining > 0 ? <Text size="sm" c="dimmed">+{remaining}</Text> : null}
    </Group>
  );
}

export function getTableFieldSortText({
  field,
  fieldType,
  value,
  context = {},
}: TableFieldValueProps): string {
  return resolveRegisteredFieldCapability({
    field,
    fieldType,
    value,
    context,
  }).sortToken;
}

export const TableFieldValue = memo(function TableFieldValue({ field, fieldType, value, context = {} }: TableFieldValueProps) {
  if (value === null || value === undefined || value === '') {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }

  if (fieldType === 'boolean') {
    return <Badge variant="light" color={value ? 'green' : 'gray'}>{value ? 'Yes' : 'No'}</Badge>;
  }

  if (fieldType === 'enum' || fieldType === 'select') {
    if (Array.isArray(value)) {
      return (
        <Group gap="xs">
          {value.slice(0, 2).map((item, index) => (
            <Badge key={`${field?.key || 'value'}-${index}`} variant="light">
              {getFieldChoiceLabel(field, item)}
            </Badge>
          ))}
          {value.length > 2 ? <Text size="sm" c="dimmed">+{value.length - 2}</Text> : null}
        </Group>
      );
    }
    return <Badge variant="light">{getFieldChoiceLabel(field, value)}</Badge>;
  }

  if (fieldType === 'date' || fieldType === 'datetime') {
    return <Text size="sm">{formatDateValue(value)}</Text>;
  }

  if (fieldType === 'relation' || fieldType === 'reference') {
    return renderRelationValue(value, context.relationLabels);
  }

  if ((fieldType === 'media' || fieldType === 'image') && normalizeAssetReference(value)) {
    return renderAssetValue(value, fieldType, context.assetMap);
  }

  if ((fieldType === 'media' || fieldType === 'image') && Array.isArray(value)) {
    const assetReferences = value.map((item) => normalizeAssetReference(item)).filter(Boolean);
    if (!assetReferences.length) {
      return (
        <Text size="sm" c="dimmed">
          —
        </Text>
      );
    }

    return renderAssetCollectionValue(value, fieldType, context.assetMap);
  }

  if (Array.isArray(value)) {
    const visible = value.slice(0, 2).map((item) => getDisplayText(item));
    return (
      <Group gap="xs">
        {visible.map((item, index) => (
          <Badge key={`${field?.key || 'value'}-${index}`} variant="light" color="gray">
            {item}
          </Badge>
        ))}
        {value.length > 2 ? <Text size="sm" c="dimmed">+{value.length - 2}</Text> : null}
      </Group>
    );
  }

  if (typeof value === 'object') {
    return (
      <Text size="sm" c="dimmed">
        Structured value
      </Text>
    );
  }

  return (
    <Text size="sm" lineClamp={2}>
      {getDisplayText(value)}
    </Text>
  );
});
