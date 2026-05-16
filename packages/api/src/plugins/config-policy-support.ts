import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  mergePluginExecutionPolicy,
  mergePluginUiPolicy,
  normalizeExecutionPolicy,
  normalizePluginUiPolicy,
  parsePluginExecutionPolicy,
  parsePluginUiPolicy,
} from './settings';
import { writePluginAuditEvent } from './shared';
import { PluginConfigRouteError } from './config-route-common';

type PolicyRollbackRow = {
  id: string;
  action: 'plugin.policy.execution.updated' | 'plugin.policy.ui.updated';
  oldValue: Prisma.JsonValue;
};

export async function findRollbackPolicyEvent(projectId: string, eventId: string) {
  const rows = await prisma.auditLog.findMany({
    where: {
      projectId,
      id: eventId,
      action: { in: ['plugin.policy.execution.updated', 'plugin.policy.ui.updated'] },
    },
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: { id: true, action: true, oldValue: true },
  });

  if (rows.length === 0) {
    throw new PluginConfigRouteError(404, 'POLICY_EVENT_NOT_FOUND', 'Policy event not found');
  }

  const row = rows[0] as PolicyRollbackRow;
  if (!row.oldValue || typeof row.oldValue !== 'object' || Array.isArray(row.oldValue)) {
    throw new PluginConfigRouteError(
      400,
      'POLICY_EVENT_NOT_ROLLBACKABLE',
      'Policy event has no rollback snapshot',
    );
  }

  const existingRollback = await prisma.auditLog.findMany({
    where: {
      projectId,
      action: { in: ['plugin.policy.execution.rolled_back', 'plugin.policy.ui.rolled_back'] },
      newValue: { path: ['summary', 'rollbackFromEventId'], equals: row.id },
    },
    take: 1,
  });

  return {
    row,
    alreadyRolledBack: existingRollback.length > 0,
  };
}

export function resolvePolicyRollbackPreview(settings: unknown, row: PolicyRollbackRow, alreadyRolledBack: boolean) {
  if (row.action === 'plugin.policy.execution.updated') {
    const current = parsePluginExecutionPolicy(settings);
    const rollback = normalizeExecutionPolicy(row.oldValue, current);
    return {
      rollbackable: !alreadyRolledBack,
      alreadyRolledBack,
      rolledBackAction: row.action,
      eventId: row.id,
      currentExecutionPolicy: current,
      rollbackExecutionPolicy: rollback,
    };
  }

  const current = parsePluginUiPolicy(settings);
  const rollback = normalizePluginUiPolicy(row.oldValue as Partial<ReturnType<typeof parsePluginUiPolicy>>);
  return {
    rollbackable: !alreadyRolledBack,
    alreadyRolledBack,
    rolledBackAction: row.action,
    eventId: row.id,
    currentUiPolicy: current,
    rollbackUiPolicy: rollback,
  };
}

export async function applyPolicyRollback(
  projectId: string,
  settings: unknown,
  row: PolicyRollbackRow,
  userId?: string,
) {
  if (row.action === 'plugin.policy.execution.updated') {
    const currentExecutionPolicy = parsePluginExecutionPolicy(settings);
    const executionPolicy = normalizeExecutionPolicy(row.oldValue, currentExecutionPolicy);
    const nextSettings = mergePluginExecutionPolicy(settings, executionPolicy);
    await prisma.project.update({ where: { id: projectId }, data: { settings: nextSettings } });
    await writePluginAuditEvent({
      projectId,
      userId,
      action: 'plugin.policy.execution.rolled_back',
      newValue: {
        summary: { rollbackFromEventId: row.id },
        policy: executionPolicy,
      } as Prisma.InputJsonValue,
    });

    return {
      rolledBackAction: row.action,
      eventId: row.id,
      executionPolicy,
    };
  }

  const uiPolicy = normalizePluginUiPolicy(row.oldValue as Partial<ReturnType<typeof parsePluginUiPolicy>>);
  const nextSettings = mergePluginUiPolicy(settings, uiPolicy);
  await prisma.project.update({ where: { id: projectId }, data: { settings: nextSettings } });
  await writePluginAuditEvent({
    projectId,
    userId,
    action: 'plugin.policy.ui.rolled_back',
    newValue: {
      summary: { rollbackFromEventId: row.id },
      policy: uiPolicy,
    } as Prisma.InputJsonValue,
  });

  return {
    rolledBackAction: row.action,
    eventId: row.id,
    uiPolicy,
  };
}
