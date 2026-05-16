import type { CollectionConfig, ComponentSchema, ContentType } from '@ori/shared';
import type { ComponentType, SVGProps } from 'react';

export type SectionKey = 'collections' | 'schemas' | 'media' | 'builds' | 'members' | 'settings';
export type SchemaMode = 'types' | 'components';
export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export type SidebarOption = {
  id: string;
  label: string;
  description?: string;
  groupId?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
};

export type WorkspaceRouteState = {
  projectSlug: string;
  branchName: string | null;
  section: SectionKey;
  secondaryId: string | null;
  entryId: string | null;
  historyView: boolean;
  collectionSettingsView: boolean;
  schemaMode: SchemaMode;
};

export type RelationFieldTarget = {
  fieldKey: string;
  targetCollectionId: string;
  multiple: boolean;
};

export type LoadedSchemaDocument = {
  path: string;
  schema: ContentType | ComponentSchema;
};

export type CollectionLookup = Pick<CollectionConfig, 'id' | 'contentType' | 'path'>;
