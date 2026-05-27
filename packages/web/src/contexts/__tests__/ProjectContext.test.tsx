import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ProjectProvider } from '../ProjectContext';
import { useProject } from '../useProject';
import { AuthContext, type AuthContextType } from '../auth-context';
import { UserPreferencesContext, type UserPreferencesContextType } from '../user-preferences-context';
import { projectsApi } from '../../lib/api/projects';
import { gitApi } from '../../lib/api/git';
import { collectionsApi } from '../../lib/api/collections';
import type { UserPreferences, ProjectRole } from '@ori/shared';

vi.mock('../../lib/api/projects', () => ({
  projectsApi: {
    list: vi.fn(),
    listMembers: vi.fn(),
  },
}));

vi.mock('../../lib/api/git', () => ({
  gitApi: {
    getStatus: vi.fn(),
    getSchemas: vi.fn(),
  },
}));

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    list: vi.fn(),
  },
}));

const defaultPreferences: UserPreferences = {
  theme: 'light',
  editorMode: 'split',
  notifications: { builds: true, invites: true, mentions: true },
  projectDefaults: {},
  lastVisitedProjectId: null,
  onboarding: { version: 2, lastStep: 'welcome', completedAt: null, createdProjectId: null },
};

function createMockAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    githubLogin: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    token: null,
    ...overrides,
  };
}

function createMockUserPreferences(overrides: Partial<UserPreferencesContextType> = {}): UserPreferencesContextType {
  return {
    preferences: defaultPreferences,
    isLoading: false,
    updatePreferences: vi.fn(),
    updateProjectDefault: vi.fn(),
    setLastVisitedProject: vi.fn(),
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={createMockAuth()}>
      <UserPreferencesContext.Provider value={createMockUserPreferences()}>
        <ProjectProvider>{children}</ProjectProvider>
      </UserPreferencesContext.Provider>
    </AuthContext.Provider>
  );
}

