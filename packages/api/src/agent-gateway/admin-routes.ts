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

router.get('/v1/admin/config', authenticateJWT, requirePermission('agents', 'read'), async (req, res) => {
  await getAgentAdminConfig(req, res);
});

router.put('/v1/admin/config', authenticateJWT, requirePermission('agents', 'update'), async (req, res) => {
  await updateAgentAdminConfig(req, res);
});

router.get('/v1/admin/audit-log', authenticateJWT, requirePermission('agents', 'read'), async (req, res) => {
  await listAgentAuditLog(req, res);
});

router.get('/v1/admin/audit-log/summary', authenticateJWT, requirePermission('agents', 'read'), async (req, res) => {
  await getAgentAuditLogSummary(req, res);
});

router.get('/v1/admin/audit-log/export', authenticateJWT, requirePermission('agents', 'read'), async (req, res) => {
  await exportAgentAuditLog(req, res);
});

router.get('/v1/admin/tokens', authenticateJWT, requirePermission('agents', 'read'), async (req, res) => {
  await listAgentTokens(req, res);
});

router.post('/v1/admin/tokens', authenticateJWT, requirePermission('agents', 'create'), async (req, res) => {
  await createAgentAdminToken(req, res);
});

router.post('/v1/admin/tokens/:id/revoke', authenticateJWT, requirePermission('agents', 'delete'), async (req, res) => {
  await revokeAgentAdminToken(req, res);
});

router.post('/v1/admin/consent', authenticateJWT, requirePermission('agents', 'create'), async (req, res) => {
  await createAgentConsentRecord(req, res);
});

router.get('/v1/admin/consent', authenticateJWT, requirePermission('agents', 'read'), async (req, res) => {
  await listAgentConsentHistory(req, res);
});

router.post('/v1/admin/consent/:id/revoke', authenticateJWT, requirePermission('agents', 'delete'), async (req, res) => {
  await revokeAgentConsentRecord(req, res);
});

export default router;
