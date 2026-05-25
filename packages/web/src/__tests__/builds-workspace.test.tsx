import { mocks, renderApp, setupWorkspaceTestHarness } from '../test-utils/workspaceTestHarness';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

setupWorkspaceTestHarness();

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Builds workspace', () => {
  it('shows a setup warning when no build webhooks are configured', async () => {
    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByText('Deploy automation is not configured')).toBeInTheDocument();
    expect(screen.getByText(/no environment build webhook is configured yet/i)).toBeInTheDocument();
  });

  it('renders latest build details alongside build history', async () => {
    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByText('Latest build')).toBeInTheDocument();
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText('Deploy homepage refresh').length).toBeGreaterThan(1));
    expect(screen.getAllByRole('link', { name: 'Preview' }).length).toBeGreaterThan(0);
  });

  it('keeps build controls accessible on narrow shell widths', async () => {
    setViewportWidth(900);
    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByRole('button', { name: 'Trigger build' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Build status filter')[0]).toBeInTheDocument();
    expect(await screen.findByText('Latest build')).toBeInTheDocument();
  });

  it('hides dashboard context panels when builds need first environment setup', async () => {
    mocks.getProject.mockResolvedValueOnce({
      project: {
        id: 'project-1',
        name: 'Project One',
        slug: 'project-one',
        repoUrl: 'https://github.com/example/project-one',
        repoProvider: 'github',
        defaultBranch: 'main',
        description: 'A managed project',
        avatarUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        settings: { contentRoot: 'content', environments: [], collections: [] },
      },
    });
    mocks.buildSummary.mockResolvedValueOnce({
      counts: { pending: 0, running: 0, success: 0, failed: 0, cancelled: 0, total: 0 },
    });
    mocks.listBuilds.mockResolvedValueOnce({
      builds: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
    });

    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByText('Set up builds for this project')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up environment' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configure environments' })).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Configure environment')).toBeInTheDocument();
    expect(screen.getByText('Branch main')).toBeInTheDocument();
    expect(screen.getByText('Environment required')).toBeInTheDocument();
    expect(screen.queryByText('Environment setup needed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trigger build' })).not.toBeInTheDocument();
    expect(screen.queryByText('Latest build')).not.toBeInTheDocument();
    expect(screen.queryByText('Build behavior')).not.toBeInTheDocument();
  });
});
