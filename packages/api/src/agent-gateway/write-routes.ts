import { Router, type Request, type Response } from 'express';
import { authenticateAgentToken } from './middleware';
import { requirePermission } from '../permissions/middleware';
import type { AgentEntryStatus } from '@ori/shared';
import { handleAgentMutation, runMutationPreflight } from './write-route-support';
import {
  handleCreateSchemaDefinition,
  handleUpdateSchemaDefinition,
} from './schema-definition-routes';

const router = Router();

function entryCreateRoute(permissionResource: 'collections' | 'entries') {
  return [authenticateAgentToken, requirePermission(permissionResource, 'create'), async (req: Request, res: Response) => {
    await handleAgentMutation(req, res, {
      action: 'create',
      collectionName: req.params.name,
      inputData: req.body as Record<string, unknown>,
    });
  }] as const;
}

function entryUpdateRoute(permissionResource: 'collections' | 'entries') {
  return [authenticateAgentToken, requirePermission(permissionResource, 'update'), async (req: Request, res: Response) => {
    await handleAgentMutation(req, res, {
      action: 'update',
      collectionName: req.params.name,
      entryId: req.params.id,
      inputData: req.body as Record<string, unknown>,
    });
  }] as const;
}

function entryTransitionRoute(permissionResource: 'collections' | 'entries') {
  return [authenticateAgentToken, requirePermission(permissionResource, 'publish'), async (req: Request, res: Response) => {
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
  }] as const;
}

function entryDeleteRoute(permissionResource: 'collections' | 'entries') {
  return [authenticateAgentToken, requirePermission(permissionResource, 'delete'), async (req: Request, res: Response) => {
    await handleAgentMutation(req, res, {
      action: 'delete',
      collectionName: req.params.name,
      entryId: req.params.id,
      inputData: {},
    });
  }] as const;
}

router.post('/v1/preflight', authenticateAgentToken, async (req, res) => {
  await runMutationPreflight(req, res);
});

router.post('/v1/schemas', authenticateAgentToken, requirePermission('schemas', 'update'), async (req, res) => {
  await handleCreateSchemaDefinition(req, res);
});

router.put('/v1/schemas/:name', authenticateAgentToken, requirePermission('schemas', 'update'), async (req, res) => {
  await handleUpdateSchemaDefinition(req, res);
});

router.post('/v1/collections/:name/entries', ...entryCreateRoute('collections'));
router.post('/v1/schemas/:name/entries', ...entryCreateRoute('entries'));

router.put('/v1/collections/:name/entries/:id', ...entryUpdateRoute('collections'));
router.put('/v1/schemas/:name/entries/:id', ...entryUpdateRoute('entries'));

router.post('/v1/collections/:name/entries/:id/transition', ...entryTransitionRoute('collections'));
router.post('/v1/schemas/:name/entries/:id/transition', ...entryTransitionRoute('entries'));

router.delete('/v1/collections/:name/entries/:id', ...entryDeleteRoute('collections'));
router.delete('/v1/schemas/:name/entries/:id', ...entryDeleteRoute('entries'));

export default router;
