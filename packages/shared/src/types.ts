/**
 * Shared Type Definitions for Ori CMS
 */

// =============================================================================
// User Types
// =============================================================================

export type UserType = 'HUMAN' | 'AGENT';

export interface User {
  id: string;
  email: string;
  name: string;
  type: UserType;
  avatarUrl: string | null;
  githubId: string | null;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  accessToken: string;
  refreshToken: string;
}

/**
 * User Preferences - Synced across devices
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  editorMode: 'split' | 'preview' | 'code';
  notifications: {
    builds: boolean;
    invites: boolean;
    mentions: boolean;
  };
  lastVisitedProjectId: string | null;
  projectDefaults: {
    [projectId: string]: {
      defaultTab: 'schemas' | 'builds' | 'members' | 'settings' | 'collections';
      sidebarCollapsed: boolean;
    };
  };
  onboarding?: {
    version: 2;
    lastStep: 'welcome' | 'project' | 'done';
    completedAt: string | null;
    createdProjectId: string | null;
  };
}

// =============================================================================
// Project Types
// =============================================================================

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Project {
  id: string;
  name: string;
  slug: string;
  repoUrl: string;
  repoProvider: 'github' | 'gitlab' | 'bitbucket';
  defaultBranch: string;
  description: string | null;
  avatarUrl: string | null;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

/**
 * Environment - External deployment target for preview/publishing
 */
export interface Environment {
  id: string;
  name: string;
  url: string;
  type: 'preview' | 'live';
  /** Optional webhook URL to trigger builds/deploys */
  buildWebhook?: string;
  /** Optional URL to trigger ISR/revalidation on content changes */
  revalidationUrl?: string;
  /** Server-managed encrypted revalidation secret (never plaintext at rest) */
  revalidationSecretEncrypted?: string;
  /** Whether to auto-publish on git push to default branch */
  autoPublish?: boolean;
  /** Display order (lower = first) */
  order?: number;
}

export interface ProjectSettings {
  /** Root directory for all content (e.g. "src/content" or "content") */
  contentRoot?: string;
  /** @deprecated Use environments instead */
  previewUrl?: string;
  deploymentWebhook?: string;
  webhookSecret?: string;
  allowedOrigins?: string[];
  features?: {
    scheduling?: boolean;
    staging?: boolean;
    i18n?: boolean;
  };
  /** External environments for preview and publishing */
  environments?: Environment[];
  /** Default environment for preview button */
  defaultEnvironmentId?: string;
  /** Explicit collection configurations */
  collections?: CollectionConfig[];
  /** User-defined navigation groupings for collections */
  uiGroups?: UiGroup[];
  /** SHA-256 hash of delivery API key for public collections endpoint */
  deliveryApiKeyHash?: string;
  /** Non-secret key prefix for UI display (e.g. "del_ab12cd34") */
  deliveryApiKeyPrefix?: string;
  /** Require API key for delivery endpoints (defaults to true when key exists) */
  requireDeliveryApiKey?: boolean;
  graphql?: {
    deliveryPersistedQueries?: {
      enabled?: boolean;
      requirePersistedOnly?: boolean;
      queries?: Array<{
        id: string;
        query: string;
        sha256: string;
        operationName?: string;
        createdAt?: string;
      }>;
    };
    schemaRegistry?: {
      latestVersion?: number;
      latestHash?: string;
      snapshots?: Array<{
        version: number;
        hash: string;
        sdl: string;
        createdAt: string;
      }>;
    };
  };
  plugins?: {
    enabled?: string[];
    hookEndpoints?: Record<string, Record<string, string>>;
    executionPolicy?: {
      mode?: 'disabled' | 'webhook-only';
      enforceManifestCapabilities?: boolean;
      allowlistedHooks?: string[];
      blockedPlugins?: string[];
    };
    secrets?: Record<string, {
      encryptedSecret: string;
      secretPrefix: string;
      rotatedAt: string;
    }>;
    retry?: {
      maxAttempts?: number;
      baseDelayMs?: number;
      timeoutMs?: number;
    };
  };
}

