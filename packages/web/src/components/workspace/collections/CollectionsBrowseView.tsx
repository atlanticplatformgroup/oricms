import type { CollectionConfig, ContentType } from '@ori/shared';
import { useEditorContext } from '../../../contexts/workspace/EditorContext';
import { workspaceExtensionRegistry } from '../../../lib/workspace/registry';
import { useWorkspaceShellMode } from '../../../hooks/useWorkspaceShellMode';
import { resolveContentType } from '../../../lib/entries/resolution';
import {
  WorkspaceHeader,
  WorkspaceListSurface,
  WorkspaceMain,
  WorkspacePage,
  WorkspaceTableToolbarInset,
} from '../../ui/WorkspacePrimitives';
import type { CollectionBrowseController } from './types';
import { CollectionBrowseHeaderActions, CollectionBrowseResults, CollectionBrowseToolbar } from './browse-view-support';

interface CollectionsBrowseViewProps {
  selectedCollection: CollectionConfig | null;
  contentTypes: ContentType[];
  browse: CollectionBrowseController;
  canUpdateCollections: boolean;
  canDeleteCollections: boolean;
  onGoToCollectionSettings: () => void;
  onSelectEntry: (entryId: string) => void;
  canCreateEntries: boolean;
}

export function CollectionsBrowseView(props: CollectionsBrowseViewProps) {
  const { selectedCollection, browse } = props;
  const entryEditor = useEditorContext();
  const { isMobileShell, isNarrowShell } = useWorkspaceShellMode();
  const selectedContentType = resolveContentType(selectedCollection, props.contentTypes);
  const headerActions = workspaceExtensionRegistry.getHeaderActions('collections');
  const toolbarControlSlots = workspaceExtensionRegistry.getBrowseToolbar('collections', 'controls');
  const toolbarActionSlots = workspaceExtensionRegistry.getBrowseToolbar('collections', 'actions');

  if (!selectedCollection) return null;

  const mobileSortOptions = [
    ...browse.tableColumns.map((column) => ({ key: column.key, label: column.label })),
    { key: '$status', label: 'Status' },
    { key: '$updatedAt', label: 'Updated' },
  ];
  const mobileEntryCountLabel = `${browse.entriesPagination.total} ${browse.entriesPagination.total === 1 ? 'entry' : 'entries'}`;
  const mobileSortFieldLabel = mobileSortOptions.find((option) => option.key === browse.sortState.key)?.label || 'Updated';

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title={selectedCollection.label}
        description={selectedCollection.path}
        actions={
          <CollectionBrowseHeaderActions
            canCreateEntries={props.canCreateEntries}
            canDeleteCollections={props.canDeleteCollections}
            canUpdateCollections={props.canUpdateCollections}
            createEntryPending={entryEditor.createEntryPending}
            headerActions={headerActions}
            onCreateEntry={() => void entryEditor.handleNewEntry()}
            onGoToCollectionSettings={props.onGoToCollectionSettings}
          />
        }
      />

      <WorkspaceMain>
        <WorkspaceListSurface>
          <WorkspaceTableToolbarInset>
            <CollectionBrowseToolbar
              browse={browse}
              isMobileShell={isMobileShell}
              mobileEntryCountLabel={mobileEntryCountLabel}
              mobileSortFieldLabel={mobileSortFieldLabel}
              toolbarActionSlots={toolbarActionSlots}
              toolbarControlSlots={toolbarControlSlots}
            />
          </WorkspaceTableToolbarInset>
          <CollectionBrowseResults
            browse={browse}
            isMobileShell={isMobileShell}
            isNarrowShell={isNarrowShell}
            onSelectEntry={props.onSelectEntry}
            selectedCollection={selectedCollection}
            selectedContentType={selectedContentType}
          />
        </WorkspaceListSurface>
      </WorkspaceMain>
    </WorkspacePage>
  );
}
