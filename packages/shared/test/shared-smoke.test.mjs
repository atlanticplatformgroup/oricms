import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_PREVIEW_ENVIRONMENT_ID,
  getCollectionBrowseFields,
  getValueAtPath,
  normalizeProjectSettingsForStorage,
  validateSchemaFieldOptionConstraints,
  withLegacyPreviewEnvironment,
} from '../dist/index.js';

test('withLegacyPreviewEnvironment backfills a preview environment from previewUrl', () => {
  const settings = withLegacyPreviewEnvironment({
    previewUrl: 'https://preview.example.com',
  });

  assert.equal(settings.environments.length, 1);
  assert.deepEqual(settings.environments[0], {
    id: LEGACY_PREVIEW_ENVIRONMENT_ID,
    name: 'Preview',
    url: 'https://preview.example.com',
    type: 'preview',
    order: 0,
  });
  assert.equal(settings.defaultEnvironmentId, LEGACY_PREVIEW_ENVIRONMENT_ID);
});

test('normalizeProjectSettingsForStorage removes previewUrl after normalization', () => {
  const settings = normalizeProjectSettingsForStorage({
    previewUrl: 'https://preview.example.com',
  });

  assert.equal('previewUrl' in settings, false);
  assert.equal(settings.environments.length, 1);
});

test('getCollectionBrowseFields prefers configured display fields before fallbacks', () => {
  const fields = getCollectionBrowseFields({
    name: 'post',
    fields: [
      { key: 'body', type: 'richtext', label: 'Body' },
      { key: 'slug', type: 'uid', label: 'Slug' },
      { key: 'title', type: 'string', label: 'Title' },
      { key: 'published', type: 'boolean', label: 'Published' },
    ],
    display: {
      primary: 'title',
      secondary: 'slug',
    },
  });

  assert.deepEqual(fields.map((field) => field.key), ['title', 'slug', 'published']);
});

test('getValueAtPath resolves nested object and array segments', () => {
  const value = getValueAtPath(
    {
      seo: {
        alternates: [{ url: 'https://example.com/fr' }],
      },
    },
    'seo.alternates[0].url',
  );

  assert.equal(value, 'https://example.com/fr');
});

test('validateSchemaFieldOptionConstraints reports invalid configured values', () => {
  const errors = validateSchemaFieldOptionConstraints(
    {
      key: 'coverImage',
      type: 'image',
      label: 'Cover image',
      options: {
        accept: ['image/png'],
      },
    },
    'hero.jpg',
    'coverImage',
  );

  assert.deepEqual(errors, ['coverImage must match allowed file types: image/png']);
});
