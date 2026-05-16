import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Asset, ComponentSchema, ContentType } from '@ori/shared';
import { useCollections, useContentTypes } from './queries/useCollectionQueries';
import { assetsApi, globalAssetsApi } from '../lib/api/assets';
import { collectionsApi } from '../lib/api/collections';
import { gitApi } from '../lib/api/git';
import { workspaceApi } from '../lib/api/workspace';
import { getStaticSidebarOptions } from '../lib/workspace/registry';
import type { LoadedSchemaDocument, SidebarOption } from '../lib/workspace/types';
import { DEFAULT_SCHEMA_SECONDARY, EMPTY_SECONDARY } from '../lib/workspace/constants';
import { getAssetOptionLabel } from '../lib/assets/display';
import { toLabel } from '../lib/workspace/format';
import { getPreferredField, resolveContentType } from '../lib/entries/resolution';

interface UseWorkspaceDataOptions {
  projectId: string | null;
  activeSection: 'collections' | 'schemas' | 'media' | 'builds' | 'members' | 'settings';
  activeSecondaryId: string | null;
  activeSchemaMode: 'types' | 'components';
  activeEntryId: string | null;
  branchName: string | null;
  canManageGlobalMedia?: boolean;
}

export function useWorkspaceData({
  projectId,
  activeSection,
  activeSecondaryId,
  activeSchemaMode,
  activeEntryId,
  branchName,
  canManageGlobalMedia = false,
}: UseWorkspaceDataOptions) {
  const collectionsQuery = useCollections(projectId ?? undefined, branchName);
  const contentTypesQuery = useContentTypes(projectId ?? undefined, branchName);
  const typeSchemasQuery = useQuery({
    queryKey: ['type-schemas', projectId, branchName],
    queryFn: async () => {
      const { schemas } = await gitApi.getTypeSchemas(projectId!);
      return Promise.all(
        schemas.map(async (schema) => {
          const result = await gitApi.getSchema(projectId!, schema.path);
          return {
            path: schema.path,
            schema: JSON.parse(result.content) as ContentType,
          } satisfies LoadedSchemaDocument;
        }),
      );
    },
    enabled: Boolean(projectId),
  });
  const assetsQuery = useQuery({
    queryKey: ['assets', projectId, branchName, 'editor-images'],
    queryFn: () => assetsApi.list(projectId!, 'images'),
    enabled: Boolean(projectId),
  });
  const globalAssetsQuery = useQuery({
    queryKey: ['global-assets', projectId],
    queryFn: () => globalAssetsApi.list(projectId!),
    enabled: Boolean(projectId && activeSection === 'collections'),
  });
  const tableAssetsQuery = useQuery({
    queryKey: ['assets', projectId, branchName, 'table-display'],
    queryFn: async (): Promise<{ assets: Asset[] }> => {
      const [images, documents] = await Promise.all([
        assetsApi.list(projectId!, 'images'),
        assetsApi.list(projectId!, 'documents'),
      ]);
      const merged = new Map<string, Asset>();
      [...images.assets, ...documents.assets].forEach((asset) => merged.set(asset.path, asset));
      return { assets: [...merged.values()] };
    },
    enabled: Boolean(projectId),
  });
  const componentSchemasQuery = useQuery({
    queryKey: ['component-schemas', projectId, branchName],
    queryFn: async () => {
      const { schemas } = await gitApi.getComponentSchemas(projectId!);
      return Promise.all(
        schemas.map(async (schema) => {
          const result = await gitApi.getSchema(projectId!, schema.path);
          return {
            path: schema.path,
            schema: JSON.parse(result.content) as ComponentSchema,
          } satisfies LoadedSchemaDocument;
        }),
      );
    },
    enabled: Boolean(projectId),
  });
  const workspaceCatalogQuery = useQuery({
    queryKey: ['workspace-catalog', projectId, branchName],
    queryFn: () => workspaceApi.getCatalog(projectId!),
    enabled: Boolean(projectId && activeSection === 'collections'),
  });

  const collections = useMemo(
    () => collectionsQuery.data?.collections ?? [],
    [collectionsQuery.data?.collections],
  );
  const contentTypes = useMemo(
    () => contentTypesQuery.data?.contentTypes ?? [],
    [contentTypesQuery.data?.contentTypes],
  );
  const typeSchemaData = useMemo(
    () => typeSchemasQuery.data ?? [],
    [typeSchemasQuery.data],
  );
  const componentSchemaData = useMemo(
    () => componentSchemasQuery.data ?? [],
    [componentSchemasQuery.data],
  );
  const workspaceCatalog = workspaceCatalogQuery.data?.catalog ?? null;
  const workspaceCatalogCollections = useMemo(
    () => workspaceCatalog?.collections ?? [],
    [workspaceCatalog],
  );
  const workspaceCatalogGroups = useMemo(
    () => workspaceCatalog?.navigation.uiGroups ?? [],
    [workspaceCatalog],
  );

  const assetOptions = useMemo(
    () => (assetsQuery.data?.assets ?? []).map((asset) => ({ value: asset.path, label: getAssetOptionLabel(asset) })),
    [assetsQuery.data?.assets],
  );
  const globalAssetRecords = useMemo(
    () => globalAssetsQuery.data?.assets ?? [],
    [globalAssetsQuery.data?.assets],
  );
  const assetMap = useMemo(
    () => {
      const map = new Map<string, Asset>();
      (assetsQuery.data?.assets ?? []).forEach((asset) => map.set(asset.path, asset));
      globalAssetRecords.forEach((asset) => map.set(asset.assetId, asset as Asset));
      return map;
    },
    [assetsQuery.data?.assets, globalAssetRecords],
  );
  const componentSchemaMap = useMemo(
    () => new Map(componentSchemaData.map((item) => [item.schema.$id, item.schema])),
    [componentSchemaData],
  );

  const collectionsSecondaryOptions = useMemo(
    () => {
      const groupByCollectionId = new Map(
        workspaceCatalogGroups.flatMap((entry) =>
          entry.collectionIds.map((collectionId) => [
            collectionId,
            {
              id: entry.group.id,
              label: entry.group.label,
              order: entry.group.order,
            },
          ] as const),
        ),
      );

      if (workspaceCatalogCollections.length > 0) {
        return workspaceCatalogCollections.map(({ collection }) => ({
          id: collection.id,
          label: collection.label || toLabel(collection.id),
          groupId: groupByCollectionId.get(collection.id)?.id ?? null,
          groupLabel: groupByCollectionId.get(collection.id)?.label ?? null,
          groupOrder: groupByCollectionId.get(collection.id)?.order ?? null,
        }));
      }

      return collections.map((collection) => ({ id: collection.id, label: collection.label || toLabel(collection.id) }));
    },
    [collections, workspaceCatalogCollections, workspaceCatalogGroups],
  );

  const schemaSecondaryOptions = useMemo(() => {
    if (activeSchemaMode === 'components') {
      if (!componentSchemaData.length) {
        return [{ id: DEFAULT_SCHEMA_SECONDARY, label: 'Components', description: 'No component schemas configured yet' }];
      }

      return componentSchemaData.map((schema) => ({
        id: schema.schema.$id,
        label: schema.schema.label || schema.schema.name || schema.schema.$id,
      }));
    }

    if (!typeSchemaData.length) {
      return [{ id: DEFAULT_SCHEMA_SECONDARY, label: 'Overview', description: 'No content types configured yet' }];
    }

    return typeSchemaData.map((item) => ({
      id: item.schema.$id,
      label: item.schema.label || item.schema.name || item.schema.$id,
    }));
  }, [activeSchemaMode, componentSchemaData, typeSchemaData]);

  const secondaryOptions: SidebarOption[] = useMemo(() => {
    if (activeSection === 'collections') {
      return collectionsSecondaryOptions.length ? collectionsSecondaryOptions : [{ id: EMPTY_SECONDARY, label: 'No collections' }];
    }
    if (activeSection === 'schemas') {
      return schemaSecondaryOptions;
    }
    if (activeSection === 'settings') {
      const options = getStaticSidebarOptions(activeSection);
      return canManageGlobalMedia
        ? [...options, { id: 'global-media', label: 'Global Media', description: 'Shared brand assets and reusable files' }]
        : options;
    }
    return getStaticSidebarOptions(activeSection);
  }, [activeSection, canManageGlobalMedia, collectionsSecondaryOptions, schemaSecondaryOptions]);

  const selectedSecondaryOption = secondaryOptions.find((option) => option.id === activeSecondaryId) ?? null;
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === activeSecondaryId) ?? null,
    [collections, activeSecondaryId],
  );
  const selectedContentType = useMemo(
    () => resolveContentType(selectedCollection, contentTypes),
    [selectedCollection, contentTypes],
  );

  const primaryField =
    selectedContentType?.display?.primary ||
    getPreferredField(selectedContentType, ['title', 'name', 'label', 'slug']) ||
    '$id';
  const secondaryField =
    selectedContentType?.display?.secondary || getPreferredField(selectedContentType, ['slug', 'name']);

  const selectedEntryQuery = useQuery({
    queryKey: ['collections', 'entry', projectId, branchName, selectedCollection?.id, activeEntryId],
    queryFn: async () => {
      if (!projectId || !selectedCollection || !activeEntryId) return null;
      return collectionsApi.getEntry(projectId, selectedCollection.id, activeEntryId);
    },
    enabled: Boolean(projectId && selectedCollection && activeEntryId),
  });

  const selectedEntry = selectedEntryQuery.data?.entry || null;
  const selectedEntryRevision = selectedEntryQuery.data?.meta?.revision || null;

  const selectedSchema =
    activeSection === 'schemas'
      ? activeSchemaMode === 'components'
        ? componentSchemaData.find((item) => item.schema.$id === activeSecondaryId)?.schema ?? null
        : typeSchemasQuery.data?.find((item) => item.schema.$id === activeSecondaryId)?.schema
          ?? contentTypes.find((schema) => schema.$id === activeSecondaryId)
          ?? null
      : null;
  const selectedSchemaDocument =
    activeSection === 'schemas'
      ? activeSchemaMode === 'components'
        ? componentSchemaData.find((item) => item.schema.$id === activeSecondaryId) ?? null
        : typeSchemasQuery.data?.find((item) => item.schema.$id === activeSecondaryId) ?? null
      : null;

  const tableAssetMap = useMemo(
    () => new Map((tableAssetsQuery.data?.assets ?? []).map((asset) => [asset.path, asset])),
    [tableAssetsQuery.data?.assets],
  );

  return {
    collectionsQuery,
    contentTypesQuery,
    typeSchemasQuery,
    assetsQuery,
    globalAssetsQuery,
    tableAssetsQuery,
    componentSchemasQuery,
    workspaceCatalogQuery,
    collections,
    contentTypes,
    componentSchemaData,
    componentSchemaMap,
    assetOptions,
    assetMap,
    globalAssetRecords,
    tableAssetMap,
    secondaryOptions,
    selectedSecondaryOption,
    selectedCollection,
    selectedContentType,
    primaryField,
    secondaryField,
    selectedEntryQuery,
    selectedEntry,
    selectedEntryRevision,
    selectedSchema,
    selectedSchemaDocument,
    schemaSecondaryOptions,
  };
}
