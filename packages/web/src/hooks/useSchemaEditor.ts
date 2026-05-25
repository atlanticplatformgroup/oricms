import { useEffect, useMemo, useState } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import type { ComponentSchema, ContentType, FieldType, SchemaField } from '@ori/shared';
import { gitApi } from '../lib/api/git';
import { moveArrayItem } from '../lib/array-move';
import { makeSchemaField, toSchemaFieldKey } from '../lib/schemas/factory';
import { getSchemaValidation } from '../lib/schemas/validation';
import { toLabel } from '../lib/workspace/format';
import type { LoadedSchemaDocument } from '../lib/workspace/types';
import { useSchemaHistory } from './queries/useSchemaQueries';
import { useWorkspaceRouterContext } from '../contexts/workspace/WorkspaceRouterContext';
import { useActionScopedLock } from './useActionScopedLock';

interface UseSchemaEditorOptions {
  projectId: string | null;
  activeSchemaMode: 'types' | 'components';
  selectedSchema: ContentType | ComponentSchema | null;
  selectedSchemaDocument: LoadedSchemaDocument | null;
  showToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  queryClient: QueryClient;
  onNavigateToSchema: (schemaId: string, mode: 'types' | 'components') => void;
  onNavigateAfterDelete: (mode: 'types' | 'components') => void;
}

