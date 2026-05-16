import { Router, type Request, type Response } from 'express';
import { param } from 'express-validator';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { ok } from '../lib/responses';
import { requireOwnerOrAdmin } from '../permissions/middleware';
import { sendInternalError, sendNotFound } from './shared';

const router = Router({ mergeParams: true });

router.get('/:projectId/delivery-key', [param('projectId').isUUID()], requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      sendNotFound(res);
      return;
    }

    const settings = (project.settings || {}) as Record<string, unknown>;
    ok(res, {
      configured: Boolean(settings.deliveryApiKeyHash),
      prefix: settings.deliveryApiKeyPrefix || null,
      requireDeliveryApiKey: settings.requireDeliveryApiKey ?? true,
    });
  } catch (error) {
    logger.error({ msg: 'Get delivery key status error', error });
    sendInternalError(res, 'Failed to load delivery key status');
  }
});

router.post('/:projectId/delivery-key', [param('projectId').isUUID()], requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      sendNotFound(res);
      return;
    }

    const rawToken = `del_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.slice(0, 12);
    const currentSettings = (project.settings || {}) as Record<string, unknown>;
    const updatedSettings = {
      ...currentSettings,
      deliveryApiKeyHash: tokenHash,
      deliveryApiKeyPrefix: tokenPrefix,
      requireDeliveryApiKey: true,
    };

    await prisma.project.update({
      where: { id: projectId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    ok(res, {
      token: rawToken,
      prefix: tokenPrefix,
      message: 'Delivery API key generated. Store this key securely; it will not be shown again.',
    });
  } catch (error) {
    logger.error({ msg: 'Generate delivery key error', error });
    sendInternalError(res, 'Failed to generate delivery key');
  }
});

router.delete('/:projectId/delivery-key', [param('projectId').isUUID()], requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      sendNotFound(res);
      return;
    }

    const currentSettings = (project.settings || {}) as Record<string, unknown>;
    const updatedSettings = { ...currentSettings };
    delete updatedSettings.deliveryApiKeyHash;
    delete updatedSettings.deliveryApiKeyPrefix;
    delete updatedSettings.requireDeliveryApiKey;

    await prisma.project.update({
      where: { id: projectId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    ok(res, { message: 'Delivery API key revoked' });
  } catch (error) {
    logger.error({ msg: 'Revoke delivery key error', error });
    sendInternalError(res, 'Failed to revoke delivery key');
  }
});

export default router;
