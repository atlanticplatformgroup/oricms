/**
 * CDN Storage Providers - S3, R2, and other object storage
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

export interface StorageConfig {
  provider: 's3' | 'r2' | 'minio';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  baseUrl?: string;
  // CloudFront/Cloudflare for cache invalidation
  distributionId?: string;
  accountId?: string;
  apiToken?: string;
  zoneId?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  etag?: string;
}

export interface StorageProvider {
  name: string;
  upload(key: string, content: Buffer, contentType: string): Promise<UploadResult>;
  uploadStream(key: string, stream: NodeJS.ReadableStream, contentType: string, size: number): Promise<UploadResult>;
  remove(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  deleteMany(keys: string[]): Promise<void>;
  getUrl(key: string): string;
  invalidateCache?(keys: string[]): Promise<void>;
}

/**
 * S3-compatible storage provider (works with AWS S3, Cloudflare R2, MinIO)
 */
export class S3Provider implements StorageProvider {
  name = 's3';
  protected client: S3Client;
  protected config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;

    this.client = new S3Client({
      region: config.region || 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Required for R2 and MinIO
      forcePathStyle: !!config.endpoint,
    });
  }

  async upload(key: string, content: Buffer, contentType: string): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    const result = await this.client.send(command);

    return {
      key,
      url: this.getUrl(key),
      size: content.length,
      etag: result.ETag,
    };
  }

  async uploadStream(
    key: string,
    stream: NodeJS.ReadableStream,
    contentType: string,
    size: number
  ): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: stream as any,
      ContentType: contentType,
      ContentLength: size,
    });

    const result = await this.client.send(command);

    return {
      key,
      url: this.getUrl(key),
      size,
      etag: result.ETag,
    };
  }

  async remove(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const result = await this.client.send(command);

      if (result.Contents) {
        keys.push(...result.Contents.map(obj => obj.Key!));
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    // S3 supports max 1000 keys per delete request
    const chunks = chunkArray(keys, 1000);

    for (const chunk of chunks) {
      const command = new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: {
          Objects: chunk.map(key => ({ Key: key })),
        },
      });

      await this.client.send(command);
    }
  }

  getUrl(key: string): string {
    if (this.config.baseUrl) {
      return `${this.config.baseUrl.replace(/\/$/, '')}/${key}`;
    }

    // Standard S3 URL
    if (this.config.endpoint) {
      return `${this.config.endpoint.replace(/\/$/, '')}/${this.config.bucket}/${key}`;
    }

    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Invalidate CloudFront cache (AWS S3 only)
   */
  async invalidateCache(keys: string[]): Promise<void> {
    if (!this.config.distributionId) return;

    // Import CloudFront client dynamically
    const { CloudFrontClient, CreateInvalidationCommand } = await import('@aws-sdk/client-cloudfront');

    const cloudfront = new CloudFrontClient({
      region: this.config.region || 'us-east-1',
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });

    // CloudFront allows up to 3000 paths per invalidation request
    const chunks = chunkArray(keys, 3000);

    for (const chunk of chunks) {
      const command = new CreateInvalidationCommand({
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          CallerReference: `oricms-export-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          Paths: {
            Quantity: chunk.length,
            Items: chunk.map(key => `/${key}`),
          },
        },
      });
      await cloudfront.send(command);
    }
  }
}

/**
 * Cloudflare R2 Provider (extends S3 with specific defaults)
 */
export class R2Provider extends S3Provider {
  name = 'r2';

  constructor(config: StorageConfig) {
    super({
      ...config,
      region: 'auto',
      endpoint: config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`,
    });
  }

  /**
   * Purge Cloudflare cache via API
   */
  async invalidateCache(keys: string[]): Promise<void> {
    if (!this.config.zoneId || !this.config.apiToken) return;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: keys.map(key => this.getUrl(key)),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare cache purge failed: ${response.statusText}`);
    }
  }
}

/**
 * Factory to create storage provider from config
 */
export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 'r2':
      return new R2Provider(config);
    case 's3':
    case 'minio':
    default:
      return new S3Provider(config);
  }
}

// Helper function
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
