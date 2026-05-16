/**
 * CDN Storage Providers - S3-compatible (works with S3, R2, MinIO)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export interface StorageConfig {
  provider: 's3' | 'r2' | 'minio';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  baseUrl?: string;
  accountId?: string;
  zoneId?: string;
  apiToken?: string;
  distributionId?: string;
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
  uploadFile(key: string, filePath: string, contentType: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  deleteMany(keys: string[]): Promise<void>;
  getUrl(key: string): string;
  invalidateCache?(keys: string[]): Promise<void>;
}

/**
 * S3-compatible storage provider
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
      forcePathStyle: !!config.endpoint,
    });
  }

  async invalidateCache(keys: string[]): Promise<void> {
    if (!this.config.distributionId) return;

    const { CloudFrontClient, CreateInvalidationCommand } = await import('@aws-sdk/client-cloudfront');
    const cloudFront = new CloudFrontClient({
      region: this.config.region || 'auto',
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      }
    });

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

      await cloudFront.send(command);
    }
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

  async uploadFile(key: string, filePath: string, contentType: string): Promise<UploadResult> {
    const stream = createReadStream(filePath);

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: stream as unknown as ReadableStream,
      ContentType: contentType,
    });

    const result = await this.client.send(command);

    // Get file size
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);

    return {
      key,
      url: this.getUrl(key),
      size: stats.size,
      etag: result.ETag,
    };
  }

  async delete(key: string): Promise<void> {
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

    if (this.config.endpoint) {
      return `${this.config.endpoint.replace(/\/$/, '')}/${this.config.bucket}/${key}`;
    }

    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }
}

/**
 * Cloudflare R2 Provider
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
 * Factory to create storage provider
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

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
