import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('Media workspace', () => {
  it('filters assets and updates the inspector from the browser selection', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByText('Library')).toBeInTheDocument();
      expect(screen.getByText('current-hero.jpg')).toBeInTheDocument();
      expect(screen.getByText('style-guide.pdf')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Search filename, alt text, caption, or tag'), {
      target: { value: 'style-guide' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('style-guide.pdf').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('style-guide.pdf')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('style-guide.pdf').length).toBeGreaterThan(0);
      expect(screen.getAllByText('/docs/style-guide.pdf').length).toBeGreaterThan(0);
    });
  });

  it('supports inline type filtering without a shell-level media subview', async () => {
    renderApp('/project-one/b/main/media?type=documents');

    await waitFor(() => {
      expect(screen.getByText('Library')).toBeInTheDocument();
      expect(screen.getAllByText('style-guide.pdf').length).toBeGreaterThan(0);
      expect(screen.queryByText('current-hero.jpg')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });
  });

  it('supports query-param-backed grid browsing without changing the coarse media route', async () => {
    renderApp('/project-one/b/main/media?type=documents&view=grid');

    await waitFor(() => {
      expect(screen.getByText('Library')).toBeInTheDocument();
      expect(screen.getByText('style-guide.pdf')).toBeInTheDocument();
      expect(screen.queryByText('current-hero.jpg')).not.toBeInTheDocument();
      expect(screen.getByText('Grid')).toBeInTheDocument();
    });
  });

  it('supports quick tag filtering from media facets', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'guides (1)' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'guides (1)' }));

    await waitFor(() => {
      expect(screen.getByText('style-guide.pdf')).toBeInTheDocument();
      expect(screen.queryByText('current-hero.jpg')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });
  });

  it('supports usage filtering and surfaces usage state in the inspector', async () => {
    renderApp('/project-one/b/main/media?usage=used');

    await waitFor(() => {
      expect(screen.getByText('current-hero.jpg')).toBeInTheDocument();
      expect(screen.queryByText('selected-hero.jpg')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
      expect(screen.getAllByText('Used in 2 entries').length).toBeGreaterThan(0);
    });
  });

  it('shows usage reference details in the inspector for the selected asset', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByText('Usage')).toBeInTheDocument();
      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByText('About')).toBeInTheDocument();
      expect(screen.getAllByText('content/posts/post-1.json').length).toBeGreaterThan(0);
      expect(screen.getAllByText('content/pages/page-1.json').length).toBeGreaterThan(0);
    });
  });

  it('preserves the selected asset when switching between list and grid views', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByText('style-guide.pdf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('style-guide.pdf')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('/docs/style-guide.pdf').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Grid'));

    await waitFor(() => {
      expect(screen.getAllByText('/docs/style-guide.pdf').length).toBeGreaterThan(0);
    });
  });

  it('can clear active filters back to the broad media browser state', async () => {
    renderApp('/project-one/b/main/media?type=documents&q=style');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
      expect(screen.queryByText('current-hero.jpg')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(screen.getByText('current-hero.jpg')).toBeInTheDocument();
      expect(screen.getByText('style-guide.pdf')).toBeInTheDocument();
    });
  });

  it('saves metadata and supports upload flow from the library surface', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByText('Inspector')).toBeInTheDocument();
      expect(screen.getByText('current-hero.jpg')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('current-hero.jpg')[0]);

    await waitFor(() => {
      expect(screen.getByLabelText('Alt text')).toHaveValue('Current hero image');
    });

    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'Updated alt copy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save metadata' }));

    await waitFor(() => expect(mocks.updateAssetMetadata).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Upload asset' }));
    await waitFor(() => expect(screen.getByText(/Choose whether this upload should stay branch-aware/i)).toBeInTheDocument());

    const uploadDialog = screen.getByRole('dialog');
    const file = new File(['image-bytes'], 'cover.jpg', { type: 'image/jpeg' });
    const fileInput = uploadDialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    const tagInput = within(uploadDialog).getByRole('textbox', { name: 'Tags' });
    fireEvent.change(tagInput, { target: { value: 'homepage' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.click(within(uploadDialog).getByRole('button', { name: 'Upload asset' }));

    await waitFor(() => expect(mocks.uploadAsset).toHaveBeenCalledTimes(1));
    expect(mocks.uploadAsset).toHaveBeenCalledWith(
      'project-1',
      'cover.jpg',
      expect.stringMatching(/^data:image\/jpeg;base64,/),
      'images',
      { tags: ['homepage'] },
    );
    expect(mocks.updateAssetMetadata).toHaveBeenCalledTimes(1);
  });

  it('supports uploading directly into the global library from the media upload flow', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Upload asset' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Upload asset' }));
    const uploadDialog = await screen.findByRole('dialog');

    fireEvent.click(within(uploadDialog).getByText('Global library'));

    const file = new File(['image-bytes'], 'brand-logo.png', { type: 'image/png' });
    const fileInput = uploadDialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    const tagInput = within(uploadDialog).getByRole('textbox', { name: 'Tags' });
    fireEvent.change(tagInput, { target: { value: 'brand' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.click(within(uploadDialog).getByRole('button', { name: 'Upload asset' }));

    await waitFor(() => expect(mocks.uploadGlobalAsset).toHaveBeenCalledTimes(1));
    expect(mocks.uploadGlobalAsset).toHaveBeenCalledWith(
      'project-1',
      'brand-logo.png',
      expect.stringMatching(/^data:image\/png;base64,/),
      'images',
      ['brand'],
    );
    expect(mocks.uploadAsset).not.toHaveBeenCalled();
  });

  it('supports bulk tag assignment for selected assets', async () => {
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current-hero.jpg' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select selected-hero.jpg' }));
    fireEvent.change(screen.getByLabelText('Bulk tag'), { target: { value: 'campaigns' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply tag' }));

    await waitFor(() => expect(mocks.updateAssetMetadata).toHaveBeenCalledTimes(2));
    expect(mocks.updateAssetMetadata).toHaveBeenNthCalledWith(
      1,
      'project-1',
      '/media/current-hero.jpg',
      expect.objectContaining({ tags: ['homepage', 'campaigns'] }),
    );
    expect(mocks.updateAssetMetadata).toHaveBeenNthCalledWith(
      2,
      'project-1',
      '/media/selected-hero.jpg',
      expect.objectContaining({ tags: ['blog', 'campaigns'] }),
    );
  });

  it('supports bulk deletion for selected assets', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current-hero.jpg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    await waitFor(() => expect(mocks.deleteAsset).toHaveBeenCalledTimes(1));
    expect(mocks.deleteAsset).toHaveBeenCalledWith('project-1', '/media/current-hero.jpg');
    confirmSpy.mockRestore();
  });

  it('keeps media browser and inspector controls accessible on narrow shell widths', async () => {
    setViewportWidth(900);
    renderApp('/project-one/b/main/media');

    await waitFor(() => {
      expect(screen.getByText('Library')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search filename, alt text, caption, or tag')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload asset' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save metadata' })).toBeInTheDocument();
    });
  });
});
