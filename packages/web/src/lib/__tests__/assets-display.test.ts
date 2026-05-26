import { describe, expect, it } from 'vitest';
import {
  formatAssetSize,
  formatAssetUsage,
  getAssetIdentifier,
  getAssetOptionLabel,
  getAssetRenderUrl,
  getAssetTypeLabel,
  isGlobalAsset,
} from '../assets/display';

describe('getAssetOptionLabel', () => {
  it('should format asset label', () => {
    const asset = { name: 'hero.jpg', path: '/images/hero.jpg' } as any;
    expect(getAssetOptionLabel(asset)).toBe('hero.jpg · /images/hero.jpg');
  });
});

describe('getAssetTypeLabel', () => {
  it('should return Image for image type', () => {
    expect(getAssetTypeLabel('image')).toBe('Image');
  });

  it('should return Document for document type', () => {
    expect(getAssetTypeLabel('document')).toBe('Document');
  });

  it('should return File for unknown type', () => {
    expect(getAssetTypeLabel('video' as any)).toBe('File');
  });
});

describe('formatAssetSize', () => {
  it('should format bytes', () => {
    expect(formatAssetSize(512)).toBe('512 B');
  });

  it('should format kilobytes', () => {
    expect(formatAssetSize(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatAssetSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('formatAssetUsage', () => {
  it('should return Unused for no usage', () => {
    const asset = { usage: null } as any;
    expect(formatAssetUsage(asset)).toEqual({ label: 'Unused', color: 'gray' });
  });

  it('should return Unused for unused status', () => {
    const asset = { usage: { status: 'unused', count: 0 } } as any;
    expect(formatAssetUsage(asset)).toEqual({ label: 'Unused', color: 'gray' });
  });

  it('should format single entry usage', () => {
    const asset = { usage: { status: 'used', count: 1 } } as any;
    expect(formatAssetUsage(asset)).toEqual({ label: 'Used in 1 entry', color: 'teal' });
  });

  it('should format multiple entry usage', () => {
    const asset = { usage: { status: 'used', count: 5 } } as any;
    expect(formatAssetUsage(asset)).toEqual({ label: 'Used in 5 entries', color: 'teal' });
  });
});

describe('isGlobalAsset', () => {
  it('should return true for global asset', () => {
    const asset = { scope: 'global', assetId: 'global-1' } as any;
    expect(isGlobalAsset(asset)).toBe(true);
  });

  it('should return false for project asset', () => {
    const asset = { scope: 'project', path: '/a.jpg' } as any;
    expect(isGlobalAsset(asset)).toBe(false);
  });
});

describe('getAssetIdentifier', () => {
  it('should return assetId for global asset', () => {
    const asset = { scope: 'global', assetId: 'global-1' } as any;
    expect(getAssetIdentifier(asset)).toBe('global-1');
  });

  it('should return path for project asset', () => {
    const asset = { scope: 'project', path: '/a.jpg' } as any;
    expect(getAssetIdentifier(asset)).toBe('/a.jpg');
  });
});

describe('getAssetRenderUrl', () => {
  it('should return absolute URL as-is', () => {
    expect(getAssetRenderUrl('https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg');
  });

  it('should resolve relative URL with API base', () => {
    const result = getAssetRenderUrl('/api/assets/1');
    expect(result).toContain('/api/assets/1');
  });

  it('should handle empty URL', () => {
    expect(getAssetRenderUrl('')).toBe('');
  });
});
