import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { NextjsAdapter } from '../nextjs.js';
import type { Page, Schema } from '../../lib/types.js';

const TEST_DIR = path.join(os.tmpdir(), 'oricms-nextjs-test-' + Date.now());

const mockSchema: Schema = {
  $id: 'schema-1',
  $schema: 'schema-v1',
  name: 'blog-post',
  description: 'A blog post',
  fields: [
    { key: 'title', label: 'Title', type: 'string', required: true },
    { key: 'body', label: 'Body', type: 'richtext' },
    { key: 'count', label: 'Count', type: 'number' },
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
  content: '# Hello World',
};

describe('NextjsAdapter', () => {
  let adapter: NextjsAdapter;

  beforeEach(async () => {
    adapter = new NextjsAdapter();
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
      expect(adapter.name).toBe('@oricms/nextjs');
      expect(adapter.version).toBe('1.0.0');
    });

    it('should accept custom config', () => {
      const custom = new NextjsAdapter({ collectionsDir: 'data', format: 'md' });
      expect(custom.name).toBe('@oricms/nextjs');
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
      const outputPath = path.join(TEST_DIR, 'lib', 'types', 'oricms.ts');
      await adapter.generateTypes([mockSchema], outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('export interface BlogPost {');
      expect(content).toContain('title: string;');
      expect(content).toContain('body?: string;');
      expect(content).toContain('count?: number;');
    });

    it('should generate Entry and PageMetadata interfaces', async () => {
      const outputPath = path.join(TEST_DIR, 'lib', 'types', 'oricms.ts');
      await adapter.generateTypes([], outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('export interface Entry<T = unknown> {');
      expect(content).toContain('export interface PageMetadata {');
      expect(content).toContain('collectionId?: string;');
      expect(content).toContain('contentType?: string;');
    });
  });

  describe('transformPages', () => {
    it('should transform pages to json by default', async () => {
      const result = await adapter.transformPages([mockPage], { outputDir: TEST_DIR });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('json');
      expect(result[0].path).toContain('hello-world.json');
      const parsed = JSON.parse(result[0].content);
      expect(parsed.$id).toBe('page-1');
      expect(parsed.metadata.title).toBe('Hello World');
    });

    it('should transform pages to markdown when configured', async () => {
      const mdAdapter = new NextjsAdapter({ format: 'md' });
      const result = await mdAdapter.transformPages([mockPage], { outputDir: TEST_DIR });

      expect(result[0].type).toBe('markdown');
      expect(result[0].path).toContain('.md');
      expect(result[0].content).toContain('---');
    });

    it('should group pages by contentType', async () => {
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
  });

  describe('generateConfig', () => {
    it('should generate oricms.ts helper for app router', async () => {
      // Create app directory to simulate app router
      await fs.mkdir(path.join(TEST_DIR, 'app'), { recursive: true });

      await adapter.generateConfig({ outputDir: TEST_DIR });

      const helperPath = path.join(TEST_DIR, 'src', 'lib', 'oricms.ts');
      const content = await fs.readFile(helperPath, 'utf-8');

      expect(content).toContain('export async function getCollection');
      expect(content).toContain('export async function getEntry');
      expect(content).toContain("const CONTENT_DIR = path.join(process.cwd(), 'content', 'entries');");
    });

    it('should generate oricms.ts helper for pages router', async () => {
      // No app directory = pages router
      await adapter.generateConfig({ outputDir: TEST_DIR });

      const helperPath = path.join(TEST_DIR, 'lib', 'oricms.ts');
      const content = await fs.readFile(helperPath, 'utf-8');

      expect(content).toContain('export async function getCollection');
      expect(content).toContain('export async function getEntry');
    });
  });

  describe('postExport', () => {
    it('should generate GITCMS.md readme', async () => {
      await adapter.postExport({ outputDir: TEST_DIR });

      const readmePath = path.join(TEST_DIR, 'GITCMS.md');
      const content = await fs.readFile(readmePath, 'utf-8');

      expect(content).toContain('# OriCMS Content');
      expect(content).toContain('getCollection');
      expect(content).toContain('getEntry');
      expect(content).toContain('App Router');
    });
  });
});
