import type { CollectionEntry, GitCommit, SchemaField } from '@ori/shared';
import type { FieldDiff, HistoryTimelineItem } from './types';
import { toLabel } from '../workspace/format';
import { inferFieldType } from '../fields/display';

export function createFieldDiffs(previousValue: Record<string, unknown>, currentValue: Record<string, unknown>): FieldDiff[] {
  const keys = new Set([...Object.keys(previousValue), ...Object.keys(currentValue)]);
  const diffs: FieldDiff[] = [];

  Array.from(keys)
    .sort()
    .forEach((key) => {
      const before = previousValue[key];
      const after = currentValue[key];
      const beforeExists = Object.prototype.hasOwnProperty.call(previousValue, key);
      const afterExists = Object.prototype.hasOwnProperty.call(currentValue, key);

      if (!beforeExists && afterExists) {
        diffs.push({ key, kind: 'added', before: undefined, after });
        return;
      }

      if (beforeExists && !afterExists) {
        diffs.push({ key, kind: 'removed', before, after: undefined });
        return;
      }

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diffs.push({ key, kind: 'changed', before, after });
      }
    });

  return diffs;
}

export function normalizeHistoryItem(item: GitCommit | Record<string, unknown>, index: number): HistoryTimelineItem {
  return {
    hash: String('hash' in item ? item.hash : item.commit || item.id || `rev-${index}`),
    message: String('message' in item ? item.message : item.subject || 'Commit'),
    author: String('author' in item ? item.author : item.authorName || 'Unknown'),
    date: String('date' in item ? item.date : item.timestamp || ''),
  };
}

export function stripSystemFields(entry: CollectionEntry): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  Object.entries(entry).forEach(([key, value]) => {
    if (!key.startsWith('$') || key === '$status' || key === '$publishedAt') {
      clone[key] = value;
    }
  });
  return clone;
}

export function isEmptyFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function inferFallbackEditorField(entry: CollectionEntry, key: string): SchemaField {
  return {
    key,
    label: toLabel(key),
    type: inferFieldType(entry[key]),
  };
}
