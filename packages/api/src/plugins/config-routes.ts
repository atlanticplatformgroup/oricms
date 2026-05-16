import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import type { Prisma } from '@prisma/client';
import { requireOwnerOrAdmin, requirePermission } from '../permissions/middleware';
import { prisma } from '../lib/prisma';
import {
  mergeEnabledPlugins,
  mergePluginHooksConfig,
  mergePluginSecret,
  parsePluginExecutionPolicy,
  parsePluginHooksConfig,
  parsePluginSecretMetadata,
  parsePluginUiPolicy,
} from './settings';
import { findPluginProject, findPluginProjectSettings, loadValidatedManifestsOrRespond, respondProjectNotFound, writePluginAuditEvent } from './shared';
import {
  applyPolicyRollback,
  buildRotatedPluginSecret,
  findRollbackPolicyEvent,
  getRequestedEnabledPluginIds,
  PluginConfigRouteError,
  resolveExecutionPolicyUpdate,
  resolveHookConfigUpdate,
  resolvePolicyRollbackPreview,
  resolveReconcilePlan,
  resolveUiPolicyPreview,
  resolveUiPolicyUpdate,
} from './config-route-support';

const router = Router({ mergeParams: true });

function respondPluginConfigRouteError(res: Response, error: PluginConfigRouteError) {
  res.status(error.status).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

router.patch('/enabled', requirePermission('settings', 'update'), [body('enabled').isArray(), body('enabled.*').isString().trim().notEmpty()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin enablement payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;

  let uniqueRequested: string[];
  try {
    uniqueRequested = getRequestedEnabledPluginIds(manifests, req.body.enabled as string[]);
  } catch (error) {
    if (error instanceof PluginConfigRouteError) {
      respondPluginConfigRouteError(res, error);
      return;
    }
    throw error;
  }

  const settings = mergeEnabledPlugins(project.settings, uniqueRequested);
  await prisma.project.update({ where: { id: projectId }, data: { settings } });
  res.json({ success: true, data: { enabled: uniqueRequested } });
});

router.get('/hooks', requirePermission('schemas', 'read'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  res.json({ success: true, data: parsePluginHooksConfig(project.settings) });
});

router.patch('/hooks', requirePermission('settings', 'update'), [body('hookEndpoints').optional().isObject(), body('retry').optional().isObject(), body('retry.maxAttempts').optional().isInt({ min: 1, max: 10 }), body('retry.baseDelayMs').optional().isInt({ min: 1, max: 60000 }), body('retry.timeoutMs').optional().isInt({ min: 100, max: 60000 })], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin hook config payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  const bodyValue = req.body as { hookEndpoints?: Record<string, Record<string, string>>; retry?: { maxAttempts?: number; baseDelayMs?: number; timeoutMs?: number } };

  let hookEndpoints: ReturnType<typeof parsePluginHooksConfig>['hookEndpoints'];
  let retry: ReturnType<typeof parsePluginHooksConfig>['retry'];
  try {
    ({ hookEndpoints, retry } = resolveHookConfigUpdate(project.settings, manifests, bodyValue));
  } catch (error) {
    if (error instanceof PluginConfigRouteError) {
      respondPluginConfigRouteError(res, error);
      return;
    }
    throw error;
  }

  const settings = mergePluginHooksConfig(project.settings, hookEndpoints, retry);
  await prisma.project.update({ where: { id: projectId }, data: { settings } });
  res.json({ success: true, data: { hookEndpoints, retry } });
});

router.post('/reconcile', requirePermission('settings', 'update'), [body('dryRun').optional().isBoolean()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin reconcile payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const dryRun = req.body?.dryRun !== false;
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  const { changes, hasChanges, nextSettings } = resolveReconcilePlan(project.settings, manifests);

  if (!dryRun && hasChanges) {
    await prisma.project.update({ where: { id: projectId }, data: { settings: nextSettings as Prisma.InputJsonValue } });
    await writePluginAuditEvent({
      projectId,
      userId: req.user?.id,
      action: 'plugin.runtime.reconciled',
      newValue: {
        summary: {
          removedEnabledPlugins: changes.removedEnabledPlugins.length,
          removedHookEndpoints: changes.removedHookEndpoints.reduce((total, row) => total + row.hooks.length, 0),
        },
        changes: changes as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    });
  }

  res.json({ success: true, data: { dryRun, applied: !dryRun && hasChanges, changes } });
});

router.get('/secrets', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }
  res.json({ success: true, data: { secrets: parsePluginSecretMetadata(project.settings) } });
});

