declare module 'lru-cache' {
  class LRUCache<K, V> {
    constructor(options?: {
      max?: number;
      maxAge?: number;
      ttl?: number;
      updateAgeOnGet?: boolean;
    });
    get(key: K): V | undefined;
    set(key: K, value: V, ttl?: number): this;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    keys(): IterableIterator<K>;
    readonly size: number;
  }
  export default LRUCache;
}
