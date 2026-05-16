import { Router } from 'express';
import { requirePermission } from '../permissions/middleware';
import { pageContentSchema } from '../lib/validation';
import { logger } from '../middleware/logger';
import { internalError, notFound, ok } from '../lib/responses';
import { saveSchema } from '../application/schemas/save-schema';
import { deleteSchema } from '../application/schemas/delete-schema';
import { formatGitError, isLifecycleHookError, normalizeSchemaPath, respondLifecycleBlocked, respondValidationError } from './helpers';
import type { GitService } from './service';
import { ensureResourceNotLocked } from '../locks/middleware';

export function createSchemaRoutes(gitService: GitService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', requirePermission('collections', 'read'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const { branch } = req.query;
      const listSchemaDir = async (directory: string) => {
        try {
          return await gitService.listFiles(projectId, directory, branch as string);
        } catch {
          return [];
        }
      };
      const [componentSchemas, typeSchemas] = await Promise.all([
        listSchemaDir('schemas/components'),
        listSchemaDir('schemas/types'),
      ]);
      const schemas = [...componentSchemas, ...typeSchemas].sort((a, b) => a.path.localeCompare(b.path));
      ok(res, { schemas });
    } catch (error) {
      logger.error({ msg: 'List schemas error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get('/types', requirePermission('collections', 'read'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const { branch } = req.query;
      const schemas = await gitService.listFiles(projectId, 'schemas/types', branch as string);
      ok(res, { schemas });
    } catch (error) {
      logger.error({ msg: 'List type schemas error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get('/components', requirePermission('collections', 'read'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const { branch } = req.query;
      const schemas = await gitService.listFiles(projectId, 'schemas/components', branch as string);
      ok(res, { schemas });
    } catch (error) {
      logger.error({ msg: 'List component schemas error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get('/*', requirePermission('collections', 'read'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const schemaPath = req.params[0];
      const { branch } = req.query;
      if (!schemaPath || schemaPath.includes('..')) {
        respondValidationError(res, 'Invalid schema path');
        return;
      }
      const normalizedPath = normalizeSchemaPath(schemaPath, 'components');
      if (!/\.json$/i.test(normalizedPath)) {
        respondValidationError(res, 'Schema files must use .json extension.');
        return;
      }

      const content = await gitService.readFile(projectId, normalizedPath, branch as string);
      if (content === null) {
        notFound(res, 'Schema not found');
        return;
      }
      ok(res, { path: normalizedPath, content });
    } catch (error) {
      logger.error({ msg: 'Read schema error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.post('/*', requirePermission('collections', 'update'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const schemaPath = req.params[0];
      const user = req.user!;
      if (!schemaPath || schemaPath.includes('..')) {
        respondValidationError(res, 'Invalid schema path');
        return;
      }
      const normalizedPath = normalizeSchemaPath(schemaPath, 'components');
      if (!/\.json$/i.test(normalizedPath)) {
        respondValidationError(res, 'Schema files must use .json extension.');
        return;
      }

      const contentValidation = pageContentSchema.safeParse(req.body);
      if (!contentValidation.success) {
        respondValidationError(res, 'Invalid content', contentValidation.error.errors);
        return;
      }

      const { content, message } = contentValidation.data;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        branch: typeof req.query.branch === 'string' ? req.query.branch : null,
        resourceType: 'schema',
        resourceId: normalizedPath,
      }))) {
        return;
      }
      await saveSchema({
        projectId,
        path: normalizedPath,
        actor: { id: user.id, name: user.name, email: user.email },
      }, content, message, { gitService });

      ok(res, { path: normalizedPath, message: 'Schema saved successfully' });
    } catch (error) {
      if (isLifecycleHookError(error)) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Write schema error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.delete('/*', requirePermission('collections', 'update'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const schemaPath = req.params[0];
      const user = req.user!;
      if (!schemaPath || schemaPath.includes('..')) {
        respondValidationError(res, 'Invalid schema path');
        return;
      }
      const normalizedPath = normalizeSchemaPath(schemaPath, 'types');
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        branch: typeof req.query.branch === 'string' ? req.query.branch : null,
        resourceType: 'schema',
        resourceId: normalizedPath,
      }))) {
        return;
      }
      await deleteSchema({
        projectId,
        path: normalizedPath,
        actor: { id: user.id, name: user.name, email: user.email },
      }, { gitService });
      ok(res, { path: normalizedPath, message: 'Schema deleted successfully' });
    } catch (error) {
      if (isLifecycleHookError(error)) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Delete schema error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  return router;
}