export function useSchemaEditor({
  projectId,
  activeSchemaMode,
  selectedSchema,
  selectedSchemaDocument,
  showToast,
  queryClient,
  onNavigateToSchema,
  onNavigateAfterDelete,
}: UseSchemaEditorOptions) {
  const { activeBranchName } = useWorkspaceRouterContext();
  const [schemaDraft, setSchemaDraft] = useState<ContentType | ComponentSchema | null>(null);
  const [createSchemaOpened, setCreateSchemaOpened] = useState(false);
  const [deleteSchemaOpened, setDeleteSchemaOpened] = useState(false);
  const [schemaJsonOpened, setSchemaJsonOpened] = useState(false);
  const [schemaHistoryOpened, setSchemaHistoryOpened] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');
  const [newSchemaLabel, setNewSchemaLabel] = useState('');
  const [newSchemaDescription, setNewSchemaDescription] = useState('');
  const [newSchemaFieldType, setNewSchemaFieldType] = useState<FieldType>('string');

  const schemaLock = useActionScopedLock({
    projectId,
    resourceType: 'schema',
    resourceId: selectedSchemaDocument?.path ?? `schemas-${activeSchemaMode}`,
    branch: activeBranchName ?? undefined,
    mode: 'hard',
    reason: 'editing',
  });

  const saveSchemaMutation = useMutation({
    mutationFn: async ({ path, schema, headers }: { path: string; schema: ContentType | ComponentSchema; headers: Record<string, string> }) => {
      if (!projectId) throw new Error('Project id is required');
      await gitApi.saveSchema(
        projectId,
        path,
        `${JSON.stringify(schema, null, 2)}\n`,
        `Update schema: ${schema.label || schema.name || schema.$id}`,
        headers,
      );
      return path;
    },
    onSuccess: async () => {
      showToast('Schema saved', 'success');
      if (!projectId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['type-schemas', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['component-schemas', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['content-types', projectId] }),
      ]);
    },
    onError: () => {
      showToast('Failed to save schema', 'error');
    },
  });

  const deleteSchemaMutation = useMutation({
    mutationFn: async ({ path, headers }: { path: string; headers: Record<string, string> }) => {
      if (!projectId) throw new Error('Project id is required');
      await gitApi.deleteSchema(projectId, path, headers);
      return path;
    },
    onSuccess: async () => {
      showToast('Schema deleted', 'success');
      if (!projectId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['type-schemas', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['component-schemas', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['content-types', projectId] }),
      ]);
      setDeleteSchemaOpened(false);
      onNavigateAfterDelete(activeSchemaMode);
    },
    onError: () => {
      showToast('Failed to delete schema', 'error');
    },
  });

  useEffect(() => {
    if (!selectedSchema) {
      setSchemaDraft(null);
      return;
    }
    setSchemaDraft(JSON.parse(JSON.stringify(selectedSchema)) as ContentType | ComponentSchema);
  }, [selectedSchema]);

  const effectiveSchema = schemaDraft ?? selectedSchema;
  const effectiveSchemaFields = effectiveSchema?.fields ?? [];

  const newFieldGuidance = useMemo(() => {
    if (newSchemaFieldType === 'component') {
      return 'Use repeatable components for structured repeaters where every item follows the same schema.';
    }
    if (newSchemaFieldType === 'blocks') {
      return 'Use blocks only when a field must contain mixed component types in one ordered content zone.';
    }
    if (newSchemaFieldType === 'array') {
      return 'Keep arrays primitive. Prefer repeatable components for structured list items.';
    }
    return 'Choose the simplest field that matches the authoring need.';
  }, [newSchemaFieldType]);

  const isSchemaDirty = useMemo(() => {
    if (!schemaDraft || !selectedSchema) return false;
    return JSON.stringify(schemaDraft) !== JSON.stringify(selectedSchema);
  }, [schemaDraft, selectedSchema]);

  const schemaValidation = useMemo(() => getSchemaValidation(effectiveSchema), [effectiveSchema]);
  const canSaveSchema = Boolean(
    selectedSchemaDocument
      && schemaDraft
      && isSchemaDirty
      && schemaValidation.issueCount === 0
      && !saveSchemaMutation.isPending
      && !schemaLock.isPending,
  );
  const schemaJson = useMemo(() => (effectiveSchema ? `${JSON.stringify(effectiveSchema, null, 2)}\n` : ''), [effectiveSchema]);
  const schemaHistoryQuery = useSchemaHistory(
    projectId ?? undefined,
    selectedSchemaDocument?.path ?? null,
    20,
    schemaHistoryOpened,
  );

  const handleSchemaMetaChange = (key: 'label' | 'description', value: string) => {
    setSchemaDraft((previous) => {
      if (!previous) return previous;
      return { ...previous, [key]: value };
    });
  };

  const handleSchemaFieldPatch = (fieldKey: string, updater: (field: SchemaField) => SchemaField) => {
    setSchemaDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        fields: previous.fields.map((field) => (field.key === fieldKey ? updater(field) : field)),
      };
    });
  };

  const handleAddSchemaField = () => {
    setSchemaDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        fields: [...previous.fields, makeSchemaField(newSchemaFieldType, previous.fields)],
      };
    });
  };

  const handleRemoveSchemaField = (fieldKey: string) => {
    setSchemaDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        fields: previous.fields.filter((field) => field.key !== fieldKey),
      };
    });
  };

  const handleReorderSchemaField = (fieldKey: string, targetFieldKey: string) => {
    setSchemaDraft((previous) => {
      if (!previous) return previous;
      const currentIndex = previous.fields.findIndex((field) => field.key === fieldKey);
      const targetIndex = previous.fields.findIndex((field) => field.key === targetFieldKey);
      if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return previous;
      return {
        ...previous,
        fields: moveArrayItem(previous.fields, currentIndex, targetIndex),
      };
    });
  };

  const handleCreateSchema = async () => {
    if (!projectId) return;
    const nextName = toSchemaFieldKey(newSchemaName);
    const nextLabel = newSchemaLabel.trim() || toLabel(nextName);
    if (!nextName) {
      showToast('Schema name is required', 'error');
      return;
    }

    const path =
      activeSchemaMode === 'components'
        ? `schemas/components/${nextName}.json`
        : `schemas/types/${nextName}.json`;

    const schema =
      activeSchemaMode === 'components'
        ? ({
            $schema: 'component-v1',
            $id: nextName,
            name: nextName,
            label: nextLabel,
            description: newSchemaDescription.trim() || undefined,
            fields: [makeSchemaField('string', [], { key: 'title', label: 'Title' })],
          } satisfies ComponentSchema)
        : ({
            $schema: 'content-type-v1',
            $id: nextName,
            name: nextName,
            plural: `${nextName}s`,
            label: nextLabel,
            labelPlural: `${nextLabel}s`,
            description: newSchemaDescription.trim() || undefined,
            fields: [makeSchemaField('string', [], { key: 'title', label: 'Title' })],
            display: { primary: 'title' },
          } satisfies ContentType);

    await schemaLock.runWithLock((headers) => saveSchemaMutation.mutateAsync({ path, schema, headers }));
    setCreateSchemaOpened(false);
    setNewSchemaName('');
    setNewSchemaLabel('');
    setNewSchemaDescription('');
    onNavigateToSchema(nextName, activeSchemaMode);
  };

  const handleSaveSchema = async () => {
    if (!selectedSchemaDocument || !schemaDraft || schemaValidation.issueCount > 0) return;
    await schemaLock.runWithLock((headers) => saveSchemaMutation.mutateAsync({ path: selectedSchemaDocument.path, schema: schemaDraft, headers }));
  };

  const handleDeleteSchema = async () => {
    if (!selectedSchemaDocument) return;
    await schemaLock.runWithLock((headers) => deleteSchemaMutation.mutateAsync({ path: selectedSchemaDocument.path, headers }));
  };

  return {
    effectiveSchema,
    effectiveSchemaFields,
    isSchemaDirty,
    createSchemaOpened,
    setCreateSchemaOpened,
    deleteSchemaOpened,
    setDeleteSchemaOpened,
    schemaJsonOpened,
    setSchemaJsonOpened,
    schemaHistoryOpened,
    setSchemaHistoryOpened,
    newSchemaName,
    setNewSchemaName,
    newSchemaLabel,
    setNewSchemaLabel,
    newSchemaDescription,
    setNewSchemaDescription,
    newSchemaFieldType,
    setNewSchemaFieldType,
    schemaValidation,
    canSaveSchema,
    newFieldGuidance,
    schemaJson,
    schemaHistory: schemaHistoryQuery.data?.history || [],
    schemaHistoryLoading: schemaHistoryQuery.isLoading,
    handleSchemaMetaChange,
    handleSchemaFieldPatch,
    handleAddSchemaField,
    handleRemoveSchemaField,
    handleReorderSchemaField,
    handleCreateSchema,
    handleSaveSchema,
    handleDeleteSchema,
    saveSchemaPending: saveSchemaMutation.isPending,
    deleteSchemaPending: deleteSchemaMutation.isPending,
    schemaLock,
  };
}