export interface BranchEnvironmentMapping {
  id: string;
  projectId: string;
  branchPattern: string;
  environmentId?: string | null;
  autoDeploy: boolean;
  deployOnMerge: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: User;
  role: ProjectRole;
  userType: UserType;
  joinedAt: string;
  createdAt: string;
}

// =============================================================================
// Workspace / Collection Management Types
// =============================================================================

export type SystemSurfaceId =
  | 'collections'
  | 'schemas'
  | 'media'
  | 'members'
  | 'settings';

export type CollectionKind = 'user' | 'system';
export type CollectionVisibility = 'visible' | 'hidden';
export type StorageAdapterKind = 'git_repo' | 'database' | 'hybrid';
export type ManagedSchemaKind = 'record' | 'component' | 'system';
export type UiNodeKind = 'system-surface' | 'ui-group' | 'collection';

export interface CapabilitySet {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canConfigure?: boolean;
  canManageSchema?: boolean;
  canManagePolicy?: boolean;
  canPublish?: boolean;
}

export interface SystemSurface {
  id: SystemSurfaceId;
  label: string;
  description?: string;
  icon?: string;
  locked: true;
  order: number;
}

export interface UiGroup {
  id: string;
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  order: number;
  visible: boolean;
  locked: boolean;
  capabilities?: CapabilitySet;
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionStorageConfig {
  adapter: StorageAdapterKind;
  path?: string | null;
  branch?: string | null;
}

export interface CollectionRoutingConfig {
  enabled: boolean;
  slugField?: string | null;
  slugPattern?: string | null;
  pattern?: string | null;
  homepageId?: string | null;
  homepageRecordId?: string | null;
}

export interface CollectionDisplayConfig {
  primaryField?: string | null;
  secondaryField?: string | null;
  mediaField?: string | null;
  icon?: string | null;
}

// =============================================================================
// Permission Types
// =============================================================================

export type Resource =
  | 'schemas'
  | 'entries'
  | 'assets'
  | 'settings'
  | 'members'
  | 'agents'
  | 'contentTypes'
  | 'collections';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'publish';

export interface Permission {
  role: ProjectRole;
  resource: Resource;
  action: Action;
  allowed: boolean;
}

export interface PermissionSet {
  canEditSchemas: boolean;
  canManageMembers: boolean;
  canDeleteProject: boolean;
}

// Extended PermissionSet
export interface ExtendedPermissionSet extends PermissionSet {
  // Content
  canEditContentTypes: boolean;
  canCreateEntries: boolean;
  canEditEntries: boolean;
  canDeleteEntries: boolean;
  canPublishEntries: boolean;
  
  // Assets
  canCreateAssets: boolean;
  canReadAssets: boolean;
  canUpdateAssets: boolean;
  canDeleteAssets: boolean;
  
  // Settings
  canUpdateSettings: boolean;

