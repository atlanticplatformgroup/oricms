import { normalizeAssetMetadata, type Asset, type AssetMetadata, type AssetUsageDetail } from '@ori/shared';
import { request } from './core';
import type { GlobalAsset } from '../assets/references';

export type AssetListItem = Asset;
export interface AssetDetail extends Asset {
  usageDetail?: AssetUsageDetail;
}
export type GlobalAssetListItem = GlobalAsset;
export type GlobalAssetDetail = GlobalAsset;

export interface AssetListOptions {
  folder?: 'images' | 'documents' | 'all';
  tag?: string;
  usage?: 'all' | 'used' | 'unused';
  search?: string;
  sort?: 'newest' | 'oldest' | 'name' | 'size';
  limit?: number;
  offset?: number;
}

export interface AssetListResponse {
  assets: AssetListItem[];
  pagination: {
    total: number;
    limit: number | null;
    offset: number;
    hasMore: boolean;
  };
  facets: {
    tags: Array<{
      value: string;
      label: string;
      count: number;
    }>;
    usage: {
      used: number;
      unused: number;
    };
  };
}

export interface AssetDetailResponse {
  asset: AssetDetail;
}

export interface GlobalAssetListResponse {
  assets: GlobalAssetListItem[];
}

export interface GlobalAssetDetailResponse {
  asset: GlobalAssetDetail;
}

export const assetsApi = {
  async list(projectId: string, folderOrOptions: string | AssetListOptions = 'images'): Promise<AssetListResponse> {
    const options: AssetListOptions = typeof folderOrOptions === 'string' ? { folder: folderOrOptions as AssetListOptions['folder'] } : folderOrOptions;
    const params = new URLSearchParams();
    if (options.folder) params.set('folder', options.folder);
    if (options.tag) params.set('tag', options.tag);
    if (options.usage && options.usage !== 'all') params.set('usage', options.usage);
    if (options.search) params.set('search', options.search);
    if (options.sort) params.set('sort', options.sort);
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));
    if (typeof options.offset === 'number') params.set('offset', String(options.offset));

    const query = params.toString();
    return request(`/api/v1/projects/${projectId}/assets${query ? `?${query}` : ''}`);
  },

  async get(projectId: string, path: string): Promise<AssetDetailResponse> {
    return request(`/api/v1/projects/${projectId}/assets/${encodeURIComponent(path)}`);
  },

  async upload(
    projectId: string,
    filename: string,
    content: string,
    folder: string = 'images',
    metadata?: AssetMetadata,
  ): Promise<{ asset: Asset }> {
    return request(`/api/v1/projects/${projectId}/assets/upload`, {
      method: 'POST',
      body: { filename, content, folder, metadata: metadata ? normalizeAssetMetadata(metadata) : undefined },
    });
  },

  async delete(projectId: string, path: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}/assets/${encodeURIComponent(path)}`, { method: 'DELETE' });
  },

  async updateMetadata(projectId: string, path: string, metadata: AssetMetadata): Promise<{ metadata: AssetMetadata }> {
    return request(`/api/v1/projects/${projectId}/assets/metadata/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: normalizeAssetMetadata(metadata),
    });
  },
};

export const globalAssetsApi = {
  async list(projectId: string): Promise<GlobalAssetListResponse> {
    return request(`/api/v1/projects/${projectId}/global-assets`);
  },

  async get(projectId: string, assetId: string): Promise<GlobalAssetDetailResponse> {
    return request(`/api/v1/projects/${projectId}/global-assets/${encodeURIComponent(assetId)}`);
  },

  async upload(
    projectId: string,
    filename: string,
    content: string,
    folder: string = 'images',
    tags?: string[],
  ): Promise<{ asset: GlobalAsset }> {
    return request(`/api/v1/projects/${projectId}/global-assets/upload`, {
      method: 'POST',
      body: { filename, content, folder, tags },
    });
  },

  async updateMetadata(projectId: string, assetId: string, metadata: AssetMetadata): Promise<{ asset: GlobalAsset; metadata: AssetMetadata }> {
    return request(`/api/v1/projects/${projectId}/global-assets/metadata/${encodeURIComponent(assetId)}`, {
      method: 'PUT',
      body: normalizeAssetMetadata(metadata),
    });
  },

  async delete(projectId: string, assetId: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}/global-assets/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
    });
  },
};
