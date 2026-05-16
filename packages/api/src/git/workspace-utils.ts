import * as fs from 'fs/promises';
import * as path from 'path';
import type { GitFile } from '@ori/shared';

export const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || path.resolve(process.cwd(), '.oricms', 'projects');

export function getWorkspacePath(projectId: string): string {
  return path.join(WORKSPACE_ROOT, projectId, 'repo');
}

export function validateWorkspacePath(workspacePath: string, filePath: string): string {
  const resolved = path.resolve(workspacePath, filePath);
  const normalizedWorkspace = path.normalize(workspacePath + path.sep);
  const normalizedResolved = path.normalize(resolved + path.sep);

  if (!normalizedResolved.startsWith(normalizedWorkspace)) {
    throw new Error('Invalid path: directory traversal detected');
  }

  return resolved;
}

async function toGitFile(
  workspacePath: string,
  entryPath: string,
  entryType: 'file' | 'directory',
): Promise<GitFile> {
  const stat = await fs.stat(path.join(workspacePath, entryPath));
  return {
    path: entryPath,
    name: path.basename(entryPath),
    type: entryType,
    size: entryType === 'file' ? stat.size : undefined,
    lastModified: stat.mtime.toISOString(),
  };
}

export async function listWorkspaceFiles(
  workspacePath: string,
  dirPath: string,
  recursive = false,
): Promise<GitFile[]> {
  const fullPath = validateWorkspacePath(workspacePath, dirPath);

  const listShallow = async (): Promise<GitFile[]> => {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return Promise.all(
      entries.map((entry) => {
        const entryPath = path.join(dirPath, entry.name);
        return toGitFile(workspacePath, entryPath, entry.isDirectory() ? 'directory' : 'file');
      }),
    );
  };

  const listRecursive = async (): Promise<GitFile[]> => {
    const results: GitFile[] = [];

    const walk = async (currentRelativePath: string): Promise<void> => {
      const currentAbsolutePath = validateWorkspacePath(workspacePath, currentRelativePath);
      const entries = await fs.readdir(currentAbsolutePath, { withFileTypes: true });

      for (const entry of entries) {
        const entryRelativePath = path.join(currentRelativePath, entry.name);
        const entryType: 'file' | 'directory' = entry.isDirectory() ? 'directory' : 'file';
        results.push(await toGitFile(workspacePath, entryRelativePath, entryType));

        if (entry.isDirectory()) {
          await walk(entryRelativePath);
        }
      }
    };

    await walk(dirPath);
    return results;
  };

  try {
    return recursive ? await listRecursive() : await listShallow();
  } catch {
    return [];
  }
}

export async function listWorkspaceFilePaths(workspacePath: string, dirPath: string): Promise<string[]> {
  const fullPath = validateWorkspacePath(workspacePath, dirPath);
  const results: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryFullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await walk(entryFullPath);
        } else {
          results.push(path.relative(workspacePath, entryFullPath));
        }
      }
    } catch {
      // Directory doesn't exist or permission error — skip
    }
  }

  await walk(fullPath);
  return results;
}

export async function readWorkspaceFile(workspacePath: string, filePath: string): Promise<string | null> {
  const fullPath = validateWorkspacePath(workspacePath, filePath);

  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
}
