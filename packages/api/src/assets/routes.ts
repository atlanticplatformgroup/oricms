/**
 * Asset Routes - Image and file management
 * 
 * Stores assets in git repo under assets/ directory
 * Supports: images (jpg, png, gif, svg, webp), documents (pdf)
 */
import { Router, type Response } from 'express';
import { requirePermission } from '../permissions/middleware';
import { GitAssetService } from './service';
import { logger } from '../middleware/logger';
import { badRequest, created, internalError, notFound, ok, lifecycleBlocked, unauthorized } from '../lib/responses';
import { LifecycleHookError } from '../plugins/dispatcher';
import { uploadAsset } from '../application/assets/upload-asset';
import { updateAssetMetadata } from '../application/assets/update-asset-metadata';
import { deleteAsset } from '../application/assets/delete-asset';
import * as fs from 'fs';
import {
  buildAssetActor,
  buildAssetListPayload,
  buildAssetPayload,
  normalizeMetadataUpdate,
  normalizeUploadAssetInput,
  parseAssetListOptions,
  resolveRawAssetFile,
} from './route-support';

const router = Router({ mergeParams: true });
const assetService = new GitAssetService();

function respondLifecycleBlocked(res: Response, error: Error) {
  lifecycleBlocked(res, error.message);
}

/**
 * GET /api/v1/projects/:id/assets/raw/:path
 * Serve raw asset binary
 */
router.get(
  '/raw/:path(*)',
  requirePermission('assets', 'read'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const assetPath = req.params.path;

      const asset = await assetService.getAsset(projectId, assetPath);

      if (!asset) {
        notFound(res, 'Asset not found');
        return;
      }

      const rawAsset = resolveRawAssetFile(projectId, assetPath);
      if (!rawAsset) {
        notFound(res, 'File not found on disk');
        return;
      }

      res.setHeader('Content-Type', rawAsset.contentType);
      // Raw asset binaries are intentionally embedded cross-origin by the web app in dev/prod.
      // Helmet defaults CORP to same-origin, which blocks <img> loads from the separate API origin.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const stream = fs.createReadStream(rawAsset.fullPath);
      stream.pipe(res);
    } catch (error) {
      logger.error({ msg: 'Raw asset error', error });
      internalError(res, 'Failed to serve raw asset', 'ASSET_ERROR');
    }
  }
);

/**
 * GET /api/v1/projects/:id/assets
...
 * List all assets
 */
router.get(
  '/',
  requirePermission('assets', 'read'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const result = await assetService.listAssets(projectId, parseAssetListOptions(req.query as Record<string, unknown>));

      ok(res, buildAssetListPayload(result));
    } catch (error) {
      logger.error({ msg: 'List assets error', error });
      internalError(res, 'Failed to list assets', 'ASSET_ERROR');
    }
  }
);

/**
 * POST /api/v1/projects/:id/assets/upload
 * Upload a new asset
 */
router.post(
  '/upload',
  requirePermission('assets', 'create'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const user = req.user;

      const normalizedInput = normalizeUploadAssetInput((req.body || {}) as Record<string, unknown>);
      if (normalizedInput.error || !normalizedInput.input) {
        badRequest(res, normalizedInput.error?.message ?? 'Invalid asset upload payload', normalizedInput.error?.code ?? 'INVALID_REQUEST');
        return;
      }

      const { asset } = await uploadAsset(
        {
          projectId,
          actor: buildAssetActor(user),
        },
        normalizedInput.input,
        {
          audit: {
            userId: user.id,
            action: 'asset.upload',
          },
        },
        { assetService },
      );

      created(res, { asset });
    } catch (error: unknown) {
      if (error instanceof LifecycleHookError) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Upload asset error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to upload asset', 'UPLOAD_ERROR');
    }
  }
);

/**
 * GET /api/v1/projects/:id/assets/:path
 * Get asset data
 */
router.get(
  '/:path(*)',
  requirePermission('assets', 'read'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const assetPath = req.params.path;

      const asset = await assetService.getAsset(projectId, assetPath);

      if (!asset) {
        notFound(res, 'Asset not found');
        return;
      }

      ok(res, {
        asset: buildAssetPayload(asset),
        resourceCollectionId: buildAssetPayload(asset).resourceCollectionId,
      });
    } catch (error) {
      logger.error({ msg: 'Get asset error', error });
      internalError(res, 'Failed to get asset', 'ASSET_ERROR');
    }
  }
);

/**
 * DELETE /api/v1/projects/:id/assets/:path
 * Delete an asset
 */
router.delete(
  '/:path(*)',
  requirePermission('assets', 'delete'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const assetPath = req.params.path;
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const user = req.user;

      await deleteAsset(
        {
          projectId,
          actor: buildAssetActor(user),
        },
        assetPath,
        {
          audit: {
            userId: user.id,
            action: 'asset.delete',
          },
        },
        { assetService },
      );

      ok(res, { message: 'Asset deleted successfully' });
    } catch (error) {
      if (error instanceof LifecycleHookError) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Delete asset error', error });
      internalError(res, 'Failed to delete asset', 'DELETE_ERROR');
    }
  }
);

/**
 * PUT /api/v1/projects/:id/assets/metadata/:path(*)
 * Update asset metadata
 */
router.put(
  '/metadata/:path(*)',
  requirePermission('assets', 'update'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const assetPath = req.params.path;
      const metadata = normalizeMetadataUpdate((req.body || {}) as Record<string, unknown>);
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const user = req.user;

      const { metadata: updated } = await updateAssetMetadata(
        {
          projectId,
          actor: buildAssetActor(user),
        },
        assetPath,
        metadata,
        {
          audit: {
            userId: user.id,
            action: 'asset.updateMetadata',
          },
        },
        { assetService },
      );

      ok(res, { metadata: updated });
    } catch (error) {
      if (error instanceof LifecycleHookError) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Update asset metadata error', error });
      internalError(res, 'Failed to update asset metadata', 'METADATA_ERROR');
    }
  }
);

export default router;
