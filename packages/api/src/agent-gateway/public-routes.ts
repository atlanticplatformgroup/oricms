import { Router } from 'express';
import { authenticateAgentToken } from './middleware';
import { requirePermission } from '../permissions/middleware';
import {
  diagnoseAgentProject,
  getAgentBootstrap,
  getAgentCollectionEntry,
  getAgentHistory,
  getAgentRawFile,
  getAgentRepositoryStructure,
  getAgentSchema,
  getAgentStatus,
  listAgentCollectionEntries,
  listAgentSchemas,
} from './public-route-support';

const router = Router();

router.get('/v1/status', authenticateAgentToken, async (req, res) => {
  await getAgentStatus(req, res);
});

router.get('/v1/bootstrap', authenticateAgentToken, async (req, res) => {
  await getAgentBootstrap(req, res);
});

router.get('/v1/schemas', authenticateAgentToken, requirePermission('schemas', 'read'), async (req, res) => {
  await listAgentSchemas(req, res);
});

router.get('/v1/schemas/:id', authenticateAgentToken, requirePermission('schemas', 'read'), async (req, res) => {
  await getAgentSchema(req, res);
});

router.get('/v1/structure', authenticateAgentToken, requirePermission('collections', 'read'), async (req, res) => {
  await getAgentRepositoryStructure(req, res);
});

router.get('/v1/history', authenticateAgentToken, requirePermission('collections', 'read'), async (req, res) => {
  await getAgentHistory(req, res);
});

router.get('/v1/collections/:name/entries', authenticateAgentToken, requirePermission('collections', 'read'), async (req, res) => {
  await listAgentCollectionEntries(req, res);
});

router.get('/v1/schemas/:name/entries', authenticateAgentToken, requirePermission('entries', 'read'), async (req, res) => {
  await listAgentCollectionEntries(req, res);
});

router.get('/v1/collections/:name/entries/:id', authenticateAgentToken, requirePermission('collections', 'read'), async (req, res) => {
  await getAgentCollectionEntry(req, res);
});

router.get('/v1/schemas/:name/entries/:id', authenticateAgentToken, requirePermission('entries', 'read'), async (req, res) => {
  await getAgentCollectionEntry(req, res);
});

router.get('/v1/files/*', authenticateAgentToken, requirePermission('agents', 'read'), async (req, res) => {
  await getAgentRawFile(req, res);
});

router.post('/v1/diagnose', authenticateAgentToken, requirePermission('collections', 'read'), async (req, res) => {
  await diagnoseAgentProject(req, res);
});

export default router;
