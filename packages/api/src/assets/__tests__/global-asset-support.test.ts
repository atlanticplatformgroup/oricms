import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  getGlobalAssetType,
  getGlobalAssetUrl,
  listGlobalAssetIds,
  readGlobalAssetMetadata,
  toGlobalAsset,
} from '../global-asset-support';

const tempRoots: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oricms-global-assets-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

describe('global asset support helpers', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('walks nested asset trees and skips metadata, readme, and git internals', async () => {
    const workspacePath = await createTempWorkspace();
    await fs.mkdir(path.join(workspacePath, '.git'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'brand'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'README.md'), 'ignore me', 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'brand', 'logo.png'), 'logo', 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'brand', 'logo.png.json'), '{"tags":["brand"]}', 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'notes.txt'), 'hello', 'utf-8');

    await expect(listGlobalAssetIds(workspacePath)).resolves.toEqual([
      'brand/logo.png',
      'notes.txt',
    ]);
  });

  it('reads normalized metadata and maps a file into a global asset payload', async () => {
    const workspacePath = await createTempWorkspace();
    await fs.mkdir(path.join(workspacePath, 'brand'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'brand', 'logo-primary.png'), 'image-bytes', 'utf-8');
    await fs.writeFile(
      path.join(workspacePath, 'brand', 'logo-primary.png.json'),
      JSON.stringify({ assetId: 'brand/logo', tags: ['brand', ''] }),
      'utf-8',
    );

    await expect(readGlobalAssetMetadata(workspacePath, 'brand/logo-primary.png')).resolves.toEqual({
      assetId: 'brand/logo',
      tags: ['brand'],
    });

    await expect(toGlobalAsset('project-1', workspacePath, 'brand/logo-primary.png')).resolves.toMatchObject({
      assetId: 'brand/logo',
      path: 'brand/logo-primary.png',
      folder: 'brand',
      type: 'image',
      url: '/api/v1/projects/project-1/global-assets/raw/brand/logo',
      metadata: {
        assetId: 'brand/logo',
        tags: ['brand'],
      },
    });
  });

  it('classifies asset types and encodes project-scoped global asset urls', () => {
    expect(getGlobalAssetType('photo.avif')).toBe('image');
    expect(getGlobalAssetType('brief.pdf')).toBe('document');
    expect(getGlobalAssetType('archive.zip')).toBe('file');
    expect(getGlobalAssetUrl('project one', 'brand/logo primary.png')).toBe(
      '/api/v1/projects/project%20one/global-assets/raw/brand/logo%20primary.png',
    );
  });
});
