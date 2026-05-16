import type { AssetMetadata, AssetUsageDetail, AssetUsageSummary } from '@ori/shared';

export interface CommitOptions {
  author: {
    name: string;
    email: string;
  };
  message: string;
}

export interface Asset {
  path: string;
  name: string;
  folder: string;
  size: number;
  type: string;
  url: string;
  lastModified: string;
  metadata?: AssetMetadata;
  usage?: AssetUsageSummary;
  usageDetail?: AssetUsageDetail;
}

export interface AssetListOptions {
  folder?: string;
  tag?: string;
  usage?: 'all' | 'used' | 'unused';
  search?: string;
  sort?: 'newest' | 'oldest' | 'name' | 'size';
  limit?: number;
  offset?: number;
}

export interface AssetListResult {
  assets: Asset[];
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
