import { useMemo, useState } from 'react';
import { getAssetTags, type Asset, type SchemaField } from '@ori/shared';
import type { AssetReference, AssetReferenceScope, GlobalAsset } from '../lib/assets/references';
import { getProjectAssetPath, normalizeAssetReference } from '../lib/assets/references';
import type { CollectionEntry } from '@ori/shared';

type SelectableAsset = Asset | GlobalAsset;

export function useStructuredAssetPicker({
  activeFields,
  assetMap,
  assetRecords,
  draftEntry,
  globalAssetRecords,
  handleFieldChange,
}: {
  activeFields: SchemaField[];
  assetMap: Map<string, Asset>;
  assetRecords: Asset[];
  draftEntry: CollectionEntry | null;
  globalAssetRecords: GlobalAsset[];
  handleFieldChange: (fieldKey: string, value: unknown) => void;
}) {
  const [assetPickerOpened, setAssetPickerOpened] = useState(false);
  const [activeAssetFieldKey, setActiveAssetFieldKey] = useState<string | null>(null);
  const [assetPickerScope, setAssetPickerScope] = useState<AssetReferenceScope>('project');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetTagFilter, setAssetTagFilter] = useState<string>('all');

  const activeAssetField = activeFields.find((field) => field.key === activeAssetFieldKey) ?? null;
  const selectedAssetValue = activeAssetFieldKey && draftEntry ? draftEntry[activeAssetFieldKey] : null;
  const selectedAssetReference = normalizeAssetReference(selectedAssetValue);
  const selectedAssetPath = getProjectAssetPath(selectedAssetValue);
  const selectedAsset = selectedAssetReference
    ? (assetMap.get(selectedAssetReference.scope === 'project' ? selectedAssetPath || '' : selectedAssetReference.assetId) as SelectableAsset | undefined) ?? null
    : null;

  const filteredAssets = useMemo<SelectableAsset[]>(() => {
    const records: SelectableAsset[] = assetPickerScope === 'global' ? globalAssetRecords : assetRecords;
    const query = assetSearch.trim().toLowerCase();
    return records.filter((asset) => {
      const matchesTag = assetTagFilter === 'all' || getAssetTags(asset.metadata).includes(assetTagFilter);
      if (!matchesTag) return false;
      if (!query) return true;
      return [
        asset.name,
        asset.path,
        'assetId' in asset ? asset.assetId : '',
        ...getAssetTags(asset.metadata),
        String(asset.metadata?.altText || ''),
        String(asset.metadata?.caption || ''),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [assetPickerScope, assetSearch, assetTagFilter, assetRecords, globalAssetRecords]);

  const assetTagOptions = useMemo(() => {
    const records = assetPickerScope === 'global' ? globalAssetRecords : assetRecords;
    const tags = Array.from(
      new Set(
        records.flatMap((asset) => getAssetTags(asset.metadata)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return [{ value: 'all', label: 'All tags' }, ...tags.map((tag) => ({ value: tag, label: tag }))];
  }, [assetPickerScope, assetRecords, globalAssetRecords]);

  const handleOpenAssetPicker = (fieldKey: string) => {
    const currentValue = draftEntry?.[fieldKey];
    const currentReference = normalizeAssetReference(currentValue);
    setActiveAssetFieldKey(fieldKey);
    setAssetPickerScope(currentReference?.scope ?? 'project');
    setAssetSearch('');
    setAssetTagFilter('all');
    setAssetPickerOpened(true);
  };

  const handleSelectAsset = (reference: AssetReference | null) => {
    if (!activeAssetFieldKey) return;
    handleFieldChange(activeAssetFieldKey, reference ?? '');
    setAssetPickerOpened(false);
    setActiveAssetFieldKey(null);
    setAssetSearch('');
  };

  return {
    activeAssetField,
    activeAssetFieldKey,
    assetPickerOpened,
    assetPickerScope,
    assetSearch,
    assetTagFilter,
    assetTagOptions,
    filteredAssets,
    selectedAsset,
    selectedAssetReference,
    handleOpenAssetPicker,
    handleSelectAsset,
    setActiveAssetFieldKey,
    setAssetPickerOpened,
    setAssetPickerScope,
    setAssetSearch,
    setAssetTagFilter,
  };
}
