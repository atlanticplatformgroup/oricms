import * as path from 'path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/data/projects';

export function getAssetWorkspacePath(projectId: string): string {
  return path.join(WORKSPACE_ROOT, projectId, 'repo');
}

export function getProjectAssetDirectory(projectId: string): string {
  return path.join(getAssetWorkspacePath(projectId), 'assets');
}

export function getProjectAssetFolderPath(projectId: string, folder: string): string {
  return path.join(getProjectAssetDirectory(projectId), folder);
}

export function getProjectAssetUrl(projectId: string, assetPath: string): string {
  const encodedPath = assetPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `/api/v1/projects/${encodeURIComponent(projectId)}/assets/raw/${encodedPath}`;
}
