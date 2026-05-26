import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ContentType, SchemaField } from '@ori/shared';
import { useSchemaEditor } from '../useSchemaEditor';

const saveSchemaMock = vi.fn();
const deleteSchemaMock = vi.fn();

vi.mock('../../contexts/workspace/WorkspaceRouterContext', () => ({
  useWorkspaceRouterContext: () => ({ activeBranchName: 'main' }),
}));

vi.mock('../../lib/api/git', () => ({
  gitApi: {
    saveSchema: (...args: unknown[]) => saveSchemaMock(...args),
    deleteSchema: (...args: unknown[]) => deleteSchemaMock(...args),
  },
}));

vi.mock('../../lib/schemas/factory', () => ({
  makeSchemaField: (type: string, _existing: SchemaField[], options?: any) => ({
    key: options?.key || 'new-field',
    type,
    label: options?.label || 'New Field',
  }),
  toSchemaFieldKey: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('../../lib/schemas/validation', () => ({
  getSchemaValidation: (schema: any) => {
    if (!schema) return { schemaIssues: [], fieldIssuesByKey: {}, issueCount: 0 };
    const issues: string[] = [];
    if (!schema.label) issues.push('Schema label is required.');
    return { schemaIssues: issues, fieldIssuesByKey: {}, issueCount: issues.length };
  },
}));

vi.mock('../../lib/array-move', () => ({
  moveArrayItem: <T,>(arr: T[], from: number, to: number) => {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  },
}));

vi.mock('../../lib/workspace/format', () => ({
  toLabel: (id: string) => id.charAt(0).toUpperCase() + id.slice(1),
}));

vi.mock('../useActionScopedLock', () => ({
  useActionScopedLock: () => ({
    isPending: false,
    runWithLock: (fn: any) => fn({}),
  }),
}));

vi.mock('../queries/useSchemaQueries', () => ({
  useSchemaHistory: () => ({ data: { history: [] }, isLoading: false }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSchemaEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseSchema: ContentType = {
    $schema: 'content-type-v1',
    $id: 'post',
    name: 'post',
    plural: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    fields: [
      { key: 'title', type: 'string', label: 'Title' },
      { key: 'body', type: 'text', label: 'Body' },
    ],
    display: { primary: 'title' },
  };

  const selectedSchemaDocument = { path: 'schemas/types/post.json', schema: baseSchema };

  function createOptions(overrides: Partial<Parameters<typeof useSchemaEditor>[0]> = {}) {
    return {
      projectId: 'project-1',
      activeSchemaMode: 'types' as const,
      selectedSchema: baseSchema,
      selectedSchemaDocument,
      showToast: vi.fn(),
      queryClient: new QueryClient(),
      onNavigateToSchema: vi.fn(),
      onNavigateAfterDelete: vi.fn(),
      ...overrides,
    };
  }

  it('returns initial state', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    expect(result.current.effectiveSchema).toEqual(baseSchema);
    expect(result.current.effectiveSchemaFields).toHaveLength(2);
    expect(result.current.isSchemaDirty).toBe(false);
    expect(result.current.canSaveSchema).toBe(false);
    expect(result.current.createSchemaOpened).toBe(false);
  });

  it('syncs schemaDraft when selectedSchema changes', () => {
    const { result, rerender } = renderHook(
      ({ schema }) => useSchemaEditor(createOptions({ selectedSchema: schema })),
      {
        wrapper: createWrapper(),
        initialProps: { schema: baseSchema },
      },
    );

    expect(result.current.effectiveSchema?.$id).toBe('post');

    const nextSchema = { ...baseSchema, $id: 'page', name: 'page', label: 'Page' };
    rerender({ schema: nextSchema });

    expect(result.current.effectiveSchema?.$id).toBe('page');
  });

  it('clears effectiveSchema when selectedSchema is null', () => {
    const { result, rerender } = renderHook(
      ({ schema }) => useSchemaEditor(createOptions({ selectedSchema: schema, selectedSchemaDocument: schema ? selectedSchemaDocument : null })),
      {
        wrapper: createWrapper(),
        initialProps: { schema: baseSchema as ContentType | null },
      },
    );

    rerender({ schema: null as ContentType | null });

    expect(result.current.effectiveSchema).toBeNull();
  });

  it('computes isSchemaDirty when draft changes', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSchemaDirty).toBe(false);

    act(() => result.current.handleSchemaMetaChange('label', 'Article'));

    expect(result.current.isSchemaDirty).toBe(true);
  });

  it('computes schemaValidation and canSaveSchema', () => {
    const invalidSchema = { ...baseSchema, label: '' };
    const { result } = renderHook(() => useSchemaEditor(createOptions({ selectedSchema: invalidSchema })), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleSchemaMetaChange('label', ''));

    expect(result.current.schemaValidation.issueCount).toBeGreaterThan(0);
    expect(result.current.canSaveSchema).toBe(false);
  });

  it('handleSchemaMetaChange updates draft label', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleSchemaMetaChange('label', 'Article'));

    expect(result.current.effectiveSchema?.label).toBe('Article');
  });

  it('handleSchemaFieldPatch updates a field', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleSchemaFieldPatch('title', (field) => ({ ...field, label: 'Heading' })));

    const titleField = result.current.effectiveSchemaFields.find((f: SchemaField) => f.key === 'title');
    expect(titleField?.label).toBe('Heading');
  });

  it('handleAddSchemaField adds a field', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleAddSchemaField());

    expect(result.current.effectiveSchemaFields).toHaveLength(3);
  });

  it('handleRemoveSchemaField removes a field', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleRemoveSchemaField('body'));

    expect(result.current.effectiveSchemaFields).toHaveLength(1);
    expect(result.current.effectiveSchemaFields[0].key).toBe('title');
  });

  it('handleReorderSchemaField reorders fields', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleReorderSchemaField('body', 'title'));

    expect(result.current.effectiveSchemaFields[0].key).toBe('body');
    expect(result.current.effectiveSchemaFields[1].key).toBe('title');
  });

  it('handleCreateSchema validates name and calls mutation', async () => {
    const showToast = vi.fn();
    const onNavigateToSchema = vi.fn();
    saveSchemaMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSchemaEditor(createOptions({ selectedSchema: null, selectedSchemaDocument: null, showToast, onNavigateToSchema })), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setNewSchemaName('article'));
    act(() => result.current.setNewSchemaLabel('Article'));

    await act(async () => result.current.handleCreateSchema());

    expect(saveSchemaMock).toHaveBeenCalled();
    expect(onNavigateToSchema).toHaveBeenCalledWith('article', 'types');
  });

  it('handleCreateSchema shows error when name is empty', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useSchemaEditor(createOptions({ selectedSchema: null, selectedSchemaDocument: null, showToast })), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.handleCreateSchema());

    expect(showToast).toHaveBeenCalledWith('Schema name is required', 'error');
  });

  it('handleSaveSchema calls saveSchemaMutation', async () => {
    saveSchemaMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.handleSchemaMetaChange('label', 'Updated'));

    await act(async () => result.current.handleSaveSchema());

    expect(saveSchemaMock).toHaveBeenCalled();
  });

  it('handleDeleteSchema calls deleteSchemaMutation', async () => {
    deleteSchemaMock.mockResolvedValue(undefined);
    const onNavigateAfterDelete = vi.fn();
    const { result } = renderHook(() => useSchemaEditor(createOptions({ onNavigateAfterDelete })), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.handleDeleteSchema());

    expect(deleteSchemaMock).toHaveBeenCalled();
  });

  it('exposes newFieldGuidance', () => {
    const { result } = renderHook(() => useSchemaEditor(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setNewSchemaFieldType('component'));
    expect(result.current.newFieldGuidance).toContain('repeatable components');

    act(() => result.current.setNewSchemaFieldType('blocks'));
    expect(result.current.newFieldGuidance).toContain('blocks');
  });
});
