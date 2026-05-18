import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mocks, renderApp, setupWorkspaceTestHarness, waitForCollectionsHeading } from '../test-utils/workspaceTestHarness';
import { request } from '../lib/api/core';

setupWorkspaceTestHarness();

beforeEach(() => {
  vi.mocked(request).mockResolvedValue({});
});

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Workspace shell', () => {
  it('renders first-project onboarding instead of an endless loader when the user has no projects', async () => {
    mocks.projectState.currentProject = null;
    mocks.projectState.projects = [];
    mocks.projectState.isLoadingProjects = false;

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Create your first project' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /project name/i })).toHaveValue('My First Project');
    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument();
  });

  it('creates a managed project from the first-project onboarding state', async () => {
    mocks.projectState.currentProject = null;
    mocks.projectState.projects = [];
    mocks.projectState.isLoadingProjects = false;

    renderApp('/');

    fireEvent.change(await screen.findByRole('textbox', { name: /project name/i }), { target: { value: 'Launch Site' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => {
      expect(mocks.createProject).toHaveBeenCalledWith({ name: 'Launch Site', slug: 'launch-site' });
    });
    expect(mocks.setCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'project-created', role: 'owner' }));
    expect(mocks.refreshProjects).toHaveBeenCalled();
  });

  it('renders catalog-driven collection groups in the secondary rail', async () => {
    setViewportWidth(1440);
    vi.mocked(request).mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/workspace-catalog')) {
        return {
          catalog: {
            navigation: {
              systemSurfaces: [],
              uiGroups: [
                {
                  group: { id: 'editorial', slug: 'editorial', label: 'Editorial', order: 1, visible: true, locked: false },
                  collectionIds: ['pages'],
                },
              ],
              ungroupedCollectionIds: ['posts'],
            },
            collections: [
              { collection: { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' }, recordCount: 1 },
              { collection: { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' }, recordCount: 1 },
            ],
            schemas: [],
          },
        };
      }

      return {};
    });

    renderApp('/project-one/b/main/collections/posts');

    await waitForCollectionsHeading('Posts');
    expect(await screen.findByText('Editorial')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-posts')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-pages')).toBeInTheDocument();
  });

  it('shows section rail based on permissions', () => {
    setViewportWidth(1440);
    mocks.permissionMap = {
      'entries:read': true,
      'entries:create': true,
      'entries:update': true,
      'schemas:read': false,
      'assets:read': false,
      'members:read': false,
      'settings:read': false,
    };

    renderApp('/project-one/b/main/collections/posts');

    expect(screen.getByTestId('section-collections')).toBeInTheDocument();
    expect(screen.getByTestId('section-builds')).toBeInTheDocument();
    expect(screen.queryByTestId('section-schemas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-media')).not.toBeInTheDocument();
  });

  it('keeps route and secondary rail in sync', async () => {
    setViewportWidth(1440);
    renderApp('/project-one/b/main/collections/posts');

    await waitForCollectionsHeading('Posts');
    fireEvent.click(screen.getByTestId('secondary-pages'));
    await waitForCollectionsHeading('Pages');
  });

  it('prompts when leaving dirty editor state', async () => {
    setViewportWidth(1440);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed title' } });
    fireEvent.click(screen.getByTestId('secondary-pages'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Changed title' })).toBeInTheDocument();
  });

  it('preserves entry deep-link on initial load', async () => {
    setViewportWidth(1440);
    renderApp('/project-one/b/main/collections/posts/entries/post-1');

    await waitForCollectionsHeading('Welcome');
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('opens the secondary navigation in a drawer on narrow shell widths', async () => {
    setViewportWidth(1100);
    renderApp('/project-one/b/main/collections/posts');

    await waitForCollectionsHeading('Posts');
    expect(screen.queryByTestId('secondary-pages')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    fireEvent.click(await screen.findByTestId('secondary-pages'));

    await waitForCollectionsHeading('Pages');
  });

  it('opens a workspace drawer from the header on mobile shell widths', async () => {
    setViewportWidth(760);
    renderApp('/project-one/b/main/settings/general');

    expect(screen.queryByTestId('section-settings')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Branch: main' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();

    fireEvent.click(await screen.findByTestId('workspace-nav-trigger'));
    expect(await screen.findByTestId('workspace-section-grid')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-section-settings')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-branches')).toBeInTheDocument();
    expect(screen.getByTestId('secondary-environments')).toBeInTheDocument();
  });

  it('does not render a secondary rail for inline media navigation', async () => {
    setViewportWidth(1440);
    renderApp('/project-one/b/main/media');

    expect(await screen.findByRole('heading', { name: 'Media Library' })).toBeInTheDocument();
    expect(screen.queryByTestId('secondary-images')).not.toBeInTheDocument();
    expect(screen.queryByTestId('secondary-documents')).not.toBeInTheDocument();
  });
});