  // Phase 7 - AI Agent
  canManageAgentAccess: boolean;
  canViewAgentAuditLog: boolean;
  canRevokeAgentAccess: boolean;
}

export const ROLE_PERMISSION_MATRIX: Record<ProjectRole, Record<Resource, Partial<Record<Action, boolean>>>> = {
  owner: {
    schemas: { create: true, read: true, update: true, delete: true },
    entries: { create: true, read: true, update: true, delete: true, publish: true },
    assets: { create: true, read: true, update: true, delete: true },
    settings: { read: true, update: true },
    members: { create: true, read: true, update: true, delete: true },
    agents: { create: true, read: true, update: true, delete: true },
    contentTypes: { create: true, read: true, update: true, delete: true },
    collections: { create: true, read: true, update: true, delete: true, publish: true },
  },
  admin: {
    schemas: { create: true, read: true, update: true, delete: true },
    entries: { create: true, read: true, update: true, delete: true, publish: true },
    assets: { create: true, read: true, update: true, delete: true },
    settings: { read: true, update: true },
    members: { create: true, read: true, update: true, delete: true },
    agents: { create: true, read: true, update: true, delete: true },
    contentTypes: { create: true, read: true, update: true, delete: true },
    collections: { create: true, read: true, update: true, delete: true, publish: true },
  },
  editor: {
    schemas: {},
    entries: { create: true, read: true, update: true, delete: false, publish: true },
    assets: { create: true, read: true, update: true, delete: false },
    settings: { read: false, update: false },
    members: {},
    agents: {},
    contentTypes: {},
    collections: { create: true, read: true, update: true, delete: false, publish: true },
  },
  viewer: {
    schemas: {},
    entries: {},
    assets: { read: true },
    settings: { read: false, update: false },
    members: {},
    agents: {},
    contentTypes: {},
    collections: {},
  },
};

export const RESOURCE_ACTION_PERMISSION_MAP: Record<Resource, Partial<Record<Action, keyof ExtendedPermissionSet>>> = {
  schemas: {
    create: 'canEditSchemas',
    read: 'canEditSchemas',
    update: 'canEditSchemas',
    delete: 'canEditSchemas',
  },
  entries: {
    create: 'canCreateEntries',
    read: 'canEditEntries',
    update: 'canEditEntries',
    delete: 'canDeleteEntries',
    publish: 'canPublishEntries',
  },
  assets: {
    create: 'canCreateAssets',
    read: 'canReadAssets',
    update: 'canUpdateAssets',
    delete: 'canDeleteAssets',
  },
  settings: {
    read: 'canManageMembers',
    update: 'canUpdateSettings',
  },
  members: {
    create: 'canManageMembers',
    read: 'canManageMembers',
    update: 'canManageMembers',
    delete: 'canManageMembers',
  },
  agents: {
    create: 'canManageAgentAccess',
    read: 'canViewAgentAuditLog',
    update: 'canManageAgentAccess',
    delete: 'canRevokeAgentAccess',
  },
  contentTypes: {
    create: 'canEditContentTypes',
    read: 'canEditContentTypes',
    update: 'canEditContentTypes',
    delete: 'canEditContentTypes',
  },
  collections: {
    create: 'canCreateEntries',
    read: 'canEditEntries',
    update: 'canEditEntries',
    delete: 'canDeleteEntries',
    publish: 'canPublishEntries',
  },
};

export function getPermissionKey(resource: Resource, action: Action): keyof ExtendedPermissionSet | null {
  return RESOURCE_ACTION_PERMISSION_MAP[resource]?.[action] ?? null;
}

function hasRolePermission(role: ProjectRole, resource: Resource, action: Action): boolean {
  return ROLE_PERMISSION_MATRIX[role]?.[resource]?.[action] ?? false;
}

function buildLegacyPermissionSet(role: ProjectRole): ExtendedPermissionSet {
  return {
    canEditSchemas: hasRolePermission(role, 'schemas', 'read'),
    canManageMembers: hasRolePermission(role, 'members', 'read'),
    canDeleteProject: role === 'owner',
    canEditContentTypes: hasRolePermission(role, 'contentTypes', 'read'),
    canCreateEntries: hasRolePermission(role, 'entries', 'create'),
    canEditEntries: hasRolePermission(role, 'entries', 'read'),
    canDeleteEntries: hasRolePermission(role, 'entries', 'delete'),
    canPublishEntries: hasRolePermission(role, 'entries', 'publish'),
    canCreateAssets: hasRolePermission(role, 'assets', 'create'),
    canReadAssets: hasRolePermission(role, 'assets', 'read'),
    canUpdateAssets: hasRolePermission(role, 'assets', 'update'),
    canDeleteAssets: hasRolePermission(role, 'assets', 'delete'),
    canUpdateSettings: hasRolePermission(role, 'settings', 'update'),
    canManageAgentAccess: hasRolePermission(role, 'agents', 'create') || hasRolePermission(role, 'agents', 'update'),
    canViewAgentAuditLog: hasRolePermission(role, 'agents', 'read'),
    canRevokeAgentAccess: hasRolePermission(role, 'agents', 'delete'),
  };
}

export function getRolePermissions(role: ProjectRole): ExtendedPermissionSet {
  return buildLegacyPermissionSet(role);
}

// Default permissions by role (Legacy / Base)
export const DEFAULT_PERMISSIONS: Record<ProjectRole, Partial<PermissionSet>> = {
  owner: {
    canEditSchemas: true,
    canManageMembers: true,
    canDeleteProject: true,
  },
  admin: {
    canEditSchemas: true,
    canManageMembers: true,
    canDeleteProject: false,
  },
  editor: {
    canEditSchemas: false,
    canManageMembers: false,
    canDeleteProject: false,
  },
  viewer: {
    canEditSchemas: false,
    canManageMembers: false,
    canDeleteProject: false,
  },
};

// Extended permissions including Assets and Universal Collections
export const EXTENDED_PERMISSIONS: Record<ProjectRole, Partial<ExtendedPermissionSet>> = {
  owner: buildLegacyPermissionSet('owner'),
  admin: buildLegacyPermissionSet('admin'),
  editor: buildLegacyPermissionSet('editor'),
  viewer: buildLegacyPermissionSet('viewer'),
};

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// =============================================================================
// Git Types (for API proxy)
// =============================================================================

export interface GitBranch {
  name: string;
  isCurrent?: boolean;
  isDefault: boolean;
  isProtected: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
}

export interface GitFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}

