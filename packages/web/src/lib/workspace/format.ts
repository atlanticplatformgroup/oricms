export function toLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getDisplayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

export function formatFieldCount(count: number, noun: 'revision' | 'comparison'): string {
  return `${count} ${noun === 'revision'
    ? `${count === 1 ? 'field' : 'fields'} changed in revision`
    : `${count === 1 ? 'differing field' : 'differing fields'}`}`;
}
