import { createContext, useContext, type ReactNode } from 'react';
import { useEntryHistory } from '../../hooks/useEntryHistory';

type EntryHistoryValue = ReturnType<typeof useEntryHistory>;
const EntryHistoryContext = createContext<EntryHistoryValue | null>(null);

export function EntryHistoryProvider({ children, ...options }: { children: ReactNode } & Parameters<typeof useEntryHistory>[0]) {
  const value = useEntryHistory(options);
  return <EntryHistoryContext.Provider value={value}>{children}</EntryHistoryContext.Provider>;
}

export function useEntryHistoryContext() {
  const value = useContext(EntryHistoryContext);
  if (!value) throw new Error('useEntryHistoryContext must be used within EntryHistoryProvider');
  return value;
}
