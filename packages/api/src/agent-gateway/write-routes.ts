import { Router } from 'express';
import { authenticateAgentToken } from './middleware';
import { requirePermission } from '../permissions/middleware';
import type { AgentEntryStatus } from '@ori/shared';
import { handleAgentMutation, runMutationPreflight } from './write-route-support';

const router = Router();

router.post('/v1/preflight', authenticateAgentToken, async (req, res) => {
  await runMutationPreflight(req, res);
});

router.post('/v1/collections/:name/entries', authenticateAgentToken, requirePermission('collections', 'create'), async (req, res) => {
  await handleAgentMutation(req, res, {
    action: 'create',
    collectionName: req.params.name,
    inputData: req.body as Record<string, unknown>,
  });
});

router.put('/v1/collections/:name/entries/:id', authenticateAgentToken, requirePermission('collections', 'update'), async (req, res) => {
  await handleAgentMutation(req, res, {
    action: 'update',
    collectionName: req.params.name,
    entryId: req.params.id,
    inputData: req.body as Record<string, unknown>,
  });
});

router.post('/v1/collections/:name/entries/:id/transition', authenticateAgentToken, requirePermission('collections', 'publish'), async (req, res) => {
  await handleAgentMutation(req, res, {
    action: 'transition',
    collectionName: req.params.name,
    entryId: req.params.id,
    targetStatus: req.body?.targetStatus as AgentEntryStatus | undefined,
    inputData: {
      $status: req.body?.targetStatus,
      ...(req.body?.targetStatus === 'published' ? { $publishedAt: new Date().toISOString() } : {}),
    },
  });
});

router.delete('/v1/collections/:name/entries/:id', authenticateAgentToken, requirePermission('collections', 'delete'), async (req, res) => {
  await handleAgentMutation(req, res, {
    action: 'delete',
    collectionName: req.params.name,
    entryId: req.params.id,
    inputData: {},
  });
});

export default router;
