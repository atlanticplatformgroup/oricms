import { describe, expect, it } from 'vitest';
import { resolveFallbackFieldCapability, resolveRegisteredFieldCapability } from '../capabilities';

describe('field capabilities', () => {
  it('resolves enum labels and stored values for search', () => {
    const capability = resolveRegisteredFieldCapability({
      field: {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: {
          choices: [
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
          ],
        },
      },
      fieldType: 'select',
      value: 'published',
    });

    expect(capability.displayText).toBe('Published');
    expect(capability.searchTokens).toEqual(expect.arrayContaining(['Published', 'published']));
  });

  it('uses relation labels when available and falls back safely for unknown fields', () => {
    const relationCapability = resolveRegisteredFieldCapability({
      field: {
        key: 'author',
        label: 'Author',
        type: 'relation',
        relation: { target: 'authors' },
      } as any,
      fieldType: 'relation',
      value: 'author-1',
      context: {
        relationLabels: {
          'author-1': 'Isaac Asimov',
        },
      },
    });

    expect(relationCapability.displayText).toBe('Isaac Asimov');
    expect(relationCapability.searchTokens).toEqual(expect.arrayContaining(['Isaac Asimov', 'author-1']));

    const fallbackCapability = resolveFallbackFieldCapability({
      field: {
        key: 'payload',
        label: 'Payload',
        type: 'json',
      },
      fieldType: 'json',
      value: { nested: true },
    });

    expect(fallbackCapability.searchTokens).toEqual([]);
    expect(fallbackCapability.displayText).toBe('{"nested":true}');
  });
});
