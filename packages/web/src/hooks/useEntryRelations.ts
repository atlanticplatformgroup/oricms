import { useEffect, useMemo, useState } from 'react';
import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { collectionsApi } from '../lib/api/collections';
import { toRelationOption, type RelationOption } from '../lib/entries/displayResolver';
import { isMultiRelationField, resolveTargetCollectionId } from '../lib/entries/resolution';
import { getRefId, getRefIds } from '@ori/shared';

interface UseEntryRelationsOptions {
  projectId: string | null;
  visibleEditorFields: SchemaField[];
  collections: CollectionConfig[];
  contentTypes: ContentType[];
  draftEntry: CollectionEntry | null;
}

export function useEntryRelations({ projectId, visibleEditorFields, collections, contentTypes, draftEntry }: UseEntryRelationsOptions) {
  const [relationOptionsByField, setRelationOptionsByField] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const [relationPickerOpened, setRelationPickerOpened] = useState(false);
  const [activeRelationFieldKey, setActiveRelationFieldKey] = useState<string | null>(null);
  const [relationSearch, setRelationSearch] = useState('');
  const [relationPickerResults, setRelationPickerResults] = useState<RelationOption[]>([]);
  const [relationPickerLoading, setRelationPickerLoading] = useState(false);

  const relationTargets = useMemo(() => {
    const nextTargets: Array<{ fieldKey: string; targetCollectionId: string; multiple: boolean }> = [];
    visibleEditorFields.forEach((field) => {
      if (field.type !== 'relation' && field.type !== 'reference') return;
      const targetCollectionId = resolveTargetCollectionId(field, collections);
      if (!targetCollectionId) return;
      nextTargets.push({ fieldKey: field.key, targetCollectionId, multiple: isMultiRelationField(field) });
    });
    return nextTargets;
  }, [visibleEditorFields, collections]);

  const relationTargetMap = useMemo(
    () => new Map(relationTargets.map((target) => [target.fieldKey, target])),
    [relationTargets],
  );

  const activeRelationField = activeRelationFieldKey
    ? visibleEditorFields.find((field) => field.key === activeRelationFieldKey) ?? null
    : null;

  const activeRelationTarget = activeRelationFieldKey ? relationTargetMap.get(activeRelationFieldKey) ?? null : null;
  const activeRelationCollection = activeRelationTarget
    ? collections.find((collection) => collection.id === activeRelationTarget.targetCollectionId) ?? null
    : null;
  const activeRelationMultiple = Boolean(activeRelationTarget?.multiple);

  const relationLabelMapByField = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(relationOptionsByField).map(([fieldKey, options]) => [
          fieldKey,
          Object.fromEntries(options.map((option) => [option.value, option.label])),
        ]),
      ),
    [relationOptionsByField],
  );

  const activeRelationValue = activeRelationFieldKey && draftEntry ? draftEntry[activeRelationFieldKey] : null;
  const activeSelectedRelationIds = useMemo(
    () => (activeRelationField && isMultiRelationField(activeRelationField) ? getRefIds(activeRelationValue) : getRefId(activeRelationValue) ? [getRefId(activeRelationValue)!] : []),
    [activeRelationField, activeRelationValue],
  );

  const activeSelectedRelationOptions = useMemo(() => {
    if (!activeRelationFieldKey) return [];
    const labelMap = relationLabelMapByField[activeRelationFieldKey] ?? {};
    return activeSelectedRelationIds.map((value) => ({
      value,
      label: labelMap[value] || value,
    }));
  }, [activeRelationFieldKey, activeSelectedRelationIds, relationLabelMapByField]);

  useEffect(() => {
    if (!projectId || !relationTargets.length) {
      setRelationOptionsByField({});
      return;
    }
    let cancelled = false;

    const loadOptions = async () => {
      const next: Record<string, Array<{ value: string; label: string }>> = {};
      await Promise.all(
        relationTargets.map(async (target) => {
          try {
            const response = await collectionsApi.listEntries(projectId, target.targetCollectionId, { page: 1, limit: 25 });
            const targetCollection = collections.find((collection) => collection.id === target.targetCollectionId) ?? null;
            const selectedIds = target.multiple
              ? getRefIds(draftEntry?.[target.fieldKey])
              : getRefId(draftEntry?.[target.fieldKey]) ? [getRefId(draftEntry?.[target.fieldKey])!] : [];
            const seen = new Set<string>();
            const options = (response.data || []).map((entry) => {
              const option = toRelationOption(entry, targetCollection, contentTypes);
              seen.add(option.value);
              return option;
            });
            selectedIds.forEach((selectedId) => {
              if (!seen.has(selectedId)) options.unshift({ value: selectedId, label: selectedId });
            });
            next[target.fieldKey] = options;
          } catch {
            next[target.fieldKey] = [];
          }
        }),
      );
      if (!cancelled) setRelationOptionsByField(next);
    };

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [projectId, relationTargets, collections, contentTypes, draftEntry]);

  useEffect(() => {
    if (!projectId || !relationPickerOpened || !activeRelationFieldKey || !activeRelationTarget) {
      setRelationPickerResults([]);
      setRelationPickerLoading(false);
      return;
    }

    let cancelled = false;

    const loadPickerResults = async () => {
      setRelationPickerLoading(true);
      try {
        const response = await collectionsApi.listEntries(projectId, activeRelationTarget.targetCollectionId, {
          page: 1,
          limit: 25,
          search: relationSearch.trim() || undefined,
        });
        if (cancelled) return;
        const targetCollection = collections.find((collection) => collection.id === activeRelationTarget.targetCollectionId) ?? null;
        const nextOptions = (response.data || []).map((entry) => toRelationOption(entry, targetCollection, contentTypes));
        const merged = [...activeSelectedRelationOptions];
        nextOptions.forEach((option) => {
          if (!merged.some((current) => current.value === option.value)) {
            merged.push(option);
          }
        });
        setRelationPickerResults(merged);
      } catch {
        if (!cancelled) setRelationPickerResults(activeSelectedRelationOptions);
      } finally {
        if (!cancelled) setRelationPickerLoading(false);
      }
    };

    void loadPickerResults();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    relationPickerOpened,
    activeRelationFieldKey,
    activeRelationTarget,
    relationSearch,
    collections,
    contentTypes,
    activeSelectedRelationOptions,
  ]);

  return {
    relationOptionsByField,
    relationLabelMapByField,
    relationPickerOpened,
    setRelationPickerOpened,
    activeRelationField,
    activeRelationFieldKey,
    setActiveRelationFieldKey,
    relationSearch,
    setRelationSearch,
    relationPickerResults,
    relationPickerLoading,
    activeSelectedRelationIds,
    activeSelectedRelationOptions,
    activeRelationCollection,
    activeRelationMultiple,
    openRelationPicker: (fieldKey: string) => {
      setActiveRelationFieldKey(fieldKey);
      setRelationSearch('');
      setRelationPickerOpened(true);
    },
  };
}
