import { createContext, useContext, type ReactNode } from 'react';
import { useSchemaEditor } from '../../hooks/useSchemaEditor';

type SchemaEditorValue = ReturnType<typeof useSchemaEditor>;
const SchemaEditorContext = createContext<SchemaEditorValue | null>(null);

export function SchemaEditorProvider({ children, ...options }: { children: ReactNode } & Parameters<typeof useSchemaEditor>[0]) {
  const value = useSchemaEditor(options);
  return <SchemaEditorContext.Provider value={value}>{children}</SchemaEditorContext.Provider>;
}

export function useSchemaEditorContext() {
  const value = useContext(SchemaEditorContext);
  if (!value) throw new Error('useSchemaEditorContext must be used within SchemaEditorProvider');
  return value;
}
