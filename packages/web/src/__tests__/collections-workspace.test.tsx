import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ContentType } from '@ori/shared';
import { defaultEntriesByCollection, mocks, renderApp, setupWorkspaceTestHarness } from '../test-utils/workspaceTestHarness';

setupWorkspaceTestHarness();

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Collections workspace', () => {
  it('supports collection creation from the collections workspace', async () => {
    renderApp('/project-one/b/main/collections/posts');

    fireEvent.click(screen.getByText('New collection'));
    await waitFor(() => expect(screen.getByLabelText('Collection id')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Collection id'), { target: { value: 'newsroom' } });
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Newsroom' } });
    fireEvent.change(screen.getByLabelText('Singular label'), { target: { value: 'News item' } });
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'content/newsroom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));

    await waitFor(() => expect(mocks.updateCollectionsConfig).toHaveBeenCalledTimes(1));
  });

  it('blocks collection creation when the path duplicates an existing collection', async () => {
    renderApp('/project-one/b/main/collections/posts');

    fireEvent.click(screen.getByText('New collection'));
    await waitFor(() => expect(screen.getByLabelText('Collection id')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Collection id'), { target: { value: 'newsroom' } });
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'content/posts' } });

    expect(screen.getByText('Collection path is already in use')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create collection' })).toBeDisabled();
    expect(mocks.updateCollectionsConfig).not.toHaveBeenCalled();
  });

  it('deletes a collection through the dedicated collection API', async () => {
    renderApp('/project-one/b/main/collections/posts');

    fireEvent.click(screen.getByLabelText('Collection settings'));
    await waitFor(() => expect(screen.getByRole('heading', { name: /posts collection settings/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete collection' }));

    await waitFor(() => expect(mocks.deleteCollection).toHaveBeenCalledWith(
      'project-1',
      'posts',
      expect.objectContaining({
        'x-ori-lock-token': 'lock-token-1',
        'x-ori-session-id': 'session-1',
      }),
    ));
    expect(mocks.listEntries).not.toHaveBeenCalled();
  });

  it('blocks collection settings save when the path duplicates another collection', async () => {
    renderApp('/project-one/b/main/collections/posts');

    fireEvent.click(screen.getByLabelText('Collection settings'));
    await waitFor(() => expect(screen.getByRole('heading', { name: /posts collection settings/i })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'content/pages' } });

    expect(screen.getByText('Collection path is already in use')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save collection settings' })).toBeDisabled();
    expect(mocks.updateCollectionsConfig).not.toHaveBeenCalled();
  });

  it('supports direct navigation to the collection settings route', async () => {
    renderApp('/project-one/b/main/collections/posts/settings');

    await waitFor(() => expect(screen.getByRole('heading', { name: /posts collection settings/i })).toBeInTheDocument());
    expect(screen.getByLabelText('Collection id')).toHaveValue('posts');
    expect(screen.getByRole('button', { name: 'Save collection settings' })).toBeInTheDocument();
  });

  it('renders schema-defined editor sections instead of heuristic field buckets', async () => {
    const sectionedType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string', options: { editor: { section: 'content' } } },
        { key: 'slug', label: 'Slug', type: 'uid', options: { editor: { section: 'content' }, helpText: 'Used in the entry URL.' } },
        { key: 'seo', label: 'SEO', type: 'json', options: { editor: { section: 'seo' } } },
      ],
      display: { primary: 'title' },
      editor: {
        sections: [
          { id: 'content', label: 'Content', description: 'Editorial fields for this entry.' },
          { id: 'seo', label: 'SEO', description: 'Search metadata.', defaultCollapsed: true },
        ],
      },
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: [sectionedType] }, isLoading: false, isError: false });

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument());
    expect(screen.getByText('Editorial fields for this entry.')).toBeInTheDocument();
    expect(screen.getByText('Used in the entry URL.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand SEO' })).toBeInTheDocument();
    expect(screen.queryByText('Structure')).not.toBeInTheDocument();
    expect(screen.queryByText('Media & References')).not.toBeInTheDocument();
  });

  it('runs save -> commit -> cancel/commit transitions', async () => {
    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed title' } });
    expect(screen.getByLabelText('Title').closest('[data-ori-field-changed="true"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId('open-commit-bar'));
    expect(screen.getByTestId('commit-message')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-commit'));
    expect(screen.queryByTestId('commit-message')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-commit-bar'));
    fireEvent.change(screen.getByLabelText('Commit message'), { target: { value: 'Update homepage title' } });
    fireEvent.click(screen.getByTestId('commit-entry'));

    await waitFor(() => expect(mocks.updateEntry).toHaveBeenCalledTimes(1));
  });

  it('opens the branch copy modal from the entry header and applies an entire entry copy', async () => {
    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Copy to branch...' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toBeInTheDocument());
    expect(screen.getByLabelText('From branch')).toHaveValue('main');
    await waitFor(() => expect(mocks.previewEntryBranchTransfer).toHaveBeenCalled());
    expect(screen.getAllByDisplayValue('staging').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Copy Welcome to staging')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy entry' }));

    await waitFor(() => expect(mocks.applyEntryBranchTransfer).toHaveBeenCalledWith(
      'project-1',
      'posts',
      'post-1',
      expect.objectContaining({
        sourceBranch: 'main',
        targetBranch: 'staging',
        mode: 'entire_entry',
      }),
    ));
  });

  it('disables selected changes when the target entry does not exist yet', async () => {
    mocks.previewEntryBranchTransfer.mockResolvedValue({
      sourceBranch: 'main',
      targetBranch: 'staging',
      entryId: 'post-1',
      collectionId: 'posts',
      sourceExists: true,
      targetExists: false,
      modeAvailability: { entire_entry: true, selected_paths: false },
      diffTree: [{ pointer: '/title', label: 'Title', kind: 'changed', field: { key: 'title', label: 'Title', type: 'string' } }],
      conflicts: [],
      schemaCompatibility: { matches: true, message: null },
      defaultCommitMessage: 'Copy Welcome to staging',
    });

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Copy to branch...' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toBeInTheDocument());
    await waitFor(() => expect(mocks.previewEntryBranchTransfer).toHaveBeenCalled());
    expect(screen.getByRole('radio', { name: 'Selected changes' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toHaveTextContent('does not exist on the target branch yet');
  });

  it('requires conflict resolution before applying selected changes', async () => {
    mocks.previewEntryBranchTransfer.mockResolvedValue({
      sourceBranch: 'main',
      targetBranch: 'staging',
      entryId: 'post-1',
      collectionId: 'posts',
      sourceExists: true,
      targetExists: true,
      modeAvailability: { entire_entry: true, selected_paths: true },
      diffTree: [{ pointer: '/title', label: 'Title', kind: 'changed', field: { key: 'title', label: 'Title', type: 'string' } }],
      conflicts: [{ pointer: '/title', label: 'Title' }],
      schemaCompatibility: { matches: true, message: null },
      defaultCommitMessage: 'Copy Welcome to staging',
    });

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Copy to branch...' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toBeInTheDocument());
    await waitFor(() => expect(mocks.previewEntryBranchTransfer).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('radio', { name: 'Selected changes' }));
    await waitFor(() => expect(screen.getByText('Changed content')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Apply selected changes' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Use source' }));
    expect(screen.getByRole('button', { name: 'Apply selected changes' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply selected changes' }));

    await waitFor(() => expect(mocks.applyEntryBranchTransfer).toHaveBeenCalledWith(
      'project-1',
      'posts',
      'post-1',
      expect.objectContaining({
        mode: 'selected_paths',
        selectedPointers: ['/title'],
        resolutions: [{ pointer: '/title', strategy: 'source' }],
      }),
    ));
  });

  it('blocks entry copy when the schema differs between branches', async () => {
    mocks.previewEntryBranchTransfer.mockResolvedValue({
      sourceBranch: 'main',
      targetBranch: 'staging',
      entryId: 'post-1',
      collectionId: 'posts',
      sourceExists: true,
      targetExists: true,
      modeAvailability: { entire_entry: false, selected_paths: false },
      diffTree: [],
      conflicts: [],
      schemaCompatibility: {
        matches: false,
        message: "This entry can't be copied because the schema differs between branches. Update the schema first, then try again.",
      },
      defaultCommitMessage: 'Copy Welcome to staging',
    });

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Copy to branch...' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toBeInTheDocument());

    expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toHaveTextContent('Schema mismatch between branches');
    expect(screen.getByRole('dialog', { name: 'Copy to branch' })).toHaveTextContent('schema differs between branches');
    expect(screen.getByRole('button', { name: 'Copy entry' })).toBeDisabled();
  });

  it('blocks save when inline validation errors are present', async () => {
    const validatingTypes: ContentType[] = [{
      $schema: 'content-type-v1', $id: 'post', name: 'post', plural: 'posts', label: 'Post', labelPlural: 'Posts',
      fields: [{ key: 'title', label: 'Title', type: 'string', required: true }, { key: 'contactEmail', label: 'Contact Email', type: 'email' }],
      display: { primary: 'title' },
    }];

    const validatingEntry: CollectionEntry = {
      $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Welcome', contactEmail: 'owner@example.com',
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: validatingTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'posts' ? [validatingEntry] : defaultEntriesByCollection[collectionId || 'posts'] || [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.change(screen.getByLabelText('Contact Email'), { target: { value: 'not-an-email' } });

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('1 validation issue')).toBeInTheDocument();
    expect(screen.getByTestId('open-commit-bar')).toBeDisabled();
    expect(screen.queryByTestId('commit-message')).not.toBeInTheDocument();
  });

  it('supports asset browsing and block movement without exposing component field reordering', async () => {
    const structuredContentTypes: ContentType[] = [{
      $schema: 'content-type-v1', $id: 'post', name: 'post', plural: 'posts', label: 'Post', labelPlural: 'Posts',
      fields: [
        { key: 'heroImage', label: 'Hero Image', type: 'media' },
        { key: 'keywords', label: 'Keywords', type: 'array' },
        { key: 'featuredCallout', label: 'Featured Callout', type: 'component', component: 'callout-block' },
        { key: 'faqCards', label: 'FAQ Cards', type: 'component', component: 'quote-block', repeatable: true },
        { key: 'contentBlocks', label: 'Content Blocks', type: 'blocks', options: { allowedComponents: ['callout-block', 'quote-block'] } },
      ],
      display: { primary: 'heroImage' },
    }];

    const structuredEntry: CollectionEntry = {
      $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-03T00:00:00.000Z',
      heroImage: '/media/current-hero.jpg', keywords: ['cms', 'git-native'],
      featuredCallout: { headline: 'Before you restore', tone: 'info' },
      faqCards: [{ quote: 'Can repeatable components move?', attribution: 'Yes' }, { quote: 'Do they reorder schema fields?', attribution: 'No' }],
      contentBlocks: [{ $type: 'callout-block', headline: 'Editor note', tone: 'info' }, { $type: 'quote-block', quote: 'Shipping requires real stress cases.', attribution: 'OriCMS' }],
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: structuredContentTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'posts' ? [structuredEntry] : defaultEntriesByCollection[collectionId || 'posts'] || [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));
    mocks.getEntryVersion.mockResolvedValue({ entry: structuredEntry });

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    await waitFor(() => {
      expect(screen.getByText('Change asset')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Quick select')).not.toBeInTheDocument();
      expect(screen.getAllByText('Keywords').length).toBeGreaterThan(0);
      expect(screen.getByText('FAQ Cards')).toBeInTheDocument();
      expect(screen.getAllByText('Add item').length).toBeGreaterThan(0);
      expect(screen.getByText('Repeatable component')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Can repeatable components move?')).toBeInTheDocument();
      expect(screen.getByText('Featured Callout')).toBeInTheDocument();
      expect(screen.getAllByText('Content Blocks').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('/media/current-hero.jpg').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Drag array item')).toHaveLength(2);
    expect(screen.getAllByLabelText('Drag block')).toHaveLength(2);
    expect(screen.getAllByText('Item 1 of 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Block 1 of 2').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Reorder component field')).not.toBeInTheDocument();
  });

  it('can select a global asset reference and persist it through entry save', async () => {
    const globalMediaTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'heroImage', label: 'Hero Image', type: 'media' },
      ],
      display: { primary: 'title' },
    }];

    const globalMediaEntry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-03T00:00:00.000Z',
      title: 'Welcome',
      heroImage: '/media/current-hero.jpg',
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: globalMediaTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'posts' ? [globalMediaEntry] : defaultEntriesByCollection[collectionId || 'posts'] || [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Change asset' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change asset' }));
    const assetDialog = await screen.findByRole('dialog');
    fireEvent.click(within(assetDialog).getByText('Global'));

    await waitFor(() => {
      expect(screen.getByText('logo-primary.png')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('logo-primary.png')[0]);

    await waitFor(() => {
      expect(screen.getByText('Global')).toBeInTheDocument();
      expect(screen.getByText('brand/logo-primary.png')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('open-commit-bar'));
    await waitFor(() => expect(screen.getByTestId('commit-message')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('commit-entry'));

    await waitFor(() => expect(mocks.updateEntry).toHaveBeenCalled());
    expect(mocks.updateEntry).toHaveBeenLastCalledWith(
      'project-1',
      'posts',
      'post-1',
      expect.objectContaining({
        heroImage: {
          $ref: 'asset',
          scope: 'global',
          assetId: 'brand/logo-primary.png',
        },
      }),
      'rev-post-1',
    );
  });

  it('renders object fields as structured nested editors instead of raw JSON and removes debug preview copy', async () => {
    const objectTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        {
          key: 'seo',
          label: 'SEO',
          type: 'object',
          fields: [
            { key: 'seoTitle', label: 'SEO title', type: 'string' },
            { key: 'seoDescription', label: 'SEO description', type: 'text' },
          ],
        },
      ],
      display: { primary: 'title' },
    }];

    const objectEntry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-03T00:00:00.000Z',
      title: 'Welcome',
      seo: {
        seoTitle: 'Welcome to OriCMS',
        seoDescription: 'Search metadata that should be edited structurally.',
      },
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: objectTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'posts' ? [objectEntry] : defaultEntriesByCollection[collectionId || 'posts'] || [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    expect(await screen.findByLabelText('SEO title')).toHaveValue('Welcome to OriCMS');
    expect(screen.getByLabelText('SEO description')).toHaveValue('Search metadata that should be edited structurally.');
    expect(screen.queryByText('Current value')).not.toBeInTheDocument();
    expect(screen.queryByText('Nested fields')).not.toBeInTheDocument();
  });

  it('renders boolean fields through a single label row with status text instead of duplicate labels', async () => {
    const toggleTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'feature-flag',
      name: 'feature-flag',
      plural: 'feature-flags',
      label: 'Feature flag',
      labelPlural: 'Feature flags',
      fields: [
        { key: 'featured', label: 'Featured', type: 'boolean', description: 'Controls whether this entry is promoted.' },
      ],
      display: { primary: 'featured' },
    }];

    const toggleEntry: CollectionEntry = {
      $id: 'flag-1',
      $type: 'feature-flag',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      featured: true,
    };

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'feature-flags', label: 'Feature Flags', contentType: 'feature-flag', path: 'content/feature-flags' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: toggleTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'feature-flags' ? [toggleEntry] : [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));

    renderApp('/project-one/b/main/collections/feature-flags/entries/flag-1');

    expect(await screen.findByText('Featured')).toBeInTheDocument();
    expect(screen.getByText('Controls whether this entry is promoted.')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getAllByText('Featured')).toHaveLength(1);
  });

  it('supports auto-managed identifiers with manual override and reset', async () => {
    const identifierTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string', required: true },
        { key: 'slug', label: 'Slug', type: 'uid' },
      ],
      display: { primary: 'title' },
    }];

    const identifierEntry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Welcome',
      slug: 'welcome',
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: identifierTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: { data: collectionId === 'posts' ? [identifierEntry] : defaultEntriesByCollection[collectionId || 'posts'] || [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } },
      isLoading: false,
      isError: false,
    }));

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    const titleInput = await screen.findByLabelText('Title');
    const slugInput = screen.getByLabelText('Slug') as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: 'Field Guide' } });
    expect(slugInput.value).toBe('field-guide');

    fireEvent.change(slugInput, { target: { value: 'custom-slug' } });
    expect(screen.getByRole('button', { name: 'Reset to auto' })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: 'Another Title' } });
    expect(slugInput.value).toBe('custom-slug');

    fireEvent.click(screen.getByRole('button', { name: 'Reset to auto' }));
    expect(slugInput.value).toBe('another-title');
    expect(screen.queryByRole('button', { name: 'Reset to auto' })).not.toBeInTheDocument();
  });

  it('supports browsing and selecting relations through the relation picker', async () => {
    const relationTypes: ContentType[] = [
      {
        $schema: 'content-type-v1',
        $id: 'post',
        name: 'post',
        plural: 'posts',
        label: 'Post',
        labelPlural: 'Posts',
        fields: [
          { key: 'title', label: 'Title', type: 'string', required: true },
          { key: 'relatedPage', label: 'Related page', type: 'reference', relation: { target: 'pages' } } as any,
        ],
        display: { primary: 'title' },
      },
      {
        $schema: 'content-type-v1',
        $id: 'page',
        name: 'page',
        plural: 'pages',
        label: 'Page',
        labelPlural: 'Pages',
        fields: [{ key: 'title', label: 'Title', type: 'string' }],
        display: { primary: 'title' },
      },
    ];

    const relationEntry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Welcome',
      relatedPage: '',
    };

    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: relationTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: {
        data: collectionId === 'posts'
          ? [relationEntry]
          : [
              { $id: 'page-1', $type: 'page', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'About' },
              { $id: 'page-2', $type: 'page', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Contact' },
            ],
        meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 2 } },
      },
      isLoading: false,
      isError: false,
    }));
    mocks.listEntries.mockImplementation((_projectId: string, collectionId: string, params?: { search?: string }) => {
      if (collectionId !== 'pages') return Promise.resolve({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } });
      const all = [
        { $id: 'page-1', $type: 'page', title: 'About' },
        { $id: 'page-2', $type: 'page', title: 'Contact' },
      ];
      const filtered = params?.search ? all.filter((entry) => entry.title.toLowerCase().includes(params.search!.toLowerCase())) : all;
      return Promise.resolve({ data: filtered, meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: filtered.length } } });
    });

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Browse entries' }));
    const searchInput = await screen.findByPlaceholderText('Search entries');

    fireEvent.change(searchInput, { target: { value: 'contact' } });
    const contactOptions = await screen.findAllByText('Contact');
    fireEvent.click(contactOptions[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Contact').length).toBeGreaterThan(0);
    });
  });

  it('derives up to three descriptive table columns from schema and sorts locally by the active column', async () => {
    const tableTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'book',
      name: 'book',
      plural: 'books',
      label: 'Book',
      labelPlural: 'Books',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'author', label: 'Author', type: 'string' },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'body', label: 'Body', type: 'richtext' },
      ],
      display: { primary: 'title', secondary: 'author' },
    }];

    const tableEntries: CollectionEntry[] = [
      { $id: 'book-1', $type: 'book', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Dune', author: 'Frank Herbert', year: 1965 },
      { $id: 'book-2', $type: 'book', $status: 'published', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-03T00:00:00.000Z', title: 'Foundation', author: 'Isaac Asimov', year: 1951 },
      { $id: 'book-3', $type: 'book', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-02T00:00:00.000Z', title: 'Solaris', author: 'Stanislaw Lem', year: 1961 },
    ];

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'books', label: 'Books', contentType: 'book', path: 'content/books' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: {
        data: collectionId === 'books' ? tableEntries : [],
        meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: tableEntries.length } },
      },
      isLoading: false,
      isError: false,
    }));

    renderApp('/project-one/b/main/collections/books');

    expect(await screen.findByRole('columnheader', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /author/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /year/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /updated/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /body/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by Year ascending' }));

    await waitFor(() => {
      expect(screen.getAllByTestId(/entry-open-/).map((node) => node.textContent)).toEqual([
        'Foundation',
        'Solaris',
        'Dune',
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sort by Year descending' }));

    await waitFor(() => {
      expect(screen.getAllByTestId(/entry-open-/).map((node) => node.textContent)).toEqual([
        'Dune',
        'Solaris',
        'Foundation',
      ]);
    });
  });

  it('stacks schema-derived browse metadata into mobile rows and keeps sorting accessible', async () => {
    const tableTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'book',
      name: 'book',
      plural: 'books',
      label: 'Book',
      labelPlural: 'Books',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'author', label: 'Author', type: 'string' },
        { key: 'year', label: 'Year', type: 'number' },
      ],
      display: { primary: 'title', secondary: 'author' },
    }];

    const tableEntries: CollectionEntry[] = [
      { $id: 'book-1', $type: 'book', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Dune', author: 'Frank Herbert', year: 1965 },
      { $id: 'book-2', $type: 'book', $status: 'published', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-03T00:00:00.000Z', title: 'Foundation', author: 'Isaac Asimov', year: 1951 },
      { $id: 'book-3', $type: 'book', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-02T00:00:00.000Z', title: 'Solaris', author: 'Stanislaw Lem', year: 1961 },
    ];

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'books', label: 'Books', contentType: 'book', path: 'content/books' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: {
        data: collectionId === 'books' ? tableEntries : [],
        meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: tableEntries.length } },
      },
      isLoading: false,
      isError: false,
    }));

    setViewportWidth(760);
    renderApp('/project-one/b/main/collections/books');

    expect(await screen.findByRole('button', { name: 'Sort entries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort entries' })).toHaveTextContent('Updated');
    expect(screen.queryByRole('columnheader', { name: /author/i })).not.toBeInTheDocument();
    expect(screen.getByText('3 entries')).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
    expect(screen.getByText('Isaac Asimov')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sort entries' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Year' }));

    await waitFor(() => {
      const rows = screen.getAllByTestId(/entry-open-/).map((node) => node.textContent || '');
      expect(rows[0]).toContain('Foundation');
      expect(rows[1]).toContain('Solaris');
      expect(rows[2]).toContain('Dune');
    });

    expect(screen.getByRole('button', { name: 'Sort entries' })).toHaveTextContent('Year');
  });

  it('debounces collection browse search, resets pagination, and exposes a clear affordance', async () => {
    const tableTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'book',
      name: 'book',
      plural: 'books',
      label: 'Book',
      labelPlural: 'Books',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'author', label: 'Author', type: 'string' },
      ],
      display: { primary: 'title', secondary: 'author' },
    }];

    const pageOneEntries = Array.from({ length: 25 }, (_, index) => ({
      $id: `book-${index + 1}`,
      $type: 'book',
      $status: 'draft' as const,
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: `Book ${index + 1}`,
      author: 'Author',
    }));
    const pageTwoEntries = Array.from({ length: 25 }, (_, index) => ({
      $id: `book-${index + 26}`,
      $type: 'book',
      $status: 'draft' as const,
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: `Book ${index + 26}`,
      author: 'Author',
    }));
    const searchResult = [{
      $id: 'book-guide',
      $type: 'book',
      $status: 'draft' as const,
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Guide to Fields',
      author: 'Author',
    }];

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'books', label: 'Books', contentType: 'book', path: 'content/books' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string, options?: { page?: number; limit?: number; search?: string }) => {
      if (collectionId !== 'books') {
        return { data: { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } }, isLoading: false, isError: false };
      }

      if (options?.limit === 1) {
        return {
          data: { data: [pageOneEntries[0]], meta: { pagination: { page: 1, pageSize: 1, pageCount: 60, total: 60 } } },
          isLoading: false,
          isError: false,
        };
      }

      if (options?.search === 'guide') {
        return {
          data: { data: searchResult, meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } },
          isLoading: false,
          isError: false,
        };
      }

      const page = options?.page ?? 1;
      return {
        data: {
          data: page === 2 ? pageTwoEntries : pageOneEntries,
          meta: { pagination: { page, pageSize: 25, pageCount: 3, total: 60 } },
        },
        isLoading: false,
        isError: false,
      };
    });

    renderApp('/project-one/b/main/collections/books');

    fireEvent.click(await screen.findByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: 'Search entries' });
    fireEvent.change(searchInput, { target: { value: 'guide' } });

    expect(searchInput).toHaveValue('guide');
    expect(
      mocks.useCollectionEntries.mock.calls.some(([, collectionId, options]) =>
        collectionId === 'books' && options?.limit !== 1 && options?.search === 'guide',
      ),
    ).toBe(false);

    await waitFor(() => {
      expect(screen.getByText('Guide to Fields')).toBeInTheDocument();
      expect(
        mocks.useCollectionEntries.mock.calls.some(([, collectionId, options]) =>
          collectionId === 'books' && options?.limit !== 1 && options?.page === 1 && options?.search === 'guide',
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search entries' }));
    expect(searchInput).toHaveValue('');
  });

  it('shows search-aware empty-state copy when no entries match', async () => {
    const tableTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'book',
      name: 'book',
      plural: 'books',
      label: 'Book',
      labelPlural: 'Books',
      fields: [{ key: 'title', label: 'Title', type: 'string' }],
      display: { primary: 'title' },
    }];

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'books', label: 'Books', contentType: 'book', path: 'content/books' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string, options?: { limit?: number; search?: string }) => {
      if (collectionId !== 'books') {
        return { data: { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } }, isLoading: false, isError: false };
      }

      if (options?.limit === 1) {
        return {
          data: { data: [{ $id: 'book-1', $type: 'book', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Existing book' }], meta: { pagination: { page: 1, pageSize: 1, pageCount: 3, total: 3 } } },
          isLoading: false,
          isError: false,
        };
      }

      return {
        data: {
          data: options?.search ? [] : [{ $id: 'book-1', $type: 'book', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Existing book' }],
          meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: options?.search ? 0 : 3 } },
        },
        isLoading: false,
        isError: false,
      };
    });

    renderApp('/project-one/b/main/collections/books');

    fireEvent.change(await screen.findByRole('textbox', { name: 'Search entries' }), { target: { value: 'missing' } });

    await waitFor(() => {
      expect(screen.getByText('No matching entries')).toBeInTheDocument();
      expect(screen.getByText('No entries match "missing". Clear the search to browse all entries in this collection.')).toBeInTheDocument();
    });
  });

  it('supports collection table pagination with query-backed page state', async () => {
    const tableTypes: ContentType[] = [{
      $schema: 'content-type-v1',
      $id: 'book',
      name: 'book',
      plural: 'books',
      label: 'Book',
      labelPlural: 'Books',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'author', label: 'Author', type: 'string' },
      ],
      display: { primary: 'title' },
    }];

    const pageOneEntries = Array.from({ length: 25 }, (_, index) => ({
      $id: `book-${index + 1}`,
      $type: 'book',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: `Book ${index + 1}`,
      author: 'Author',
    }));
    const pageTwoEntries = Array.from({ length: 25 }, (_, index) => ({
      $id: `book-${index + 26}`,
      $type: 'book',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: `Book ${index + 26}`,
      author: 'Author',
    }));

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'books', label: 'Books', contentType: 'book', path: 'content/books' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string, options?: { page?: number; limit?: number; search?: string }) => {
      if (collectionId !== 'books') {
        return { data: { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } }, isLoading: false, isError: false };
      }

      if (options?.limit === 1) {
        return {
          data: { data: [pageOneEntries[0]], meta: { pagination: { page: 1, pageSize: 1, pageCount: 60, total: 60 } } },
          isLoading: false,
          isError: false,
        };
      }

      const page = options?.page ?? 1;
      return {
        data: {
          data: page === 2 ? pageTwoEntries : pageOneEntries,
          meta: { pagination: { page, pageSize: 25, pageCount: 3, total: 60 } },
        },
        isLoading: false,
        isError: false,
      };
    });

    renderApp('/project-one/b/main/collections/books');

    expect(await screen.findByText('1–25 of 60')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Book 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(screen.getByText('26–50 of 60')).toBeInTheDocument();
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      expect(screen.getByText('Book 26')).toBeInTheDocument();
    });
  });

  it('formats relation, image, and date columns from schema-derived table columns', async () => {
    const tableTypes: ContentType[] = [
      {
        $schema: 'content-type-v1',
        $id: 'book',
        name: 'book',
        plural: 'books',
        label: 'Book',
        labelPlural: 'Books',
        fields: [
          { key: 'title', label: 'Title', type: 'string' },
          { key: 'coverImage', label: 'Cover image', type: 'image' },
          { key: 'authorRef', label: 'Author', type: 'reference', relation: { target: 'authors' } } as any,
          { key: 'publishedOn', label: 'Published on', type: 'date' },
        ],
        display: { primary: 'title' },
      },
      {
        $schema: 'content-type-v1',
        $id: 'author',
        name: 'author',
        plural: 'authors',
        label: 'Author',
        labelPlural: 'Authors',
        fields: [{ key: 'name', label: 'Name', type: 'string' }],
        display: { primary: 'name' },
      },
    ];

    const bookEntries: CollectionEntry[] = [
      {
        $id: 'book-1',
        $type: 'book',
        $status: 'draft',
        $createdAt: '2026-01-01T00:00:00.000Z',
        $updatedAt: '2026-01-03T00:00:00.000Z',
        title: 'Foundation',
        coverImage: '/media/current-hero.jpg',
        authorRef: 'author-1',
        publishedOn: '1951-06-01',
      },
    ];

    mocks.useCollections.mockReturnValue({
      data: { collections: [
        { id: 'books', label: 'Books', contentType: 'book', path: 'content/books' },
        { id: 'authors', label: 'Authors', contentType: 'author', path: 'content/authors' },
      ] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: {
        data: collectionId === 'books' ? bookEntries : [],
        meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: bookEntries.length } },
      },
      isLoading: false,
      isError: false,
    }));
    mocks.listEntries.mockImplementation((_projectId: string, collectionId: string) => {
      if (collectionId !== 'authors') {
        return Promise.resolve({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } });
      }
      return Promise.resolve({
        data: [{ $id: 'author-1', $type: 'author', name: 'Isaac Asimov' }],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
      });
    });

    renderApp('/project-one/b/main/collections/books');

    expect(await screen.findByRole('columnheader', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /cover image/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^author$/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /published on/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Isaac Asimov')).toBeInTheDocument();
    });

    const coverImage = screen.getByAltText(/current hero/i);
    expect(coverImage).toBeInTheDocument();
  });

  it('formats multi-value relation, media, and boolean table cells cleanly', async () => {
    const tableTypes: ContentType[] = [
      {
        $schema: 'content-type-v1',
        $id: 'gallery',
        name: 'gallery',
        plural: 'galleries',
        label: 'Gallery',
        labelPlural: 'Galleries',
        fields: [
          { key: 'title', label: 'Title', type: 'string' },
          { key: 'contributors', label: 'Contributors', type: 'relation', relation: { target: 'authors' } } as any,
          { key: 'images', label: 'Images', type: 'media' } as any,
          { key: 'featured', label: 'Featured', type: 'boolean' },
        ],
        display: { primary: 'title' },
      },
      {
        $schema: 'content-type-v1',
        $id: 'author',
        name: 'author',
        plural: 'authors',
        label: 'Author',
        labelPlural: 'Authors',
        fields: [{ key: 'name', label: 'Name', type: 'string' }],
        display: { primary: 'name' },
      },
    ];

    const galleryEntries: CollectionEntry[] = [
      {
        $id: 'gallery-1',
        $type: 'gallery',
        $status: 'draft',
        $createdAt: '2026-01-01T00:00:00.000Z',
        $updatedAt: '2026-01-03T00:00:00.000Z',
        title: 'Winter Set',
        contributors: ['author-1', 'author-2', 'author-3'],
        images: ['/media/current-hero.jpg', '/media/selected-hero.jpg', '/media/current-hero.jpg'],
        featured: true,
      },
    ];

    mocks.useCollections.mockReturnValue({
      data: { collections: [
        { id: 'galleries', label: 'Galleries', contentType: 'gallery', path: 'content/galleries' },
        { id: 'authors', label: 'Authors', contentType: 'author', path: 'content/authors' },
      ] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string, options?: { limit?: number }) => ({
      data: {
        data: collectionId === 'galleries'
          ? galleryEntries
          : collectionId === 'authors' && options?.limit !== 1
            ? []
            : [],
        meta: { pagination: { page: 1, pageSize: options?.limit ?? 25, pageCount: 1, total: collectionId === 'galleries' ? 1 : 0 } },
      },
      isLoading: false,
      isError: false,
    }));
    mocks.listEntries.mockImplementation((_projectId: string, collectionId: string) => {
      if (collectionId !== 'authors') {
        return Promise.resolve({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } });
      }
      return Promise.resolve({
        data: [
          { $id: 'author-1', $type: 'author', name: 'Isaac Asimov' },
          { $id: 'author-2', $type: 'author', name: 'Mary Shelley' },
          { $id: 'author-3', $type: 'author', name: 'Ursula K. Le Guin' },
        ],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 3 } },
      });
    });

    renderApp('/project-one/b/main/collections/galleries');

    await waitFor(() => {
      expect(screen.getByText('Isaac Asimov')).toBeInTheDocument();
      expect(screen.getByText('Mary Shelley')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    expect(screen.getAllByAltText(/hero image/i).length).toBeGreaterThan(0);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('formats boolean table cells when the boolean field is visible', async () => {
    const tableTypes: ContentType[] = [
      {
        $schema: 'content-type-v1',
        $id: 'feature-flag',
        name: 'feature-flag',
        plural: 'feature-flags',
        label: 'Feature flag',
        labelPlural: 'Feature flags',
        fields: [
          { key: 'title', label: 'Title', type: 'string' },
          { key: 'featured', label: 'Featured', type: 'boolean' },
          { key: 'owner', label: 'Owner', type: 'string' },
        ],
        display: { primary: 'title' },
      },
    ];

    const flagEntries: CollectionEntry[] = [
      {
        $id: 'flag-1',
        $type: 'feature-flag',
        $status: 'published',
        $createdAt: '2026-01-01T00:00:00.000Z',
        $updatedAt: '2026-01-03T00:00:00.000Z',
        title: 'Winter rollout',
        featured: true,
        owner: 'Platform',
      },
    ];

    mocks.useCollections.mockReturnValue({
      data: { collections: [{ id: 'feature-flags', label: 'Feature Flags', contentType: 'feature-flag', path: 'content/feature-flags' }] },
      isLoading: false,
      isError: false,
    });
    mocks.useContentTypes.mockReturnValue({ data: { contentTypes: tableTypes }, isLoading: false, isError: false });
    mocks.useCollectionEntries.mockReturnValue({
      data: {
        data: flagEntries,
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
      },
      isLoading: false,
      isError: false,
    });

    renderApp('/project-one/b/main/collections/feature-flags');

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Featured' })).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
  });
});
