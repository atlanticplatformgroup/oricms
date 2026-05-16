import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, setupWorkspaceTestHarness } from '../test-utils/workspaceTestHarness';

setupWorkspaceTestHarness();

describe('Workspace sections smoke', () => {
  it('renders a real media workspace with asset library and inspector panes', async () => {
    renderApp('/project-one/b/main/media');

    expect(await screen.findByRole('heading', { level: 3, name: 'Media Library' })).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Inspector')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('style-guide.pdf')).toBeInTheDocument();
      expect(screen.getByText('/media/current-hero.jpg')).toBeInTheDocument();
    });
    screen.getAllByText('current-hero.jpg')[0]?.click();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save metadata' })).toBeInTheDocument();
  });

  it('renders a real builds workspace with summary and history', async () => {
    renderApp('/project-one/b/main/builds/recent');

    expect(await screen.findByRole('heading', { level: 3, name: 'Builds' })).toBeInTheDocument();
    expect(screen.getByText('Build history')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Deploy homepage refresh').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Trigger build' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cancel' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Preview' }).length).toBeGreaterThan(0);
  });

  it('renders a real settings workspace with general controls', async () => {
    renderApp('/project-one/b/main/settings/general');

    expect(await screen.findByRole('heading', { level: 3, name: 'General' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Project name')).toHaveValue('Project One');
    expect(screen.getByText('Project defaults')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://github.com/example/project-one')).toBeInTheDocument();
  });

  it('renders a real settings workspace with branch controls', async () => {
    renderApp('/project-one/b/main/settings/branches');

    expect(await screen.findByRole('button', { name: 'New branch' })).toBeInTheDocument();
    expect(screen.getAllByText('staging').length).toBeGreaterThan(0);
    expect(screen.getAllByText('main').length).toBeGreaterThan(0);
  });

  it('renders a real settings workspace with environment and branch mapping controls', async () => {
    renderApp('/project-one/b/main/settings/environments');

    expect(await screen.findByDisplayValue('https://preview.example.com')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Preview').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save environments' })).toBeInTheDocument();
    expect(screen.getByText('Add mapping')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save mapping' })).toBeInTheDocument();
  });

  it('redirects the legacy branch mappings route to environments', async () => {
    renderApp('/project-one/settings/branch-mappings');

    expect(await screen.findByRole('button', { name: 'Save mapping' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save environments' })).toBeInTheDocument();
  });

  it('redirects the branch-aware branch mappings route to environments', async () => {
    renderApp('/project-one/b/main/settings/branch-mappings');

    expect(await screen.findByRole('button', { name: 'Save mapping' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save environments' })).toBeInTheDocument();
  });

  it('renders a real members workspace with human and agent directory', async () => {
    renderApp('/project-one/b/main/members/all-members');

    expect(await screen.findByRole('heading', { level: 3, name: 'Members' })).toBeInTheDocument();
    expect(screen.getByText('Directory')).toBeInTheDocument();
    expect(screen.getByText('Owner Example')).toBeInTheDocument();
    expect(screen.getByText('Schema Agent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite human' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add AI agent' })).toBeInTheDocument();
    expect(screen.getAllByText('Human').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI Agent').length).toBeGreaterThan(0);
  });
});
