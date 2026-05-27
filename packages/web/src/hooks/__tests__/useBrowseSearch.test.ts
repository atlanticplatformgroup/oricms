import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useBrowseSearch } from '../useBrowseSearch';

vi.mock('@mantine/hooks', () => ({
  useDebouncedValue: (value: string, _delay: number) => [value],
}));

describe('useBrowseSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty string by default', () => {
    const { result } = renderHook(() => useBrowseSearch());
    expect(result.current.value).toBe('');
    expect(result.current.debouncedValue).toBe('');
    expect(result.current.hasActiveSearch).toBe(false);
  });

  it('accepts an initial value', () => {
    const { result } = renderHook(() => useBrowseSearch('hello'));
    expect(result.current.value).toBe('hello');
    expect(result.current.hasActiveSearch).toBe(true);
  });

  it('updates value via setValue', () => {
    const { result } = renderHook(() => useBrowseSearch());

    act(() => {
      result.current.setValue('query');
    });

    expect(result.current.value).toBe('query');
    expect(result.current.hasActiveSearch).toBe(true);
  });

  it('clears value via clear', () => {
    const { result } = renderHook(() => useBrowseSearch('query'));

    act(() => {
      result.current.clear();
    });

    expect(result.current.value).toBe('');
    expect(result.current.hasActiveSearch).toBe(false);
  });

  it('trims whitespace for hasActiveSearch', () => {
    const { result } = renderHook(() => useBrowseSearch('   '));
    expect(result.current.hasActiveSearch).toBe(false);

    act(() => {
      result.current.setValue('  search  ');
    });

    expect(result.current.value).toBe('  search  ');
    expect(result.current.hasActiveSearch).toBe(true);
  });
});
