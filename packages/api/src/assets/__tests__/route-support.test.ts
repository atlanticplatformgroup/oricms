import { describe, expect, it } from 'vitest';
import {
  normalizeUploadAssetInput,
  parseAssetListOptions,
} from '../route-support';

describe('asset route support', () => {
  it('falls back to metadataFolder and clamps pagination inputs', () => {
    expect(parseAssetListOptions({
      folder: 'all',
      metadataFolder: 'homepage',
      usage: 'used',
      sort: 'name',
      limit: '999',
      offset: '-10',
    })).toEqual({
      folder: 'all',
      tag: 'homepage',
      usage: 'used',
      sort: 'name',
      limit: 100,
      offset: 0,
      search: undefined,
    });
  });

  it('normalizes tag arrays into metadata for uploads', () => {
    expect(normalizeUploadAssetInput({
      folder: 'images',
      filename: 'hero.png',
      content: 'data:image/png;base64,AAAA',
      tags: ['homepage', ' feature '],
    })).toEqual({
      input: {
        folder: 'images',
        filename: 'hero.png',
        content: 'data:image/png;base64,AAAA',
        metadata: {
          tags: ['homepage', 'feature'],
        },
      },
    });
  });
});
