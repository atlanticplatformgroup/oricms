import { describe, expect, it } from 'vitest';
import type { SchemaField } from '@ori/shared';
import { isSchemaFieldVisible, validateSchemaFieldOptionConstraints } from '@ori/shared';

const textField: SchemaField = {
  key: 'title',
  label: 'Title',
  type: 'text',
  options: { minLength: 3, maxLength: 8, pattern: '^[A-Za-z ]+$' },
};

describe('schemaFieldRules', () => {
  it('evaluates conditional visibility operators', () => {
    const field: SchemaField = {
      key: 'subtitle',
      label: 'Subtitle',
      type: 'text',
      options: ({
        visibleWhen: { field: 'status', operator: 'equals', value: 'published' },
      } as unknown as SchemaField['options']),
    };

    expect(isSchemaFieldVisible(field, { status: 'published' })).toBe(true);
    expect(isSchemaFieldVisible(field, { status: 'draft' })).toBe(false);
  });

  it('validates string and number constraints', () => {
    expect(validateSchemaFieldOptionConstraints(textField, 'Hi', 'title')).toContain('title must be at least 3 characters');
    expect(validateSchemaFieldOptionConstraints(textField, 'TooLongTitle', 'title')).toContain('title must be at most 8 characters');
    expect(validateSchemaFieldOptionConstraints(textField, '1234', 'title')).toContain('title format is invalid');

    const numberField: SchemaField = {
      key: 'price',
      label: 'Price',
      type: 'number',
      options: { min: 10, max: 50 },
    };

    expect(validateSchemaFieldOptionConstraints(numberField, 5, 'price')).toContain('price must be at least 10');
    expect(validateSchemaFieldOptionConstraints(numberField, 100, 'price')).toContain('price must be at most 50');
  });

  it('validates select/array/url/date constraints', () => {
    const selectField: SchemaField = {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: {
        allowCustomValue: false,
        choices: [{ value: 'draft', label: 'Draft' }],
      },
    };
    expect(validateSchemaFieldOptionConstraints(selectField, 'published', 'status')).toContain('status must be one of the configured choices');

    const arrayField: SchemaField = {
      key: 'cards',
      label: 'Cards',
      type: 'array',
      options: { minItems: 1, maxItems: 2 },
      fields: [],
    };
    expect(validateSchemaFieldOptionConstraints(arrayField, [], 'cards')).toContain('cards must have at least 1 items');
    expect(validateSchemaFieldOptionConstraints(arrayField, [1, 2, 3], 'cards')).toContain('cards must have at most 2 items');

    const urlField: SchemaField = { key: 'link', label: 'Link', type: 'url' };
    expect(validateSchemaFieldOptionConstraints(urlField, 'not-url', 'link')).toContain('link must be a valid URL');

    const dateField: SchemaField = { key: 'publishDate', label: 'Publish Date', type: 'date' };
    expect(validateSchemaFieldOptionConstraints(dateField, 'not-a-date', 'publishDate')).toContain('publishDate must be a valid date');

    const imageField: SchemaField = {
      key: 'heroImage',
      label: 'Hero Image',
      type: 'image',
      options: ({ accept: ['image/png', 'image/jpeg'] } as unknown as SchemaField['options']),
    };
    expect(validateSchemaFieldOptionConstraints(imageField, '/assets/hero.webp', 'heroImage')).toContain(
      'heroImage must match allowed file types: image/png, image/jpeg'
    );
    expect(validateSchemaFieldOptionConstraints(imageField, '/assets/hero.png', 'heroImage')).toHaveLength(0);
  });
});