router.post('/secrets/:pluginId/rotate', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId, pluginId } = req.params as { projectId: string; pluginId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  if (!manifests.some((manifest) => manifest.id === pluginId)) {
    res.status(404).json({ success: false, error: { code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' } });
    return;
  }

  const { nextSettings, response } = buildRotatedPluginSecret(project.settings, pluginId);

  await prisma.project.update({ where: { id: projectId }, data: { settings: nextSettings } });
  res.status(201).json({ success: true, data: response });
});

router.delete('/secrets/:pluginId', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId, pluginId } = req.params as { projectId: string; pluginId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const settings = mergePluginSecret(project.settings, pluginId, null);
  await prisma.project.update({ where: { id: projectId }, data: { settings } });
  res.json({ success: true, data: { pluginId, revoked: true } });
});

router.get('/execution-policy', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  res.json({ success: true, data: parsePluginExecutionPolicy(project.settings) });
});

router.patch('/execution-policy', requirePermission('settings', 'update'), [body('mode').optional().isIn(['disabled', 'webhook-only']), body('enforceManifestCapabilities').optional().isBoolean(), body('allowlistedHooks').optional().isArray(), body('allowlistedHooks.*').optional().isString().trim().notEmpty(), body('blockedPlugins').optional().isArray(), body('blockedPlugins.*').optional().isString().trim().notEmpty()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin execution policy payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const bodyValue = req.body as Partial<ReturnType<typeof parsePluginExecutionPolicy>>;
  const { current, next, nextSettings } = resolveExecutionPolicyUpdate(project.settings, bodyValue);
  await prisma.project.update({ where: { id: projectId }, data: { settings: nextSettings } });
  await writePluginAuditEvent({
    projectId,
    userId: req.user?.id,
    action: 'plugin.policy.execution.updated',
    oldValue: current as unknown as Prisma.InputJsonValue,
    newValue: next as unknown as Prisma.InputJsonValue,
  });

  res.json({ success: true, data: next });
});

router.get('/ui-policy', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  res.json({ success: true, data: parsePluginUiPolicy(project.settings) });
});

router.patch('/ui-policy', requirePermission('settings', 'update'), [body('includeDisabledPlugins').optional().isBoolean(), body('allowlistedViews').optional().isArray(), body('allowlistedViews.*').optional().isString().trim().notEmpty(), body('allowlistedFieldTypes').optional().isArray(), body('allowlistedFieldTypes.*').optional().isString().trim().notEmpty()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin UI policy payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const bodyValue = req.body as Partial<ReturnType<typeof parsePluginUiPolicy>>;
  const { current, next, nextSettings } = resolveUiPolicyUpdate(project.settings, bodyValue);
  await prisma.project.update({ where: { id: projectId }, data: { settings: nextSettings } });
  await writePluginAuditEvent({
    projectId,
    userId: req.user?.id,
    action: 'plugin.policy.ui.updated',
    oldValue: current as unknown as Prisma.InputJsonValue,
    newValue: next as unknown as Prisma.InputJsonValue,
  });

  res.json({ success: true, data: next });
});

router.post('/ui-policy/preview', requirePermission('settings', 'update'), [body('includeDisabledPlugins').optional().isBoolean(), body('allowlistedViews').optional().isArray(), body('allowlistedViews.*').optional().isString().trim().notEmpty(), body('allowlistedFieldTypes').optional().isArray(), body('allowlistedFieldTypes.*').optional().isString().trim().notEmpty()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin UI policy preview payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;

  const bodyValue = req.body as Partial<ReturnType<typeof parsePluginUiPolicy>>;
  res.json({ success: true, data: resolveUiPolicyPreview(project.settings, manifests, bodyValue) });
});

router.post('/policy-events/:eventId/rollback/preview', requireOwnerOrAdmin, async (req: Request, res: Response) => {
  const { projectId, eventId } = req.params as { projectId: string; eventId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  try {
    const { row, alreadyRolledBack } = await findRollbackPolicyEvent(projectId, eventId);
    res.json({
      success: true,
      data: resolvePolicyRollbackPreview(project.settings, row, alreadyRolledBack),
    });
  } catch (error) {
    if (error instanceof PluginConfigRouteError) {
      respondPluginConfigRouteError(res, error);
      return;
    }
    throw error;
  }
});

router.post('/policy-events/:eventId/rollback', requireOwnerOrAdmin, async (req: Request, res: Response) => {
  const { projectId, eventId } = req.params as { projectId: string; eventId: string };
  const project = await findPluginProjectSettings(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  try {
    const { row, alreadyRolledBack } = await findRollbackPolicyEvent(projectId, eventId);
    if (alreadyRolledBack) {
      respondPluginConfigRouteError(
        res,
        new PluginConfigRouteError(
          409,
          'POLICY_EVENT_ALREADY_ROLLED_BACK',
          'Policy event has already been rolled back',
        ),
      );
      return;
    }

    res.json({
      success: true,
      data: await applyPolicyRollback(projectId, project.settings, row, req.user?.id),
    });
  } catch (error) {
    if (error instanceof PluginConfigRouteError) {
      respondPluginConfigRouteError(res, error);
      return;
    }
    throw error;
  }
});

export default router;
