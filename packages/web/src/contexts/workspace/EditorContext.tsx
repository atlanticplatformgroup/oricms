import { useMemo } from 'react';
import { createContext, useContext, type ReactNode } from 'react';
import { useEntryEditor } from '../../hooks/useEntryEditor';

type EditorValue = ReturnType<typeof useEntryEditor>;
const EditorContext = createContext<EditorValue | null>(null);

export function EditorProvider({ children, ...options }: { children: ReactNode } & Parameters<typeof useEntryEditor>[0]) {
  const value = useEntryEditor(options);
  const memoizedValue = useMemo(() => value, Object.values(value));
  return <EditorContext.Provider value={memoizedValue}>{children}</EditorContext.Provider>;
}

export function useEditorContext() {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditorContext must be used within EditorProvider');
  return value;
}
