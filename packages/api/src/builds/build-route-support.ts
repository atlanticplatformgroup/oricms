import { prisma } from '../lib/prisma';
import { RESOURCE_COLLECTION_IDS } from '../resources/service';
import { queueBuildJob } from '../webhooks/build-queue';

type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

type BuildRecord = Awaited<ReturnType<typeof prisma.build.findFirst>>;

function decorateBuild<T extends Record<string, unknown>>(build: T) {
  return {
    ...build,
    resourceCollectionId: RESOURCE_COLLECTION_IDS.builds,
  };
}

export async function listBuildsForProject(
  projectId: string,
  options: { status?: string; limit: number; offset: number },
) {
  const where: Record<string, unknown> = { projectId };
  if (options.status) {
    where.status = options.status;
  }

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.build.count({ where }),
  ]);

  return {
    builds: builds.map((build) => decorateBuild(build as unknown as Record<string, unknown>)),
    resourceCollectionId: RESOURCE_COLLECTION_IDS.builds,
    pagination: {
      total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + builds.length < total,
    },
  };
}

export async function findBuildForProject(projectId: string, buildId: string) {
  return prisma.build.findFirst({
    where: {
      id: buildId,
      projectId,
    },
  });
}

export function toBuildDetailResponse(build: NonNullable<BuildRecord>) {
  return {
    build: decorateBuild(build as unknown as Record<string, unknown>),
    resourceCollectionId: RESOURCE_COLLECTION_IDS.builds,
  };
}

export async function findBuildProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
  });
}

export async function createManualBuild(
  projectId: string,
  input: { branch: string; commit?: string; actorEmail?: string | null },
) {
  return prisma.build.create({
    data: {
      projectId,
      status: 'pending',
      branch: input.branch,
      commit: input.commit || '',
      commitMessage: 'Manual build trigger',
      commitAuthor: input.actorEmail || 'unknown',
      triggeredBy: 'manual',
      startedAt: new Date(),
    },
  });
}

export async function queueManualBuild(
  buildId: string,
  projectId: string,
  input: { branch: string; commit?: string; repoUrl?: string | null },
) {
  await queueBuildJob(buildId, projectId, {
    branch: input.branch,
    commit: input.commit || '',
    repoUrl: input.repoUrl ?? '',
  });
}

export function canCancelBuild(status: string): boolean {
  return ['pending', 'running'].includes(status);
}

export function buildStatusUpdateData(
  currentBuild: NonNullable<BuildRecord>,
  input: {
    status: BuildStatus;
    logs?: string;
    duration?: number;
    outputUrl?: string;
  },
): Record<string, unknown> {
  const updateData: Record<string, unknown> = { status: input.status };

  if (input.logs !== undefined) updateData.logs = input.logs;
  if (input.duration !== undefined) updateData.duration = input.duration;
  if (input.outputUrl !== undefined) updateData.outputUrl = input.outputUrl;
  if (['success', 'failed', 'cancelled'].includes(input.status) && !currentBuild.completedAt) {
    updateData.completedAt = new Date();
  }

  return updateData;
}

export async function summarizeBuildStatus(projectId: string) {
  const [latestBuild, statusCounts] = await Promise.all([
    prisma.build.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.build.groupBy({
      by: ['status'],
      where: { projectId },
      _count: {
        status: true,
      },
    }),
  ]);

  const counts = statusCounts.reduce((acc, curr) => {
    acc[curr.status] = curr._count.status;
    return acc;
  }, {} as Record<string, number>);

  return {
    latestBuild,
    counts: {
      pending: counts.pending || 0,
      running: counts.running || 0,
      success: counts.success || 0,
      failed: counts.failed || 0,
      cancelled: counts.cancelled || 0,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    },
  };
}
