import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import glob from 'fast-glob';
import type { ContentCollection, Page, Schema, Asset } from './types.js';

const TEMP_DIR = path.join(os.tmpdir(), 'oricms-cli');

interface RepoOptions {
  repoUrl: string;
  branch: string;
  token?: string;
}

interface ModernCollectionConfig {
  id: string;
  label?: string;
  contentType: string;
  path?: string;
}

interface ModernEntryRecord {
  $id?: string;
  id?: string;
  $status?: 'draft' | 'published';
  $createdAt?: string;
  $updatedAt?: string;
  $publishedAt?: string;
  title?: string;
  name?: string;
  slug?: string;
  body?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  components?: Page['components'];
  [key: string]: unknown;
}

export async function loadContentFromRepo(options: RepoOptions): Promise<ContentCollection> {
  const repoHash = Buffer.from(options.repoUrl).toString('base64url').slice(0, 12);
  const cloneDir = path.join(TEMP_DIR, repoHash);

  let shouldPull = false;
  try {
    await fs.access(path.join(cloneDir, '.git'));
    shouldPull = true;
  } catch {
    // Not cloned yet
  }

  const git = simpleGit();

  if (shouldPull) {
    await git.cwd(cloneDir).pull('origin', options.branch);
  } else {
    await fs.mkdir(cloneDir, { recursive: true });

    const authUrl = options.token
      ? options.repoUrl.replace('https://', `https://${options.token}@`)
      : options.repoUrl;

    await git.clone(authUrl, cloneDir, ['--branch', options.branch, '--single-branch', '--depth', '1']);
  }

  return loadContentFromLocal(cloneDir);
}

