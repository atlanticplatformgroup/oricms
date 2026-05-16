import type { Request, Response } from 'express';
import { apiServices } from '../lib/api-services';
import { badRequest, internalError, ok } from '../lib/responses';
import { exportAuditLogs, getAuditLogs, getAuditSummary } from './audit';
import { ensureAdminAccess } from './admin-route-common';

export async function listAgentAuditLog(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.query.projectId as string;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const { startDate, endDate, agentSessionId, limit, offset } = req.query as Record<string, string>;
    const logs = await getAuditLogs(projectId, {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(agentSessionId && { agentSessionId }),
      ...(limit && { limit: parseInt(limit, 10) }),
      ...(offset && { offset: parseInt(offset, 10) }),
    });
    ok(res, { logs });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent audit log error', error });
    internalError(res, 'Failed to get audit logs');
  }
}

export async function getAgentAuditLogSummary(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.query.projectId as string;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const { startDate, endDate } = req.query as Record<string, string>;
    const summary = await getAuditSummary(projectId, {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    });
    ok(res, summary);
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent audit summary error', error });
    internalError(res, 'Failed to get audit summary');
  }
}

export async function exportAgentAuditLog(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.query.projectId as string;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const { startDate, endDate, format = 'json' } = req.query as Record<string, string>;
    if (!startDate || !endDate) {
      badRequest(res, 'startDate and endDate are required');
      return;
    }

    const exportData = await exportAuditLogs(projectId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format: format as 'json' | 'csv',
    });
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `agent-audit-${projectId.substring(0, 8)}-${startDate}-${endDate}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent audit export error', error });
    internalError(res, 'Failed to export audit logs');
  }
}
