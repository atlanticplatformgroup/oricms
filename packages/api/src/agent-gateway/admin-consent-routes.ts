import type { Request, Response } from 'express';
import { apiServices } from '../lib/api-services';
import { badRequest, created, internalError, notFound, ok } from '../lib/responses';
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
    internalError(res, 'Failed to record consent');
  }
}

export async function listAgentConsentHistory(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.query.projectId as string;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const consents = await apiServices.prisma.agentConsent.findMany({
      where: { projectId },
      orderBy: { termsAcceptedAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });
    ok(res, { consents });
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
    internalError(res, 'Failed to revoke consent');
  }
}
