import { describe, expect, it } from 'vitest';
import { getCollectionPathError, normalizeCollectionPath } from '../collections/path';

describe('normalizeCollectionPath', () => {
  it('should trim whitespace', () => {
    expect(normalizeCollectionPath('  blog  ')).toBe('blog');
  });

  it('should remove leading slashes', () => {
    expect(normalizeCollectionPath('/blog')).toBe('blog');
  });

  it('should remove trailing slashes', () => {
    expect(normalizeCollectionPath('blog/')).toBe('blog');
  });

  it('should remove multiple leading/trailing slashes', () => {
    expect(normalizeCollectionPath('///blog///')).toBe('blog');
  });

  it('should preserve internal slashes', () => {
    expect(normalizeCollectionPath('/blog/posts/')).toBe('blog/posts');
  });
});

describe('getCollectionPathError', () => {
  it('should return error for empty path', () => {
    expect(getCollectionPathError('', [])).toBe('Collection path is required');
  });

  it('should return error for whitespace-only path', () => {
    expect(getCollectionPathError('   ', [])).toBe('Collection path is required');
  });

  it('should return error for backslashes', () => {
    expect(getCollectionPathError('blog\\posts', [])).toBe('Collection path must use forward slashes');
  });

  it('should return error for empty segments', () => {
    expect(getCollectionPathError('blog//posts', [])).toBe('Collection path cannot contain empty segments');
  });

  it('should return error for dot segments', () => {
    expect(getCollectionPathError('blog/./posts', [])).toBe('Collection path cannot contain "." or ".." segments');
  });

  it('should return error for dotdot segments', () => {
    expect(getCollectionPathError('blog/../posts', [])).toBe('Collection path cannot contain "." or ".." segments');
  });

  it('should return error for invalid characters', () => {
    expect(getCollectionPathError('blog/posts!', [])).toBe(
      'Collection path may only use letters, numbers, hyphens, underscores, and slashes'
    );
  });

  it('should return error for duplicate path', () => {
    const collections = [{ id: '1', path: 'blog/posts', contentType: 'markdown' }];
    expect(getCollectionPathError('blog/posts', collections)).toBe('Collection path is already in use');
  });

  it('should allow same path for current collection', () => {
    const collections = [{ id: '1', path: 'blog/posts', contentType: 'markdown' }];
    expect(getCollectionPathError('blog/posts', collections, '1')).toBeNull();
  });

  it('should return null for valid path', () => {
    expect(getCollectionPathError('blog/posts', [])).toBeNull();
  });

  it('should allow hyphens and underscores', () => {
    expect(getCollectionPathError('my-blog_posts', [])).toBeNull();
  });

  it('should allow numbers', () => {
    expect(getCollectionPathError('blog2024', [])).toBeNull();
  });
});