// =============================================================================
// Schema Types
// =============================================================================

export type FieldType =
  | 'string'
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'date'
  | 'media'
  | 'image'
  | 'relation'
  | 'reference'
  | 'json'
  | 'array'
  | 'object'
  | 'enum'
  | 'select'
  | 'uid'
  | 'email'
  | 'url'
  | 'password'
  | 'color'
  | 'blocks'
  | 'component';

export type RelationType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';

export interface ContentTypeEditorSection {
  id: string;
  label: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface SchemaFieldEditorPresentation {
  section?: string;
  width?: 'full' | 'half';
}

export interface SchemaField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  description?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enumValues?: { value: string; label: string }[];
  multiple?: boolean;
  allowedTypes?: string[];
  relation?: {
    target: string;
    type: RelationType;
    inverse?: string;
  };
  uidSource?: string;
  component?: string;
  repeatable?: boolean;
  agentVisible?: boolean;
  fields?: SchemaField[];
  /**
   * Additional field configuration used by schema editors and runtime form rendering.
   */
  options?: {
    choices?: { value: string; label: string }[];
    min?: number;
    max?: number;
    multiple?: boolean;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    rows?: number;
    placeholder?: string;
    helpText?: string;
    defaultValue?: string | number | boolean;
    pattern?: string;
    accept?: string[];
    referenceCollection?: string;
    referenceKind?: 'single' | 'collection';
    relationType?: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
    hierarchyRole?: 'parent';
    visibleWhen?: {
      field: string;
      operator: 'equals' | 'notEquals' | 'in' | 'notIn' | 'truthy' | 'falsy';
      value?: string | number | boolean | string[];
    };
    derivedFrom?: string;
    deriveStrategy?: 'slug' | 'lowercase' | 'uppercase' | 'trim';
    deriveWhen?: 'create' | 'always';
    allowCustomValue?: boolean;
    capabilityPreset?: string;
    allowedComponents?: string[]; // IDs of allowed ComponentSchemas for 'blocks' type
    editor?: SchemaFieldEditorPresentation;
  };
}

export interface ComponentSchema {
  $schema: 'component-v1';
  $id: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  fields: SchemaField[];
}

// =============================================================================
// Asset Types
// =============================================================================

export interface AssetMetadata {
  altText?: string;
  caption?: string;
  tags?: string[];
  folder?: string; // @deprecated Legacy single-tag field. Use tags instead.
  [key: string]: unknown;
}

export type AssetUsageStatus = 'used' | 'unused';

export interface AssetUsageSummary {
  count: number;
  status: AssetUsageStatus;
}

export interface AssetUsageReference {
  collectionId: string;
  collectionLabel: string;
  entryId: string;
  entryLabel: string;
  entryPath: string;
}

export interface AssetUsageDetail {
  references: AssetUsageReference[];
}

export type AssetReferenceScope = 'project' | 'global';

export interface AssetReferenceBase {
  $ref: 'asset';
  scope: AssetReferenceScope;
  alt?: string;
  caption?: string;
}

export interface ProjectAssetReference extends AssetReferenceBase {
  scope: 'project';
  path: string;
}

export interface GlobalAssetReference extends AssetReferenceBase {
  scope: 'global';
  assetId: string;
}

export type AssetReference = ProjectAssetReference | GlobalAssetReference;

