import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { chunkValues, type ProjectionSnapshot } from './service-support';

export async function findProjectionState(projectId: string, branch: string) {
  return prisma.deliveryProjectionState.findUnique({
    where: {
      projectId_branch: {
        projectId,
        branch,
      },
    },
  });
}

export function toProjectionSnapshot(state: {
  projectId: string;
  branch: string;
  revision: string;
  recordCount: number;
  lastProjectedAt: Date;
}): ProjectionSnapshot {
  return {
    projectId: state.projectId,
    branch: state.branch,
    revision: state.revision,
    recordCount: state.recordCount,
    lastProjectedAt: state.lastProjectedAt,
  };
}

export async function replaceProjectionRecords(input: {
  projectId: string;
  branch: string;
  revision: string;
  records: Prisma.DeliveryProjectionRecordCreateManyInput[];
  startedAt: Date;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.deliveryProjectionRecord.deleteMany({
      where: {
        projectId: input.projectId,
        branch: input.branch,
      },
    });

    for (const batch of chunkValues(input.records, 250)) {
      if (batch.length === 0) continue;
      await tx.deliveryProjectionRecord.createMany({ data: batch });
    }

    await tx.deliveryProjectionState.upsert({
      where: {
        projectId_branch: {
          projectId: input.projectId,
          branch: input.branch,
        },
      },
      update: {
        revision: input.revision,
        recordCount: input.records.length,
        lastProjectedAt: input.startedAt,
        lastAttemptedAt: input.startedAt,
        lastError: null,
      },
      create: {
        projectId: input.projectId,
        branch: input.branch,
        revision: input.revision,
        recordCount: input.records.length,
        lastProjectedAt: input.startedAt,
        lastAttemptedAt: input.startedAt,
        lastError: null,
      },
    });
  });
}

export async function recordProjectionFailure(input: {
  projectId: string;
  branch: string;
  revision: string;
  startedAt: Date;
  message: string;
}) {
  await prisma.deliveryProjectionState.upsert({
    where: {
      projectId_branch: {
        projectId: input.projectId,
        branch: input.branch,
      },
    },
    update: {
      revision: input.revision,
      lastAttemptedAt: input.startedAt,
      lastError: input.message,
    },
    create: {
      projectId: input.projectId,
      branch: input.branch,
      revision: input.revision,
      recordCount: 0,
      lastProjectedAt: input.startedAt,
      lastAttemptedAt: input.startedAt,
      lastError: input.message,
    },
  });
}

export async function listProjectionRows(projectId: string, branch: string, collectionId: string) {
  return prisma.deliveryProjectionRecord.findMany({
    where: {
      projectId,
      branch,
      collectionId,
    },
    orderBy: {
      entryId: 'asc',
    },
  });
}

export async function findProjectionRow(
  projectId: string,
  branch: string,
  collectionId: string,
  entryId: string,
) {
  return prisma.deliveryProjectionRecord.findUnique({
    where: {
      projectId_branch_collectionId_entryId: {
        projectId,
        branch,
        collectionId,
        entryId,
      },
    },
  });
}
