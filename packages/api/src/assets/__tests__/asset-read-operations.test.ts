import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  getProjectAsset,
  listProjectFolderAssets,
} from '../asset-read-operations';

const tempRoots: string[] = [];

async function createWorkspace(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oricms-assets-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

describe('asset read operations', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('lists folder assets and skips metadata sidecars', async () => {
    const workspacePath = await createWorkspace();
    const assetDir = path.join(workspacePath, 'assets', 'images');
    await fs.mkdir(assetDir, { recursive: true });
    await fs.writeFile(path.join(assetDir, 'hero.png'), 'hero', 'utf-8');
    await fs.writeFile(path.join(assetDir, 'hero.png.json'), JSON.stringify({ altText: 'Hero' }), 'utf-8');
    await fs.writeFile(path.join(assetDir, 'cover.jpg'), 'cover-image', 'utf-8');

    const assets = await listProjectFolderAssets({
      projectId: 'project-1',
      workspacePath,
      folder: 'images',
    });

    expect(assets.map((asset) => asset.path).sort()).toEqual([
      'assets/images/cover.jpg',
      'assets/images/hero.png',
    ]);
    expect(assets.find((asset) => asset.path === 'assets/images/hero.png')?.metadata).toEqual({
      altText: 'Hero',
    });
  });

  it('loads a single asset with normalized usage defaults when no content index exists', async () => {
    const workspacePath = await createWorkspace();
    const assetDir = path.join(workspacePath, 'assets', 'documents');
    await fs.mkdir(assetDir, { recursive: true });
    await fs.writeFile(path.join(assetDir, 'brief.pdf'), 'brief', 'utf-8');

    await expect(getProjectAsset({
      projectId: 'project-1',
      workspacePath,
      projectSettings: {},
      assetPath: 'assets/documents/brief.pdf',
    })).resolves.toMatchObject({
      path: 'assets/documents/brief.pdf',
      folder: 'documents',
      type: 'document',
      usage: {
        count: 0,
        status: 'unused',
      },
      usageDetail: {
        references: [],
      },
    });
  });
});
