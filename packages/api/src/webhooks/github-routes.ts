import crypto from 'crypto';
import { Router, type Response } from 'express';
import { header, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { badRequest, ok } from '../lib/responses';
import { queueBuildJob } from './build-queue';
import { triggerMappedEnvironmentActions } from './dispatch';
import { buildGitHubSignature, sendInternalError, sendValidationError, type WebhookRequest } from './shared';

const router = Router({ mergeParams: true });

router.post('/github', [header('x-github-event').isIn(['push', 'ping']), header('x-hub-signature-256').optional()], async (req: WebhookRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendValidationError(res);
      return;
    }

    const event = req.headers['x-github-event'] as string;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const payload = req.body;

    if (event === 'ping') {
      ok(res, { message: 'Pong' });
      return;
    }

    const repoUrl = payload.repository?.clone_url;
    const ref = payload.ref;
    const branch = ref?.replace('refs/heads/', '');
    const commit = payload.after;
    const commitMessage = payload.head_commit?.message;
    const commitAuthor = payload.head_commit?.author?.name;
    const changedFiles = (payload.commits || []).flatMap((commitItem: { added?: string[]; modified?: string[]; removed?: string[] }) => ([...(commitItem.added || []), ...(commitItem.modified || []), ...(commitItem.removed || [])]));

    if (!repoUrl || !branch || !commit) {
      badRequest(res, 'Missing required fields', 'INVALID_PAYLOAD');
      return;
    }

    const projects = await prisma.project.findMany({ where: { repoUrl }, select: { id: true, repoUrl: true, webhookSecret: true } });
    const results = await Promise.all(projects.map(async (project) => {
      const webhookSecret = project.webhookSecret;
      if (webhookSecret && signature) {
        const bodyBuffer = req.rawBody || Buffer.from(JSON.stringify(payload));
        const expectedSignature = buildGitHubSignature(webhookSecret, bodyBuffer);
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
          return { projectId: project.id, triggered: false, error: 'Invalid signature' };
        }
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
    logger.error({ msg: 'GitHub webhook error', error });
    sendInternalError(res);
  }
});

export default router;
