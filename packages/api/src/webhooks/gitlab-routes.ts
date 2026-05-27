import { Router, type Request, type Response } from 'express';
import { header, validationResult } from 'express-validator';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { badRequest, ok } from '../lib/responses';
import { queueBuildJob } from './build-queue';
import { triggerMappedEnvironmentActions } from './dispatch';
import { sendInternalError, sendValidationError } from './shared';

const router = Router({ mergeParams: true });

/**
 * Validate a GitLab webhook token using HMAC-SHA256 timing-safe comparison.
 * The caller must send the token in the x-gitlab-token header as:
 *   sha256=<hmac_hex>
 * where hmac_hex = HMAC_SHA256(webhookSecret, payloadBody)
 *
 * If the project has no webhookSecret configured, validation passes.
 * If no signature is provided and a webhookSecret is configured, validation fails.
 */
function validateGitLabWebhookSecret(
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

router.post('/gitlab', [header('x-gitlab-event').isIn(['Push Hook', 'System Hook']), header('x-gitlab-token').optional()], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendValidationError(res);
      return;
    }

    const token = req.headers['x-gitlab-token'] as string | undefined;
    const payload = req.body;
    const repoUrl = payload.repository?.git_http_url || payload.repository?.homepage;
    const ref = payload.ref;
    const branch = ref?.replace('refs/heads/', '');
    const commit = payload.after || payload.checkout_sha;
    const commitMessage = payload.commits?.[0]?.message;
    const commitAuthor = payload.commits?.[0]?.author?.name;
    const changedFiles = (payload.commits || []).flatMap((commitItem: { added?: string[]; modified?: string[]; removed?: string[] }) => ([...(commitItem.added || []), ...(commitItem.modified || []), ...(commitItem.removed || [])]));

    if (!repoUrl || !branch || !commit) {
      badRequest(res, 'Missing required fields', 'INVALID_PAYLOAD');
      return;
    }

    const projects = await prisma.project.findMany({
      where: { OR: [{ repoUrl }, { repoUrl: repoUrl.replace('.git', '') }] },
      select: { id: true, repoUrl: true, webhookSecret: true },
    });

    const payloadBody = JSON.stringify(req.body);
    const results = await Promise.all(projects.map(async (project: { id: string; repoUrl: string | null; webhookSecret: string | null }) => {
      if (!validateGitLabWebhookSecret(project.webhookSecret, token, payloadBody)) {
        return { projectId: project.id, triggered: false, error: 'Invalid token' };
      }

      const build = await prisma.build.create({
        data: {
          projectId: project.id,
          status: 'pending',
          branch,
          commit,
          commitMessage: commitMessage || '',
          commitAuthor: commitAuthor || '',
          triggeredBy: 'webhook',
          startedAt: new Date(),
        },
      });

      await queueBuildJob(build.id, project.id, { branch, commit, repoUrl });
      const deployment = await triggerMappedEnvironmentActions(project.id, branch, commit, commitMessage || '', changedFiles);
      return { projectId: project.id, triggered: true, buildId: build.id, deployment };
    }));

    ok(res, { processed: results.length, results });
  } catch (error) {
    logger.error({ msg: 'GitLab webhook error', error });
    sendInternalError(res);
  }
});

export default router;
