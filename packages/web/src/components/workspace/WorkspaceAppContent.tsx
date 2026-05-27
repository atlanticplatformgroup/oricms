import type { ComponentProps, ReactNode } from 'react';
import type { CollectionEntry } from '@ori/shared';
import { CollectionManagerProvider } from '../../contexts/workspace/CollectionManagerContext';
import { EditorProvider, useEditorContext } from '../../contexts/workspace/EditorContext';
import { EntryHistoryProvider } from '../../contexts/workspace/EntryHistoryContext';
import { SchemaEditorProvider } from '../../contexts/workspace/SchemaEditorContext';
import { DEFAULT_SCHEMA_SECONDARY } from '../../lib/workspace/constants';
import { buildWorkspacePath } from '../../lib/workspace/routing';
import { WorkspaceShell, type WorkspaceShellProps } from './WorkspaceShell';

type CollectionManagerProviderProps = Omit<ComponentProps<typeof CollectionManagerProvider>, 'children'>;
type EditorProviderProps = Omit<ComponentProps<typeof EditorProvider>, 'children'>;
type EntryHistoryProviderProps = Omit<ComponentProps<typeof EntryHistoryProvider>, 'children' | 'onRestoreRevision'>;
type SchemaEditorProviderProps = Omit<ComponentProps<typeof SchemaEditorProvider>, 'children' | 'onNavigateToSchema' | 'onNavigateAfterDelete'>;

interface EntryHistoryProviderMountProps {
  activeProjectSlug: string | null;
  currentBranchName: string;
  entryHistoryProps: EntryHistoryProviderProps;
  navigateTo: (to: string, replace?: boolean) => void;
  children: ReactNode;
}

interface WorkspaceAppContentProps {
  activeProjectSlug: string | null;
  currentBranchName: string;
  collectionManagerProps: CollectionManagerProviderProps;
  editorProps: EditorProviderProps;
  entryHistoryProps: EntryHistoryProviderProps;
  schemaEditorProps: SchemaEditorProviderProps;
  navigateTo: (to: string, replace?: boolean) => void;
  workspaceShellProps: WorkspaceShellProps;
}

function EntryHistoryProviderMount(props: EntryHistoryProviderMountProps) {
  const entryEditor = useEditorContext();

  return (
    <EntryHistoryProvider
      {...props.entryHistoryProps}
      onRestoreRevision={async (versionEntry: CollectionEntry, revisionHash: string | null) => {
        await entryEditor.handleRestoreVersion(versionEntry, revisionHash);
        if (props.activeProjectSlug && props.entryHistoryProps.selectedCollection && props.entryHistoryProps.selectedEntry) {
          props.navigateTo(
            buildWorkspacePath(props.activeProjectSlug, 'collections', props.entryHistoryProps.selectedCollection.id, {
              entryId: props.entryHistoryProps.selectedEntry.$id,
              branchName: props.currentBranchName,
            }),
          );
        }
      }}
    >
      {props.children}
    </EntryHistoryProvider>
  );
}

export default function WorkspaceAppContent(props: WorkspaceAppContentProps) {
  const {
    activeProjectSlug,
    currentBranchName,
    collectionManagerProps,
    editorProps,
    entryHistoryProps,
    schemaEditorProps,
    navigateTo,
    workspaceShellProps,
  } = props;

  return (
    <SchemaEditorProvider
      {...schemaEditorProps}
      onNavigateToSchema={(schemaId, mode) => {
        if (!activeProjectSlug) return;
        navigateTo(buildWorkspacePath(activeProjectSlug, 'schemas', schemaId, { schemaMode: mode, branchName: currentBranchName }));
      }}
      onNavigateAfterDelete={(mode) => {
        if (!activeProjectSlug) return;
        navigateTo(
          buildWorkspacePath(activeProjectSlug, 'schemas', DEFAULT_SCHEMA_SECONDARY, { schemaMode: mode, branchName: currentBranchName }),
          true,
        );
      }}
    >
      <CollectionManagerProvider {...collectionManagerProps}>
        <EditorProvider {...editorProps}>
          <EntryHistoryProviderMount
            activeProjectSlug={activeProjectSlug}
            currentBranchName={currentBranchName}
            entryHistoryProps={entryHistoryProps}
            navigateTo={navigateTo}
          >
            <WorkspaceShell {...workspaceShellProps} />
          </EntryHistoryProviderMount>
        </EditorProvider>
      </CollectionManagerProvider>
    </SchemaEditorProvider>
  );
}
