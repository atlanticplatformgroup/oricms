import { describe, expect, it } from 'vitest';
import { moveArrayItem } from '../array-move';

describe('moveArrayItem', () => {
  it('should move an item forward', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(moveArrayItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('should move an item backward', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(moveArrayItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('should return a new array', () => {
    const items = ['a', 'b', 'c'];
    const result = moveArrayItem(items, 0, 1);
    expect(result).not.toBe(items);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('should return unchanged array when fromIndex equals toIndex', () => {
    const items = ['a', 'b', 'c'];
    expect(moveArrayItem(items, 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('should return unchanged array for out-of-bounds fromIndex', () => {
    const items = ['a', 'b', 'c'];
    expect(moveArrayItem(items, -1, 1)).toEqual(['a', 'b', 'c']);
    expect(moveArrayItem(items, 5, 1)).toEqual(['a', 'b', 'c']);
  });

  it('should return unchanged array for out-of-bounds toIndex', () => {
    const items = ['a', 'b', 'c'];
    expect(moveArrayItem(items, 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveArrayItem(items, 0, 5)).toEqual(['a', 'b', 'c']);
  });

  it('should work with objects', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(moveArrayItem(items, 0, 2)).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
  });
});
