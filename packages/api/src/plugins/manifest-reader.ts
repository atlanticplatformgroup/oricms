import path from 'path';
import fg from 'fast-glob';
import { GitService } from '../git/service';
import {
  addParsedManifest,
  createPluginRegistryResult,
  parseManifest,
  sortPluginRegistryResult,
} from './manifest-support';
import type { PluginRegistryListResult } from './types';

const PLUGIN_MANIFEST_GLOBS = [
  'plugins/*.yaml',
  'plugins/*.yml',
  'plugins/*/plugin.yaml',
  'plugins/*/plugin.yml',
];

export async function listPluginManifestFiles(workspacePath: string): Promise<string[]> {
  return fg(PLUGIN_MANIFEST_GLOBS, {
    cwd: workspacePath,
    onlyFiles: true,
    unique: true,
  });
}

export async function listPluginManifestsFromWorkspace(
  workspacePath: string,
  files = listPluginManifestFiles(workspacePath)
): Promise<PluginRegistryListResult> {
  const fs = await import('fs/promises');
  const result = createPluginRegistryResult();
  const seenIds = new Set<string>();

  for (const file of await files) {
    try {
      const content = await fs.readFile(path.join(workspacePath, file), 'utf-8');
      addParsedManifest({ ...result, seenIds }, file, parseManifest(content, file));
    } catch {
      result.invalidManifests.push({
        sourcePath: file,
        code: 'PLUGIN_MANIFEST_PARSE_ERROR',
        message: 'Manifest file could not be read',
      });
    }
  }

  return sortPluginRegistryResult(result);
}

export async function preparePluginWorkspace(input: {
  projectId: string;
  repoUrl: string;
  branch: string;
  gitService?: GitService;
}): Promise<string> {
  const gitService = input.gitService ?? new GitService();
  if (input.repoUrl) {
    await gitService.cloneOrPull(input.projectId, input.repoUrl, input.branch);
  }
  return gitService.getWorkspaceDir(input.projectId);
}
