import * as fs from 'fs/promises';
import * as path from 'path';
import simpleGit from 'simple-git';
import type { CommitOptions } from './global-types';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/data/projects';
export const GLOBAL_ASSET_ROOT = path.join(WORKSPACE_ROOT, 'global-assets');

export async function ensureGlobalAssetRepository(): Promise<string> {
  await fs.mkdir(GLOBAL_ASSET_ROOT, { recursive: true });
  const git = simpleGit(GLOBAL_ASSET_ROOT);

  try {
    await fs.access(path.join(GLOBAL_ASSET_ROOT, '.git'));
  } catch {
    await git.init();
    const readmePath = path.join(GLOBAL_ASSET_ROOT, 'README.md');
    await fs.writeFile(
      readmePath,
      '# OriCMS Global Assets\n\nShared assets are stored here.\n',
      'utf-8',
    );
    await git.add('README.md');
    await git.commit('Initialize global asset library');
  }

  return GLOBAL_ASSET_ROOT;
}

export async function commitGlobalAssetChanges(
  workspacePath: string,
  files: string[],
  commitOptions: CommitOptions,
): Promise<void> {
  const git = simpleGit(workspacePath);
  for (const file of files) {
    await git.add(file);
  }

  await git.commit(commitOptions.message, {
    '--author': `${commitOptions.author.name} <${commitOptions.author.email}>`,
  });
}