export interface Asset {
  path: string;
  name: string;
  folder: string; // Physical parent directory
  size: number;
  type: 'image' | 'document' | 'file';
  url: string;
  lastModified: string;
  metadata?: AssetMetadata;
  usage?: AssetUsageSummary;
  usageDetail?: AssetUsageDetail;
}

export interface GlobalAsset extends Asset {
  assetId: string;
  scope: 'global';
}

// =============================================================================
// Content Type & Collection Types
// =============================================================================

/**
 * @deprecated Use SchemaField instead.
 */
export type ContentTypeField = SchemaField;

export interface ContentType {
  $schema: 'content-type-v1';
  $id: string;
  name: string;
  plural: string;
  label: string;
  labelPlural: string;
  description?: string;
  fields: SchemaField[];
  listFields?: string[];
  searchFields?: string[];
  /** Configuration for how entries are displayed in lists */
  display?: {
    /** Primary text field (e.g. 'title' or 'name') */
    primary?: string;
    /** Secondary text field (e.g. 'slug' or 'subtitle') */
    secondary?: string;
    /** Media field for thumbnails (e.g. 'image' or 'featuredImage') */
    media?: string;
  };
  editor?: {
    sections?: ContentTypeEditorSection[];
  };
  resource?: ResourceCollectionLink;
}

export interface CollectionConfig {
  id: string;
  slug?: string;
  label: string;
  singularLabel?: string;
  contentType: string;
  schemaId?: string | null;
  path: string;
  icon?: string;
  description?: string;
  kind?: CollectionKind;
  visibility?: CollectionVisibility;
  locked?: boolean;
  uiGroupId?: string | null;
  storage?: CollectionStorageConfig;
  display?: CollectionDisplayConfig;
  capabilities?: CapabilitySet;
  createdAt?: string;
  updatedAt?: string;
  pinnedEntryIds?: string[];
  routing?: {
    enabled?: boolean;
    slugPattern?: string;
    homepageId?: string;
  } | CollectionRoutingConfig;
  resource?: ResourceCollectionLink;
}

export type ResourceDomain =
  | 'content'
  | 'schemas'
  | 'assets'
  | 'members'
  | 'builds'
  | 'settings';

export type ResourceCollectionType = 'user' | 'system' | 'operational';

export type ResourceRecordStatus =
  | 'draft'
  | 'published'
  | 'active'
  | 'inactive'
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface ResourceCapabilities {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish?: boolean;
  canManageSchema?: boolean;
  canManagePolicy?: boolean;
}

export interface ResourcePolicyDefinition {
  privileged: boolean;
  schemaEditable: boolean;
  policyEditable: boolean;
  recordEditingMode: 'standard' | 'restricted' | 'system-managed';
}

export interface ResourceViewDefinition {
  id: string;
  kind: 'table' | 'detail' | 'form' | 'system';
  editor: 'content' | 'schemas' | 'assets' | 'members' | 'builds' | 'settings' | 'generic';
}

export interface ResourceCollectionLink {
  id: string;
  domain: ResourceDomain;
  collectionType: ResourceCollectionType;
  isSystem: boolean;
}

export interface ResourceCollectionSummary extends ResourceCollectionLink {
  label: string;
  description?: string;
  schemaId?: string;
  viewId?: string;
  recordCount?: number;
  capabilities: ResourceCapabilities;
  policySummary: ResourcePolicyDefinition;
}

export interface ResourceCollectionDetail extends ResourceCollectionSummary {
  source: 'git' | 'database' | 'hybrid';
  path?: string;
  view?: ResourceViewDefinition;
}

export interface ResourceSchemaDefinition {
  id: string;
  label: string;
  kind:
    | 'content-type'
    | 'component'
    | 'settings'
    | 'member'
    | 'build'
    | 'asset'
    | 'generic';
  document: Record<string, unknown>;
}

export interface ResourceRecordSummary {
  id: string;
  label: string;
  status?: ResourceRecordStatus | string;
  description?: string;
  updatedAt?: string;
  createdAt?: string;
  path?: string;
}