describe('ProjectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('throws when useProject is used outside provider', () => {
    expect(() => renderHook(() => useProject())).toThrow('useProject must be used within a ProjectProvider');
  });

  it('loads projects on mount when authenticated', async () => {
    const projects = [{ id: 'p1', name: 'Project One', role: 'owner' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.projects.length).toBe(1));
    expect(result.current.projects[0].name).toBe('Project One');
    expect(result.current.currentProject).toEqual(projects[0]);
  });

  it('sets current project and persists to localStorage', async () => {
    const projects = [
      { id: 'p1', name: 'One', role: 'owner' as ProjectRole, slug: 'one', repoUrl: 'https://github.com/test/one', repoProvider: 'github' as const, defaultBranch: 'main', createdAt: '2024-01-01', updatedAt: '2024-01-01', isPublic: false, description: '', avatarUrl: '', settings: {} },
      { id: 'p2', name: 'Two', role: 'editor' as ProjectRole, slug: 'two', repoUrl: 'https://github.com/test/two', repoProvider: 'github' as const, defaultBranch: 'main', createdAt: '2024-01-01', updatedAt: '2024-01-01', isPublic: false, description: '', avatarUrl: '', settings: {} },
    ];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.projects.length).toBe(2));
    act(() => {
      result.current.setCurrentProject(projects[1]);
    });
    expect(result.current.currentProject).toEqual(projects[1]);
    expect(localStorage.setItem).toHaveBeenCalledWith('currentProjectId', 'p2');
  });

  it('restores current project from localStorage', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('p2');
    const projects = [
      { id: 'p1', name: 'One', role: 'owner' as ProjectRole },
      { id: 'p2', name: 'Two', role: 'editor' as ProjectRole },
    ];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.projects.length).toBe(2));
    await waitFor(() => expect(result.current.currentProject?.id).toBe('p2'));
  });

  it('restores current project from user preferences lastVisitedProjectId', async () => {
    const projects = [{ id: 'p1', name: 'One', role: 'owner' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={createMockAuth()}>
        <UserPreferencesContext.Provider value={createMockUserPreferences({ preferences: { ...defaultPreferences, lastVisitedProjectId: 'p1' } })}>
          <ProjectProvider>{children}</ProjectProvider>
        </UserPreferencesContext.Provider>
      </AuthContext.Provider>
    );
    const { result } = renderHook(() => useProject(), { wrapper: customWrapper });
    await waitFor(() => expect(result.current.currentProject?.id).toBe('p1'));
  });

  it('computes permissions based on current role', async () => {
    const projects = [{ id: 'p1', name: 'One', role: 'viewer' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.currentProject).not.toBeNull());
    await waitFor(() => expect(result.current.permissions.canEditSchemas).toBe(false));
    await waitFor(() => expect(result.current.permissions.canReadAssets).toBe(true));
    await waitFor(() => expect(result.current.hasPermission('schemas', 'read')).toBe(false));
    await waitFor(() => expect(result.current.hasPermission('schemas', 'update')).toBe(false));
  });

  it('refreshes members', async () => {
    const projects = [{ id: 'p1', name: 'One', role: 'owner' as ProjectRole }];
    const members = [{ id: 'm1', projectId: 'p1', userId: 'u1', user: { id: 'u1', name: 'Member', email: 'm@example.com' } as any, role: 'editor' as ProjectRole, userType: 'human' as const, joinedAt: '2024-01-01', createdAt: '2024-01-01' }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.members.length).toBe(1));
    expect(result.current.members[0].user.name).toBe('Member');
  });

  it('refreshes git status', async () => {
    const projects = [{ id: 'p1', name: 'One', role: 'owner' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 2, behind: 1, modified: ['file.md'] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.gitStatus).not.toBeNull());
    expect(result.current.gitStatus?.ahead).toBe(2);
    expect(result.current.gitStatus?.modified).toContain('file.md');
  });

  it('refreshes collections', async () => {
    const projects = [{ id: 'p1', name: 'One', role: 'owner' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [{ id: 'c1', label: 'Blog', path: 'blog' }] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.collections.length).toBe(1));
    expect(result.current.collections[0].label).toBe('Blog');
  });

  it('refreshes schemas', async () => {
    const projects = [{ id: 'p1', name: 'One', role: 'owner' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [{ name: 'Post', path: 'schemas/types/post.json' }] } as any);

    const { result } = renderHook(() => useProject(), { wrapper });
    await waitFor(() => expect(result.current.projects.length).toBe(1));
    await waitFor(() => expect(result.current.currentProject).not.toBeNull());
    act(() => {
      result.current.refreshSchemas();
    });
    await waitFor(() => expect(result.current.schemas.length).toBe(1));
    expect(result.current.schemas[0].name).toBe('Post');
  });

  it('clears projects when not authenticated', async () => {
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={createMockAuth({ isAuthenticated: false })}>
        <UserPreferencesContext.Provider value={createMockUserPreferences()}>
          <ProjectProvider>{children}</ProjectProvider>
        </UserPreferencesContext.Provider>
      </AuthContext.Provider>
    );
    const { result } = renderHook(() => useProject(), { wrapper: customWrapper });
    expect(result.current.projects).toEqual([]);
    expect(result.current.currentProject).toBeNull();
  });

  it('records last visited project when switching', async () => {
    const setLastVisitedProject = vi.fn();
    const projects = [{ id: 'p1', name: 'One', role: 'owner' as ProjectRole }];
    vi.mocked(projectsApi.list).mockResolvedValue({ projects } as any);
    vi.mocked(gitApi.getStatus).mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [] } } as any);
    vi.mocked(collectionsApi.list).mockResolvedValue({ collections: [] } as any);
    vi.mocked(projectsApi.listMembers).mockResolvedValue({ members: [] } as any);
    vi.mocked(gitApi.getSchemas).mockResolvedValue({ schemas: [] } as any);

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={createMockAuth()}>
        <UserPreferencesContext.Provider value={createMockUserPreferences({ setLastVisitedProject })}>
          <ProjectProvider>{children}</ProjectProvider>
        </UserPreferencesContext.Provider>
      </AuthContext.Provider>
    );
    const { result } = renderHook(() => useProject(), { wrapper: customWrapper });
    await waitFor(() => expect(result.current.currentProject).not.toBeNull());
    expect(setLastVisitedProject).toHaveBeenCalledWith('p1');
  });
});
