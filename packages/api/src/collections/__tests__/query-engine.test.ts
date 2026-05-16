import { describe, it, expect, beforeEach } from 'vitest';
import type { CollectionEntry, ContentType } from '@ori/shared';
import { applyFilters, applyPagination, applySearch, applySort, createMockContentType, createMockRecord } from './query-engine-helpers';

describe('applyFilters', () => {
    let records: CollectionEntry[];

    beforeEach(() => {
        records = [
            createMockRecord({ $id: '1', title: 'Laptop', price: 999, quantity: 5, category: 'electronics', rating: 4.5 }),
            createMockRecord({ $id: '2', title: 'Phone', price: 599, quantity: 10, category: 'electronics', rating: 4.0 }),
            createMockRecord({ $id: '3', title: 'Desk', price: 299, quantity: 3, category: 'furniture', rating: 3.5 }),
            createMockRecord({ $id: '4', title: 'Chair', price: 199, quantity: 15, category: 'furniture', rating: 4.2 }),
            createMockRecord({ $id: '5', title: 'Monitor', price: 349, quantity: 8, category: 'electronics', rating: 4.8 }),
        ];
    });

    describe('equality filter', () => {
        it('should filter by exact string match', () => {
            const result = applyFilters(records, { category: 'electronics' });
            expect(result).toHaveLength(3);
            expect(result.every(r => r.category === 'electronics')).toBe(true);
        });

        it('should filter by exact number match', () => {
            const result = applyFilters(records, { price: 999 });
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Laptop');
        });

        it('should filter by boolean match', () => {
            const result = applyFilters(records, { inStock: true });
            expect(result).toHaveLength(5);
        });

        it('should return empty array when no matches', () => {
            const result = applyFilters(records, { category: 'nonexistent' });
            expect(result).toHaveLength(0);
        });
    });

    describe('comparison operators', () => {
        describe('lt (less than)', () => {
            it('should filter prices less than value', () => {
                const result = applyFilters(records, { price_lt: 300 });
                expect(result).toHaveLength(2);
                expect(result.map(r => r.title)).toContain('Desk');
                expect(result.map(r => r.title)).toContain('Chair');
            });

            it('should return empty when all values are greater', () => {
                const result = applyFilters(records, { price_lt: 100 });
                expect(result).toHaveLength(0);
            });
        });

        describe('lte (less than or equal)', () => {
            it('should include exact match', () => {
                const result = applyFilters(records, { price_lte: 299 });
                expect(result).toHaveLength(2);
                expect(result.map(r => r.title)).toContain('Desk');
            });
        });

        describe('gt (greater than)', () => {
            it('should filter prices greater than value', () => {
                const result = applyFilters(records, { price_gt: 500 });
                expect(result).toHaveLength(2);
                expect(result.map(r => r.title)).toContain('Laptop');
                expect(result.map(r => r.title)).toContain('Phone');
            });
        });

        describe('gte (greater than or equal)', () => {
            it('should include exact match', () => {
                const result = applyFilters(records, { price_gte: 599 });
                expect(result).toHaveLength(2);
                expect(result.map(r => r.title)).toContain('Phone');
            });
        });

        describe('ne (not equal)', () => {
            it('should exclude matching value', () => {
                const result = applyFilters(records, { category_ne: 'electronics' });
                expect(result).toHaveLength(2);
                expect(result.every(r => r.category !== 'electronics')).toBe(true);
            });
        });
    });

    describe('array operators', () => {
        describe('in (in array)', () => {
            it('should match values in array', () => {
                const result = applyFilters(records, { category_in: ['electronics', 'furniture'] });
                expect(result).toHaveLength(5);
            });

            it('should match subset of values', () => {
                const result = applyFilters(records, { category_in: ['electronics'] });
                expect(result).toHaveLength(3);
            });
        });

        describe('nin (not in array)', () => {
            it('should exclude values in array', () => {
                const result = applyFilters(records, { category_nin: ['electronics'] });
                expect(result).toHaveLength(2);
                expect(result.every(r => r.category === 'furniture')).toBe(true);
            });
        });
    });

    describe('multiple filters', () => {
        it('should combine filters with AND logic', () => {
            const result = applyFilters(records, {
                category: 'electronics',
                price_lt: 600,
            });
            // Electronics with price < 600: Phone (599), Monitor (349)
            expect(result).toHaveLength(2);
            expect(result.map(r => r.title)).toContain('Phone');
            expect(result.map(r => r.title)).toContain('Monitor');
        });

        it('should handle multiple comparison operators', () => {
            const result = applyFilters(records, {
                price_gt: 200,
                price_lt: 600,
            });
            // Price between 200-600: Phone (599), Desk (299), Monitor (349)
            expect(result).toHaveLength(3);
            expect(result.map(r => r.title)).toContain('Phone');
            expect(result.map(r => r.title)).toContain('Desk');
            expect(result.map(r => r.title)).toContain('Monitor');
        });
    });

    describe('edge cases', () => {
        it('should return all records when filters is empty', () => {
            const result = applyFilters(records, {});
            expect(result).toHaveLength(5);
        });

        it('should return all records when filters is undefined', () => {
            const result = applyFilters(records, undefined);
            expect(result).toHaveLength(5);
        });

        it('should handle undefined record values', () => {
            const recordsWithUndefined = [
                ...records,
                createMockRecord({ $id: '6', price: undefined }),
            ];
            const result = applyFilters(recordsWithUndefined, { price_lt: 1000 });
            // Records with undefined price should fail the comparison
            expect(result.length).toBeLessThan(recordsWithUndefined.length);
        });
    });
});

