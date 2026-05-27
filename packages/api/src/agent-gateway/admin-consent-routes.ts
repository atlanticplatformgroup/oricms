import type { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { apiServices } from '../lib/api-services';
import { getPrismaErrorResponse } from '../lib/prisma';
import { badRequest, conflict, created, internalError, notFound, ok } from '../lib/responses';
import { ensureResourceNotLocked } from '../locks/middleware';
import { ensureAdminAccess } from './admin-route-common';

export async function createAgentConsentRecord(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.body.projectId;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'agentConfig',
      resourceId: 'agent-consent',
    }))) {
      return;
    }
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const { allowedCollections, allowedBranches, deploymentMode, termsVersion } = req.body;
    if (!termsVersion || !req.userId) {
      badRequest(res, 'termsVersion is required');
      return;
    }

    const consent = await apiServices.prisma.agentConsent.create({
      data: {
        projectId,
        userId: req.userId,
        allowedCollections: allowedCollections || [],
        allowedBranches: allowedBranches || ['main'],
        deploymentMode: deploymentMode || 'cloud',
        termsVersion,
        termsAcceptedAt: new Date(),
        canRevokeAt: new Date(),
      },
    });
    created(res, {
      id: consent.id,
      projectId: consent.projectId,
      userId: consent.userId,
      termsVersion: consent.termsVersion,
      termsAcceptedAt: consent.termsAcceptedAt,
    });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent consent error', error });
    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      return conflict(res, prismaError.message, prismaError.code);
    }
    internalError(res, 'Failed to record consent');
  }
}

export async function listAgentConsentHistory(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.query.projectId as string;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    await Promise.all([
      query('page').optional().isInt({ min: 1 }).toInt().run(req),
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt().run(req),
    ]);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      badRequest(res, 'Invalid pagination parameters', 'INVALID_PARAMS');
      return;
    }

    const page = typeof req.query.page === 'number' ? req.query.page : 1;
    const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 50, 100);
    const skip = (page - 1) * limit;

    const [consents, total] = await Promise.all([
      apiServices.prisma.agentConsent.findMany({
        where: { projectId },
        orderBy: { termsAcceptedAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
        take: limit,
        skip,
      }),
      apiServices.prisma.agentConsent.count({ where: { projectId } }),
    ]);
    ok(res, {
      consents,
      pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
    });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent consent history error', error });
    internalError(res, 'Failed to get consent history');
  }
}

export async function revokeAgentConsentRecord(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projectId = req.body.projectId;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'agentConfig',
      resourceId: `agent-consent:${id}`,
    }))) {
      return;
    }
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const consent = await apiServices.prisma.agentConsent.findFirst({ where: { id, projectId } });
    if (!consent) {
      notFound(res, 'Consent record not found');
      return;
    }

    await apiServices.prisma.agentConsent.update({
      where: { id },
      data: { revokedAt: new Date(), revokedBy: req.userId },
    });
    ok(res, { message: 'Consent revoked successfully' });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent consent revoke error', error });
    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      res.status(prismaError.statusCode).json({ success: false, error: { code: prismaError.code, message: prismaError.message } });
      return;
    }
    internalError(res, 'Failed to revoke consent');
  }
}
