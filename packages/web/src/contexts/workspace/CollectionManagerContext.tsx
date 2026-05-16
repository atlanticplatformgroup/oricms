import { createContext, useContext, type ReactNode } from 'react';
import { useCollectionManager } from '../../hooks/useCollectionManager';

type CollectionManagerValue = ReturnType<typeof useCollectionManager>;
const CollectionManagerContext = createContext<CollectionManagerValue | null>(null);

export function CollectionManagerProvider({ children, ...options }: { children: ReactNode } & Parameters<typeof useCollectionManager>[0]) {
  const value = useCollectionManager(options);
  return <CollectionManagerContext.Provider value={value}>{children}</CollectionManagerContext.Provider>;
}

export function useCollectionManagerContext() {
  const value = useContext(CollectionManagerContext);
  if (!value) throw new Error('useCollectionManagerContext must be used within CollectionManagerProvider');
  return value;
}
