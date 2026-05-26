import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Project, ProjectRole } from '@ori/shared';
import { useWorkspaceRouter } from '../useWorkspaceRouter';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function Wrapper({ children, initialEntries }: { children: ReactNode; initialEntries?: string[] }) {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
}

describe('useWorkspaceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createProject(overrides: Partial<Project & { role: ProjectRole }> = {}): Project & { role: ProjectRole } {
    return {
      id: 'project-1',
      slug: 'project-1',
      name: 'Project One',
      repoUrl: 'https://github.com/test/project',
      repoProvider: 'github' as const,
      description: '',
      defaultBranch: 'main',
      avatarUrl: null,
      settings: {},
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      role: 'owner',
      ...overrides,
    };
  }

  it('parses active section and branch from pathname', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content']}>{children}</Wrapper> },
    );

    expect(result.current.activeProjectSlug).toBe('project-1');
    expect(result.current.activeBranchName).toBe('main');
    expect(result.current.activeSection).toBe('collections');
  });

  it('redirects to current project when no route match', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/']}>{children}</Wrapper> },
    );

    expect(result.current.redirectTo).toBe('/project-1/b/main/content');
  });

  it('returns null redirect when route matches current project', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content']}>{children}</Wrapper> },
    );

    expect(result.current.redirectTo).toBeNull();
  });

  it('navigates to current project when route project is unknown', async () => {
    const setCurrentProject = vi.fn();
    renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject,
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/unknown-project/b/main/content']}>{children}</Wrapper> },
    );

    // When route project is unknown, the hook navigates to current project's default path
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/project-1/b/main/content', { replace: true });
  });

  it('sets current project from route', async () => {
    const setCurrentProject = vi.fn();
    renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: null,
          setCurrentProject,
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content']}>{children}</Wrapper> },
    );

    await waitFor(() => expect(setCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ slug: 'project-1' })));
  });

  it('does not set current project if already matches', () => {
    const setCurrentProject = vi.fn();
    renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject,
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content']}>{children}</Wrapper> },
    );

    expect(setCurrentProject).not.toHaveBeenCalled();
  });

  it('parses entry id from pathname', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/coll-1/entries/entry-123']}>{children}</Wrapper> },
    );

    expect(result.current.activeEntryId).toBe('entry-123');
  });

  it('parses history view from pathname', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main/content/coll-1/entries/entry-123/history']}>{children}</Wrapper> },
    );

    expect(result.current.activeHistoryView).toBe(true);
  });

  it('defaults active section to collections', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject()],
          currentProject: createProject(),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/b/main']}>{children}</Wrapper> },
    );

    expect(result.current.activeSection).toBe('collections');
  });

  it('uses project default branch when branch not in URL', () => {
    const { result } = renderHook(
      () =>
        useWorkspaceRouter({
          projects: [createProject({ defaultBranch: 'develop' })] as any,
          currentProject: createProject({ defaultBranch: 'develop' }),
          setCurrentProject: vi.fn(),
          isLoadingProjects: false,
        }),
      { wrapper: ({ children }) => <Wrapper initialEntries={['/project-1/content']}>{children}</Wrapper> },
    );

    expect(result.current.activeBranchName).toBe('develop');
  });
});
