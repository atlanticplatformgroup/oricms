/**
 * Ori CMS API Server
 * 
 * Multi-tenant backend with:
 * - JWT authentication
 * - RBAC permissions
 * - Git operations proxy
 * - Audit logging
 */
import 'dotenv/config';

import { logger } from './middleware/logger';
import { presenceService } from './presence/service';
import { bootstrapPluginRuntime } from './plugins/runtime';
import { startDeliveryProjectionReconciler, stopDeliveryProjectionReconciler } from './delivery-projection/reconciler';
import { startDeliveryProjectionWatchers, stopDeliveryProjectionWatchers } from './delivery-projection/watcher';
import { createApiRuntime } from './app';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_FILE_REPO_URLS === 'true') {
  throw new Error('ALLOW_FILE_REPO_URLS=true is not allowed in production');
}

// Re-export prisma for backward compatibility (prefer importing from './lib/prisma')
import { prisma } from './lib/prisma';
export { prisma };

const PORT = process.env.PORT || 3001;

async function main(): Promise<void> {
  bootstrapPluginRuntime();
  startDeliveryProjectionReconciler();
  void startDeliveryProjectionWatchers();

  const { app, shutdown: shutdownRateLimiting } = await createApiRuntime();

  const server = app.listen(PORT, () => {
    logger.info({ msg: 'Ori CMS API started', port: PORT, environment: process.env.NODE_ENV || 'development' });
  });

  presenceService.initialize(server);

  const shutdown = async (signal: 'SIGTERM' | 'SIGINT'): Promise<void> => {
    logger.info({ msg: `${signal} received, closing server` });
    stopDeliveryProjectionReconciler();
    stopDeliveryProjectionWatchers();
    server.close();
    await shutdownRateLimiting();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

void main().catch(async (error) => {
  logger.error({ msg: 'Ori CMS API failed to start', error });
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
