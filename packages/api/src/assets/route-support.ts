import * as fs from 'fs';
import * as path from 'path';
import mime from 'mime-types';
import { normalizeAssetMetadata, type AssetMetadata } from '@ori/shared';
import type { Asset, AssetListOptions, AssetListResult } from './types';
import { getAssetWorkspacePath } from './asset-paths';
import { RESOURCE_COLLECTION_IDS } from '../resources/service';

export interface AssetRouteActor {
  id: string;
  name: string;
  email: string;
}

export interface AssetUploadInput {
  folder: string;
  filename: string;
  content: string;
  metadata?: AssetMetadata;
}

export interface AssetRouteValidationError {
  message: string;
  code: string;
}

export function buildAssetActor(user: AssetRouteActor): AssetRouteActor {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export function buildAssetPayload(asset: Asset): Asset & { resourceCollectionId: string } {
  return {
    ...asset,
    resourceCollectionId: RESOURCE_COLLECTION_IDS.assets,
  };
}

export function buildAssetListPayload(result: AssetListResult): AssetListResult & { resourceCollectionId: string } {
  return {
    ...result,
    assets: result.assets.map(buildAssetPayload),
    resourceCollectionId: RESOURCE_COLLECTION_IDS.assets,
  };
}

export function parseAssetListOptions(query: Record<string, unknown>): AssetListOptions {
  const folder = typeof query.folder === 'string' ? query.folder : 'images';
  const tag =
    typeof query.tag === 'string'
      ? query.tag
      : typeof query.metadataFolder === 'string'
        ? query.metadataFolder
        : undefined;
  const usage = typeof query.usage === 'string' ? query.usage : undefined;
  const search = typeof query.search === 'string' ? query.search : undefined;
  const sort = typeof query.sort === 'string' ? query.sort : undefined;
  const limit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : undefined;
  const offset = typeof query.offset === 'string' ? Number.parseInt(query.offset, 10) : undefined;

  return {
    folder,
    tag,
    usage: usage === 'used' || usage === 'unused' || usage === 'all' ? usage : undefined,
    search,
    sort: sort === 'oldest' || sort === 'name' || sort === 'size' || sort === 'newest' ? sort : undefined,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit || 0, 1), 100) : undefined,
    offset: Number.isFinite(offset) ? Math.max(offset || 0, 0) : undefined,
  };
}

export function normalizeUploadAssetInput(body: Record<string, unknown>): { input?: AssetUploadInput; error?: AssetRouteValidationError } {
  const filename = typeof body.filename === 'string' ? body.filename : '';
  const content = typeof body.content === 'string' ? body.content : '';

  if (!filename || !content) {
    return {
      error: {
        message: 'Filename and content are required',
        code: 'MISSING_DATA',
      },
    };
  }

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.pdf'];
  const extensionIndex = filename.lastIndexOf('.');
  const extension = extensionIndex >= 0 ? filename.toLowerCase().substring(extensionIndex) : '';
  if (!allowedExtensions.includes(extension)) {
    return {
      error: {
        message: `File type not allowed. Allowed: ${allowedExtensions.join(', ')}`,
        code: 'INVALID_TYPE',
      },
    };
  }

  if (!content.match(/^data:[a-zA-Z0-9/+.-]+;base64,/)) {
    return {
      error: {
        message: 'Content must be base64 encoded data URL',
        code: 'INVALID_FORMAT',
      },
    };
  }

  const metadata =
    body.metadata && typeof body.metadata === 'object'
      ? normalizeAssetMetadata(body.metadata as Record<string, unknown>)
      : Array.isArray(body.tags)
        ? normalizeAssetMetadata({ tags: body.tags.map((entry: unknown) => String(entry).trim()).filter(Boolean) })
        : undefined;

  return {
    input: {
      folder: typeof body.folder === 'string' ? body.folder : 'images',
      filename,
      content,
      metadata,
    },
  };
}

export function normalizeMetadataUpdate(body: Record<string, unknown>): AssetMetadata {
  return normalizeAssetMetadata(body);
}

export function resolveRawAssetFile(projectId: string, assetPath: string): { fullPath: string; contentType: string } | null {
  const fullPath = path.join(getAssetWorkspacePath(projectId), assetPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return {
    fullPath,
    contentType: mime.lookup(fullPath) || 'application/octet-stream',
  };
}