export async function loadContentFromLocal(localPath: string): Promise<ContentCollection> {
  const assetsDir = path.join(localPath, 'assets');

  const [pages, schemas, assets] = await Promise.all([
    loadPages(localPath),
    loadSchemas(localPath),
    loadAssets(assetsDir),
  ]);

  return {
    pages,
    schemas,
    assets,
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function excerpt(value: string | undefined, max = 180): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractEntryBody(entry: ModernEntryRecord): string | undefined {
  const candidates = [entry.body, entry.content, entry.markdownBody, entry.bodytext, entry.summary];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
}

async function loadPages(localPath: string): Promise<Page[]> {
  const modernCollectionsPath = path.join(localPath, 'oricms', 'collections.json');
  if (await pathExists(modernCollectionsPath)) {
    return loadModernPages(localPath, modernCollectionsPath);
  }

  return loadLegacyPages(path.join(localPath, 'content', 'pages'));
}

async function loadModernPages(localPath: string, collectionsPath: string): Promise<Page[]> {
  const collections = JSON.parse(await fs.readFile(collectionsPath, 'utf-8')) as ModernCollectionConfig[];
  const pages: Page[] = [];

  for (const collection of collections) {
    const collectionDir = path.join(localPath, 'content', collection.path || collection.id);
    if (!(await pathExists(collectionDir))) {
      continue;
    }

    const files = await glob('**/*.json', {
      cwd: collectionDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const raw = await fs.readFile(file, 'utf-8');
        const entry = JSON.parse(raw) as ModernEntryRecord;
        const entryId = String(entry.$id || entry.id || path.basename(file, '.json'));
        const body = extractEntryBody(entry);
        const title = typeof entry.title === 'string'
          ? entry.title
          : typeof entry.name === 'string'
            ? entry.name
            : entryId;
        const slug = typeof entry.slug === 'string' && entry.slug.trim()
          ? entry.slug.trim()
          : slugify(title || entryId);

        pages.push({
          $id: entryId,
          $schema: `collection/${collection.contentType}`,
          $status: entry.$status || 'published',
          $createdAt: entry.$createdAt,
          $updatedAt: entry.$updatedAt,
          $publishedAt: entry.$publishedAt,
          metadata: {
            ...(entry.metadata || {}),
            title,
            description: typeof entry.metadata?.description === 'string'
              ? String(entry.metadata.description)
              : excerpt(body),
            slug,
            publishedAt: entry.$publishedAt,
            collectionId: collection.id,
            contentType: collection.contentType,
            sourceEntryId: entryId,
          },
          components: Array.isArray(entry.components) ? entry.components : [],
          ...(body ? { content: body } : {}),
        });
      } catch (err: unknown) {
        console.warn(`Failed to parse entry ${file}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return pages;
}

async function loadLegacyPages(pagesDir: string): Promise<Page[]> {
  const pages: Page[] = [];

  try {
    const files = await glob('**/*.{yaml,yml,md}', {
      cwd: pagesDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const ext = path.extname(file);

        let page: Page;

        if (ext === '.md') {
          const { frontmatter, body } = parseMarkdown(content);
          page = {
            $id: (frontmatter.$id as string) || `page-${Date.now()}`,
            $schema: (frontmatter.$schema as string) || 'page-v1',
            $status: (frontmatter.$status as Page['$status']) || 'published',
            $createdAt: frontmatter.$createdAt as string | undefined,
            $updatedAt: frontmatter.$updatedAt as string | undefined,
            $publishedAt: frontmatter.$publishedAt as string | undefined,
            metadata: (frontmatter.metadata as Page['metadata']) || { title: 'Untitled' },
            components: (frontmatter.components as Page['components']) || [],
            ...(body ? { content: body } : {}),
          };
        } else {
          const parsed = YAML.parse(content) as Partial<Page>;
          page = {
            $id: parsed.$id || `page-${Date.now()}`,
            $schema: parsed.$schema || 'page-v1',
            $status: parsed.$status || 'published',
            $createdAt: parsed.$createdAt,
            $updatedAt: parsed.$updatedAt,
            $publishedAt: parsed.$publishedAt,
            metadata: parsed.metadata || { title: 'Untitled' },
            components: parsed.components || [],
            ...(parsed.content ? { content: parsed.content } : {}),
          };
        }

        pages.push(page);
      } catch (err: unknown) {
        console.warn(`Failed to parse page ${file}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch {
    // Directory might not exist
  }

  return pages;
}

async function loadSchemas(localPath: string): Promise<Schema[]> {
  const modernSchemasDir = path.join(localPath, 'schemas', 'types');
  if (await pathExists(modernSchemasDir)) {
    return loadModernSchemas(modernSchemasDir);
  }

  return loadLegacySchemas(path.join(localPath, 'schemas', 'components'));
}

async function loadModernSchemas(schemasDir: string): Promise<Schema[]> {
  const schemas: Schema[] = [];
  const files = await glob('**/*.json', {
    cwd: schemasDir,
    absolute: true,
  });

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const schema = JSON.parse(content) as Schema;
      schemas.push({
        $id: schema.$id || path.basename(file, '.json'),
        $schema: schema.$schema || 'content-type-v1',
        name: schema.name || path.basename(file, '.json'),
        description: schema.description,
        fields: schema.fields || [],
      });
    } catch (err: unknown) {
      console.warn(`Failed to parse schema ${file}:`, err instanceof Error ? err.message : err);
    }
  }

  return schemas;
}

async function loadLegacySchemas(schemasDir: string): Promise<Schema[]> {
  const schemas: Schema[] = [];

  try {
    const files = await glob('**/*.yaml', {
      cwd: schemasDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const schema = YAML.parse(content) as Schema;
        schemas.push(schema);
      } catch (err: unknown) {
        console.warn(`Failed to parse schema ${file}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch {
    // Directory might not exist
  }

  return schemas;
}

async function loadAssets(assetsDir: string): Promise<Asset[]> {
  const assets: Asset[] = [];

  try {
    const files = await glob('**/*', {
      cwd: assetsDir,
      absolute: true,
      onlyFiles: true,
    });

    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        assets.push({
          path: path.relative(assetsDir, file),
          name: path.basename(file),
          size: stat.size,
          mimeType: getMimeType(file),
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory might not exist
  }

  return assets;
}

function parseMarkdown(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    return {
      frontmatter: YAML.parse(match[1]) as Record<string, unknown>,
      body: match[2].trim(),
    };
  }

  return {
    frontmatter: {},
    body: content,
  };
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
