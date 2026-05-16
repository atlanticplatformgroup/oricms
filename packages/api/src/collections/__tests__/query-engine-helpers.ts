import type { CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import {
  applyCollectionFilters as applyFilters,
  applyCollectionSort as applySort,
  paginateCollectionEntries,
} from '../service-support';

export const createMockRecord = (overrides: Partial<CollectionEntry> = {}): CollectionEntry => ({
  $id: `record-${Date.now()}`,
  $type: 'product',
  $status: 'draft',
  $createdAt: new Date().toISOString(),
  $updatedAt: new Date().toISOString(),
  title: 'Test Product',
  price: 100,
  quantity: 10,
  inStock: true,
  category: 'electronics',
  tags: ['new', 'featured'],
  rating: 4.5,
  ...overrides,
});

export const createMockContentType = (overrides: Partial<ContentType> = {}): ContentType => ({
  $schema: 'content-type-v1',
  $id: 'product',
  name: 'product',
  plural: 'products',
  label: 'Product',
  labelPlural: 'Products',
  fields: [
    { key: 'title', label: 'Title', type: 'string', required: true },
    { key: 'price', label: 'Price', type: 'number' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'inStock', label: 'In Stock', type: 'boolean' },
    { key: 'category', label: 'Category', type: 'string' },
    { key: 'tags', label: 'Tags', type: 'json' },
    { key: 'rating', label: 'Rating', type: 'number' },
  ],
  ...overrides,
});

export { applyFilters, applySort };

export function applySearch(records: CollectionEntry[], search: string, contentType: ContentType): CollectionEntry[] {
  const searchFields = contentType.searchFields || ['title', 'name'];
  const lowerSearch = search.toLowerCase();
  return records.filter((record) =>
    searchFields.some((field: SchemaField['key']) => {
      const value = record[field];
      return typeof value === 'string' ? value.toLowerCase().includes(lowerSearch) : false;
    }),
  );
}

export function applyPagination(records: CollectionEntry[], page = 1, limit = 20) {
  const result = paginateCollectionEntries(records, page, limit);
  return {
    data: result.data,
    meta: {
      page: result.meta.pagination.page,
      pageSize: result.meta.pagination.pageSize,
      pageCount: result.meta.pagination.pageCount,
      total: result.meta.pagination.total,
    },
  };
}