describe('applySort', () => {
    let records: CollectionEntry[];

    beforeEach(() => {
        records = [
            createMockRecord({ $id: '1', title: 'Charlie', price: 300, rating: 3.0 }),
            createMockRecord({ $id: '2', title: 'Alpha', price: 100, rating: 5.0 }),
            createMockRecord({ $id: '3', title: 'Bravo', price: 200, rating: 4.0 }),
        ];
    });

    describe('ascending sort', () => {
        it('should sort strings ascending', () => {
            const result = applySort(records, { title: 'asc' });
            expect(result.map(r => r.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
        });

        it('should sort numbers ascending', () => {
            const result = applySort(records, { price: 'asc' });
            expect(result.map(r => r.price)).toEqual([100, 200, 300]);
        });

        it('should sort floats ascending', () => {
            const result = applySort(records, { rating: 'asc' });
            expect(result.map(r => r.rating)).toEqual([3.0, 4.0, 5.0]);
        });
    });

    describe('descending sort', () => {
        it('should sort strings descending', () => {
            const result = applySort(records, { title: 'desc' });
            expect(result.map(r => r.title)).toEqual(['Charlie', 'Bravo', 'Alpha']);
        });

        it('should sort numbers descending', () => {
            const result = applySort(records, { price: 'desc' });
            expect(result.map(r => r.price)).toEqual([300, 200, 100]);
        });
    });

    describe('edge cases', () => {
        it('should return original order when sort is empty', () => {
            const result = applySort(records, {});
            expect(result.map(r => r.$id)).toEqual(['1', '2', '3']);
        });

        it('should return original order when sort is undefined', () => {
            const result = applySort(records, undefined);
            expect(result.map(r => r.$id)).toEqual(['1', '2', '3']);
        });

        it('should handle undefined values by putting them last', () => {
            const recordsWithUndefined = [
                createMockRecord({ $id: '1', price: 300 }),
                createMockRecord({ $id: '2', price: undefined }),
                createMockRecord({ $id: '3', price: 100 }),
            ];
            const result = applySort(recordsWithUndefined, { price: 'asc' });
            expect(result[0].price).toBe(100);
            expect(result[1].price).toBe(300);
            expect(result[2].price).toBeUndefined();
        });

        it('should not mutate original array', () => {
            const original = [...records];
            applySort(records, { price: 'asc' });
            expect(records).toEqual(original);
        });
    });
});

describe('applySearch', () => {
    let records: CollectionEntry[];
    let contentType: ContentType;

    beforeEach(() => {
        records = [
            createMockRecord({ $id: '1', title: 'MacBook Pro', name: 'laptop-1' }),
            createMockRecord({ $id: '2', title: 'iPhone 14', name: 'phone-1' }),
            createMockRecord({ $id: '3', title: 'iPad Air', name: 'tablet-1' }),
            createMockRecord({ $id: '4', title: 'Dell Monitor', name: 'monitor-1' }),
        ];
        contentType = createMockContentType();
    });

    it('should search in default fields (title, name)', () => {
        const result = applySearch(records, 'Mac', contentType);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('MacBook Pro');
    });

    it('should be case insensitive', () => {
        const result = applySearch(records, 'macbook', contentType);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('MacBook Pro');
    });

    it('should search in multiple fields', () => {
        const result = applySearch(records, '1', contentType);
        expect(result).toHaveLength(4); // All have '-1' in name
    });

    it('should return empty when no matches', () => {
        const result = applySearch(records, 'nonexistent', contentType);
        expect(result).toHaveLength(0);
    });

    it('should use custom searchFields when defined', () => {
        const customType = createMockContentType({
            searchFields: ['title'],
        });
        const result = applySearch(records, 'laptop-1', customType);
        expect(result).toHaveLength(0); // Should not search in 'name'
    });

    it('should match partial strings', () => {
        const result = applySearch(records, 'Pro', contentType);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('MacBook Pro');
    });
});

describe('applyPagination', () => {
    let records: CollectionEntry[];

    beforeEach(() => {
        records = Array.from({ length: 25 }, (_, i) =>
            createMockRecord({ $id: String(i + 1), title: `Item ${i + 1}` })
        );
    });

    it('should return first page by default', () => {
        const result = applyPagination(records);
        expect(result.data).toHaveLength(20); // Default limit
        expect(result.meta.page).toBe(1);
        expect(result.meta.total).toBe(25);
        expect(result.meta.pageCount).toBe(2);
    });

    it('should return correct page size', () => {
        const result = applyPagination(records, 1, 10);
        expect(result.data).toHaveLength(10);
        expect(result.meta.pageSize).toBe(10);
        expect(result.meta.pageCount).toBe(3);
    });

    it('should return second page', () => {
        const result = applyPagination(records, 2, 10);
        expect(result.data[0].$id).toBe('11');
        expect(result.meta.page).toBe(2);
    });

    it('should handle last page with fewer items', () => {
        const result = applyPagination(records, 3, 10);
        expect(result.data).toHaveLength(5);
        expect(result.meta.page).toBe(3);
    });

    it('should return empty for page beyond range', () => {
        const result = applyPagination(records, 10, 10);
        expect(result.data).toHaveLength(0);
        expect(result.meta.page).toBe(10);
    });

    it('should handle empty array', () => {
        const result = applyPagination([], 1, 10);
        expect(result.data).toHaveLength(0);
        expect(result.meta.total).toBe(0);
        expect(result.meta.pageCount).toBe(0);
    });

    it('should calculate pageCount correctly for exact division', () => {
        const exactRecords = Array.from({ length: 20 }, (_, i) =>
            createMockRecord({ $id: String(i + 1) })
        );
        const result = applyPagination(exactRecords, 1, 10);
        expect(result.meta.pageCount).toBe(2);
    });
});

describe('Query Engine Integration', () => {
    let records: CollectionEntry[];
    let contentType: ContentType;

    beforeEach(() => {
        records = [
            createMockRecord({ $id: '1', title: 'MacBook', price: 1999, category: 'electronics', rating: 4.8 }),
            createMockRecord({ $id: '2', title: 'iPhone', price: 999, category: 'electronics', rating: 4.5 }),
            createMockRecord({ $id: '3', title: 'AirPods', price: 199, category: 'electronics', rating: 4.2 }),
            createMockRecord({ $id: '4', title: 'Desk Chair', price: 299, category: 'furniture', rating: 4.0 }),
            createMockRecord({ $id: '5', title: 'Standing Desk', price: 599, category: 'furniture', rating: 4.6 }),
            createMockRecord({ $id: '6', title: 'Monitor', price: 499, category: 'electronics', rating: 4.3 }),
            createMockRecord({ $id: '7', title: 'Keyboard', price: 149, category: 'electronics', rating: 4.1 }),
            createMockRecord({ $id: '8', title: 'Mouse', price: 79, category: 'electronics', rating: 4.0 }),
        ];
        contentType = createMockContentType();
    });

    it('should combine filter + sort + pagination', () => {
        // Filter electronics, sort by price desc, get page 1 with limit 3
        const filtered = applyFilters(records, { category: 'electronics' });
        expect(filtered).toHaveLength(6);

        const sorted = applySort(filtered, { price: 'desc' });
        expect(sorted[0].title).toBe('MacBook');
        expect(sorted[1].title).toBe('iPhone');

        const paginated = applyPagination(sorted, 1, 3);
        expect(paginated.data).toHaveLength(3);
        expect(paginated.meta.total).toBe(6);
        expect(paginated.meta.pageCount).toBe(2);
        expect(paginated.data.map(r => r.title)).toEqual(['MacBook', 'iPhone', 'Monitor']);
    });

    it('should handle complex filter + search combination', () => {
        // Filter by price range, then search
        const filtered = applyFilters(records, {
            price_gte: 100,
            price_lte: 600,
        });
        expect(filtered).toHaveLength(5);

        const searched = applySearch(filtered, 'electronics', contentType);
        // None have 'electronics' in title/name, but this tests the combination
        expect(searched).toHaveLength(0);
    });

    it('should handle price range filter with sort', () => {
        const filtered = applyFilters(records, {
            price_gte: 200,
            price_lt: 1000,
        });
        const sorted = applySort(filtered, { rating: 'desc' });

        // In the 200-1000 range: iPhone (999, 4.5), Standing Desk (599, 4.6), Monitor (499, 4.3), Desk Chair (299, 4.0)
        // Sorted by rating desc: Standing Desk (4.6), iPhone (4.5), Monitor (4.3), Desk Chair (4.0)
        expect(sorted[0].title).toBe('Standing Desk'); // 4.6 rating
        expect(sorted[1].title).toBe('iPhone'); // 4.5 rating
        expect(sorted[2].title).toBe('Monitor'); // 4.3 rating
    });

    it('should maintain correct pagination after filtering', () => {
        const filtered = applyFilters(records, { category: 'electronics' });
        const paginated = applyPagination(filtered, 2, 2);

        expect(paginated.data).toHaveLength(2);
        expect(paginated.meta.total).toBe(6);
        expect(paginated.meta.page).toBe(2);
    });
});
