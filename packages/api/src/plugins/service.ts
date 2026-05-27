import type { PluginManifest } from '@ori/shared';
import {
  listPluginManifestsFromWorkspace,
  preparePluginWorkspace,
} from './manifest-reader';
export type {
  PluginManifestValidationError,
  PluginRegistryListResult,
} from './types';

export class PluginRegistryService {
  async listWithDiagnostics(projectId: string, repoUrl: string, branch: string) {
    const workspacePath = await preparePluginWorkspace({ projectId, repoUrl, branch });
    return listPluginManifestsFromWorkspace(workspacePath);
  }

  async list(projectId: string, repoUrl: string, branch: string): Promise<PluginManifest[]> {
    const result = await this.listWithDiagnostics(projectId, repoUrl, branch);
    return result.manifests;
  }
}
