import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createNextClient, loadContent, loadPage, loadSchemas } from '../dist/index.js';

async function createFixtureRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oricms-next-adapter-'));

  await fs.mkdir(path.join(repoRoot, 'oricms'), { recursive: true });
  await fs.mkdir(path.join(repoRoot, 'schemas', 'types'), { recursive: true });
  await fs.mkdir(path.join(repoRoot, 'content', 'content', 'blog-posts'), { recursive: true });
  await fs.mkdir(path.join(repoRoot, 'content', 'content', 'authors'), { recursive: true });

  await fs.writeFile(
    path.join(repoRoot, 'oricms', 'collections.json'),
    JSON.stringify([
      {
        id: 'blog-posts',
        label: 'Blog Posts',
        contentType: 'blog-post',
        path: 'content/blog-posts',
      },
      {
        id: 'authors',
        label: 'Authors',
        contentType: 'author',
        path: 'content/authors',
      },
    ], null, 2),
    'utf8',
  );

  await fs.writeFile(
    path.join(repoRoot, 'schemas', 'types', 'blog-post.json'),
    JSON.stringify({
      $schema: 'content-type-v1',
      $id: 'blog-post',
      name: 'blog-post',
      label: 'Blog Post',
      fields: [
        { key: 'title', label: 'Title', type: 'string', required: true },
        { key: 'slug', label: 'Slug', type: 'uid', required: true },
        { key: 'markdownBody', label: 'Markdown Body', type: 'markdown' },
      ],
    }, null, 2),
    'utf8',
  );

  await fs.writeFile(
    path.join(repoRoot, 'content', 'content', 'blog-posts', 'hello-world.json'),
    JSON.stringify({
      $id: 'hello-world',
      $type: 'blog-post',
      $status: 'published',
      $createdAt: '2026-03-14T10:00:00.000Z',
      $updatedAt: '2026-03-14T10:00:00.000Z',
      $publishedAt: '2026-03-14T10:00:00.000Z',
      title: 'Hello World',
      slug: 'hello-world',
      markdownBody: 'Published body',
    }, null, 2),
    'utf8',
  );

  await fs.writeFile(
    path.join(repoRoot, 'content', 'content', 'blog-posts', 'draft-post.json'),
    JSON.stringify({
      $id: 'draft-post',
      $type: 'blog-post',
      $status: 'draft',
      $createdAt: '2026-03-14T11:00:00.000Z',
      $updatedAt: '2026-03-14T11:00:00.000Z',
      title: 'Draft Post',
      slug: 'draft-post',
      bodytext: 'Draft body',
    }, null, 2),
    'utf8',
  );

  await fs.writeFile(
    path.join(repoRoot, 'content', 'content', 'authors', 'jane-editor.json'),
    JSON.stringify({
      $id: 'jane-editor',
      $type: 'author',
      $status: 'published',
      $createdAt: '2026-03-14T09:00:00.000Z',
      $updatedAt: '2026-03-14T09:00:00.000Z',
      name: 'Jane Editor',
      slug: 'jane-editor',
      summary: 'Editor bio',
    }, null, 2),
    'utf8',
  );

  return repoRoot;
}

test('loads collections-based content and modern schemas', async (t) => {
  const repoRoot = await createFixtureRepo();
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const entries = await loadContent({ contentPath: repoRoot, preview: false });
  const schemas = await loadSchemas(repoRoot);

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.$id).sort(), ['hello-world', 'jane-editor']);
  assert.equal(entries.find((entry) => entry.$id === 'hello-world')?.content, 'Published body');
  assert.equal(schemas[0].$id, 'blog-post');
});

test('preview filtering matches published mode behavior', async (t) => {
  const repoRoot = await createFixtureRepo();
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const publishedEntries = await loadContent({ contentPath: repoRoot, preview: false });
  const previewEntries = await loadContent({ contentPath: repoRoot, preview: true });

  assert.equal(publishedEntries.some((entry) => entry.$id === 'draft-post'), false);
  assert.equal(previewEntries.some((entry) => entry.$id === 'draft-post'), true);

  const hiddenDraft = await loadPage(repoRoot, 'draft-post', false);
  const visibleDraft = await loadPage(repoRoot, 'draft-post', true);

  assert.equal(hiddenDraft, null);
  assert.equal(visibleDraft?.$id, 'draft-post');
});

test('next client helper filters by collection and preview mode', async (t) => {
  const repoRoot = await createFixtureRepo();
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const client = createNextClient({ contentPath: repoRoot });
  const publishedPosts = await client.getCollection('blog-posts');
  const previewPosts = await client.getCollection('blog-posts', { preview: true });
  const post = await client.getEntry('blog-posts', 'hello-world');

  assert.equal(publishedPosts.length, 1);
  assert.equal(previewPosts.length, 2);
  assert.equal(post?.$id, 'hello-world');
});
