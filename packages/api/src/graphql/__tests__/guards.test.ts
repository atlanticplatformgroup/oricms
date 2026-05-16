import { describe, expect, it } from 'vitest';
import { validateGraphQlDocument } from '../guards';

describe('graphql guards', () => {
  it('accepts valid query within depth and cost limits', () => {
    const result = validateGraphQlDocument('{ contentTypes { id name } }', {
      maxQueryLength: 2000,
      maxDepth: 6,
      maxCost: 500,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.cost).toBeGreaterThan(0);
    }
  });

  it('rejects query exceeding max depth', () => {
    const result = validateGraphQlDocument('{ records(type: "post") { records { data { a { b { c { d } } } } } } }', {
      maxQueryLength: 2000,
      maxDepth: 4,
      maxCost: 20_000,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain('maximum depth');
    }
  });

  it('rejects query exceeding max cost', () => {
    const result = validateGraphQlDocument(
      'query($limit: Int!) { records(type: "post", limit: $limit) { records { id type data } meta { pagination { total page } } } }',
      {
        maxQueryLength: 2000,
        maxDepth: 12,
        maxCost: 500,
        variables: { limit: 100 },
      }
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain('maximum cost');
    }
  });
});
