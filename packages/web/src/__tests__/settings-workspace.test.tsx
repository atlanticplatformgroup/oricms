import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mocks, renderApp, setupWorkspaceTestHarness } from '../test-utils/workspaceTestHarness';

setupWorkspaceTestHarness();

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Settings workspace', () => {
  it('shows branch lifecycle controls with protected-branch safeguards', async () => {
    setViewportWidth(1440);
    renderApp('/project-one/b/main/settings/branches');

    expect(await screen.findByRole('button', { name: 'New branch' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('1 exact mapping')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();

    const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });

    expect(renameButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
    expect(renameButtons[1]).not.toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();
  });

  it('switches branches from the workspace header switcher and refreshes current status', async () => {
    setViewportWidth(1440);
    renderApp('/project-one/b/main/settings/branches');

    await screen.findByRole('button', { name: 'New branch' }, { timeout: 5000 });

    fireEvent.click(await screen.findByTestId('branch-switcher'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'staging' }));

    await waitFor(() => {
      expect(mocks.switchBranchApi).toHaveBeenCalledWith('project-1', 'staging');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /branch: staging/i })).toBeInTheDocument();
    });

    const stagingRow = (await screen.findByText('staging', {}, { timeout: 5000 })).closest('tr');
    const mainRow = (await screen.findByText('main', {}, { timeout: 5000 })).closest('tr');

    expect(stagingRow).not.toBeNull();
    expect(mainRow).not.toBeNull();

    await waitFor(() => {
      expect(within(stagingRow!).getByText('Current')).toBeInTheDocument();
      expect(within(mainRow!).queryByText('Current')).not.toBeInTheDocument();
    });
  });

  it('restores the current branch route and shows an error when branch switching fails', async () => {
    setViewportWidth(1440);
    mocks.switchBranchApi.mockRejectedValueOnce(new Error('Branch switch failed'));

    renderApp('/project-one/b/main/settings/branches');

    await screen.findByRole('button', { name: 'New branch' }, { timeout: 5000 });

    fireEvent.click(await screen.findByTestId('branch-switcher'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'staging' }));

    await waitFor(() => {
      expect(mocks.switchBranchApi).toHaveBeenCalledWith('project-1', 'staging');
    });

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith('Branch switch failed', 'error');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /branch: main/i })).toBeInTheDocument();
    });

    const mainRow = (await screen.findByText('main', {}, { timeout: 5000 })).closest('tr');
    const stagingRow = (await screen.findByText('staging', {}, { timeout: 5000 })).closest('tr');

    expect(mainRow).not.toBeNull();
    expect(stagingRow).not.toBeNull();

    await waitFor(() => {
      expect(within(mainRow!).getByText('Current')).toBeInTheDocument();
      expect(within(stagingRow!).queryByText('Current')).not.toBeInTheDocument();
    });
  });

  it('keeps branch settings controls accessible on narrow shell widths', async () => {
    setViewportWidth(900);

    renderApp('/project-one/b/main/settings/branches');

    fireEvent.click(await screen.findByRole('button', { name: 'New branch' }));
    expect(await screen.findByLabelText('Branch name')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Create from')[0]).toBeInTheDocument();
  });

  it('renders project reference fields as readonly contextual values in general settings', async () => {
    setViewportWidth(1440);

    renderApp('/project-one/b/main/settings/general');

    const defaultBranch = await screen.findByLabelText('Default branch');
    const repository = screen.getByLabelText('Repository');

    expect(defaultBranch).toHaveAttribute('readonly');
    expect(repository).toHaveAttribute('readonly');
    expect(screen.getByText('Set in project configuration and used as the default branch baseline.')).toBeInTheDocument();
    expect(screen.getByText('Managed by the connected Git repository integration.')).toBeInTheDocument();
  });

  it('keeps environment settings controls accessible on narrow shell widths', async () => {
    setViewportWidth(900);

    renderApp('/project-one/b/main/settings/environments');

    expect(await screen.findByRole('button', { name: 'Add environment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save environments' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Default environment')[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText('Branch pattern')[0]).toBeInTheDocument();
  });

  it('shows global media management in settings for users who can manage it', async () => {
    setViewportWidth(1440);
    mocks.permissionMap['settings:update'] = true;

    renderApp('/project-one/b/main/settings/global-media');

    expect(await screen.findByRole('heading', { name: 'Global Media' })).toBeInTheDocument();
    expect(screen.getByText('Curate shared brand assets and reusable files for the organization.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Upload global asset' })).toBeInTheDocument();
    expect(screen.getAllByText('logo-primary.png').length).toBeGreaterThan(0);
  });

  it('hides global media management from settings navigation for non-managers', async () => {
    setViewportWidth(1440);

    renderApp('/project-one/b/main/settings/general');

    expect(await screen.findByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.queryByText('Global Media')).not.toBeInTheDocument();
  });
});
