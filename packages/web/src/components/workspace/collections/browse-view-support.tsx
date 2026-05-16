import { Button, Group, Menu, Pagination, Stack, Table, Text } from '@mantine/core';
import { ChevronDownIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Fragment, type ReactNode } from 'react';
import type { CollectionConfig, ContentType } from '@ori/shared';
import { TableFieldValue } from '../../fields/TableFieldValue';
import { CollectionStatusBadge } from '../../ui/CollectionStatusBadge';
import { WorkspaceSearchField } from '../../ui/WorkspaceSearchField';
import {
  WORKSPACE_STATUS_COLUMN_WIDTH,
  WORKSPACE_TIMESTAMP_COLUMN_WIDTH,
  WorkspaceEmptyState,
  WorkspaceErrorState,
  WorkspaceLoadingState,
  WorkspaceMetricBadge,
  WorkspaceMobileRecordItem,
  WorkspaceMobileRecordList,
  WorkspaceOperationalTable,
  WorkspaceRecordLink,
  WorkspaceSortableHeader,
  WorkspaceTableContainer,
  WorkspaceTableToolbarInset,
  WorkspaceToolbar,
  WorkspaceToolbarButton,
  WorkspaceHeaderActionIcon,
} from '../../ui/WorkspacePrimitives';
import { resolveCollectionBrowsePreview } from '../../../lib/entries/resolution';
import type { CollectionBrowseController } from './types';

export function CollectionBrowseHeaderActions(props: {
  canCreateEntries: boolean;
  canDeleteCollections: boolean;
  canUpdateCollections: boolean;
  createEntryPending: boolean;
  headerActions: Array<{ id: string; render: (args: { section: 'collections' }) => ReactNode }>;
  onCreateEntry: () => void;
  onGoToCollectionSettings: () => void;
}) {
  return (
    <>
      {props.headerActions.map((registration) => (
        <Fragment key={registration.id}>
          {registration.render({ section: 'collections' })}
        </Fragment>
      ))}
      {(props.canUpdateCollections || props.canDeleteCollections) ? (
        <WorkspaceHeaderActionIcon ariaLabel="Collection settings" onClick={props.onGoToCollectionSettings}>
          <Cog6ToothIcon width={16} height={16} />
        </WorkspaceHeaderActionIcon>
      ) : null}
      <Button
        onClick={props.onCreateEntry}
        disabled={!props.canCreateEntries || props.createEntryPending}
        loading={props.createEntryPending}
      >
        New entry
      </Button>
    </>
  );
}

function formatMobileSortDirectionLabel(
  browse: CollectionBrowseController,
  key: string,
  direction: 'asc' | 'desc',
) {
  const fieldType = browse.tableColumns.find((column) => column.key === key)?.fieldType;
  if (key === '$updatedAt') {
    return direction === 'desc' ? 'Newest first' : 'Oldest first';
  }
  if (key === '$status') {
    return direction === 'asc' ? 'A-Z' : 'Z-A';
  }
  if (fieldType === 'date' || fieldType === 'datetime') {
    return direction === 'desc' ? 'Newest first' : 'Oldest first';
  }
  if (fieldType === 'number') {
    return direction === 'asc' ? 'Low-High' : 'High-Low';
  }
  return direction === 'asc' ? 'A-Z' : 'Z-A';
}

