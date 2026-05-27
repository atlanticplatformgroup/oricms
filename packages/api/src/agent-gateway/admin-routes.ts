import { Router } from 'express';
import { authenticate as authenticateJWT } from '../auth/middleware';
import { requirePermission } from '../permissions/middleware';
import {
  createAgentAdminToken,
  createAgentConsentRecord,
  exportAgentAuditLog,
  getAgentAdminConfig,
  getAgentAuditLogSummary,
  listAgentAuditLog,
  listAgentConsentHistory,
  listAgentTokens,
  revokeAgentAdminToken,
  revokeAgentConsentRecord,
  updateAgentAdminConfig,
} from './admin-route-support';

const router = Router();

router.use('/v1/admin', authenticateJWT, (req, _res, next) => {
  const projectId = typeof req.query.projectId === 'string'
    ? req.query.projectId
    : typeof req.body?.projectId === 'string'
      ? req.body.projectId
      : undefined;

  if (projectId) {
    req.projectId = projectId;
  }

  next();
});

router.get('/v1/admin/config', requirePermission('agents', 'read'), async (req, res) => {
  await getAgentAdminConfig(req, res);
});

router.put('/v1/admin/config', requirePermission('agents', 'update'), async (req, res) => {
  await updateAgentAdminConfig(req, res);
});

router.get('/v1/admin/audit-log', requirePermission('agents', 'read'), async (req, res) => {
  await listAgentAuditLog(req, res);
});

router.get('/v1/admin/audit-log/summary', requirePermission('agents', 'read'), async (req, res) => {
  await getAgentAuditLogSummary(req, res);
});

router.get('/v1/admin/audit-log/export', requirePermission('agents', 'read'), async (req, res) => {
  await exportAgentAuditLog(req, res);
});

router.get('/v1/admin/tokens', requirePermission('agents', 'read'), async (req, res) => {
  await listAgentTokens(req, res);
});

router.post('/v1/admin/tokens', requirePermission('agents', 'create'), async (req, res) => {
  await createAgentAdminToken(req, res);
});

router.post('/v1/admin/tokens/:id/revoke', requirePermission('agents', 'delete'), async (req, res) => {
  await revokeAgentAdminToken(req, res);
});

router.post('/v1/admin/consent', requirePermission('agents', 'create'), async (req, res) => {
  await createAgentConsentRecord(req, res);
});

router.get('/v1/admin/consent', requirePermission('agents', 'read'), async (req, res) => {
  await listAgentConsentHistory(req, res);
});

router.post('/v1/admin/consent/:id/revoke', requirePermission('agents', 'delete'), async (req, res) => {
  await revokeAgentConsentRecord(req, res);
});

export default router;
