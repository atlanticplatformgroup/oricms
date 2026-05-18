import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionConfig, ContentType } from '@ori/shared';
import { getCollectionPathError, normalizeCollectionPath } from '../lib/collections/path';
import { toLabel } from '../lib/workspace/format';
import { toSchemaFieldKey } from '../lib/schemas/factory';

interface CollectionSettingsFormState {
  id: string;
  label: string;
  singularLabel: string;
  contentType: string;
  path: string;
  description: string;
  routingEnabled: boolean;
  slugPattern: string;
}

interface NewCollectionFormState {
  id: string;
  label: string;
  singularLabel: string;
  contentType: string;
  path: string;
  description: string;
}

interface UseCollectionManagerOptions {
  selectedCollection: CollectionConfig | null;
  collections: CollectionConfig[];
  contentTypes: ContentType[];
  selectedCollectionEntryCount: number;
  showToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onPersistCreate: (nextCollection: CollectionConfig, headers?: Record<string, string>) => Promise<void>;
  onPersistSaveSettings: (nextCollections: CollectionConfig[], nextCollectionId: string, headers?: Record<string, string>) => Promise<void>;
  onPersistDelete: (collectionId: string, nextCollectionId: string | null, headers?: Record<string, string>) => Promise<void>;
}

export function useCollectionManager({
  selectedCollection,
  collections,
  contentTypes,
  selectedCollectionEntryCount,
  showToast,
  onPersistCreate,
  onPersistSaveSettings,
  onPersistDelete,
}: UseCollectionManagerOptions) {
  const [createCollectionOpened, setCreateCollectionOpened] = useState(false);
  const [collectionSettings, setCollectionSettings] = useState<CollectionSettingsFormState>({
    id: '',
    label: '',
    singularLabel: '',
    contentType: '',
    path: '',
    description: '',
    routingEnabled: false,
    slugPattern: '/{slug}',
  });
  const [newCollection, setNewCollection] = useState<NewCollectionFormState>({
    id: '',
    label: '',
    singularLabel: '',
    contentType: '',
    path: '',
    description: '',
  });
  const lastSyncedCollectionIdRef = useRef<string | null>(null);
  const [lastSyncedCollectionSettings, setLastSyncedCollectionSettings] = useState<CollectionSettingsFormState | null>(null);

  const selectedTypeOptions = useMemo(
    () => contentTypes.map((type) => ({ value: type.$id, label: type.label || type.name || type.$id })),
    [contentTypes],
  );

  const selectedCollectionSettings = useMemo<CollectionSettingsFormState | null>(() => {
    if (!selectedCollection) return null;
    return {
      id: selectedCollection.id,
      label: selectedCollection.label || '',
      singularLabel: selectedCollection.singularLabel || '',
      contentType: selectedCollection.contentType || '',
      path: selectedCollection.path || '',
      description: selectedCollection.description || '',
      routingEnabled: Boolean(selectedCollection.routing?.enabled),
      slugPattern: selectedCollection.routing?.slugPattern || '/{slug}',
    };
  }, [selectedCollection]);

  const collectionSettingsDirty = useMemo(() => {
    if (!lastSyncedCollectionSettings) return false;
    return JSON.stringify(collectionSettings) !== JSON.stringify(lastSyncedCollectionSettings);
  }, [collectionSettings, lastSyncedCollectionSettings]);

  useEffect(() => {
    if (!selectedCollectionSettings) {
      lastSyncedCollectionIdRef.current = null;
      setLastSyncedCollectionSettings(null);
      return;
    }

    const nextCollectionId = selectedCollectionSettings.id;
    const switchedCollections = lastSyncedCollectionIdRef.current !== nextCollectionId;
    lastSyncedCollectionIdRef.current = nextCollectionId;

    if (!switchedCollections && collectionSettingsDirty) {
      return;
    }

    setCollectionSettings(selectedCollectionSettings);
    setLastSyncedCollectionSettings(selectedCollectionSettings);
  }, [collectionSettingsDirty, selectedCollectionSettings]);

  const newCollectionPathValue = useMemo(
    () => normalizeCollectionPath(newCollection.path.trim() || `content/${toSchemaFieldKey(newCollection.id)}`),
    [newCollection.id, newCollection.path],
  );
  const newCollectionPathError = useMemo(
    () => getCollectionPathError(newCollectionPathValue, collections),
    [newCollectionPathValue, collections],
  );
  const collectionSettingsPathValue = useMemo(
    () => normalizeCollectionPath(collectionSettings.path.trim() || selectedCollection?.path || ''),
    [collectionSettings.path, selectedCollection?.path],
  );
  const collectionSettingsPathError = useMemo(
    () => getCollectionPathError(collectionSettingsPathValue, collections, selectedCollection?.id),
    [collectionSettingsPathValue, collections, selectedCollection?.id],
  );

  const openCreateCollection = () => {
    const defaultType = contentTypes[0];
    const defaultId = defaultType?.name || '';
    setNewCollection({
      id: defaultId,
      label: defaultType?.labelPlural || defaultType?.label || '',
      singularLabel: defaultType?.label || '',
      contentType: defaultType?.$id || '',
      path: defaultId ? `content/${defaultId}s` : '',
      description: '',
    });
    setCreateCollectionOpened(true);
  };

  const handleCreateCollection = async (headers?: Record<string, string>) => {
    const nextId = toSchemaFieldKey(newCollection.id);
    if (!nextId) {
      showToast('Schema id is required', 'error');
      return;
    }
    if (!newCollection.contentType.trim()) {
      showToast('Content type is required', 'error');
      return;
    }
    if (collections.some((collection) => collection.id === nextId)) {
      showToast('Schema id already exists', 'error');
      return;
    }
    if (newCollectionPathError) {
      showToast(newCollectionPathError, 'error');
      return;
    }

    const nextCollection: CollectionConfig = {
      id: nextId,
      label: newCollection.label.trim() || toLabel(nextId),
      singularLabel: newCollection.singularLabel.trim() || undefined,
      contentType: newCollection.contentType.trim(),
      path: newCollectionPathValue,
      description: newCollection.description.trim() || undefined,
    };

    await onPersistCreate(nextCollection, headers);
    setCreateCollectionOpened(false);
  };

  const handleSaveCollectionSettings = async (headers?: Record<string, string>) => {
    if (!selectedCollection) return;
    const nextId = collectionSettings.id.trim();
    if (!nextId) {
      showToast('Schema id is required', 'error');
      return;
    }
    if (collections.some((collection) => collection.id === nextId && collection.id !== selectedCollection.id)) {
      showToast('Schema id already exists', 'error');
      return;
    }
    if (collectionSettingsPathError) {
      showToast(collectionSettingsPathError, 'error');
      return;
    }

    const nextCollections = collections.map((collection) => {
      if (collection.id !== selectedCollection.id) return collection;
      return {
        ...collection,
        id: nextId,
        label: collectionSettings.label.trim() || nextId,
        singularLabel: collectionSettings.singularLabel.trim() || undefined,
        contentType: collectionSettings.contentType.trim() || collection.contentType,
        path: collectionSettingsPathValue,
        description: collectionSettings.description.trim() || undefined,
        routing: {
          ...(collection.routing || {}),
          enabled: collectionSettings.routingEnabled,
          slugPattern: collectionSettings.slugPattern.trim() || '/{slug}',
        },
      } as CollectionConfig;
    });

    await onPersistSaveSettings(nextCollections, nextId, headers);
  };

  const handleDeleteCollection = async (headers?: Record<string, string>) => {
    if (!selectedCollection) return;
    if (!window.confirm(`Delete collection "${selectedCollection.label}" and all of its entries? The content type will be preserved.`)) return;

    const nextCollections = collections.filter((collection) => collection.id !== selectedCollection.id);
    await onPersistDelete(selectedCollection.id, nextCollections[0]?.id || null, headers);
  };

  return {
    createCollectionOpened,
    setCreateCollectionOpened,
    collectionSettings,
    setCollectionSettings,
    newCollection,
    setNewCollection,
    selectedTypeOptions,
    selectedCollectionEntryCount,
    newCollectionPathError,
    collectionSettingsPathError,
    openCreateCollection,
    handleCreateCollection,
    handleSaveCollectionSettings,
    handleDeleteCollection,
  };
}
