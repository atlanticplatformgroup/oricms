export class LifecycleHookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleHookError';
  }
}

export interface LifecycleEventMap {
  'entry.beforeCreate': { projectId: string; collectionId: string; actor?: { id?: string; name?: string; email?: string }; data: Record<string, unknown> };
  'entry.afterCreate': { projectId: string; collectionId: string; actor?: { id?: string; name?: string; email?: string }; entryId: string; entry: Record<string, unknown> };
  'entry.beforeUpdate': { projectId: string; collectionId: string; entryId: string; actor?: { id?: string; name?: string; email?: string }; data: Record<string, unknown> };
  'entry.afterUpdate': { projectId: string; collectionId: string; entryId: string; actor?: { id?: string; name?: string; email?: string }; entry: Record<string, unknown> };
  'entry.beforeDelete': { projectId: string; collectionId: string; entryId: string; actor?: { id?: string; name?: string; email?: string } };
  'entry.afterDelete': { projectId: string; collectionId: string; entryId: string; actor?: { id?: string; name?: string; email?: string } };
  'schema.beforeSave': { projectId: string; path: string; actor?: { id?: string; name?: string; email?: string }; content: string };
  'schema.afterSave': { projectId: string; path: string; actor?: { id?: string; name?: string; email?: string }; content: string };
  'schema.beforeDelete': { projectId: string; path: string; actor?: { id?: string; name?: string; email?: string } };
  'schema.afterDelete': { projectId: string; path: string; actor?: { id?: string; name?: string; email?: string } };
  'collection.beforeCreate': { projectId: string; collectionId: string; actor?: { id?: string; name?: string; email?: string }; collection: Record<string, unknown> };
  'collection.afterCreate': { projectId: string; collectionId: string; actor?: { id?: string; name?: string; email?: string }; collection: Record<string, unknown> };
  'collection.beforeDelete': { projectId: string; collectionId: string; actor?: { id?: string; name?: string; email?: string } };
  'collection.afterDelete': { projectId: string; collectionId: string; actor?: { id?: string; name?: string; email?: string } };
  'contentType.beforeCreate': { projectId: string; typeId: string; actor?: { id?: string; name?: string; email?: string }; contentType: Record<string, unknown>; path: string };
  'contentType.afterCreate': { projectId: string; typeId: string; actor?: { id?: string; name?: string; email?: string }; contentType: Record<string, unknown>; path: string };
  'contentType.beforeUpdate': { projectId: string; typeId: string; actor?: { id?: string; name?: string; email?: string }; contentType: Record<string, unknown>; path: string };
  'contentType.afterUpdate': { projectId: string; typeId: string; actor?: { id?: string; name?: string; email?: string }; contentType: Record<string, unknown>; path: string };
  'contentType.beforeDelete': { projectId: string; typeId: string; actor?: { id?: string; name?: string; email?: string }; path: string; deleteRecords: boolean };
  'contentType.afterDelete': { projectId: string; typeId: string; actor?: { id?: string; name?: string; email?: string }; path: string; deleteRecords: boolean };
  'asset.beforeCreate': { projectId: string; assetPath: string; actor?: { id?: string; name?: string; email?: string }; folder: string; filename: string };
  'asset.afterCreate': { projectId: string; assetPath: string; actor?: { id?: string; name?: string; email?: string }; asset: Record<string, unknown> };
  'asset.beforeUpdate': { projectId: string; assetPath: string; actor?: { id?: string; name?: string; email?: string }; metadata: Record<string, unknown> };
  'asset.afterUpdate': { projectId: string; assetPath: string; actor?: { id?: string; name?: string; email?: string }; metadata: Record<string, unknown> };
  'asset.beforeDelete': { projectId: string; assetPath: string; actor?: { id?: string; name?: string; email?: string } };
  'asset.afterDelete': { projectId: string; assetPath: string; actor?: { id?: string; name?: string; email?: string } };
}

type LifecycleEvent = keyof LifecycleEventMap;
type Listener<E extends LifecycleEvent> = (payload: LifecycleEventMap[E]) => void | Promise<void>;

const listeners = new Map<LifecycleEvent, Array<{ id: string; handler: Listener<any> }>>();

export function registerLifecycleHook<E extends LifecycleEvent>(event: E, id: string, handler: Listener<E>): void {
  const existing = listeners.get(event) ?? [];
  const next = existing.filter((entry) => entry.id !== id);
  next.push({ id, handler });
  listeners.set(event, next);
}

export function clearLifecycleHooks(): void {
  listeners.clear();
}

export async function dispatchLifecycleEvent<E extends LifecycleEvent>(event: E, payload: LifecycleEventMap[E]): Promise<void> {
  const handlers = listeners.get(event);
  if (!handlers?.length) return;
  for (const handler of handlers) {
    await handler.handler(payload);
  }
}
