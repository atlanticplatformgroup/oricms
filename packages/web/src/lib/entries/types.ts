import type { FieldType, SchemaField } from '@ori/shared';

export type FieldDiff = {
  key: string;
  kind: 'added' | 'removed' | 'changed';
  before: unknown;
  after: unknown;
};

export type HistoryTimelineItem = {
  hash: string;
  message: string;
  author: string;
  date: string;
};

export type EditorFieldSection = {
  id: string;
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fields: SchemaField[];
};

export type StructuredDragItem = {
  kind: 'component' | 'blocks' | 'array';
  fieldKey: string;
  index: number;
};

export type CollectionTableColumn = {
  key: string;
  label: string;
  fieldType: FieldType | '$id';
  field?: SchemaField;
};

export type CollectionBrowsePreview = {
  primary: string;
  summary: string | null;
  tertiary: string | null;
};

export type CollectionEntriesPagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};
