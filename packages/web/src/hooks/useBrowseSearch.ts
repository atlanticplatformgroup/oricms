import { useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

interface UseBrowseSearchOptions {
  debounceMs?: number;
}

export function useBrowseSearch(initialValue = '', options: UseBrowseSearchOptions = {}) {
  const { debounceMs = 180 } = options;
  const [value, setValue] = useState(initialValue);
  const [debouncedValue] = useDebouncedValue(value, debounceMs);

  return {
    value,
    setValue,
    debouncedValue,
    hasActiveSearch: value.trim().length > 0,
    clear: () => setValue(''),
  };
}
