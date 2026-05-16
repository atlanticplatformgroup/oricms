import type { SchemaField } from '@ori/shared';
import { isAssetReference } from '../assets/references';

export function inferFieldType(value: unknown): SchemaField['type'] {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (isAssetReference(value)) return 'media';
  if (typeof value === 'object' && value !== null) return 'json';
  return 'string';
}
