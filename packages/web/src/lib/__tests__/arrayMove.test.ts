import { describe, expect, it } from 'vitest';
import { moveArrayItem } from '../array-move';

describe('moveArrayItem', () => {
  it('moves item between valid indexes', () => {
    expect(moveArrayItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveArrayItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns a copy for no-op or invalid indexes', () => {
    expect(moveArrayItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveArrayItem(['a', 'b'], -1, 1)).toEqual(['a', 'b']);
    expect(moveArrayItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});
