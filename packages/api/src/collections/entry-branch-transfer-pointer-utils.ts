type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cloneValue<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value)) as T;
}

export function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function splitPointer(pointer: string): string[] {
  if (!pointer || pointer === '/') return [];
  return pointer.replace(/^\/+/, '').split('/').map(decodePointerSegment);
}

function ensurePointerParent(document: JsonObject | unknown[], segments: string[]): JsonObject | unknown[] {
  let current: JsonObject | unknown[] = document;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const wantsArray = /^\d+$/.test(nextSegment);

    if (Array.isArray(current)) {
      const itemIndex = Number(segment);
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        throw new Error(`Invalid array pointer segment "${segment}"`);
      }
      if (current[itemIndex] == null) {
        current[itemIndex] = wantsArray ? [] : {};
      }
      if (!Array.isArray(current[itemIndex]) && !isPlainObject(current[itemIndex])) {
        current[itemIndex] = wantsArray ? [] : {};
      }
      current = current[itemIndex] as JsonObject | unknown[];
      continue;
    }

    if (!isPlainObject(current[segment])) {
      current[segment] = wantsArray ? [] : {};
    }
    current = current[segment] as JsonObject | unknown[];
  }

  return current;
}

export function getValueAtPointer(document: unknown, pointer: string): { exists: boolean; value: unknown } {
  if (!pointer) return { exists: document !== undefined, value: document };

  let current: unknown = document;
  for (const rawSegment of splitPointer(pointer)) {
    if (Array.isArray(current)) {
      const index = Number(rawSegment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { exists: false, value: undefined };
      }
      current = current[index];
      continue;
    }

    if (!isPlainObject(current) || !(rawSegment in current)) {
      return { exists: false, value: undefined };
    }

    current = current[rawSegment];
  }

  return { exists: true, value: current };
}

export function setPointerValue(document: JsonObject, pointer: string, value: unknown): JsonObject {
  const nextDocument = cloneValue(document);
  const segments = splitPointer(pointer);
  if (segments.length === 0) {
    return cloneValue(value as JsonObject);
  }

  const parent = ensurePointerParent(nextDocument, segments);
  const lastSegment = segments[segments.length - 1];

  if (Array.isArray(parent)) {
    const index = Number(lastSegment);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid array pointer segment "${lastSegment}"`);
    }
    parent[index] = cloneValue(value);
  } else {
    parent[lastSegment] = cloneValue(value);
  }

  return nextDocument;
}

export function deletePointerValue(document: JsonObject, pointer: string): JsonObject {
  const nextDocument = cloneValue(document);
  const segments = splitPointer(pointer);
  if (segments.length === 0) {
    return nextDocument;
  }

  const parent = ensurePointerParent(nextDocument, segments);
  const lastSegment = segments[segments.length - 1];

  if (Array.isArray(parent)) {
    const index = Number(lastSegment);
    if (Number.isInteger(index) && index >= 0 && index < parent.length) {
      parent.splice(index, 1);
    }
  } else {
    delete parent[lastSegment];
  }

  return nextDocument;
}

export function isAncestorPointer(ancestor: string, pointer: string): boolean {
  if (!ancestor) return true;
  return pointer === ancestor || pointer.startsWith(`${ancestor}/`);
}

export function normalizeSelectedPointers(pointers: string[]): string[] {
  return [...new Set(pointers)]
    .sort((left, right) => left.split('/').length - right.split('/').length)
    .filter((pointer, index, items) => !items.slice(0, index).some((candidate) => isAncestorPointer(candidate, pointer)));
}
