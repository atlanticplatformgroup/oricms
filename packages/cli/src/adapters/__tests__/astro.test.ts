import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AstroAdapter } from '../astro.js';
import type { Page, Schema } from '../../lib/types.js';

const TEST_DIR = path.join(os.tmpdir(), 'oricms-astro-test-' + Date.now());

const mockSchema: Schema = {
  $id: 'schema-1',
  $schema: 'schema-v1',
  name: 'blog-post',
  description: 'A blog post',
  fields: [
    { key: 'title', label: 'Title', type: 'string', required: true },
    { key: 'body', label: 'Body', type: 'richtext' },
    { key: 'published', label: 'Published', type: 'boolean', required: false },
    { key: 'tags', label: 'Tags', type: 'array', options: { itemType: 'string' } },
  ],
};

const mockPage: Page = {
  $id: 'page-1',
  $schema: 'schema-v1/blog-post',
  $status: 'published',
  $createdAt: '2024-01-01T00:00:00Z',
  metadata: {
    title: 'Hello World',
    slug: 'hello-world',
    contentType: 'blog-post',
  },
  components: [
    { $id: 'comp-1', $type: 'heading', props: { text: 'Hello' } },
  ],
  content: '# Hello World\n\nThis is a test post.',
};

describe('AstroAdapter', () => {
  let adapter: AstroAdapter;

  beforeEach(async () => {
    adapter = new AstroAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should use default config', () => {
      expect(adapter.name).toBe('@oricms/astro');
      expect(adapter.version).toBe('1.0.0');
    });

    it('should accept custom config', () => {
      const custom = new AstroAdapter({ collectionsDir: 'custom/content', format: 'json' });
      expect(custom.name).toBe('@oricms/astro');
    });
  });

  describe('validate', () => {
    it('should return true with valid outputDir', async () => {
      const result = await adapter.validate({ outputDir: TEST_DIR });
      expect(result).toBe(true);
    });

    it('should throw without outputDir', async () => {
      await expect(adapter.validate({} as any)).rejects.toThrow('outputDir is required');
    });
  });

  describe('generateTypes', () => {
    it('should generate TypeScript interfaces', async () => {
      const outputPath = path.join(TEST_DIR, 'types', 'oricms.ts');
      await adapter.generateTypes([mockSchema], outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('export interface BlogPost {');
      expect(content).toContain('title: string;');
      expect(content).toContain('body?: string;');
      expect(content).toContain('published?: boolean;');
      expect(content).toContain('tags?: string[];');
      expect(content).toContain("$schema: 'schema-v1';");
    });

    it('should generate union type for multiple schemas', async () => {
      const schema2: Schema = {
        ...mockSchema,
        $id: 'schema-2',
        name: 'article',
        fields: [{ key: 'headline', label: 'Headline', type: 'string', required: true }],
      };

      const outputPath = path.join(TEST_DIR, 'types', 'oricms.ts');
      await adapter.generateTypes([mockSchema, schema2], outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('export type AnySchema = BlogPost | Article;');
    });

    it('should generate Entry and PageMetadata interfaces', async () => {
      const outputPath = path.join(TEST_DIR, 'types', 'oricms.ts');
      await adapter.generateTypes([], outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('export interface Entry<T = unknown> {');
      expect(content).toContain('export interface PageMetadata {');
      expect(content).toContain('title: string;');
    });
  });

  describe('transformPages', () => {
    it('should transform pages to markdown by default', async () => {
      const result = await adapter.transformPages([mockPage], { outputDir: TEST_DIR });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('markdown');
      expect(result[0].path).toContain('hello-world.md');
      expect(result[0].content).toContain('---');
      expect(result[0].content).toContain('Hello World');
    });

    it('should transform pages to json when configured', async () => {
      const jsonAdapter = new AstroAdapter({ format: 'json' });
      const result = await jsonAdapter.transformPages([mockPage], { outputDir: TEST_DIR });

      expect(result[0].type).toBe('json');
      expect(result[0].path).toContain('.json');
      const parsed = JSON.parse(result[0].content);
      expect(parsed.$id).toBe('page-1');
    });

    it('should group pages by type', async () => {
      const page2: Page = {
        ...mockPage,
        $id: 'page-2',
        $schema: 'schema-v1/article',
        metadata: { ...mockPage.metadata, title: 'Article One', contentType: 'article' },
      };

      const result = await adapter.transformPages([mockPage, page2], { outputDir: TEST_DIR });

      expect(result).toHaveLength(2);
      expect(result[0].path).toContain('/entries/blog-post/');
      expect(result[1].path).toContain('/entries/article/');
    });

    it('should generate slug from title when missing', async () => {
      const pageNoSlug: Page = {
        ...mockPage,
        metadata: { ...mockPage.metadata, slug: undefined, title: 'My Great Post!' },
      };

      const result = await adapter.transformPages([pageNoSlug], { outputDir: TEST_DIR });
      expect(result[0].path).toContain('my-great-post.md');
    });
  });

  describe('generateConfig', () => {
    it('should generate content.config.ts', async () => {
      await adapter.generateConfig({ outputDir: TEST_DIR });

      const configPath = path.join(TEST_DIR, 'content.config.ts');
      const content = await fs.readFile(configPath, 'utf-8');

      expect(content).toContain("import { defineCollection, z } from 'astro:content';");
      expect(content).toContain('entries: defineCollection({');
      expect(content).toContain("type: 'content',");
      expect(content).toContain('$id: z.string(),');
      expect(content).toContain("$status: z.enum(['draft', 'published']).optional(),");
    });
  });

  describe('postExport', () => {
    it('should generate GITCMS.md readme', async () => {
      await adapter.postExport({ outputDir: TEST_DIR });

      const readmePath = path.join(TEST_DIR, 'GITCMS.md');
      const content = await fs.readFile(readmePath, 'utf-8');

      expect(content).toContain('# OriCMS Content Collections');
      expect(content).toContain('getCollection');
      expect(content).toContain('getEntry');
    });
  });
});