export function CollectionBrowseToolbar(props: {
  browse: CollectionBrowseController;
  isMobileShell: boolean;
  mobileEntryCountLabel: string;
  mobileSortFieldLabel: string;
  toolbarActionSlots: Array<{ id: string; render: (args: { section: 'collections' }) => ReactNode }>;
  toolbarControlSlots: Array<{ id: string; render: (args: { section: 'collections' }) => ReactNode }>;
}) {
  const mobileSortOptions = [
    ...props.browse.tableColumns.map((column) => ({ key: column.key, label: column.label })),
    { key: '$status', label: 'Status' },
    { key: '$updatedAt', label: 'Updated' },
  ];

  if (props.isMobileShell) {
    return (
      <Stack gap="xs">
        <WorkspaceSearchField
          ariaLabel="Search entries"
          placeholder="Search entries"
          value={props.browse.search}
          onChange={props.browse.setSearch}
          maw={undefined}
        />
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm" style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="wrap" style={{ minWidth: 0 }}>
            <Menu shadow="md" position="bottom-start">
              <Menu.Target>
                <WorkspaceToolbarButton size="sm" aria-label="Sort entries" rightSection={<ChevronDownIcon width={14} height={14} />}>
                  {props.mobileSortFieldLabel}
                </WorkspaceToolbarButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Sort by</Menu.Label>
                {mobileSortOptions.map((option) => (
                  <Menu.Item
                    key={option.key}
                    onClick={() => props.browse.setSort(option.key, option.key === '$updatedAt' ? 'desc' : 'asc')}
                  >
                    {option.label}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Label>Order</Menu.Label>
                <Menu.Item onClick={() => props.browse.setSort(props.browse.sortState.key, props.browse.sortState.key === '$updatedAt' ? 'desc' : 'asc')}>
                  {formatMobileSortDirectionLabel(props.browse, props.browse.sortState.key, props.browse.sortState.key === '$updatedAt' ? 'desc' : 'asc')}
                </Menu.Item>
                <Menu.Item onClick={() => props.browse.setSort(props.browse.sortState.key, props.browse.sortState.key === '$updatedAt' ? 'asc' : 'desc')}>
                  {formatMobileSortDirectionLabel(props.browse, props.browse.sortState.key, props.browse.sortState.key === '$updatedAt' ? 'asc' : 'desc')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            {props.toolbarControlSlots.map((registration) => (
              <Fragment key={registration.id}>
                {registration.render({ section: 'collections' })}
              </Fragment>
            ))}
            {props.toolbarActionSlots.map((registration) => (
              <Fragment key={registration.id}>
                {registration.render({ section: 'collections' })}
              </Fragment>
            ))}
          </Group>
          <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
            {props.mobileEntryCountLabel}
          </Text>
        </Group>
      </Stack>
    );
  }

  return (
    <WorkspaceToolbar
      controls={(
        <>
          <WorkspaceSearchField
            ariaLabel="Search entries"
            placeholder="Search entries"
            value={props.browse.search}
            onChange={props.browse.setSearch}
            maw={320}
          />
          {props.toolbarControlSlots.map((registration) => (
            <Fragment key={registration.id}>
              {registration.render({ section: 'collections' })}
            </Fragment>
          ))}
        </>
      )}
      actions={(
        <>
          {props.toolbarActionSlots.map((registration) => (
            <Fragment key={registration.id}>
              {registration.render({ section: 'collections' })}
            </Fragment>
          ))}
          <WorkspaceMetricBadge>{props.browse.shownMetric}</WorkspaceMetricBadge>
        </>
      )}
    />
  );
}

export function CollectionBrowseResults(props: {
  browse: CollectionBrowseController;
  isMobileShell: boolean;
  isNarrowShell: boolean;
  onSelectEntry: (entryId: string) => void;
  selectedCollection: CollectionConfig;
  selectedContentType: ContentType | null;
}) {
  const visibleTableColumns = props.isNarrowShell
    ? props.browse.tableColumns.slice(0, Math.min(2, props.browse.tableColumns.length))
    : props.browse.tableColumns;
  const descriptiveColumnCount = visibleTableColumns.length;
  const showStatusColumn = !props.isMobileShell;
  const showUpdatedColumn = !props.isMobileShell && !props.isNarrowShell;
  const fixedColumnsWidth = (showStatusColumn ? WORKSPACE_STATUS_COLUMN_WIDTH : 0) + (showUpdatedColumn ? WORKSPACE_TIMESTAMP_COLUMN_WIDTH : 0);
  const descriptiveBaseWidths = visibleTableColumns.map((_, index) => {
    if (descriptiveColumnCount === 1) return 'calc(100% - 300px)';
    if (descriptiveColumnCount === 2) return index === 0 ? 'calc((100% - 300px) * 0.58)' : 'calc((100% - 300px) * 0.42)';
    return index === 0 ? 'calc((100% - 300px) * 0.44)' : 'calc((100% - 300px) * 0.28)';
  });
  const tableMinWidth = Math.max((descriptiveColumnCount * 180) + fixedColumnsWidth, props.isNarrowShell ? 560 : 760);

  const renderSortableHeader = (key: string, label: string) => {
    const isActive = props.browse.sortState.key === key;
    return (
      <WorkspaceSortableHeader
        label={label}
        active={isActive}
        direction={props.browse.sortState.direction}
        onToggle={() => props.browse.toggleSort(key)}
      />
    );
  };

  const renderTableFieldValue = (entry: typeof props.browse.entries[number], column: typeof props.browse.tableColumns[number]) => {
    const rawValue = column.key === '$id' ? entry.$id : entry[column.key];

    return (
      <TableFieldValue
        field={column.field}
        fieldType={column.fieldType}
        value={rawValue}
        context={{
          assetMap: props.browse.tableAssetMap,
          relationLabels: props.browse.tableRelationLabelsByField[column.key],
        }}
      />
    );
  };

  if (props.browse.entriesLoading) {
    return <WorkspaceLoadingState label="Loading entries…" />;
  }
  if (props.browse.entriesError) {
    return <WorkspaceErrorState title="Failed to load entries" message="Check your connection and try again." onRetry={props.browse.retryEntries} />;
  }
  if (props.browse.entries.length === 0) {
    return <WorkspaceEmptyState title={props.browse.emptyState.title} message={props.browse.emptyState.message} />;
  }

  if (props.isMobileShell) {
    return (
      <Stack gap="sm">
        <WorkspaceMobileRecordList>
          {props.browse.entries.map((entry) => {
            const preview = resolveCollectionBrowsePreview({
              contentType: props.selectedContentType,
              entry,
              tableAssetMap: props.browse.tableAssetMap,
              relationLabelsByField: props.browse.tableRelationLabelsByField,
            });

            return (
              <WorkspaceMobileRecordItem
                key={entry.$id}
                testId={`entry-open-${entry.$id}`}
                title={preview.primary}
                summary={preview.summary || undefined}
                tertiary={preview.tertiary || undefined}
                meta={(
                  <Group justify="space-between" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                    <CollectionStatusBadge status={entry.$status} />
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {new Date(entry.$updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </Group>
                )}
                onClick={() => props.onSelectEntry(entry.$id)}
              />
            );
          })}
        </WorkspaceMobileRecordList>

        {props.browse.entriesPagination.pageCount > 1 ? (
          <WorkspaceTableToolbarInset>
            <div>
              <Group justify="space-between" wrap="wrap">
                <Text size="sm" c="dimmed">
                  Page {props.browse.entryPage} of {props.browse.entriesPagination.pageCount}
                </Text>
                <Pagination
                  value={props.browse.entryPage}
                  onChange={props.browse.setEntryPage}
                  total={props.browse.entriesPagination.pageCount}
                />
              </Group>
            </div>
          </WorkspaceTableToolbarInset>
        ) : null}
      </Stack>
    );
  }

  return (
    <WorkspaceTableContainer>
      <Stack gap="sm">
        <div style={{ minWidth: tableMinWidth }}>
          <WorkspaceOperationalTable>
            <colgroup>
              {descriptiveBaseWidths.map((width, index) => (
                <col
                  key={visibleTableColumns[index]?.key || index}
                  style={{
                    width,
                    minWidth: index === 0 ? 240 : 180,
                  }}
                />
              ))}
              {showStatusColumn ? <col style={{ width: WORKSPACE_STATUS_COLUMN_WIDTH, minWidth: WORKSPACE_STATUS_COLUMN_WIDTH }} /> : null}
              {showUpdatedColumn ? <col style={{ width: WORKSPACE_TIMESTAMP_COLUMN_WIDTH, minWidth: WORKSPACE_TIMESTAMP_COLUMN_WIDTH }} /> : null}
            </colgroup>
            <Table.Thead>
              <Table.Tr>
                {visibleTableColumns.map((column) => (
                  <Table.Th key={column.key} aria-sort={props.browse.sortState.key === column.key ? (props.browse.sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortableHeader(column.key, column.label)}
                  </Table.Th>
                ))}
                {showStatusColumn ? (
                  <Table.Th aria-sort={props.browse.sortState.key === '$status' ? (props.browse.sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortableHeader('$status', 'Status')}
                  </Table.Th>
                ) : null}
                {showUpdatedColumn ? (
                  <Table.Th aria-sort={props.browse.sortState.key === '$updatedAt' ? (props.browse.sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortableHeader('$updatedAt', 'Updated')}
                  </Table.Th>
                ) : null}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {props.browse.entries.map((entry) => (
                <Table.Tr key={entry.$id}>
                  {visibleTableColumns.map((column, index) => (
                    <Table.Td key={`${entry.$id}-${column.key}`}>
                      {index === 0 ? (
                        <WorkspaceRecordLink testId={`entry-open-${entry.$id}`} onClick={() => props.onSelectEntry(entry.$id)}>
                          {renderTableFieldValue(entry, column)}
                        </WorkspaceRecordLink>
                      ) : (
                        renderTableFieldValue(entry, column)
                      )}
                    </Table.Td>
                  ))}
                  {showStatusColumn ? (
                    <Table.Td>
                      <CollectionStatusBadge status={entry.$status} />
                    </Table.Td>
                  ) : null}
                  {showUpdatedColumn ? (
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {new Date(entry.$updatedAt).toLocaleString()}
                      </Text>
                    </Table.Td>
                  ) : null}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </WorkspaceOperationalTable>
        </div>

        {props.browse.entriesPagination.pageCount > 1 ? (
          <WorkspaceTableToolbarInset>
            <div>
              <Group justify="space-between" wrap="wrap">
                <Text size="sm" c="dimmed">
                  Page {props.browse.entryPage} of {props.browse.entriesPagination.pageCount}
                </Text>
                <Pagination
                  value={props.browse.entryPage}
                  onChange={props.browse.setEntryPage}
                  total={props.browse.entriesPagination.pageCount}
                />
              </Group>
            </div>
          </WorkspaceTableToolbarInset>
        ) : null}
      </Stack>
    </WorkspaceTableContainer>
  );
}