export interface ResourceRecordDetail extends ResourceRecordSummary {
  data: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface ListSystemSurfacesResponse {
  systemSurfaces: SystemSurface[];
}

export interface ListUiGroupsResponse {
  uiGroups: UiGroupSummary[];
}

export interface GetUiGroupResponse {
  uiGroup: UiGroupSummary;
}

export interface ListCollectionsResponse {
  collections: CollectionSummary[];
}

export interface GetCollectionResponse {
  collection: CollectionConfig;
}

export interface CreateCollectionRequest {
  slug: string;
  label: string;
  singularLabel?: string | null;
  description?: string | null;
  schemaId?: string | null;
  uiGroupId?: string | null;
  visibility?: CollectionVisibility;
  storage: CollectionStorageConfig;
  routing?: CollectionRoutingConfig;
  display?: CollectionDisplayConfig;
}

export interface UpdateCollectionRequest {
  label?: string;
  singularLabel?: string | null;
  description?: string | null;
  schemaId?: string | null;
  uiGroupId?: string | null;
  visibility?: CollectionVisibility;
  storage?: Partial<CollectionStorageConfig>;
  routing?: CollectionRoutingConfig;
  display?: CollectionDisplayConfig;
}

export interface DeleteCollectionResponse {
  deleted: true;
  collectionId: string;
}

export interface ListSchemasResponse {
  schemas: SchemaDefinition[];
}

export interface GetSchemaResponse {
  schema: SchemaDefinition;
}

export interface CreateSchemaRequest {
  slug: string;
  label: string;
  description?: string | null;
  kind: ManagedSchemaKind;
  fields: SchemaField[];
}

export interface UpdateSchemaRequest {
  label?: string;
  description?: string | null;
  fields?: SchemaField[];
}

export interface DeleteSchemaResponse {
  deleted: true;
  schemaId: string;
}

export interface CreateUiGroupRequest {
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  order?: number;
  visible?: boolean;
}

export interface UpdateUiGroupRequest {
  label?: string;
  description?: string;
  icon?: string;
  order?: number;
  visible?: boolean;
}

export interface DeleteUiGroupResponse {
  deleted: true;
  uiGroupId: string;
}

export interface ListRecordsResponse<TData extends Record<string, unknown> = Record<string, unknown>> {
  records: Array<RecordEnvelope<TData>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
}

export interface GetRecordResponse<TData extends Record<string, unknown> = Record<string, unknown>> {
  record: RecordEnvelope<TData>;
}

export interface CreateRecordRequest<TData extends Record<string, unknown> = Record<string, unknown>> {
  data: TData;
  status?: string;
}

export interface UpdateRecordRequest<TData extends Record<string, unknown> = Record<string, unknown>> {
  data?: Partial<TData>;
  status?: string;
  baseRevision?: string;
}

export interface DeleteRecordRequest {
  baseRevision?: string;
}

export interface DeleteRecordResponse {
  deleted: true;
  recordId: string;
}

export interface GetWorkspaceCatalogResponse {
  catalog: WorkspaceCatalog;
}

export interface CollectionEntry {
  $id: string;
  $type: string;
  $status: 'draft' | 'published';
  $createdAt: string;
  $updatedAt: string;
  $publishedAt?: string;
  [key: string]: unknown;
}

export interface CollectionQuery {
  filter?: Record<string, unknown>;
  sort?: Record<string, 'asc' | 'desc'>;
  page?: number;
  limit?: number;
  populate?: string | string[];
  search?: string;
}

export interface CollectionQueryResult<T = CollectionEntry> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface EntryRevisionMeta {
  revision: string;
}

export interface CollectionEntryResponse<T = CollectionEntry> {
  entry: T;
  meta: EntryRevisionMeta;
}

export interface SchemaDefinition {
  id: string;
  slug: string;
  label: string;
  description?: string | null;
  kind: ManagedSchemaKind;
  locked: boolean;
  fields: SchemaField[];
  capabilities: CapabilitySet;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecordEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  collectionId: string;
  schemaId: string | null;
  label: string;
  status?: string;
  data: TData;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  revision?: string;
  capabilities: CapabilitySet;
}

export interface CollectionSummary {
  collection: CollectionConfig;
  recordCount: number;
}

export interface UiGroupSummary {
  group: UiGroup;
  collectionIds: string[];
}

export interface WorkspaceNavigationModel {
  systemSurfaces: SystemSurface[];
  uiGroups: UiGroupSummary[];
  ungroupedCollectionIds: string[];
}

export interface WorkspaceCatalog {
  navigation: WorkspaceNavigationModel;
  collections: CollectionSummary[];
  schemas: SchemaDefinition[];
}

export type LockMode = 'hard' | 'soft';

export type LockHolderType = 'human' | 'agent';

export type LockResourceType =
  | 'entry'
  | 'assetMetadata'
  | 'schema'
  | 'contentType'
  | 'collectionConfig'
  | 'branchPromotion'
  | 'projectSettings'
  | 'members'
  | 'agentConfig'
  | 'bulkMutation';

export interface ResourceLock {
  id: string;
  projectId: string;
  branch?: string | null;
  resourceType: LockResourceType;
  resourceId: string;
  mode: LockMode;
  holderType: LockHolderType;
  holderId: string;
  holderName: string;
  sessionId: string;
  reason: 'editing' | 'deleting' | 'promoting' | 'configuring' | 'bulk-mutation';
  acquiredAt: string;
  expiresAt: string;
}

export interface LockAcquireRequest {
  resourceType: LockResourceType;
  resourceId: string;
  branch?: string;
  mode: LockMode;
  reason: ResourceLock['reason'];
}

export interface LockAcquireResponse {
  lock: ResourceLock;
  lockToken?: string;
}

export interface LockStatusResponse {
  locks: ResourceLock[];
}

export interface LockConflictInfo {
  required: boolean;
  mode: LockMode;
  heldByOther: boolean;
  holderType?: LockHolderType;
  holderName?: string;
  expiresAt?: string;
  retryAfterSeconds?: number;
}

export type EntryBranchTransferMode = 'entire_entry' | 'selected_paths';

export type EntryBranchTransferDiffKind = 'added' | 'removed' | 'changed';

export interface EntryBranchTransferFieldMeta {
  key: string;
  label: string;
  type: string;
}

export interface EntryBranchTransferDiffNode {
  pointer: string;
  label: string;
  kind: EntryBranchTransferDiffKind;
  field?: EntryBranchTransferFieldMeta;
  children?: EntryBranchTransferDiffNode[];
}

export interface EntryBranchTransferConflict {
  pointer: string;
  label: string;
}

export interface EntryBranchTransferResolution {
  pointer: string;
  strategy: 'source' | 'target';
}

export interface EntryBranchTransferPreview {
  sourceBranch: string;
  targetBranch: string;
  entryId: string;
  collectionId: string;
  sourceExists: boolean;
  targetExists: boolean;
  modeAvailability: {
    entire_entry: boolean;
    selected_paths: boolean;
  };
  diffTree: EntryBranchTransferDiffNode[];
  conflicts: EntryBranchTransferConflict[];
  schemaCompatibility: {
    matches: boolean;
    message: string | null;
  };
  defaultCommitMessage: string;
}

export interface EntryBranchTransferApplyRequest {
  sourceBranch: string;
  targetBranch: string;
  mode: EntryBranchTransferMode;
  selectedPointers?: string[];
  resolutions?: EntryBranchTransferResolution[];
  message: string;
}

// =============================================================================
// Phase 7: AI Agent Support Types
// =============================================================================

export interface AgentAccessConfig {
  projectId: string;
  enabled: boolean;
  allowedBranches: string[];
  allowedCollections: string[]; // empty = none allowed
  historyDepth: number; // max commits (default: 30)
  historyDays: number; // max age in days (default: 14)
  deploymentMode: 'cloud' | 'on-premise';
  cloudProvider?: 'openai' | 'anthropic' | 'custom';
  onPremiseConfig?: {
    endpoint: string;
    model: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AgentAuditEntry {
  id: string;
  timestamp: string;
  agentSessionId: string;
  projectId: string;
  filePath: string;
  branch: string;
  projectRole: ProjectRole | null;
  contentRead: boolean;
  wasRedacted: boolean;
  piiPatternsFound: string[];
  queryType?: string;
  diagnosisId?: string;
}

export interface AgentWritePolicy {
  collectionName: string;
  mode: 'HUMAN_REVIEW' | 'AUTO_PUBLISH' | 'BRANCH_BASED';
  targetBranch: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export type AgentMutationAction = 'create' | 'update' | 'delete' | 'transition' | 'createSchema' | 'updateSchema';

export type AgentEntryStatus = 'draft' | 'published';

export interface AgentConfigFreshness {
  generatedAt: string;
  configVersion: string;
  configUpdatedAt?: string;
}

export interface AgentMutationChangeRequestSummary {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED' | 'AUTO_PUBLISHED';
  message?: string;
}

export interface AgentMutationPersistenceSummary {
  persisted: boolean;
  commitSha?: string | null;
  revision?: string | null;
}

export interface AgentDeletedEntrySummary {
  entryId: string;
  previousStatus?: AgentEntryStatus | null;
  previousEntry?: CollectionEntry | null;
}

export interface AgentMutationResult extends AgentConfigFreshness {
  action: AgentMutationAction;
  collectionName?: string;
  schemaName?: string;
  entryId?: string;
  branch: string;
  resultingStatus?: AgentEntryStatus | null;
  changeRequest: AgentMutationChangeRequestSummary;
  persistence: AgentMutationPersistenceSummary;
  entry?: CollectionEntry | null;
  proposedEntry?: CollectionEntry | null;
  deletedEntry?: AgentDeletedEntrySummary | null;
}

export interface AgentMutationPreflightRequest {
  action: AgentMutationAction;
  collectionName?: string;
  schemaName?: string;
  entryId?: string;
  branch?: string;
  data?: Record<string, unknown>;
  targetStatus?: AgentEntryStatus;
  baseRevision?: string;
}

export interface AgentMutationPreflightResponse extends AgentConfigFreshness {
  allowed: boolean;
  action: AgentMutationAction;
  collectionName?: string;
  schemaName?: string;
  entryId?: string;
  branch?: string;
  resultingStatus?: AgentEntryStatus | null;
  autoPublish: boolean;
  requiresConfirmation: boolean;
  confirmationToken?: string;
  details?: Record<string, string[]>;
  currentRevision?: string;
  lock?: LockConflictInfo;
}

export interface AgentSessionBootstrap {
  project: {
    id: string;
    name: string;
    branch: string;
    role: ProjectRole;
  };
  capabilities: {
    allowedBranches: string[];
    readableCollections: string[];
    writableCollections: string[];
    publishableCollections: string[];
  };
  contentModel: {
    collections: Array<{
      id: string;
      label: string;
      contentType: string;
    }>;
  };
  entryIdentity: {
    canonicalField: '$id';
    slugIsCanonicalId: false;
    useReturnedEntryIdAfterCreate: true;
  };
  workflow: {
    defaultEntryStatus: 'draft';
    readyStatusValue: 'published';
    readyStatusLabel: 'Ready';
    publishRequiresExplicitIntent: boolean;
    destructiveChangesRequireConfirmation: boolean;
  };
  writePolicies: AgentWritePolicy[];
  summaryMarkdown: string;
  generatedAt: string;
  configVersion: string;
  configUpdatedAt?: string;
}

// PII Redaction patterns
export type PiiPattern = 'EMAIL' | 'PHONE' | 'SSN' | 'CREDIT_CARD' | 'IP_ADDRESS' | 'ADDRESS';

export interface PiiRedactionConfig {
  enabled: boolean;
  patterns: Record<PiiPattern, {
    enabled: boolean;
    required: boolean;
  }>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  capabilities?: {
    fieldTypes?: boolean;
    views?: boolean;
    webhooks?: boolean;
    validators?: boolean;
    automations?: boolean;
  };
  hooks?: string[];
  ui?: {
    views?: string[];
    fieldTypes?: string[];
  };
  sourcePath?: string;
}

// =============================================================================
// WebSocket Types
// =============================================================================

export type WsMessageType =
  | 'cursor.move'
  | 'content.update'
  | 'user.join'
  | 'user.leave'
  | 'lock.acquire'
  | 'lock.release';

export interface WsMessage {
  type: WsMessageType;
  projectId: string;
  userId: string;
  payload: unknown;
  timestamp: string;
}
