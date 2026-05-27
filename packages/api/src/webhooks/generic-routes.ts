import { Router, type Request, type Response } from 'express';
import { body, header, validationResult } from 'express-validator';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { badRequest, notFound, unauthorized } from '../lib/responses';
import { queueBuildJob } from './build-queue';
import { triggerMappedEnvironmentActions } from './dispatch';
import { sendInternalError, sendValidationError } from './shared';

const router = Router({ mergeParams: true });

/**
 * Validate a generic webhook secret using HMAC-SHA256 timing-safe comparison.
 * The caller must send the secret in the x-webhook-secret header as:
 *   sha256=<hmac_hex>
 * where hmac_hex = HMAC_SHA256(webhookSecret, payloadBody)
 *
 * If the project has no webhookSecret configured, validation passes.
 * If no signature is provided and a webhookSecret is configured, validation fails.
 */
function validateGenericWebhookSecret(
  projectWebhookSecret: string | null,
  providedSignature: string | undefined,
  payloadBody: string,
): boolean {
  if (!projectWebhookSecret) {
    return true;
  }
  if (!providedSignature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', projectWebhookSecret)
    .update(payloadBody, 'utf8')
    .digest('hex');

  // Normalize both to sha256= prefix for comparison
  const normalizedProvided = providedSignature.startsWith('sha256=')
    ? providedSignature.slice(7)
    : providedSignature;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(normalizedProvided, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    // Buffer length mismatch or invalid hex
    return false;
  }
}

router.post(
  '/generic/:projectId',
  [header('x-webhook-secret').optional(), body('ref').optional().trim(), body('branch').optional().trim(), body('commit').trim().isLength({ min: 7 }), body('commitMessage').optional().trim(), body('commitAuthor').optional().trim(), body('changedFiles').optional().isArray()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, 'Invalid input');
        return;
      }

      const { projectId } = req.params;
      const { ref, branch: bodyBranch, commit, commitMessage, commitAuthor, changedFiles = [] } = req.body;
      const branch = bodyBranch || ref?.replace('refs/heads/', '');
      if (!branch) {
        badRequest(res, 'Branch is required', 'MISSING_BRANCH');
        return;
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }

      const secret = req.headers['x-webhook-secret'] as string | undefined;
      const payloadBody = JSON.stringify(req.body);
      if (!validateGenericWebhookSecret(project.webhookSecret, secret, payloadBody)) {
        unauthorized(res, 'Invalid webhook secret', 'INVALID_WEBHOOK_SECRET');
        return;
      }

      const build = await prisma.build.create({
        data: {
          projectId,
          status: 'pending',
          branch,
          commit,
          commitMessage: commitMessage || '',
          commitAuthor: commitAuthor || '',
          triggeredBy: 'api',
          startedAt: new Date(),
        },
      });

      await queueBuildJob(build.id, projectId, { branch, commit, repoUrl: project.repoUrl ?? "" });
      const deployment = await triggerMappedEnvironmentActions(projectId, branch, commit, commitMessage || '', Array.isArray(changedFiles) ? changedFiles.map(String) : []);

      res.json({ success: true, data: { buildId: build.id, status: build.status, deployment } });
    } catch (error) {
      logger.error({ msg: 'Generic webhook error', error });
      sendInternalError(res);
    }
  },
);

export default router;
