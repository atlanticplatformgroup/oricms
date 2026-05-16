import { renderApp, setupWorkspaceTestHarness } from '../test-utils/workspaceTestHarness';
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
    expect(screen.getByText('Owner')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Deploy homepage refresh').length).toBeGreaterThan(1));
    expect(screen.getAllByRole('link', { name: 'Preview' }).length).toBeGreaterThan(0);
  });

  it('keeps build controls accessible on narrow shell widths', async () => {
    setViewportWidth(900);
    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByRole('button', { name: 'Trigger build' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Build status filter')[0]).toBeInTheDocument();
    expect(screen.getByText('Latest build')).toBeInTheDocument();
  });
});
