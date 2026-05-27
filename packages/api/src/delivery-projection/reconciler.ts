import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { apiServices } from '../lib/api-services';
import { DeliveryProjectionService } from './service';
import pLimit from 'p-limit';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

function getIntervalMs(): number {
  const raw = process.env.DELIVERY_PROJECTION_RECONCILE_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_INTERVAL_MS;
  }
  return parsed;
}

export async function reconcileAllDeliveryProjections(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        repoUrl: true,
        defaultBranch: true,
      },
    });

    const limit = pLimit(5);
    await Promise.all(
      projects.map((project) =>
        limit(async () => {
          const projector = new DeliveryProjectionService({
            projectId: project.id,
            repoUrl: project.repoUrl ?? '',
            branch: project.defaultBranch,
          });
          try {
            await projector.ensureCurrent();
          } catch (error) {
            logger.error({
              msg: 'Delivery projection reconcile failed',
              projectId: project.id,
              branch: project.defaultBranch,
              error,
            });
          }
        }),
      ),
    );
  } finally {
    running = false;
  }
}

export function startDeliveryProjectionReconciler(): void {
  if (process.env.ENABLE_DELIVERY_PROJECTION_RECONCILER === 'false') {
    return;
  }
  if (timer) return;

  apiServices.runBackgroundTask('delivery-projection-reconcile:start', reconcileAllDeliveryProjections());

  const intervalMs = getIntervalMs();
  timer = setInterval(() => {
    apiServices.runBackgroundTask('delivery-projection-reconcile:tick', reconcileAllDeliveryProjections());
  }, intervalMs);
  timer.unref();

  logger.info({ msg: 'Delivery projection reconciler started', intervalMs });
}

export function stopDeliveryProjectionReconciler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
