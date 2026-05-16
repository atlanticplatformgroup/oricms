import { prisma } from './prisma';
import { logger } from '../middleware/logger';

export interface ApiServices {
  prisma: typeof prisma;
  logger: typeof logger;
  now: () => Date;
  runBackgroundTask: (label: string, task: Promise<unknown>) => void;
}

function runBackgroundTask(label: string, task: Promise<unknown>): void {
  void task.catch((error) => {
    logger.error({ msg: 'Background task failed', label, error });
  });
}

export const apiServices: ApiServices = {
  prisma,
  logger,
  now: () => new Date(),
  runBackgroundTask,
};
