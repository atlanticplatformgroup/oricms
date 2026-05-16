export const PLUGIN_EVENT_NAMES = {
  PAGE_WORKFLOW_TRANSITION: 'page.workflow.transition',
  COLLECTION_RECORD_CREATED: 'collection.record.created',
  COLLECTION_RECORD_UPDATED: 'collection.record.updated',
  COLLECTION_RECORD_DELETED: 'collection.record.deleted',
  COLLECTION_CREATED: 'collection.created',
  COLLECTION_DELETED: 'collection.deleted',
  SCHEMA_SAVED: 'schema.saved',
  SCHEMA_DELETED: 'schema.deleted',
  CONTENT_TYPE_CREATED: 'content-type.created',
  CONTENT_TYPE_UPDATED: 'content-type.updated',
  CONTENT_TYPE_DELETED: 'content-type.deleted',
  ASSET_CREATED: 'asset.created',
  ASSET_UPDATED: 'asset.updated',
  ASSET_DELETED: 'asset.deleted',
} as const;

export type PluginEventName = (typeof PLUGIN_EVENT_NAMES)[keyof typeof PLUGIN_EVENT_NAMES];

export const ALLOWED_PLUGIN_HOOKS = new Set<PluginEventName>(Object.values(PLUGIN_EVENT_NAMES));

export function isPluginEventName(value: string): value is PluginEventName {
  return ALLOWED_PLUGIN_HOOKS.has(value as PluginEventName);
}
