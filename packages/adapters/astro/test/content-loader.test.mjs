import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadContent, loadPage, loadSchemas } from '../dist/content.js';

async function createFixtureRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oricms-astro-adapter-'));

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

test('loads collections-based OriCMS entries and modern schemas', async (t) => {
  const repoRoot = await createFixtureRepo();
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const entries = await loadContent({ contentPath: repoRoot, preview: false });
  const schemas = await loadSchemas(repoRoot);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.$id).sort(),
    ['hello-world', 'jane-editor'],
  );

  const publishedPost = entries.find((entry) => entry.$id === 'hello-world');
  assert.ok(publishedPost);
  assert.equal(publishedPost.$schema, 'collection/blog-post');
  assert.equal(publishedPost.metadata.collectionId, 'blog-posts');
  assert.equal(publishedPost.metadata.contentType, 'blog-post');
  assert.equal(publishedPost.metadata.sourceEntryId, 'hello-world');
  assert.equal(publishedPost.content, 'Published body');

  assert.equal(schemas.length, 1);
  assert.equal(schemas[0].$id, 'blog-post');
  assert.equal(schemas[0].fields[1].type, 'uid');
});

test('preview mode includes drafts while published mode filters them out', async (t) => {
  const repoRoot = await createFixtureRepo();
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const publishedEntries = await loadContent({ contentPath: repoRoot, preview: false });
  const previewEntries = await loadContent({ contentPath: repoRoot, preview: true });

  assert.equal(publishedEntries.some((entry) => entry.$id === 'draft-post'), false);
  assert.equal(previewEntries.some((entry) => entry.$id === 'draft-post'), true);

  const draftEntry = previewEntries.find((entry) => entry.$id === 'draft-post');
  assert.ok(draftEntry);
  assert.equal(draftEntry.$status, 'draft');
  assert.equal(draftEntry.content, 'Draft body');
});

test('loadPage respects preview filtering and resolves by slug', async (t) => {
  const repoRoot = await createFixtureRepo();
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const publishedPage = await loadPage(repoRoot, 'hello-world', false);
  const hiddenDraft = await loadPage(repoRoot, 'draft-post', false);
  const previewDraft = await loadPage(repoRoot, 'draft-post', true);

  assert.ok(publishedPage);
  assert.equal(publishedPage.$id, 'hello-world');
  assert.equal(hiddenDraft, null);
  assert.ok(previewDraft);
  assert.equal(previewDraft.$id, 'draft-post');
});
