import { prisma } from '../lib/prisma';
import { apiServices } from '../lib/api-services';
import { decrypt, encrypt } from '../lib/crypto';
import { logger } from '../middleware/logger';
import { CDNExportService } from './service';
import type { StorageConfig } from './providers';

export class CdnRouteError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sanitizeCdnConfig(config: {
  provider: string;
  bucket: string;
  region: string | null;
  endpoint: string | null;
  baseUrl: string | null;
}) {
  return {
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    baseUrl: config.baseUrl,
    isConfigured: true,
  };
}

export async function findCdnConfig(projectId: string) {
  return prisma.cdnConfig.findUnique({
    where: { projectId },
  });
}

export async function requireProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new CdnRouteError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }

  return project;
}

export async function saveCdnConfig(
  projectId: string,
  input: {
    provider: 's3' | 'r2' | 'minio';
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
    endpoint?: string;
    baseUrl?: string;
  },
) {
  const encryptedAccessKey = encrypt(input.accessKeyId);
  const encryptedSecretKey = encrypt(input.secretAccessKey);

  return prisma.cdnConfig.upsert({
    where: { projectId },
    update: {
      provider: input.provider,
      bucket: input.bucket,
      encryptedAccessKey,
      encryptedSecretKey,
      region: input.region,
      endpoint: input.endpoint,
      baseUrl: input.baseUrl,
    },
    create: {
      projectId,
      provider: input.provider,
      bucket: input.bucket,
      encryptedAccessKey,
      encryptedSecretKey,
      region: input.region,
      endpoint: input.endpoint,
      baseUrl: input.baseUrl,
    },
  });
}

export function toStorageConfig(config: {
  provider: string;
  bucket: string;
  encryptedAccessKey: string;
  encryptedSecretKey: string;
  region: string | null;
  endpoint: string | null;
  baseUrl: string | null;
}): StorageConfig {
  return {
    provider: config.provider as 's3' | 'r2' | 'minio',
    bucket: config.bucket,
    accessKeyId: decrypt(config.encryptedAccessKey),
    secretAccessKey: decrypt(config.encryptedSecretKey),
    region: config.region || undefined,
    endpoint: config.endpoint || undefined,
    baseUrl: config.baseUrl || undefined,
  };
}

export async function resolveExportSourcePath(projectId: string, buildId?: string) {
  if (buildId) {
    const build = await prisma.build.findFirst({
      where: { id: buildId, projectId },
    });

    if (!build || !build.outputPath) {
      throw new CdnRouteError(400, 'BUILD_NOT_FOUND', 'Build not found or has no output');
    }

    return {
      buildId,
      sourcePath: build.outputPath,
    };
  }

  const latestBuild = await prisma.build.findFirst({
    where: { projectId, status: 'success' },
    orderBy: { completedAt: 'desc' },
  });

  if (!latestBuild || !latestBuild.outputPath) {
    throw new CdnRouteError(400, 'NO_BUILD_OUTPUT', 'No successful build with output found');
  }

  return {
    buildId: latestBuild.id,
    sourcePath: latestBuild.outputPath,
  };
}

export async function createCdnExportJob(
  projectId: string,
  input: { buildId?: string; sourcePath: string; destinationPrefix?: string },
) {
  return prisma.cdnExport.create({
    data: {
      projectId,
      buildId: input.buildId || null,
      status: 'pending',
      sourcePath: input.sourcePath,
      destinationPrefix: input.destinationPrefix || '',
      startedAt: new Date(),
    },
  });
}

export async function listCdnExports(projectId: string, limit: number, offset: number) {
  const [exports, total] = await Promise.all([
    prisma.cdnExport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.cdnExport.count({ where: { projectId } }),
  ]);

  return {
    exports,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + exports.length < total,
    },
  };
}

export async function findCdnExport(projectId: string, exportId: string) {
  return prisma.cdnExport.findFirst({
    where: { id: exportId, projectId },
  });
}

export async function deleteCdnConfig(projectId: string) {
  await prisma.cdnConfig.delete({
    where: { projectId },
  });
}

export async function markCdnExportUploading(exportId: string) {
  await prisma.cdnExport.update({
    where: { id: exportId },
    data: { status: 'uploading' },
  });
}

export function scheduleCdnExport(input: {
  exportId: string;
  projectId: string;
  storageConfig: StorageConfig;
  sourcePath: string;
  destinationPrefix?: string;
}) {
  const service = new CDNExportService(input.storageConfig);
  const destinationPrefix = input.destinationPrefix || `deploys/${Date.now()}`;

  apiServices.runBackgroundTask(
    'cdn-export',
    service
      .export({
        sourcePath: input.sourcePath,
        destinationPrefix,
        onProgress: (progress) => {
          logger.info({
            msg: 'CDN export progress',
            exportId: input.exportId,
            projectId: input.projectId,
            percentComplete: progress.percentComplete,
            uploadedFiles: progress.uploadedFiles,
            failedFiles: progress.failedFiles,
            totalFiles: progress.totalFiles,
            currentFile: progress.currentFile,
          });
        },
      })
      .then(async (result) => {
        await prisma.cdnExport.update({
          where: { id: input.exportId },
          data: {
            status: result.success ? 'completed' : 'failed',
            completedAt: new Date(),
            totalFiles: result.uploaded + result.failed,
            uploadedFiles: result.uploaded,
            failedFiles: result.failed,
            errors: result.errors,
            urls: result.urls,
          },
        });
      })
      .catch(async (error) => {
        logger.error({
          msg: 'CDN export background task failed',
          exportId: input.exportId,
          projectId: input.projectId,
          error,
        });
        await prisma.cdnExport.update({
          where: { id: input.exportId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errors: [error instanceof Error ? error.message : String(error)],
          },
        });
      }),
  );
}
