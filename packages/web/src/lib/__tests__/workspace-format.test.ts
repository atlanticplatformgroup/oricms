import { describe, expect, it } from 'vitest';
import { toLabel, getDisplayText, formatFieldCount } from '../workspace/format';

describe('toLabel', () => {
  it('should convert snake_case to label', () => {
    expect(toLabel('hello_world')).toBe('Hello World');
  });

  it('should convert kebab-case to label', () => {
    expect(toLabel('hello-world')).toBe('Hello World');
  });

  it('should convert camelCase to label', () => {
    expect(toLabel('helloWorld')).toBe('Hello World');
  });

  it('should convert PascalCase to label', () => {
    expect(toLabel('HelloWorld')).toBe('Hello World');
  });

  it('should handle mixed separators', () => {
    expect(toLabel('hello_world-test')).toBe('Hello World Test');
  });

  it('should handle single word', () => {
    expect(toLabel('hello')).toBe('Hello');
  });

  it('should handle numbers', () => {
    expect(toLabel('hello2world')).toBe('Hello2world');
  });
});

describe('getDisplayText', () => {
  it('should return string as-is', () => {
    expect(getDisplayText('hello')).toBe('hello');
  });

  it('should convert number to string', () => {
    expect(getDisplayText(42)).toBe('42');
  });

  it('should convert true to Yes', () => {
    expect(getDisplayText(true)).toBe('Yes');
  });

  it('should convert false to No', () => {
    expect(getDisplayText(false)).toBe('No');
  });

  it('should convert Date to ISO string', () => {
    const date = new Date('2024-01-15');
    expect(getDisplayText(date)).toBe(date.toISOString());
  });

  it('should return empty string for null', () => {
    expect(getDisplayText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(getDisplayText(undefined)).toBe('');
  });

  it('should JSON stringify objects', () => {
    expect(getDisplayText({ a: 1 })).toBe('{"a":1}');
  });
});

describe('formatFieldCount', () => {
  it('should format single revision field', () => {
    expect(formatFieldCount(1, 'revision')).toBe('1 field changed in revision');
  });

  it('should format multiple revision fields', () => {
    expect(formatFieldCount(3, 'revision')).toBe('3 fields changed in revision');
  });

  it('should format single comparison field', () => {
    expect(formatFieldCount(1, 'comparison')).toBe('1 differing field');
  });

  it('should format multiple comparison fields', () => {
    expect(formatFieldCount(5, 'comparison')).toBe('5 differing fields');
  });
});
