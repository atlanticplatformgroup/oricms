import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceData } from '../hooks/useWorkspaceData';

const workspaceCatalogFixture = {
  catalog: {
    navigation: {
      systemSurfaces: [],
      uiGroups: [] as Array<{ group: { id: string; label: string; order: number }; collectionIds: string[] }>,
      ungroupedCollectionIds: ['catalog-posts', 'catalog-pages'],
    },
    collections: [
      {
        collection: {
          id: 'catalog-posts',
          label: 'Catalog Posts',
          contentType: 'post',
          path: 'content/catalog-posts',
        },
        recordCount: 2,
      },
      {
        collection: {
          id: 'catalog-pages',
          label: 'Catalog Pages',
          contentType: 'page',
          path: 'content/catalog-pages',
        },
        recordCount: 1,
      },
    ],
    schemas: [],
  },
};

vi.mock('../hooks/queries/useCollectionQueries', () => ({
  useCollections: vi.fn(() => ({ data: { collections: [] } })),
  useContentTypes: vi.fn(() => ({
    data: {
      contentTypes: [
        {
          $schema: 'content-type-v1',
          $id: 'author',
          name: 'author',
          label: 'Author',
          fields: [],
        },
      ],
    },
  })),
  useCollectionEntries: vi.fn(() => ({ data: { data: [] } })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: unknown[] }) => {
    if (Array.isArray(queryKey) && queryKey[0] === 'type-schemas') {
      return {
        data: [
          {
            path: 'schemas/types/author.json',
            schema: {
              $schema: 'content-type-v1',
              $id: 'author',
              name: 'author',
              label: 'Author',
              description: 'Author records',
              fields: [],
            },
          },
          {
            path: 'schemas/types/books.json',
            schema: {
              $schema: 'content-type-v1',
              $id: 'books',
              name: 'books',
              label: 'Books',
              description: 'Books records',
              fields: [],
            },
          },
        ],
      };
    }

    if (Array.isArray(queryKey) && queryKey[0] === 'component-schemas') {
      return { data: [] };
    }

    if (Array.isArray(queryKey) && queryKey[0] === 'assets') {
      return { data: { assets: [] } };
    }

    if (Array.isArray(queryKey) && queryKey[0] === 'workspace-catalog') {
      return { data: workspaceCatalogFixture };
    }

    return { data: null };
  }),
}));

describe('useWorkspaceData', () => {
  it('builds schema sidebar options for content types from type schema documents', () => {
    const { result } = renderHook(() =>
      useWorkspaceData({
        projectId: 'project-1',
        activeSection: 'schemas',
        activeSecondaryId: 'books',
        activeSchemaMode: 'types',
        activeEntryId: null,
        branchName: 'main',
      }),
    );

    expect(result.current.schemaSecondaryOptions).toEqual([
      {
        id: 'author',
        label: 'Author',
      },
      {
        id: 'books',
        label: 'Books',
      },
    ]);

    expect(result.current.selectedSchema?.$id).toBe('books');
  });

  it('uses registry-provided static secondary options for settings', () => {
    const { result } = renderHook(() =>
      useWorkspaceData({
        projectId: 'project-1',
        activeSection: 'settings',
        activeSecondaryId: 'environments',
        activeSchemaMode: 'types',
        activeEntryId: null,
        branchName: 'main',
      }),
    );

    expect(result.current.secondaryOptions).toEqual([
      { id: 'general', label: 'General', description: 'Project identity and defaults' },
      { id: 'branches', label: 'Branches', description: 'Create, rename, and remove branches' },
      { id: 'environments', label: 'Environments', description: 'Deployment targets and branch mappings' },
    ]);
    expect(result.current.selectedSecondaryOption).toEqual({
      id: 'environments',
      label: 'Environments',
      description: 'Deployment targets and branch mappings',
    });
  });

  it('adds the global media settings destination only for managers', () => {
    const { result } = renderHook(() =>
      useWorkspaceData({
        projectId: 'project-1',
        activeSection: 'settings',
        activeSecondaryId: 'global-media',
        activeSchemaMode: 'types',
        activeEntryId: null,
        branchName: 'main',
        canManageGlobalMedia: true,
      }),
    );

    expect(result.current.secondaryOptions).toContainEqual({
      id: 'global-media',
      label: 'Global Media',
      description: 'Shared brand assets and reusable files',
    });
    expect(result.current.selectedSecondaryOption).toEqual({
      id: 'global-media',
      label: 'Global Media',
      description: 'Shared brand assets and reusable files',
    });
  });

  it('prefers workspace catalog collections for the collections secondary rail', () => {
    const { result } = renderHook(() =>
      useWorkspaceData({
        projectId: 'project-1',
        activeSection: 'collections',
        activeSecondaryId: 'catalog-pages',
        activeSchemaMode: 'types',
        activeEntryId: null,
        branchName: 'main',
      }),
    );

    expect(result.current.secondaryOptions).toEqual([
      { id: 'catalog-posts', label: 'Catalog Posts', groupId: null, groupLabel: null, groupOrder: null },
      { id: 'catalog-pages', label: 'Catalog Pages', groupId: null, groupLabel: null, groupOrder: null },
    ]);
    expect(result.current.selectedSecondaryOption).toEqual({
      id: 'catalog-pages',
      label: 'Catalog Pages',
      groupId: null,
      groupLabel: null,
      groupOrder: null,
    });
  });

  it('includes ui group metadata for catalog-backed collection options', async () => {
    workspaceCatalogFixture.catalog.navigation.uiGroups = [
      {
        group: { id: 'editorial', label: 'Editorial', order: 1 },
        collectionIds: ['catalog-posts'],
      },
    ];

    const { result } = renderHook(() =>
      useWorkspaceData({
        projectId: 'project-1',
        activeSection: 'collections',
        activeSecondaryId: 'catalog-posts',
        activeSchemaMode: 'types',
        activeEntryId: null,
        branchName: 'main',
      }),
    );

    expect(result.current.secondaryOptions).toEqual([
      { id: 'catalog-posts', label: 'Catalog Posts', groupId: 'editorial', groupLabel: 'Editorial', groupOrder: 1 },
      { id: 'catalog-pages', label: 'Catalog Pages', groupId: null, groupLabel: null, groupOrder: null },
    ]);

    workspaceCatalogFixture.catalog.navigation.uiGroups = [];
  });
});
