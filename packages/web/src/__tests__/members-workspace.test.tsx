import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, setupWorkspaceTestHarness } from '../test-utils/workspace-test-harness';

setupWorkspaceTestHarness();

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('Members workspace', () => {
  it('filters the directory by search term', async () => {
    renderApp('/project-one/b/main/members/all-members');

    expect(await screen.findByRole('heading', { level: 3, name: 'Members' })).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Search members' });
    fireEvent.change(search, { target: { value: 'schema' } });

    await waitFor(() => {
      expect(screen.getByText('Schema Agent')).toBeInTheDocument();
      expect(screen.queryByText('Owner Example')).not.toBeInTheDocument();
    });
  });

  it('shows the generated token after creating an AI agent', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderApp('/project-one/b/main/members/all-members');

    expect(await screen.findByRole('button', { name: 'Add AI agent' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add AI agent' }));

    fireEvent.change(await screen.findByLabelText('Agent name'), { target: { value: 'Review Agent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));

    expect(await screen.findByRole('dialog', { name: 'Agent token' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Generated agent token' })).toHaveValue('agt_demo_token');

    fireEvent.click(screen.getByRole('button', { name: 'Copy token' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('agt_demo_token'));
  });

  it('keeps member directory controls accessible on narrow shell widths', async () => {
    setViewportWidth(900);
    renderApp('/project-one/b/main/members/all-members');

    expect(await screen.findByRole('button', { name: 'Add AI agent' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search members' })).toBeInTheDocument();
    expect(screen.getByText('Owner Example')).toBeInTheDocument();
  });
});
