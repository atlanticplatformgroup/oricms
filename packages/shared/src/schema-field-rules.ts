import type { SchemaField } from './types';

export interface SchemaVisibleWhenRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'in' | 'notIn' | 'truthy' | 'falsy';
  value?: unknown;
}

type ExtendedSchemaOptions = NonNullable<SchemaField['options']> & {
  visibleWhen?: SchemaVisibleWhenRule;
};

function getLowerPathExtension(value: string): string {
  const clean = value.split('?')[0].split('#')[0];
  const lastSegment = clean.split('/').pop() || '';
  const dot = lastSegment.lastIndexOf('.');
  return dot > -1 ? lastSegment.slice(dot).toLowerCase() : '';
}

function mapAcceptPatternToExtensions(pattern: string): string[] {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return [];
  if (normalized === 'image/*') {
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.tif', '.tiff'];
  }
  if (normalized.startsWith('.')) return [normalized];
  if (normalized.startsWith('image/')) {
    const subtype = normalized.slice('image/'.length);
    if (!subtype) return [];
    if (subtype === 'jpeg') return ['.jpg', '.jpeg'];
    return [`.${subtype}`];
  }
  return [];
}

function parsePathSegments(path: string): Array<string | number> {
  const segments: Array<string | number> = [];
  const pattern = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(path)) !== null) {
    if (match[1]) {
      segments.push(match[1]);
    } else if (match[2]) {
      segments.push(Number(match[2]));
    }
  }

  return segments;
}

export function getValueAtPath(input: unknown, path: string): unknown {
  if (!path) return input;
  const segments = parsePathSegments(path);
  if (segments.length === 0) return input;

  let cursor: unknown = input;
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[segment];
      continue;
    }
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

function parseInValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [String(value)];
}

export function getVisibleWhenRule(field: SchemaField): SchemaVisibleWhenRule | undefined {
  const options = (field.options || {}) as ExtendedSchemaOptions;
  return options.visibleWhen;
}

export function isSchemaFieldVisible(field: SchemaField, contextValues: Record<string, unknown>): boolean {
  const rule = getVisibleWhenRule(field);
  if (!rule || !rule.field) return true;

  const currentValue = getValueAtPath(contextValues, rule.field);
  switch (rule.operator) {
    case 'equals':
      return String(currentValue ?? '') === String(rule.value ?? '');
    case 'notEquals':
      return String(currentValue ?? '') !== String(rule.value ?? '');
    case 'in': {
      const values = parseInValues(rule.value);
      return values.includes(String(currentValue ?? ''));
    }
    case 'notIn': {
      const values = parseInValues(rule.value);
      return !values.includes(String(currentValue ?? ''));
    }
    case 'truthy':
      return Boolean(currentValue);
    case 'falsy':
      return !currentValue;
    default:
      return true;
  }
}

export function validateSchemaFieldOptionConstraints(field: SchemaField, value: unknown, path: string): string[] {
  const errors: string[] = [];
  const fieldPath = path || field.key;
  const options = (field.options || {}) as ExtendedSchemaOptions;

  if (value === undefined || value === null || value === '') {
    return errors;
  }

  if (typeof value === 'string') {
    if (options.minLength && value.length < options.minLength) {
      errors.push(`${fieldPath} must be at least ${options.minLength} characters`);
    }
    if (options.maxLength && options.maxLength > 0 && value.length > options.maxLength) {
      errors.push(`${fieldPath} must be at most ${options.maxLength} characters`);
    }
    if (options.pattern) {
      try {
        const regex = new RegExp(options.pattern);
        if (!regex.test(value)) {
          errors.push(`${fieldPath} format is invalid`);
        }
      } catch {
        errors.push(`${fieldPath} has an invalid pattern configuration`);
      }
    }
  }

  if (field.type === 'number') {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(numericValue)) {
      if (typeof options.min === 'number' && numericValue < options.min) {
        errors.push(`${fieldPath} must be at least ${options.min}`);
      }
      if (typeof options.max === 'number' && options.max !== 0 && numericValue > options.max) {
        errors.push(`${fieldPath} must be at most ${options.max}`);
      }
    }
  }

  if (field.type === 'array' && Array.isArray(value)) {
    if (typeof options.minItems === 'number' && options.minItems > 0 && value.length < options.minItems) {
      errors.push(`${fieldPath} must have at least ${options.minItems} items`);
    }
    if (typeof options.maxItems === 'number' && options.maxItems > 0 && value.length > options.maxItems) {
      errors.push(`${fieldPath} must have at most ${options.maxItems} items`);
    }
  }

  if (field.type === 'select' && !options.allowCustomValue && Array.isArray(options.choices) && options.choices.length > 0) {
    const allowedValues = options.choices.map((choice) => String(choice.value));
    if (!allowedValues.includes(String(value))) {
      errors.push(`${fieldPath} must be one of the configured choices`);
    }
  }

  if (field.type === 'url' && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      errors.push(`${fieldPath} must be a valid URL`);
    }
  }

  if (field.type === 'image' && typeof value === 'string' && value.trim() && Array.isArray(options.accept) && options.accept.length > 0) {
    const extension = getLowerPathExtension(value);
    if (extension) {
      const allowedExtensions = options.accept.flatMap((pattern) => mapAcceptPatternToExtensions(String(pattern)));
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
        errors.push(`${fieldPath} must match allowed file types: ${options.accept.join(', ')}`);
      }
    }
  }

  if (field.type === 'date' && typeof value === 'string' && Number.isNaN(Date.parse(value))) {
    errors.push(`${fieldPath} must be a valid date`);
  }

  return errors;
}
