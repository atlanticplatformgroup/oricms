import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useWorkspaceRouteNormalization } from '../useWorkspaceRouteNormalization';

function Wrapper({ children, initialEntries }: { children: ReactNode; initialEntries?: string[] }) {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
}

describe('useWorkspaceRouteNormalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createArgs(overrides: Partial<Parameters<typeof useWorkspaceRouteNormalization>[0]> = {}) {
    return {
      activeProjectSlug: 'project-1',
      currentProjectSlug: 'project-1',
      pathname: '/project-1/b/main/content/coll-1',
      navigate: vi.fn(),
      availableSections: [{ key: 'collections' as const }, { key: 'schemas' as const }],
      activeSection: 'collections' as const,
      activeSecondaryId: 'coll-1',
      currentBranchName: 'main',
      activeSchemaMode: 'types' as const,
      collections: [{ id: 'coll-1' }, { id: 'coll-2' }],
      collectionsLoading: false,
      schemaSecondaryOptions: [{ id: 'type-1', label: 'Type 1' }],
      secondaryOptions: [{ id: 'option-1', label: 'Option 1' }],
      isBranchSyncing: false,
      ...overrides,
    };
  }

  it('does not navigate when everything is valid', () => {
    const args = createArgs();
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/coll-1']}>{children}</Wrapper>,
    });
    expect(args.navigate).not.toHaveBeenCalled();
  });

  it('redirects to first available section when active section is invalid', () => {
    const args = createArgs({
      activeSection: 'builds',
      availableSections: [{ key: 'collections' }, { key: 'schemas' }],
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/builds']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/content', { replace: true });
  });

  it('redirects to first collection when active secondary is invalid', () => {
    const args = createArgs({
      activeSecondaryId: 'nonexistent',
      pathname: '/project-1/b/main/content/nonexistent',
      collections: [{ id: 'coll-1' }, { id: 'coll-2' }],
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/content/coll-1', { replace: true });
  });

  it('redirects to null collection when no collections exist', () => {
    const args = createArgs({
      activeSecondaryId: 'nonexistent',
      collections: [],
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/content', { replace: true });
  });

  it('redirects to first schema option when schema secondary is invalid', () => {
    const args = createArgs({
      activeSection: 'schemas',
      activeSecondaryId: 'nonexistent',
      schemaSecondaryOptions: [{ id: 'type-1', label: 'Type 1' }],
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/schemas/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/schemas/types/type-1', { replace: true });
  });

  it('redirects to default schema secondary when no options', () => {
    const args = createArgs({
      activeSection: 'schemas',
      activeSecondaryId: 'nonexistent',
      schemaSecondaryOptions: [],
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/schemas/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/schemas/types/overview', { replace: true });
  });

  it('does not redirect when collections are loading', () => {
    const args = createArgs({
      activeSecondaryId: 'nonexistent',
      collectionsLoading: true,
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).not.toHaveBeenCalled();
  });

  it('does not redirect when branch is syncing', () => {
    const args = createArgs({
      activeSecondaryId: 'nonexistent',
      isBranchSyncing: true,
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).not.toHaveBeenCalled();
  });

  it('does not redirect when project is not ready', () => {
    const args = createArgs({
      activeProjectSlug: null,
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content']}>{children}</Wrapper>,
    });

    expect(args.navigate).not.toHaveBeenCalled();
  });

  it('redirects inline media sections with query params', () => {
    const args = createArgs({
      activeSection: 'media',
      activeSecondaryId: 'images',
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/media/images']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/media?type=images', { replace: true });
  });

  it('redirects to first secondary option for non-collection/schema sections', () => {
    const args = createArgs({
      activeSection: 'settings',
      activeSecondaryId: 'nonexistent',
      secondaryOptions: [{ id: 'general', label: 'General' }],
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/settings/nonexistent']}>{children}</Wrapper>,
    });

    expect(args.navigate).toHaveBeenCalledWith('/project-1/b/main/settings/general', { replace: true });
  });

  it('does not redirect when pathname already matches target', () => {
    const args = createArgs({
      pathname: '/project-1/b/main/content/coll-1',
      activeSecondaryId: 'coll-1',
    });
    renderHook(() => useWorkspaceRouteNormalization(args), {
      wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/coll-1']}>{children}</Wrapper>,
    });

    expect(args.navigate).not.toHaveBeenCalled();
  });
});
