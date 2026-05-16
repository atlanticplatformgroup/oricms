import type {
  CollectionEntry,
  ContentType,
  EntryBranchTransferConflict,
  EntryBranchTransferDiffNode,
  EntryBranchTransferFieldMeta,
  SchemaField,
} from '@ori/shared';
import {
  deepEqual,
  escapePointerSegment,
  getValueAtPointer,
  splitPointer,
} from './entry-branch-transfer-pointer-utils';

const RESERVED_SYSTEM_KEYS = new Set(['$id', '$type', '$createdAt', '$updatedAt']);

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function buildFieldMeta(field: SchemaField | undefined): EntryBranchTransferFieldMeta | undefined {
  if (!field) return undefined;
  return {
    key: field.key,
    label: field.label || titleCase(field.key),
    type: field.type,
  };
}

function buildPointer(parent: string, segment: string): string {
  return `${parent}/${escapePointerSegment(segment)}`;
}

function buildPointerLabel(pointer: string, contentType: ContentType | null): string {
  const segments = splitPointer(pointer);
  if (segments.length === 0) return 'Entry';

  const [first, ...rest] = segments;
  const field = contentType?.fields.find((candidate) => candidate.key === first);
  const labels = [field?.label || titleCase(first)];

  rest.forEach((segment) => {
    if (/^\d+$/.test(segment)) {
      labels.push(`Item ${Number(segment) + 1}`);
      return;
    }
    labels.push(titleCase(segment));
  });

  return labels.join(' / ');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getTopLevelKeys(
  sourceEntry: CollectionEntry | null,
  targetEntry: CollectionEntry | null,
  contentType: ContentType | null,
): string[] {
  const fieldKeys = contentType?.fields.map((field) => field.key) ?? [];
  const dynamicKeys = new Set<string>();
  [sourceEntry, targetEntry].forEach((entry) => {
    Object.keys(entry ?? {}).forEach((key) => {
      if (!RESERVED_SYSTEM_KEYS.has(key)) {
        dynamicKeys.add(key);
      }
    });
  });

  const orderedDynamic = [...dynamicKeys].sort((left, right) => left.localeCompare(right));
  const seen = new Set<string>();
  const ordered: string[] = [];

  [...fieldKeys, ...orderedDynamic].forEach((key) => {
    if (seen.has(key) || RESERVED_SYSTEM_KEYS.has(key)) return;
    if ((sourceEntry && key in sourceEntry) || (targetEntry && key in targetEntry)) {
      ordered.push(key);
      seen.add(key);
    }
  });

  return ordered;
}

function buildDiffNode(
  pointer: string,
  sourceValue: unknown,
  sourceExists: boolean,
  targetValue: unknown,
  targetExists: boolean,
  contentType: ContentType | null,
): EntryBranchTransferDiffNode | null {
  if (sourceExists && targetExists && deepEqual(sourceValue, targetValue)) {
    return null;
  }

  const node: EntryBranchTransferDiffNode = {
    pointer,
    label: buildPointerLabel(pointer, contentType),
    kind: !targetExists ? 'added' : !sourceExists ? 'removed' : 'changed',
  };

  const rootFieldKey = splitPointer(pointer)[0];
  const rootField = contentType?.fields.find((field) => field.key === rootFieldKey);
  node.field = buildFieldMeta(rootField);

  if (Array.isArray(sourceValue) || Array.isArray(targetValue)) {
    const sourceArray = Array.isArray(sourceValue) ? sourceValue : [];
    const targetArray = Array.isArray(targetValue) ? targetValue : [];
    const childNodes: EntryBranchTransferDiffNode[] = [];
    for (let index = 0; index < Math.max(sourceArray.length, targetArray.length); index += 1) {
      const childNode = buildDiffNode(
        buildPointer(pointer, String(index)),
        sourceArray[index],
        index < sourceArray.length,
        targetArray[index],
        index < targetArray.length,
        contentType,
      );
      if (childNode) {
        childNodes.push(childNode);
      }
    }
    if (childNodes.length > 0) {
      node.children = childNodes;
    }
    return node;
  }

  if (isPlainObject(sourceValue) || isPlainObject(targetValue)) {
    const sourceObject = isPlainObject(sourceValue) ? sourceValue : {};
    const targetObject = isPlainObject(targetValue) ? targetValue : {};
    const childKeys = [...new Set([...Object.keys(sourceObject), ...Object.keys(targetObject)])]
      .sort((left, right) => left.localeCompare(right));
    const childNodes = childKeys
      .map((key) =>
        buildDiffNode(
          buildPointer(pointer, key),
          sourceObject[key],
          key in sourceObject,
          targetObject[key],
          key in targetObject,
          contentType,
        ),
      )
      .filter((entry): entry is EntryBranchTransferDiffNode => Boolean(entry));

    if (childNodes.length > 0) {
      node.children = childNodes;
    }
    return node;
  }

  return node;
}

export function buildEntryBranchTransferDiffTree(
  sourceEntry: CollectionEntry,
  targetEntry: CollectionEntry | null,
  contentType: ContentType | null,
): EntryBranchTransferDiffNode[] {
  return getTopLevelKeys(sourceEntry, targetEntry, contentType)
    .map((key) =>
      buildDiffNode(
        `/${escapePointerSegment(key)}`,
        sourceEntry[key],
        key in sourceEntry,
        targetEntry?.[key],
        Boolean(targetEntry && key in targetEntry),
        contentType,
      ),
    )
    .filter((entry): entry is EntryBranchTransferDiffNode => Boolean(entry));
}

export function collectConflictPointers(
  nodes: EntryBranchTransferDiffNode[],
  sourceEntry: CollectionEntry | null,
  targetEntry: CollectionEntry | null,
  baseEntry: CollectionEntry | null,
): EntryBranchTransferConflict[] {
  const conflicts: EntryBranchTransferConflict[] = [];

  const visit = (node: EntryBranchTransferDiffNode): boolean => {
    const sourceState = getValueAtPointer(sourceEntry, node.pointer);
    const targetState = getValueAtPointer(targetEntry, node.pointer);
    const baseState = getValueAtPointer(baseEntry, node.pointer);

    const directConflict =
      !deepEqual(sourceState.value, targetState.value) &&
      !deepEqual(targetState.value, baseState.value) &&
      !deepEqual(sourceState.value, baseState.value);

    const childConflict = (node.children ?? []).some((child) => visit(child));
    const hasConflict = directConflict || childConflict;
    if (hasConflict) {
      conflicts.push({ pointer: node.pointer, label: node.label });
    }
    return hasConflict;
  };

  nodes.forEach((node) => {
    visit(node);
  });

  return conflicts.filter(
    (conflict, index, items) => items.findIndex((candidate) => candidate.pointer === conflict.pointer) === index,
  );
}
