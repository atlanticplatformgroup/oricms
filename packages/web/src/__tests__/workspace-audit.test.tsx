import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mocks, renderApp, setupWorkspaceTestHarness } from '../test-utils/workspace-test-harness';

setupWorkspaceTestHarness();

describe('Workspace audit', () => {
  it('shows retry affordances for media load failures', async () => {
    mocks.listAssets.mockRejectedValue(new Error('boom'));

    renderApp('/project-one/b/main/media/all-assets');

    expect(await screen.findByText('Failed to load assets', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows retry affordances for build history failures', async () => {
    mocks.listBuilds.mockRejectedValueOnce(new Error('boom'));

    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByText('Failed to load builds', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows retry affordances for member directory failures', async () => {
    mocks.useMembersHook.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: async () => ({}) });

    renderApp('/project-one/b/main/members/all-members');

    expect(await screen.findByText('Failed to load members', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('uses accessible search labels across major workspaces', async () => {
    renderApp('/project-one/b/main/collections/posts');
    expect(await screen.findByRole('textbox', { name: 'Search entries' })).toBeInTheDocument();

    renderApp('/project-one/b/main/media/all-assets');
    expect(await screen.findByRole('textbox', { name: 'Search assets' })).toBeInTheDocument();

    renderApp('/project-one/b/main/members/all-members');
    expect(await screen.findByRole('textbox', { name: 'Search members' })).toBeInTheDocument();
  });
});
