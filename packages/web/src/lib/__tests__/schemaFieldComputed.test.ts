import { describe, expect, it } from 'vitest';
import type { SchemaField } from '@ori/shared';
import { applyDerivedSchemaFieldValues, buildSchemaFieldDefaults, getSchemaFieldDefaultValue } from '../schemaFieldComputed';

describe('schemaFieldComputed', () => {
  it('returns typed defaults from schema options', () => {
    const numberField: SchemaField = {
      key: 'count',
      label: 'Count',
      type: 'number',
      options: { defaultValue: '7' },
    };
    const booleanField: SchemaField = {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      options: { defaultValue: true },
    };
    expect(getSchemaFieldDefaultValue(numberField)).toBe(7);
    expect(getSchemaFieldDefaultValue(booleanField)).toBe(true);
  });

  it('derives values from source fields on create and always modes', () => {
    const fields: SchemaField[] = [
      { key: 'title', label: 'Title', type: 'text' },
      {
        key: 'slug',
        label: 'Slug',
        type: 'text',
        options: { derivedFrom: 'title', deriveStrategy: 'slug', deriveWhen: 'create' } as unknown as SchemaField['options'],
      },
      {
        key: 'titleUpper',
        label: 'Title Upper',
        type: 'text',
        options: { derivedFrom: 'title', deriveStrategy: 'uppercase', deriveWhen: 'always' } as unknown as SchemaField['options'],
      },
    ];

    const created = applyDerivedSchemaFieldValues(fields, { title: 'Hello World', slug: '' }, { isCreate: true });
    expect(created.slug).toBe('hello-world');
    expect(created.titleUpper).toBe('HELLO WORLD');

    const updated = applyDerivedSchemaFieldValues(fields, { title: 'Second Title', slug: 'custom-slug' }, { changedKey: 'title', isCreate: false });
    expect(updated.slug).toBe('custom-slug');
    expect(updated.titleUpper).toBe('SECOND TITLE');
  });

  it('builds defaults and applies create-time derivation', () => {
    const fields: SchemaField[] = [
      { key: 'title', label: 'Title', type: 'text', options: { defaultValue: 'Home' } },
      {
        key: 'slug',
        label: 'Slug',
        type: 'text',
        options: { derivedFrom: 'title', deriveStrategy: 'slug', deriveWhen: 'create' } as unknown as SchemaField['options'],
      },
    ];

    const defaults = buildSchemaFieldDefaults(fields);
    expect(defaults.title).toBe('Home');
    expect(defaults.slug).toBe('home');
  });
});
