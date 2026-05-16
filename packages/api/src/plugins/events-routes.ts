import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import type { Prisma } from '@prisma/client';
import { isPluginEventName } from '@ori/shared';
import { requirePermission } from '../permissions/middleware';
import { prisma } from '../lib/prisma';
import { PluginRegistryService } from './service';
import { dispatchPluginHook } from './hook-dispatcher';
import { buildPluginHealthSnapshot, parseQueryInt } from './settings';
import { findPluginProject, findPluginProjectRuntime, respondProjectNotFound, loadValidatedManifestsOrRespond } from './shared';

const router = Router({ mergeParams: true });

router.post('/test-fire', requirePermission('settings', 'update'), [body('pluginId').isString().trim().notEmpty(), body('event').isString().trim().notEmpty(), body('payload').optional().isObject()], async (req: Request, res: Response) => {
  const validation = validationResult(req);
  if (!validation.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Plugin test-fire payload is invalid', details: validation.mapped() } });
    return;
  }

  const { projectId } = req.params as { projectId: string };
  const { pluginId, event, payload } = req.body as { pluginId: string; event: string; payload?: Record<string, unknown> };
  const project = await findPluginProjectRuntime(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  if (!isPluginEventName(event)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Event "${event}" is not allowlisted for plugin dispatch` } });
    return;
  }

  const manifests = await loadValidatedManifestsOrRespond(res, project);
  if (!manifests) return;
  if (!manifests.some((manifest) => manifest.id === pluginId)) {
    res.status(404).json({ success: false, error: { code: 'PLUGIN_NOT_FOUND', message: 'Plugin not found' } });
    return;
  }

  const result = await dispatchPluginHook({
    projectId,
    event,
    resourceType: 'plugin',
    resourceId: pluginId,
    payload: { testFire: true, ...(payload || {}) },
    actor: { id: req.user?.id, name: req.user?.name, email: req.user?.email },
  });

  res.json({ success: true, data: { pluginId, event, result } });
});

router.get('/health', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProject(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const registry = new PluginRegistryService();
  const result = await registry.listWithDiagnostics(project.id, project.repoUrl, project.defaultBranch);
  const snapshot = buildPluginHealthSnapshot({ manifests: result.manifests, settings: project.settings });

  res.json({
    success: true,
    data: {
      invalidManifestCount: result.invalidManifests.length,
      invalidManifests: result.invalidManifests,
      staleEnabledPlugins: snapshot.staleEnabledPlugins,
      blockedEnabledPlugins: snapshot.blockedEnabledPlugins,
      missingHookEndpoints: snapshot.missingHookEndpoints,
      staleHookEndpoints: snapshot.staleHookEndpoints,
    },
  });
});

router.get('/policy-events', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const limit = parseQueryInt(req.query.limit, 20, 1, 100);
  const project = await findPluginProjectRuntime(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const rows = await prisma.auditLog.findMany({
    where: {
      projectId,
      action: { in: ['plugin.policy.execution.updated', 'plugin.policy.ui.updated', 'plugin.runtime.reconciled', 'plugin.policy.execution.rolled_back', 'plugin.policy.ui.rolled_back'] },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, action: true, createdAt: true, userId: true, newValue: true },
  });

  res.json({
    success: true,
    data: {
      events: rows.map((row) => {
        const payload = row.newValue && typeof row.newValue === 'object' && !Array.isArray(row.newValue)
          ? row.newValue as Record<string, unknown>
          : {};
        return { id: row.id, action: row.action, createdAt: row.createdAt, userId: row.userId, summary: payload.summary ?? null };
      }),
    },
  });
});

router.get('/events', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const page = parseQueryInt(req.query.page, 1, 1, 1000);
  const limit = parseQueryInt(req.query.limit, 20, 1, 100);
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const pluginId = typeof req.query.pluginId === 'string' ? req.query.pluginId.trim() : '';
  const event = typeof req.query.event === 'string' ? req.query.event.trim() : '';

  const project = await findPluginProjectRuntime(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const actionFilter = status === 'sent' ? ['plugin.hook.sent'] : (status === 'failed' ? ['plugin.hook.failed'] : ['plugin.hook.sent', 'plugin.hook.failed']);
  const where: Prisma.AuditLogWhereInput = {
    projectId,
    action: { in: actionFilter },
    ...(pluginId ? { newValue: { path: ['pluginId'], equals: pluginId } } : {}),
    ...(event ? { newValue: { path: ['event'], equals: event } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, action: true, resourceType: true, resourceId: true, newValue: true, createdAt: true, userId: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      events: rows.map((row) => {
        const payload = row.newValue && typeof row.newValue === 'object' && !Array.isArray(row.newValue)
          ? row.newValue as Record<string, unknown>
          : {};
        return {
          id: row.id,
          action: row.action,
          resourceType: row.resourceType,
          resourceId: row.resourceId,
          createdAt: row.createdAt,
          userId: row.userId,
          pluginId: typeof payload.pluginId === 'string' ? payload.pluginId : null,
          event: typeof payload.event === 'string' ? payload.event : null,
          endpoint: typeof payload.endpoint === 'string' ? payload.endpoint : null,
          error: typeof payload.error === 'string' ? payload.error : null,
          attempts: typeof payload.attempts === 'number' ? payload.attempts : null,
          hookId: typeof payload.hookId === 'string' ? payload.hookId : null,
          secretPrefix: typeof payload.secretPrefix === 'string' ? payload.secretPrefix : null,
        };
      }),
      pagination: { page, pageSize: limit, pageCount: Math.ceil(total / limit), total },
    },
  });
});

router.get('/events/summary', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await findPluginProjectRuntime(projectId);
  if (!project) {
    respondProjectNotFound(res);
    return;
  }

  const [sentCount, failedCount, latestFailures] = await Promise.all([
    prisma.auditLog.count({ where: { projectId, action: 'plugin.hook.sent' } }),
    prisma.auditLog.count({ where: { projectId, action: 'plugin.hook.failed' } }),
    prisma.auditLog.findMany({ where: { projectId, action: 'plugin.hook.failed' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, newValue: true, createdAt: true } }),
  ]);

  res.json({
    success: true,
    data: {
      sentCount,
      failedCount,
      successRate: sentCount + failedCount === 0 ? 1 : sentCount / (sentCount + failedCount),
      latestFailures: latestFailures.map((row) => {
        const payload = row.newValue && typeof row.newValue === 'object' && !Array.isArray(row.newValue)
          ? row.newValue as Record<string, unknown>
          : {};
        return {
          id: row.id,
          createdAt: row.createdAt,
          pluginId: typeof payload.pluginId === 'string' ? payload.pluginId : null,
          event: typeof payload.event === 'string' ? payload.event : null,
          error: typeof payload.error === 'string' ? payload.error : null,
        };
      }),
    },
  });
});

export default router;
