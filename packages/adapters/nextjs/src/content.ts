import YAML from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import glob from 'fast-glob';

export interface CollectionConfig {
  id: string;
  label: string;
  routing?: {
    enabled?: boolean;
    slugPattern?: string;
    homepageId?: string;
  };
}

export interface Page {
  $id: string;
  $schema: string;
  $status: 'draft' | 'published';
  $createdAt: string;
  $updatedAt: string;
  $publishedAt?: string;
  metadata: {
    title: string;
    description?: string;
    slug?: string;
    publishedAt?: string;
    collectionId?: string;
    contentType?: string;
    sourceEntryId?: string;
    [key: string]: unknown;
  };
  components: Component[];
  content?: string;
}

export interface Component {
  $id: string;
  $type: string;
  props: Record<string, unknown>;
}

export interface Schema {
  $id: string;
  $schema: string;
  name: string;
  description?: string;
  fields: SchemaField[];
}

export interface SchemaField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Record<string, unknown>;
  fields?: SchemaField[];
}

export interface LoadContentOptions {
  contentPath: string;
  type?: string;
  preview?: boolean;
  limit?: number;
}

interface ModernCollectionConfig {
  id: string;
  label?: string;
  contentType: string;
  path?: string;
  routing?: {
    enabled?: boolean;
    slugPattern?: string;
    homepageId?: string;
  };
}

interface ModernEntryRecord {
  $id?: string;
  id?: string;
  $type?: string;
  $status?: 'draft' | 'published';
  $createdAt?: string;
  $updatedAt?: string;
  $publishedAt?: string;
  title?: string;
  name?: string;
  slug?: string;
  body?: string;
  content?: string;
  markdownBody?: string;
  bodytext?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  components?: Component[];
  [key: string]: unknown;
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

function normalizePageType(page: Page): string {
  return (
    page.metadata.contentType
    || page.metadata.collectionId
    || page.$schema.split('/').filter(Boolean).pop()
    || 'entry'
  );
}

export async function loadContent(options: LoadContentOptions): Promise<Page[]> {
  const isPreview = options.preview ?? process.env.ORICMS_PREVIEW === 'true';
  const pages = await loadModernEntries(options.contentPath);
  const normalizedPages = pages.length > 0 ? pages : await loadLegacyPages(options.contentPath);

  const filteredPages = normalizedPages.filter((page) => {
    if (options.type && normalizePageType(page) !== options.type && !page.$schema.includes(options.type)) {
      return false;
    }

    if (!isPreview && page.$status === 'draft') {
      return false;
    }

    return true;
  });

  filteredPages.sort((a, b) => {
    const aDate = a.metadata.publishedAt ? new Date(a.metadata.publishedAt) : new Date(0);
    const bDate = b.metadata.publishedAt ? new Date(b.metadata.publishedAt) : new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

  if (options.limit) {
    return filteredPages.slice(0, options.limit);
  }

  return filteredPages;
}

export async function loadPage(contentPath: string, slug: string, preview?: boolean): Promise<Page | null> {
  const pages = await loadContent({ contentPath, preview });
  return pages.find((page) => page.metadata.slug === slug || page.$id === slug) || null;
}

export async function loadCollectionRoot(contentPath: string, collectionId: string): Promise<Page | null> {
  try {
    const configPath = path.join(contentPath, 'oricms', 'collections.json');
    const content = await fs.readFile(configPath, 'utf-8');
    const collections = JSON.parse(content) as ModernCollectionConfig[];
    const config = collections.find((collection) => collection.id === collectionId);

    if (config?.routing?.homepageId) {
      return loadPage(contentPath, config.routing.homepageId);
    }
  } catch (error) {
    console.warn(`Failed to load collection root for ${collectionId}:`, err);
  }

  return null;
}

export async function loadSchemas(contentPath: string): Promise<Schema[]> {
  const modernSchemasDir = path.join(contentPath, 'schemas', 'types');
  const schemas: Schema[] = [];

  if (await pathExists(modernSchemasDir)) {
    const files = await glob('**/*.json', {
      cwd: modernSchemasDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const parsed = JSON.parse(content) as {
          $id?: string;
          $schema?: string;
          name?: string;
          label?: string;
          description?: string;
          fields?: Array<SchemaField>;
        };
        schemas.push({
          $id: parsed.$id || path.basename(file, '.json'),
          $schema: parsed.$schema || 'content-type-v1',
          name: parsed.name || parsed.label || path.basename(file, '.json'),
          description: parsed.description,
          fields: (parsed.fields || []).map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options,
            fields: field.fields,
          })),
        });
      } catch (error) {
        console.warn(`Failed to parse schema ${file}:`, err);
      }
    }

    return schemas;
  }

