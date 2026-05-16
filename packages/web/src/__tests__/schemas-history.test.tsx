import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ContentType } from '@ori/shared';
import { MantineProvider } from '@mantine/core';
import { defaultEntriesByCollection, mocks, renderApp, setupWorkspaceTestHarness } from '../test-utils/workspaceTestHarness';
import { SchemasWorkspace } from '../components/workspace/SchemasWorkspace';
import { SCHEMA_FIELD_TYPE_GROUPS, SCHEMA_FIELD_TYPE_OPTIONS } from '../lib/workspace/constants';
import { makeSchemaField } from '../lib/schemas/factory';

setupWorkspaceTestHarness();

describe('Schemas and history', () => {
  it('surfaces schema field modeling cues for types and components', async () => {
    const schemaContentTypes: ContentType[] = [{
      $schema: 'content-type-v1', $id: 'post', name: 'post', plural: 'posts', label: 'Post', labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'faqCards', label: 'FAQ Cards', type: 'component', component: 'quote-block', repeatable: true },
        { key: 'contentBlocks', label: 'Content Blocks', type: 'blocks', options: { allowedComponents: ['callout-block', 'quote-block'] } },
        { key: 'keywords', label: 'Keywords', type: 'array' },
      ],
      display: { primary: 'title' },
    }];

    render(
      <MantineProvider>
        <SchemasWorkspace
          activeSchemaMode="types"
          onCreateSchema={() => {}}
          onSaveSchema={() => {}}
          onOpenDeleteSchema={() => {}}
          onOpenSchemaJson={() => {}}
          onOpenSchemaHistory={() => {}}
          canDeleteSchema
          canSaveSchema={false}
          isSchemaDirty={false}
          saveSchemaPending={false}
          selectedSchemaDocument={{ path: 'schemas/types/post.json', schema: schemaContentTypes[0] }}
          effectiveSchema={schemaContentTypes[0]}
          effectiveSchemaFields={schemaContentTypes[0].fields}
          schemaIssues={[]}
          fieldIssuesByKey={{}}
          validationIssueCount={0}
          newFieldGuidance="Choose the simplest field that matches the authoring need."
          schemaBusy={false}
          schemaBlockingLock={null}
          schemaLockError={null}
          onSchemaMetaChange={() => {}}
          newSchemaFieldType="string"
          onNewSchemaFieldTypeChange={() => {}}
          onAddSchemaField={() => {}}
          onReorderSchemaField={() => {}}
          onSchemaFieldPatch={() => {}}
          onRemoveSchemaField={() => {}}
          componentSchemaOptions={[
            { value: 'callout-block', label: 'Callout Block' },
            { value: 'quote-block', label: 'Quote Block' },
          ]}
          collectionOptions={[{ value: 'posts', label: 'Posts · posts' }]}
          schemaFieldTypeOptions={SCHEMA_FIELD_TYPE_OPTIONS}
          schemaFieldTypeGroups={SCHEMA_FIELD_TYPE_GROUPS}
          toLabel={(value) => value}
          makeSchemaField={makeSchemaField}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Field builder')).toBeInTheDocument();
      expect(screen.getByText('Preferred structured repeater')).toBeInTheDocument();
      expect(screen.getByText('Mixed-type content zone')).toBeInTheDocument();
      expect(screen.getByText('Primitive list only')).toBeInTheDocument();
      expect(screen.getByText('Add field')).toBeInTheDocument();
      expect(screen.getByText('New content type')).toBeInTheDocument();
      expect(screen.getAllByText('Remove').length).toBeGreaterThan(0);
      expect(screen.getByDisplayValue('FAQ Cards')).toBeInTheDocument();
      expect(screen.getByDisplayValue('faqCards')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Drag schema field').length).toBeGreaterThan(0);
    });
  });

  it('holds up under dense history data with mixed field types', async () => {
    const denseContentTypes: ContentType[] = [{
      $schema: 'content-type-v1', $id: 'post', name: 'post', plural: 'posts', label: 'Post', labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'body', label: 'Body', type: 'textarea' },
        { key: 'featured', label: 'Featured', type: 'boolean' },
        { key: 'gallery', label: 'Gallery', type: 'array' },
        { key: 'heroImage', label: 'Hero Image', type: 'media' },
        { key: 'seo', label: 'SEO', type: 'json' },
        { key: 'settings', label: 'Settings', type: 'json' },
        { key: 'tags', label: 'Tags', type: 'array' },
      ],
      display: { primary: 'title' },
    }];

    const denseEntry: CollectionEntry = {
      $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-03T00:00:00.000Z',
      title: 'Current draft title', body: 'Current draft body with a much longer editorial note.\nSecond paragraph for inspection.', featured: false,
      gallery: ['image-a.jpg', 'image-b.jpg'], heroImage: '/media/current-hero.jpg', seo: { title: 'Draft SEO', theme: 'light' },
      settings: { featured: false, audience: ['students', 'faculty'] }, tags: ['news', 'updates'],
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: denseContentTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'posts' ? [denseEntry] : defaultEntriesByCollection[collectionId || 'posts'] || [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));
    mocks.getEntryHistory.mockResolvedValue({ history: Array.from({ length: 12 }).map((_, index) => ({ hash: `revhash0${index}`, message: `Revision ${index + 1}`, author: 'Editor', date: `2026-03-${String(index + 1).padStart(2, '0')}T12:00:00.000Z` })) });
    mocks.getEntryVersion.mockImplementation(async (_projectId: string, _collectionId: string, _entryId: string, hash: string) => ({
      entry: hash === 'revhash01'
        ? { ...denseEntry, title: 'Compare base title', body: 'Earlier base body copy.\nSecond paragraph from compare base.', featured: false, gallery: ['image-a.jpg'], heroImage: '/media/base-hero.jpg', seo: { title: 'Base SEO', theme: 'neutral' }, settings: { featured: false, audience: ['students'] }, tags: ['base'] }
        : { ...denseEntry, title: 'Selected revision title', body: 'Archived body copy with a much longer editorial note.\nSecond paragraph from an earlier revision.', featured: true, gallery: ['image-a.jpg', 'image-c.jpg', 'image-d.jpg'], heroImage: '/media/selected-hero.jpg', seo: { title: 'Archived SEO', theme: 'dark' }, settings: { featured: true, audience: ['alumni'] }, tags: ['archive', 'feature'] },
    }));

    renderApp('/project-one/b/main/collections/posts/entries/post-1/history');

    await waitFor(() => expect(screen.getByText('12 commits')).toBeInTheDocument());
    await waitFor(() => {
      expect(screen.getByText(/Comparing revision revhash0 against Current draft/i)).toBeInTheDocument();
      expect(screen.getByText('Field differences')).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
      expect(screen.getByText('Gallery')).toBeInTheDocument();
      expect(screen.getByText('Hero Image')).toBeInTheDocument();
      expect(screen.getByText('SEO')).toBeInTheDocument();
      expect(screen.getAllByText('Featured').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Hero Image'));
    fireEvent.click(screen.getByText('SEO'));

    expect(screen.getAllByText(/Yes|No/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Media asset/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/current-hero\.jpg/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/selected-hero\.jpg/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Theme').length).toBeGreaterThan(0);
    expect(screen.getByText('light')).toBeInTheDocument();
    expect(screen.getByText('dark')).toBeInTheDocument();
  });
});
