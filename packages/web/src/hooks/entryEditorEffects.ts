import { useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import type { CollectionEntry } from '@ori/shared';
import type { SchemaField } from '@ori/shared';
import { applyDerivedSchemaFieldValues, deriveSchemaFieldValue } from '../lib/schema-field-computed';
import { getDisplayText } from '../lib/workspace/format';
import type { DerivedIdentifierConfig, IdentifierState } from './entryEditorSupport';
import { buildIdentifierState, cloneEntry } from './entryEditorSupport';

export function useEntrySelectionSync(args: {
  isDirty: boolean;
  lastSyncedEntryIdRef: MutableRefObject<string | null>;
  selectedEntry: CollectionEntry | null;
  selectedEntryRevision: string | null;
  setBaselineEntry: Dispatch<SetStateAction<CollectionEntry | null>>;
  setCommitMessage: Dispatch<SetStateAction<string>>;
  setCurrentRevision: Dispatch<SetStateAction<string | null>>;
  setDraftEntry: Dispatch<SetStateAction<CollectionEntry | null>>;
  setIdentifierStateByField: Dispatch<SetStateAction<IdentifierState>>;
  setShowCommitBar: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    isDirty,
    lastSyncedEntryIdRef,
    selectedEntry,
    selectedEntryRevision,
    setBaselineEntry,
    setCommitMessage,
    setCurrentRevision,
    setDraftEntry,
    setIdentifierStateByField,
    setShowCommitBar,
  } = args;

  useEffect(() => {
    if (!selectedEntry) {
      lastSyncedEntryIdRef.current = null;
      setDraftEntry(null);
      setBaselineEntry(null);
      setShowCommitBar(false);
      setCommitMessage('');
      setIdentifierStateByField({});
      return;
    }

    const previousEntrySignature = lastSyncedEntryIdRef.current;
    const previousEntryId = previousEntrySignature?.split('|')[0] ?? null;
    const nextEntrySignature = `${selectedEntry.$id}|${selectedEntryRevision ?? selectedEntry.$updatedAt ?? ''}`;
    const switchedEntries = previousEntrySignature !== nextEntrySignature;
    const sameEntry = previousEntryId === selectedEntry.$id;
    lastSyncedEntryIdRef.current = nextEntrySignature;

    if (!switchedEntries) {
      return;
    }

    if (sameEntry && isDirty) {
      return;
    }

    const clone = cloneEntry(selectedEntry);
    setDraftEntry(clone);
    setBaselineEntry(cloneEntry(clone));
    setCurrentRevision(selectedEntryRevision);
    setShowCommitBar(false);
    setCommitMessage('');
  }, [
    isDirty,
    lastSyncedEntryIdRef,
    selectedEntry,
    selectedEntryRevision,
    setBaselineEntry,
    setCommitMessage,
    setCurrentRevision,
    setDraftEntry,
    setIdentifierStateByField,
    setShowCommitBar,
  ]);
}

export function useIdentifierStateSync(args: {
  derivedIdentifierConfig: DerivedIdentifierConfig[];
  isDirty: boolean;
  lastSyncedIdentifierEntryIdRef: MutableRefObject<string | null>;
  selectedEntry: CollectionEntry | null;
  setIdentifierStateByField: Dispatch<SetStateAction<IdentifierState>>;
}) {
  const {
    derivedIdentifierConfig,
    isDirty,
    lastSyncedIdentifierEntryIdRef,
    selectedEntry,
    setIdentifierStateByField,
  } = args;

  useEffect(() => {
    if (!selectedEntry) {
      lastSyncedIdentifierEntryIdRef.current = null;
      setIdentifierStateByField({});
      return;
    }

    const nextEntryId = selectedEntry.$id;
    const switchedEntries = lastSyncedIdentifierEntryIdRef.current !== nextEntryId;
    lastSyncedIdentifierEntryIdRef.current = nextEntryId;

    if (!switchedEntries && isDirty) {
      return;
    }

    setIdentifierStateByField(buildIdentifierState(selectedEntry, derivedIdentifierConfig));
  }, [
    derivedIdentifierConfig,
    isDirty,
    lastSyncedIdentifierEntryIdRef,
    selectedEntry,
    setIdentifierStateByField,
  ]);
}

export function useDirtyEntryUnloadPrompt(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
}

export function useEntrySaveShortcut(args: {
  canUpdateEntries: boolean;
  handleSaveEntry: () => void;
  selectedEntryId: string | undefined;
  showCommitBar: boolean;
}) {
  const { canUpdateEntries, handleSaveEntry, selectedEntryId, showCommitBar } = args;

  useEffect(() => {
    if (!selectedEntryId || !canUpdateEntries) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;
      event.preventDefault();
      if (!showCommitBar) {
        handleSaveEntry();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUpdateEntries, handleSaveEntry, selectedEntryId, showCommitBar]);
}

export function createEntryFieldChangeHandler(args: {
  derivedIdentifierConfig: DerivedIdentifierConfig[];
  editorFields: SchemaField[];
  identifierStateByField: IdentifierState;
  setDraftEntry: Dispatch<SetStateAction<CollectionEntry | null>>;
  setIdentifierStateByField: Dispatch<SetStateAction<IdentifierState>>;
}) {
  return (fieldKey: string, value: unknown) => {
    const nextIdentifierState = { ...args.identifierStateByField };
    const changedIdentifier = args.derivedIdentifierConfig.find((config) => config.fieldKey === fieldKey);
    if (changedIdentifier) {
      const trimmedValue = getDisplayText(value).trim();
      nextIdentifierState[fieldKey] = {
        auto: trimmedValue === '',
        sourceLabel: changedIdentifier.sourceLabel,
      };
      args.setIdentifierStateByField(nextIdentifierState);
    }

    args.setDraftEntry((previous) => {
      if (!previous) return previous;
      const next: CollectionEntry = { ...previous, [fieldKey]: value };
      if (fieldKey === '$status') {
        const nextStatus = String(value) as CollectionEntry['$status'];
        next.$status = nextStatus;
        if (nextStatus === 'draft') {
          delete next.$publishedAt;
        } else if (!next.$publishedAt) {
          next.$publishedAt = new Date().toISOString();
        }
      }
      const derivedNext = applyDerivedSchemaFieldValues(args.editorFields, next, { changedKey: fieldKey, isCreate: false }) as CollectionEntry;
      args.derivedIdentifierConfig
        .filter((config) => config.sourceKey === fieldKey && nextIdentifierState[config.fieldKey]?.auto)
        .forEach((config) => {
          derivedNext[config.fieldKey] = deriveSchemaFieldValue(value, config.strategy);
        });
      if (changedIdentifier && nextIdentifierState[fieldKey]?.auto) {
        derivedNext[fieldKey] = deriveSchemaFieldValue(next[changedIdentifier.sourceKey], changedIdentifier.strategy);
      }
      return derivedNext;
    });
  };
}

export function buildIdentifierResetHandler(args: {
  derivedIdentifierConfig: DerivedIdentifierConfig[];
  draftEntry: CollectionEntry | null;
  setDraftEntry: Dispatch<SetStateAction<CollectionEntry | null>>;
  setIdentifierStateByField: Dispatch<SetStateAction<IdentifierState>>;
}) {
  return (fieldKey: string) => {
    const config = args.derivedIdentifierConfig.find((item) => item.fieldKey === fieldKey);
    if (!config || !args.draftEntry) return;
    const derivedValue = deriveSchemaFieldValue(args.draftEntry[config.sourceKey], config.strategy);
    args.setIdentifierStateByField((previous) => ({
      ...previous,
      [fieldKey]: { auto: true, sourceLabel: config.sourceLabel },
    }));
    args.setDraftEntry((previous) => (previous ? { ...previous, [fieldKey]: derivedValue } : previous));
  };
}