  const schemasDir = path.join(contentPath, 'schemas', 'components');
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
      } catch (error) {
        console.warn(`Failed to parse schema ${file}:`, err);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return schemas;
}

async function loadModernEntries(contentPath: string): Promise<Page[]> {
  const collectionsPath = path.join(contentPath, 'oricms', 'collections.json');
  if (!(await pathExists(collectionsPath))) {
    return [];
  }

  const rawCollections = await fs.readFile(collectionsPath, 'utf-8');
  const collections = JSON.parse(rawCollections) as ModernCollectionConfig[];
  const pages: Page[] = [];

  for (const collection of collections) {
    const collectionDir = path.join(contentPath, 'content', collection.path || collection.id);
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
        const metadata: Page['metadata'] = {
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
        };

        pages.push({
          $id: entryId,
          $schema: `collection/${collection.contentType}`,
          $status: entry.$status === 'draft' ? 'draft' : 'published',
          $createdAt: entry.$createdAt || new Date(0).toISOString(),
          $updatedAt: entry.$updatedAt || entry.$createdAt || new Date(0).toISOString(),
          ...(entry.$publishedAt ? { $publishedAt: entry.$publishedAt } : {}),
          metadata,
          components: Array.isArray(entry.components) ? entry.components : [],
          content: body,
        });
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, err);
      }
    }
  }

  return pages;
}

async function loadLegacyPages(contentPath: string): Promise<Page[]> {
  const pagesDir = path.join(contentPath, 'content', 'pages');
  if (!(await pathExists(pagesDir))) {
    return [];
  }

  const files = await glob('**/*.{yaml,yml,md}', {
    cwd: pagesDir,
    absolute: true,
  });

  const pages: Page[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const ext = path.extname(file);
      let page: Page;

      if (ext === '.md') {
        const { frontmatter, body } = parseMarkdown(content);
        page = {
          $id: (frontmatter.$id as string) || path.basename(file, '.md'),
          $schema: (frontmatter.$schema as string) || 'page-v1',
          $status: (frontmatter.$status as Page['$status']) || 'published',
          $createdAt: (frontmatter.$createdAt as string) || new Date(0).toISOString(),
          $updatedAt: (frontmatter.$updatedAt as string) || new Date(0).toISOString(),
          $publishedAt: frontmatter.$publishedAt as string | undefined,
          metadata: (frontmatter.metadata as Page['metadata']) || { title: 'Untitled' },
          components: (frontmatter.components as Page['components']) || [],
          content: body,
        };
      } else {
        const parsed = YAML.parse(content) as Record<string, unknown>;
        page = {
          $id: String(parsed.$id || path.basename(file, ext)),
          $schema: String(parsed.$schema || 'page-v1'),
          $status: (parsed.$status as Page['$status']) || 'published',
          $createdAt: (parsed.$createdAt as string) || new Date(0).toISOString(),
          $updatedAt: (parsed.$updatedAt as string) || new Date(0).toISOString(),
          $publishedAt: parsed.$publishedAt as string | undefined,
          metadata: (parsed.metadata as Page['metadata']) || { title: 'Untitled' },
          components: (parsed.components as Page['components']) || [],
        };
      }

      pages.push(page);
    } catch (error) {
      console.warn(`Failed to parse ${file}:`, err);
    }
  }

  return pages;
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
