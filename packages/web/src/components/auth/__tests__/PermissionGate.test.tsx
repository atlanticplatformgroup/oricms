/**
 * PermissionGate Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PermissionGate, AdminGate } from '../PermissionGate';
import { getPermissionKey } from '@ori/shared';
import type { Project, User, UserPreferences, ExtendedPermissionSet, ProjectRole, Resource, Action } from '@ori/shared';
import { ProjectContext } from '../../../contexts/project-context';
import { AuthContext } from '../../../contexts/auth-context';

// Mock preferences
const mockPreferences: UserPreferences = {
  theme: 'system',
  editorMode: 'split',
  notifications: {
    builds: true,
    invites: true,
    mentions: true,
  },
  lastVisitedProjectId: null,
  projectDefaults: {},
};

// Mock data
const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  type: 'HUMAN',
  avatarUrl: null,
  githubId: null,
  preferences: mockPreferences,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockProject: Project & { role: ProjectRole } = {
  id: 'project-1',
  name: 'Test Project',
  slug: 'test-project',
  repoUrl: 'https://github.com/test/repo',
  repoProvider: 'github',
  defaultBranch: 'main',
  description: null,
  avatarUrl: null,
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  role: 'owner',
};

// Default permissions
const defaultPermissions: ExtendedPermissionSet = {
  canEditSchemas: false,
  canManageMembers: false,
  canDeleteProject: false,
  canEditContentTypes: false,
  canCreateEntries: false,
  canEditEntries: false,
  canDeleteEntries: false,
  canPublishEntries: false,
  canCreateAssets: false,
  canReadAssets: false,
  canUpdateAssets: false,
  canDeleteAssets: false,
  canUpdateSettings: false,
  canManageAgentAccess: false,
  canViewAgentAuditLog: false,
  canRevokeAgentAccess: false,
};

const ownerPermissions: ExtendedPermissionSet = {
  ...defaultPermissions,
  canEditSchemas: true,
  canManageMembers: true,
  canDeleteProject: true,
  canEditContentTypes: true,
  canCreateEntries: true,
  canEditEntries: true,
  canDeleteEntries: true,
  canPublishEntries: true,
  canManageAgentAccess: true,
  canViewAgentAuditLog: true,
  canRevokeAgentAccess: true,
};

const editorPermissions: ExtendedPermissionSet = {
  ...defaultPermissions,
  canCreateEntries: true,
  canEditEntries: true,
  canDeleteEntries: false,
  canPublishEntries: true,
};

// Helper to create context provider
function createWrapper(role: ProjectRole | null) {
  const permissions = role === 'owner' ? ownerPermissions : 
                      role === 'editor' ? editorPermissions : 
                      defaultPermissions;
  
  const projectWithRole = role ? { ...mockProject, role } : mockProject;

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthContext.Provider
        value={{
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
          login: vi.fn(),
          register: vi.fn(),
          githubLogin: vi.fn(),
          logout: vi.fn(),
          clearError: vi.fn(),
          token: 'mock-token',
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          error: null,
        }}
      >
        <ProjectContext.Provider
          value={{
            projects: [projectWithRole],
            isLoadingProjects: false,
            refreshProjects: vi.fn(),
            currentProject: projectWithRole,
            setCurrentProject: vi.fn(),
            members: [],
            isLoadingMembers: false,
            refreshMembers: vi.fn(),
            permissions,
            hasPermission: (resource: Resource, action: Action) => {
              const key = getPermissionKey(resource, action);
              return key ? permissions[key] || false : false;
            },
            gitStatus: null,
            refreshGitStatus: vi.fn(),
            schemas: [],
            isLoadingSchemas: false,
            schemasError: null,
            refreshSchemas: vi.fn(),
            collections: [],
            isLoadingCollections: false,
            refreshCollections: vi.fn(),
          }}
        >
          {children}
        </ProjectContext.Provider>
      </AuthContext.Provider>
    );
  };
}

describe('PermissionGate', () => {
  it('should render children when user has permission', () => {
    const Wrapper = createWrapper('owner');
    render(
      <PermissionGate permission="canEditEntries">
        <button>Edit Entry</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Edit Entry')).toBeInTheDocument();
  });

  it('should not render children when user lacks permission', () => {
    const Wrapper = createWrapper('editor');
    render(
      <PermissionGate permission="canDeleteProject">
        <button>Delete Project</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();
  });

  it('should render fallback when user lacks permission', () => {
    const Wrapper = createWrapper(null);
    render(
      <PermissionGate
        permission="canEditEntries"
        fallback={<span>No permission</span>}
      >
        <button>Edit Entry</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.queryByText('Edit Entry')).not.toBeInTheDocument();
    expect(screen.getByText('No permission')).toBeInTheDocument();
  });

  it('should allow editor to edit entries', () => {
    const Wrapper = createWrapper('editor');
    render(
      <PermissionGate permission="canEditEntries">
        <button>Edit Entry</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Edit Entry')).toBeInTheDocument();
  });

  it('should not allow editor to edit schemas', () => {
    const Wrapper = createWrapper('editor');
    render(
      <PermissionGate permission="canEditSchemas">
        <button>Edit Schema</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.queryByText('Edit Schema')).not.toBeInTheDocument();
  });

  it('should render children when user has resource permission', () => {
    const Wrapper = createWrapper('owner');
    render(
      <PermissionGate resource="agents" action="read">
        <button>Agent Audit</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Agent Audit')).toBeInTheDocument();
  });

  it('should render fallback when user lacks resource permission', () => {
    const Wrapper = createWrapper('editor');
    render(
      <PermissionGate resource="agents" action="update" fallback={<span>No agent access</span>}>
        <button>Agent Settings</button>
      </PermissionGate>,
      { wrapper: Wrapper }
    );

    expect(screen.queryByText('Agent Settings')).not.toBeInTheDocument();
    expect(screen.getByText('No agent access')).toBeInTheDocument();
  });
});

describe('AdminGate', () => {
  it('should render children for owner', () => {
    const Wrapper = createWrapper('owner');
    render(
      <AdminGate>
        <button>Admin Action</button>
      </AdminGate>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Admin Action')).toBeInTheDocument();
  });

  it('should render children for admin', () => {
    const Wrapper = createWrapper('owner');
    render(
      <AdminGate>
        <button>Admin Action</button>
      </AdminGate>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Admin Action')).toBeInTheDocument();
  });

  it('should not render children for editor', () => {
    const Wrapper = createWrapper('editor');
    render(
      <AdminGate>
        <button>Admin Action</button>
      </AdminGate>,
      { wrapper: Wrapper }
    );

    expect(screen.queryByText('Admin Action')).not.toBeInTheDocument();
  });
});
