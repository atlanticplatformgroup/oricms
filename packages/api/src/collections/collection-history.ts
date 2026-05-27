import { logger } from '../middleware/logger';
import { GitService } from '../git/service';

export async function getCollectionEntryHistory(options: {
  gitService: GitService;
  projectId: string;
  branch: string;
  limit: number;
  entryPath: string;
}) {
  try {
    return await options.gitService.getHistory(
      options.projectId,
      options.limit,
      options.entryPath,
      options.branch,
    );
  } catch (error) {
    logger.warn({
      msg: 'Failed to get collection entry history',
      projectId: options.projectId,
      branch: options.branch,
      entryPath: options.entryPath,
      error,
    });
    return [];
  }
}

export async function getCollectionEntryAtCommit(options: {
  gitService: GitService;
  projectId: string;
  branch: string;
  entryPath: string;
  hash: string;
}) {
  try {
    const content = await options.gitService.getFileAtCommit(
      options.projectId,
      options.hash,
      options.entryPath,
    );
    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    logger.warn({
      msg: 'Failed to get collection entry file at commit',
      projectId: options.projectId,
      branch: options.branch,
      entryPath: options.entryPath,
      hash: options.hash,
      error,
    });
    return null;
  }
}
