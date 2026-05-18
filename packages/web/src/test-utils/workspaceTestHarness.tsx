import { render, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import type { CollectionEntry, ContentType, ProjectMember } from '@ori/shared';
import { initializeWorkspaceExtensions } from '../lib/workspace/registry';
import { appCssVariablesResolver, appTheme } from '../lib/theme';

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();
  return {
    ...actual,
    ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});

const hoisted = vi.hoisted(() => ({
  gitState: {
    currentBranch: 'main',
  },
  mocks: {
    logout: vi.fn(),
    showToast: vi.fn(),
    setCurrentProject: vi.fn(),
    refreshProjects: vi.fn(),
    projectState: {
      currentProject: undefined as any,
      projects: undefined as any,
      isLoadingProjects: undefined as boolean | undefined,
    },
    createProject: vi.fn(),
    updateEntry: vi.fn(),
    updateCollectionsConfig: vi.fn(),
    deleteCollection: vi.fn(),
    deleteEntry: vi.fn(),
    listEntries: vi.fn(),
    getEntryHistory: vi.fn(),
    getEntryVersion: vi.fn(),
    previewEntryBranchTransfer: vi.fn(),
    applyEntryBranchTransfer: vi.fn(),
    listAssets: vi.fn(),
    getAsset: vi.fn(),
    uploadAsset: vi.fn(),
    listGlobalAssets: vi.fn(),
    getGlobalAsset: vi.fn(),
    uploadGlobalAsset: vi.fn(),
    updateGlobalAssetMetadata: vi.fn(),
    deleteGlobalAsset: vi.fn(),
    updateAssetMetadata: vi.fn(),
    deleteAsset: vi.fn(),
    listBuilds: vi.fn(),
    buildSummary: vi.fn(),
    triggerBuild: vi.fn(),
    cancelBuild: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
    listBranchMappings: vi.fn(),
    createBranchMapping: vi.fn(),
    updateBranchMappingApi: vi.fn(),
    deleteBranchMappingApi: vi.fn(),
    useMembersHook: vi.fn(),
    inviteMemberHook: vi.fn(),
    updateMemberRoleHook: vi.fn(),
    removeMemberHook: vi.fn(),
    addAgentMemberHook: vi.fn(),
    getTypeSchemas: vi.fn(),
    getComponentSchemas: vi.fn(),
    getSchema: vi.fn(),
    saveSchema: vi.fn(),
    getBranches: vi.fn(),
    switchBranchApi: vi.fn(),
    createBranchApi: vi.fn(),
    renameBranchApi: vi.fn(),
    deleteBranchApi: vi.fn(),
    useCollections: vi.fn(),
    useCollectionEntries: vi.fn(),
    useContentTypes: vi.fn(),
    permissionMap: {} as Record<string, boolean>,
  },
}));

export const mocks = hoisted.mocks;

export const defaultCollections = [
  { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
  { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' },
];

export const defaultContentTypes: ContentType[] = [
  {
    $schema: 'content-type-v1',
    $id: 'post',
    name: 'post',
    plural: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    fields: [{ key: 'title', label: 'Title', type: 'string' }],
    display: { primary: 'title' },
  },
  {
    $schema: 'content-type-v1',
    $id: 'page',
    name: 'page',
    plural: 'pages',
    label: 'Page',
    labelPlural: 'Pages',
    fields: [{ key: 'title', label: 'Title', type: 'string' }],
    display: { primary: 'title' },
  },
];

export const defaultEntriesByCollection: Record<string, CollectionEntry[]> = {
  posts: [
    {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Welcome',
    },
  ],
  pages: [
    {
      $id: 'page-1',
      $type: 'page',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'About',
    },
  ],
};

export const defaultMembers: ProjectMember[] = [
  {
    id: 'member-1',
    projectId: 'project-1',
    userId: 'user-1',
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner Example',
      type: 'HUMAN',
      avatarUrl: null,
      githubId: null,
      preferences: {
        theme: 'light',
        editorMode: 'split',
        notifications: { builds: true, invites: true, mentions: true },
        lastVisitedProjectId: null,
        projectDefaults: {},
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    role: 'owner',
    userType: 'HUMAN',
    joinedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'member-2',
    projectId: 'project-1',
    userId: 'agent-1',
    user: {
      id: 'agent-1',
      email: 'agent@example.com',
      name: 'Schema Agent',
      type: 'AGENT',
      avatarUrl: null,
      githubId: null,
      preferences: {
        theme: 'light',
        editorMode: 'split',
        notifications: { builds: true, invites: true, mentions: true },
        lastVisitedProjectId: null,
        projectDefaults: {},
      },
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    role: 'viewer',
    userType: 'AGENT',
    joinedAt: '2026-01-02T00:00:00.000Z',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
    logout: hoisted.mocks.logout,
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: hoisted.mocks.showToast }),
}));

vi.mock('../contexts/useProject', () => {
  const currentProject = {
    id: 'project-1',
    name: 'Project One',
    slug: 'project-one',
    repoUrl: 'https://github.com/example/project-one',
    repoProvider: 'github',
    defaultBranch: 'main',
    description: 'A managed project',
    avatarUrl: null,
    settings: {
      contentRoot: 'content',
      environments: [
        { id: 'env-preview', name: 'Preview', url: 'https://preview.example.com', type: 'preview', order: 0 },
        { id: 'env-live', name: 'Production', url: 'https://example.com', type: 'live', order: 1 },
      ],
      defaultEnvironmentId: 'env-preview',
      collections: [
        { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
        { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' },
      ],
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    role: 'owner',
  };
  const buildValue = () => ({
    currentProject: hoisted.mocks.projectState.currentProject === undefined ? currentProject : hoisted.mocks.projectState.currentProject,
    projects: hoisted.mocks.projectState.projects === undefined ? [currentProject] : hoisted.mocks.projectState.projects,
    setCurrentProject: (project: typeof currentProject | null) => {
      hoisted.mocks.projectState.currentProject = project;
      hoisted.mocks.setCurrentProject(project);
    },
    isLoadingProjects: hoisted.mocks.projectState.isLoadingProjects ?? false,
    refreshProjects: hoisted.mocks.refreshProjects,
  });

  return {
    useProject: () => buildValue(),
    useProjectPermissions: () => ({
      hasPermission: (resource: string, action: string) => hoisted.mocks.permissionMap[`${resource}:${action}`] ?? false,
    }),
  };
});

vi.mock('../hooks/queries/useCollectionQueries', () => ({
  useCollections: (...args: unknown[]) => hoisted.mocks.useCollections(...args),
  useCollectionEntries: (...args: unknown[]) => hoisted.mocks.useCollectionEntries(...args),
  useContentTypes: (...args: unknown[]) => hoisted.mocks.useContentTypes(...args),
  collectionQueryKeys: {
    entries: (...args: unknown[]) => ['collections', 'entries', ...args],
    lists: (...args: unknown[]) => ['collections', 'lists', ...args],
  },
}));

vi.mock('../hooks/useGitStatus', () => ({
  useGitStatus: () => ({
    status: { branch: hoisted.gitState.currentBranch },
    branchMappings: [],
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../hooks/queries/useProjectQueries', () => ({
  useMembers: (...args: unknown[]) => hoisted.mocks.useMembersHook(...args),
  useInviteMember: (...args: unknown[]) => hoisted.mocks.inviteMemberHook(...args),
  useUpdateMemberRole: (...args: unknown[]) => hoisted.mocks.updateMemberRoleHook(...args),
  useRemoveMember: (...args: unknown[]) => hoisted.mocks.removeMemberHook(...args),
  useAddAgentMember: (...args: unknown[]) => hoisted.mocks.addAgentMemberHook(...args),
}));

vi.mock('../lib/api/client', () => ({
  collectionsApi: {
    updateEntry: (...args: unknown[]) => hoisted.mocks.updateEntry(...args),
    updateConfig: (...args: unknown[]) => hoisted.mocks.updateCollectionsConfig(...args),
    deleteCollection: (...args: unknown[]) => hoisted.mocks.deleteCollection(...args),
    createEntry: vi.fn().mockResolvedValue({ entry: { $id: 'new-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Untitled' }, meta: { revision: 'rev-new-1' } }),
    getEntry: vi.fn().mockResolvedValue({ entry: { $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Welcome' }, meta: { revision: 'rev-post-1' } }),
    listEntries: (...args: unknown[]) => hoisted.mocks.listEntries(...args),
    deleteEntry: (...args: unknown[]) => hoisted.mocks.deleteEntry(...args),
    getEntryHistory: (...args: unknown[]) => hoisted.mocks.getEntryHistory(...args),
    getEntryVersion: (...args: unknown[]) => hoisted.mocks.getEntryVersion(...args),
    previewEntryBranchTransfer: (...args: unknown[]) => hoisted.mocks.previewEntryBranchTransfer(...args),
    applyEntryBranchTransfer: (...args: unknown[]) => hoisted.mocks.applyEntryBranchTransfer(...args),
  },
  assetsApi: {
    list: (...args: unknown[]) => hoisted.mocks.listAssets(...args),
    get: (...args: unknown[]) => hoisted.mocks.getAsset(...args),
    updateMetadata: (...args: unknown[]) => hoisted.mocks.updateAssetMetadata(...args),
    delete: (...args: unknown[]) => hoisted.mocks.deleteAsset(...args),
  },
  buildsApi: {
    list: (...args: unknown[]) => hoisted.mocks.listBuilds(...args),
    getSummary: (...args: unknown[]) => hoisted.mocks.buildSummary(...args),
    trigger: (...args: unknown[]) => hoisted.mocks.triggerBuild(...args),
    cancel: (...args: unknown[]) => hoisted.mocks.cancelBuild(...args),
  },
  projectsApi: {
    get: (...args: unknown[]) => hoisted.mocks.getProject(...args),
    update: (...args: unknown[]) => hoisted.mocks.updateProject(...args),
    listBranchMappings: (...args: unknown[]) => hoisted.mocks.listBranchMappings(...args),
    createBranchMapping: (...args: unknown[]) => hoisted.mocks.createBranchMapping(...args),
    updateBranchMapping: (...args: unknown[]) => hoisted.mocks.updateBranchMappingApi(...args),
    deleteBranchMapping: (...args: unknown[]) => hoisted.mocks.deleteBranchMappingApi(...args),
  },
  gitApi: {
    getTypeSchemas: (...args: unknown[]) => hoisted.mocks.getTypeSchemas(...args),
    getComponentSchemas: (...args: unknown[]) => hoisted.mocks.getComponentSchemas(...args),
    getSchema: (...args: unknown[]) => hoisted.mocks.getSchema(...args),
    saveSchema: (...args: unknown[]) => hoisted.mocks.saveSchema(...args),
  },
}));

vi.mock('../lib/api/core', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/core')>('../lib/api/core');
  return { ...actual, request: vi.fn().mockResolvedValue({}) };
});

vi.mock('../lib/api/locks', () => ({
  locksApi: {
    acquire: vi.fn().mockResolvedValue({
      lock: {
        id: 'lock-1',
        projectId: 'project-1',
        resourceType: 'members',
        resourceId: 'project-members',
        mode: 'hard',
        holderType: 'human',
        holderId: 'user-1',
        holderName: 'Owner Example',
        sessionId: 'session-1',
        reason: 'configuring',
        acquiredAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-01T00:00:45.000Z',
      },
      lockToken: 'lock-token-1',
    }),
    renew: vi.fn(),
    release: vi.fn().mockResolvedValue({ released: true }),
    status: vi.fn().mockResolvedValue({ locks: [] }),
    mutationHeaders: vi.fn().mockImplementation((lockToken?: string) => ({
      'x-ori-session-id': 'session-1',
      ...(lockToken ? { 'x-ori-lock-token': lockToken } : {}),
    })),
  },
}));

vi.mock('../lib/api/assets', () => ({
  assetsApi: {
    list: (...args: unknown[]) => hoisted.mocks.listAssets(...args),
    get: (...args: unknown[]) => hoisted.mocks.getAsset(...args),
    upload: (...args: unknown[]) => hoisted.mocks.uploadAsset(...args),
    updateMetadata: (...args: unknown[]) => hoisted.mocks.updateAssetMetadata(...args),
    delete: (...args: unknown[]) => hoisted.mocks.deleteAsset(...args),
  },
  globalAssetsApi: {
    list: (...args: unknown[]) => hoisted.mocks.listGlobalAssets(...args),
    get: (...args: unknown[]) => hoisted.mocks.getGlobalAsset(...args),
    upload: (...args: unknown[]) => hoisted.mocks.uploadGlobalAsset(...args),
    updateMetadata: (...args: unknown[]) => hoisted.mocks.updateGlobalAssetMetadata(...args),
    delete: (...args: unknown[]) => hoisted.mocks.deleteGlobalAsset(...args),
  },
}));

vi.mock('../lib/api/collections', () => ({
  contentTypesApi: {
    list: vi.fn().mockResolvedValue({
      contentTypes: [
        {
          $schema: 'content-type-v1',
          $id: 'post',
          name: 'post',
          plural: 'posts',
          label: 'Post',
          labelPlural: 'Posts',
          fields: [{ key: 'title', label: 'Title', type: 'string' }],
          display: { primary: 'title' },
        },
        {
          $schema: 'content-type-v1',
          $id: 'page',
          name: 'page',
          plural: 'pages',
          label: 'Page',
          labelPlural: 'Pages',
          fields: [{ key: 'title', label: 'Title', type: 'string' }],
          display: { primary: 'title' },
        },
      ],
    }),
  },
  collectionsApi: {
    updateEntry: (...args: unknown[]) => hoisted.mocks.updateEntry(...args),
    updateConfig: (...args: unknown[]) => hoisted.mocks.updateCollectionsConfig(...args),
    deleteCollection: (...args: unknown[]) => hoisted.mocks.deleteCollection(...args),
    createEntry: vi.fn().mockResolvedValue({ entry: { $id: 'new-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Untitled' }, meta: { revision: 'rev-new-1' } }),
    getEntry: vi.fn().mockResolvedValue({ entry: { $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '2026-01-01T00:00:00.000Z', $updatedAt: '2026-01-01T00:00:00.000Z', title: 'Welcome' }, meta: { revision: 'rev-post-1' } }),
    list: vi.fn().mockResolvedValue({
      collections: [
        { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
        { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' },
      ],
    }),
    listEntries: (...args: unknown[]) => hoisted.mocks.listEntries(...args),
    deleteEntry: (...args: unknown[]) => hoisted.mocks.deleteEntry(...args),
    getEntryHistory: (...args: unknown[]) => hoisted.mocks.getEntryHistory(...args),
    getEntryVersion: (...args: unknown[]) => hoisted.mocks.getEntryVersion(...args),
    previewEntryBranchTransfer: (...args: unknown[]) => hoisted.mocks.previewEntryBranchTransfer(...args),
    applyEntryBranchTransfer: (...args: unknown[]) => hoisted.mocks.applyEntryBranchTransfer(...args),
  },
}));

vi.mock('../lib/api/builds', () => ({
  buildsApi: {
    list: (...args: unknown[]) => hoisted.mocks.listBuilds(...args),
    getSummary: (...args: unknown[]) => hoisted.mocks.buildSummary(...args),
    trigger: (...args: unknown[]) => hoisted.mocks.triggerBuild(...args),
    cancel: (...args: unknown[]) => hoisted.mocks.cancelBuild(...args),
  },
}));

vi.mock('../lib/api/projects', () => ({
  projectsApi: {
    get: (...args: unknown[]) => hoisted.mocks.getProject(...args),
    update: (...args: unknown[]) => hoisted.mocks.updateProject(...args),
    listBranchMappings: (...args: unknown[]) => hoisted.mocks.listBranchMappings(...args),
    createBranchMapping: (...args: unknown[]) => hoisted.mocks.createBranchMapping(...args),
    updateBranchMapping: (...args: unknown[]) => hoisted.mocks.updateBranchMappingApi(...args),
    deleteBranchMapping: (...args: unknown[]) => hoisted.mocks.deleteBranchMappingApi(...args),
    list: vi.fn().mockResolvedValue({ projects: [{ id: 'project-1', name: 'Project One', slug: 'project-one', role: 'owner' }] }),
    listMembers: vi.fn().mockResolvedValue({ members: [] }),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    addAgentMember: vi.fn(),
    create: (...args: unknown[]) => hoisted.mocks.createProject(...args),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/api/git', () => ({
  gitApi: {
    getTypeSchemas: (...args: unknown[]) => hoisted.mocks.getTypeSchemas(...args),
    getComponentSchemas: (...args: unknown[]) => hoisted.mocks.getComponentSchemas(...args),
    getSchema: (...args: unknown[]) => hoisted.mocks.getSchema(...args),
    saveSchema: (...args: unknown[]) => hoisted.mocks.saveSchema(...args),
    getStatus: vi.fn().mockResolvedValue({ status: { ahead: 0, behind: 0, modified: [], staged: [] } }),
    getBranches: (...args: unknown[]) => hoisted.mocks.getBranches(...args),
    switchBranch: (...args: unknown[]) => hoisted.mocks.switchBranchApi(...args),
    createBranch: (...args: unknown[]) => hoisted.mocks.createBranchApi(...args),
    renameBranch: (...args: unknown[]) => hoisted.mocks.renameBranchApi(...args),
    deleteBranch: (...args: unknown[]) => hoisted.mocks.deleteBranchApi(...args),
    getSchemas: vi.fn().mockResolvedValue({ schemas: [] }),
    compareBranches: vi.fn().mockResolvedValue({ base: 'main', head: 'staging', ahead: 0, behind: 0 }),
    getHistory: vi.fn().mockResolvedValue({ history: [] }),
    deleteSchema: vi.fn(),
  },
}));

import App from '../App';

export function renderApp(initialPath: string) {
  initializeWorkspaceExtensions();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });

  return render(
    <MantineProvider theme={appTheme} cssVariablesResolver={appCssVariablesResolver}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

export function setupWorkspaceTestHarness() {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1440,
    });
    window.dispatchEvent(new Event('resize'));
    hoisted.gitState.currentBranch = 'main';
    hoisted.mocks.projectState.currentProject = undefined;
    hoisted.mocks.projectState.projects = undefined;
    hoisted.mocks.projectState.isLoadingProjects = undefined;
    hoisted.mocks.refreshProjects.mockResolvedValue(undefined);
    hoisted.mocks.createProject.mockResolvedValue({
      project: {
        id: 'project-created',
        name: 'My First Project',
        slug: 'my-first-project',
        repoUrl: null,
        repoProvider: 'local',
        defaultBranch: 'main',
        description: null,
        avatarUrl: null,
        settings: { contentRoot: 'content', environments: [], collections: [] },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    hoisted.mocks.permissionMap = {
      'collections:read': true,
      'collections:create': true,
      'collections:update': true,
      'collections:delete': true,
      'entries:read': true,
      'entries:create': true,
      'entries:update': true,
      'entries:delete': true,
      'schemas:read': true,
      'schemas:create': true,
      'schemas:update': true,
      'schemas:delete': true,
      'assets:read': true,
      'assets:create': true,
      'assets:update': true,
      'assets:delete': true,
      'members:read': true,
      'settings:read': true,
      'settings:update': false,
    };

    hoisted.mocks.useCollections.mockReturnValue({ data: { collections: defaultCollections }, isLoading: false, isError: false });
    hoisted.mocks.useContentTypes.mockReturnValue({ data: { contentTypes: defaultContentTypes }, isLoading: false, isError: false });
    hoisted.mocks.useCollectionEntries.mockImplementation((_projectId: string | undefined, collectionId?: string) => ({
      data: {
        data: defaultEntriesByCollection[collectionId || 'posts'] || [],
        meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } },
      },
      isLoading: false,
      isError: false,
    }));

    hoisted.mocks.updateEntry.mockResolvedValue({ entry: { ...defaultEntriesByCollection.posts[0], title: 'Updated Welcome', $updatedAt: '2026-01-02T00:00:00.000Z' }, meta: { revision: 'rev-updated-post-1' } });
    hoisted.mocks.getEntryHistory.mockResolvedValue({ history: [] });
    hoisted.mocks.getEntryVersion.mockResolvedValue({ entry: defaultEntriesByCollection.posts[0] });
    hoisted.mocks.previewEntryBranchTransfer.mockResolvedValue({
      sourceBranch: 'main',
      targetBranch: 'staging',
      entryId: 'post-1',
      collectionId: 'posts',
      sourceExists: true,
      targetExists: true,
      modeAvailability: { entire_entry: true, selected_paths: true },
      diffTree: [{ pointer: '/title', label: 'Title', kind: 'changed', field: { key: 'title', label: 'Title', type: 'string' } }],
      conflicts: [],
      schemaCompatibility: { matches: true, message: null },
      defaultCommitMessage: 'Copy Welcome to staging',
    });
    hoisted.mocks.applyEntryBranchTransfer.mockResolvedValue({
      committed: true,
      hash: 'abc123',
      message: 'Copy Welcome to staging',
      appliedPointerCount: 1,
    });
    hoisted.mocks.updateCollectionsConfig.mockResolvedValue(undefined);
    hoisted.mocks.deleteCollection.mockResolvedValue(undefined);
    hoisted.mocks.deleteEntry.mockResolvedValue(undefined);
    hoisted.mocks.listEntries.mockResolvedValue({ data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 0 } } });
    hoisted.mocks.listAssets.mockImplementation(async (_projectId: string, folderOrOptions?: string | { folder?: string; tag?: string; usage?: 'all' | 'used' | 'unused'; search?: string; sort?: string; limit?: number; offset?: number }) => {
      const options = typeof folderOrOptions === 'string'
        ? { folder: folderOrOptions }
        : (folderOrOptions || {});
      const tag = (options as { tag?: string }).tag;
      const folder = options.folder || 'images';
      const usage = (options as { usage?: 'all' | 'used' | 'unused' }).usage || 'all';
      const allAssets =
        folder === 'documents'
          ? [{ path: '/docs/style-guide.pdf', name: 'style-guide.pdf', folder: 'documents', size: 4096, type: 'document', url: 'https://example.com/style-guide.pdf', lastModified: '2026-01-03T00:00:00.000Z', metadata: { caption: 'Editorial guide', tags: ['guides'] }, usage: { count: 1, status: 'used' as const } }]
          : folder === 'all'
            ? [
                { path: '/media/current-hero.jpg', name: 'current-hero.jpg', folder: 'images', size: 1200, type: 'image', url: 'https://example.com/current-hero.jpg', lastModified: '2026-01-01T00:00:00.000Z', metadata: { altText: 'Current hero image', caption: 'Current caption', tags: ['homepage'] }, usage: { count: 2, status: 'used' as const } },
                { path: '/media/selected-hero.jpg', name: 'selected-hero.jpg', folder: 'images', size: 1100, type: 'image', url: 'https://example.com/selected-hero.jpg', lastModified: '2026-01-02T00:00:00.000Z', metadata: { altText: 'Selected hero image', tags: ['blog'] }, usage: { count: 0, status: 'unused' as const } },
                { path: '/docs/style-guide.pdf', name: 'style-guide.pdf', folder: 'documents', size: 4096, type: 'document', url: 'https://example.com/style-guide.pdf', lastModified: '2026-01-03T00:00:00.000Z', metadata: { caption: 'Editorial guide', tags: ['guides'] }, usage: { count: 1, status: 'used' as const } },
              ]
            : [
                { path: '/media/current-hero.jpg', name: 'current-hero.jpg', folder: 'images', size: 1200, type: 'image', url: 'https://example.com/current-hero.jpg', lastModified: '2026-01-01T00:00:00.000Z', metadata: { altText: 'Current hero image', caption: 'Current caption', tags: ['homepage'] }, usage: { count: 2, status: 'used' as const } },
                { path: '/media/selected-hero.jpg', name: 'selected-hero.jpg', folder: 'images', size: 1100, type: 'image', url: 'https://example.com/selected-hero.jpg', lastModified: '2026-01-02T00:00:00.000Z', metadata: { altText: 'Selected hero image', tags: ['blog'] }, usage: { count: 0, status: 'unused' as const } },
              ];

      const searchedAssets = allAssets.filter((asset) => {
        if (tag && !(asset.metadata?.tags || []).includes(tag)) return false;
        if (!options.search) return true;
        const query = options.search.toLowerCase();
        return [asset.name, asset.path, String(asset.metadata?.altText || ''), String(asset.metadata?.caption || ''), ...((asset.metadata?.tags as string[] | undefined) || [])]
          .some((value) => value.toLowerCase().includes(query));
      });

      const usageFilteredAssets = searchedAssets.filter((asset) => {
        if (usage === 'used') return asset.usage?.status === 'used';
        if (usage === 'unused') return asset.usage?.status === 'unused';
        return true;
      });

      const offset = options.offset || 0;
      const limit = options.limit;
      const pagedAssets = typeof limit === 'number' ? usageFilteredAssets.slice(offset, offset + limit) : usageFilteredAssets;

      return {
        assets: pagedAssets,
        pagination: {
          total: usageFilteredAssets.length,
          limit: typeof limit === 'number' ? limit : null,
          offset,
          hasMore: typeof limit === 'number' ? offset + pagedAssets.length < usageFilteredAssets.length : false,
        },
        facets: {
          tags: Array.from(
            allAssets.reduce((counts, asset) => {
              const tags = ((asset.metadata?.tags as string[] | undefined) || []).filter(Boolean);
              if (!tags.length) {
                counts.set('__untagged__', (counts.get('__untagged__') || 0) + 1);
                return counts;
              }
              tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
              return counts;
            }, new Map<string, number>()),
          )
            .map(([value, count]) => ({
              value,
              label: value === '__untagged__' ? 'Untagged' : value,
              count,
            }))
            .sort((left, right) => {
              if (right.count !== left.count) return right.count - left.count;
              return left.label.localeCompare(right.label);
            }),
          usage: {
            used: searchedAssets.filter((asset) => asset.usage?.status === 'used').length,
            unused: searchedAssets.filter((asset) => asset.usage?.status !== 'used').length,
          },
        },
      };
    });
    hoisted.mocks.getAsset.mockImplementation(async (_projectId: string, assetPath: string) => ({
      asset:
        assetPath === '/docs/style-guide.pdf'
          ? {
              path: '/docs/style-guide.pdf',
              name: 'style-guide.pdf',
              folder: 'documents',
              size: 4096,
              type: 'document',
              url: 'https://example.com/style-guide.pdf',
              lastModified: '2026-01-03T00:00:00.000Z',
              metadata: { caption: 'Editorial guide', tags: ['guides'] },
              usage: { count: 1, status: 'used' as const },
              usageDetail: {
                references: [
                  {
                    collectionId: 'pages',
                    collectionLabel: 'Pages',
                    entryId: 'page-1',
                    entryLabel: 'About',
                    entryPath: 'content/pages/page-1.json',
                  },
                ],
              },
            }
          : {
              path: '/media/current-hero.jpg',
              name: 'current-hero.jpg',
              folder: 'images',
              size: 1200,
              type: 'image',
              url: 'https://example.com/current-hero.jpg',
              lastModified: '2026-01-01T00:00:00.000Z',
              metadata: { altText: 'Current hero image', caption: 'Current caption', tags: ['homepage'] },
              usage: { count: 2, status: 'used' as const },
              usageDetail: {
                references: [
                  {
                    collectionId: 'posts',
                    collectionLabel: 'Posts',
                    entryId: 'post-1',
                    entryLabel: 'Welcome',
                    entryPath: 'content/posts/post-1.json',
                  },
                  {
                    collectionId: 'pages',
                    collectionLabel: 'Pages',
                    entryId: 'page-1',
                    entryLabel: 'About',
                    entryPath: 'content/pages/page-1.json',
                  },
                ],
              },
            },
    }));
    hoisted.mocks.uploadAsset.mockImplementation(async (_projectId: string, filename: string, _content: string, folder?: string, metadata?: { tags?: string[] }) => ({
      asset: {
        path: folder === 'documents' ? `/docs/${filename}` : `/media/${filename}`,
        name: filename,
        folder: folder || 'images',
        size: 2048,
        type: folder === 'documents' ? 'document' : 'image',
        url: `https://example.com/${filename}`,
        lastModified: '2026-01-04T00:00:00.000Z',
        metadata: metadata || {},
      },
    }));
    hoisted.mocks.listGlobalAssets.mockResolvedValue({
      assets: [
        {
          assetId: 'brand/logo-primary.png',
          scope: 'global',
          path: 'brand/logo-primary.png',
          name: 'logo-primary.png',
          folder: 'brand',
          size: 1337,
          type: 'image',
          url: 'https://example.com/global/logo-primary.png',
          lastModified: '2026-01-05T00:00:00.000Z',
          metadata: { altText: 'Primary brand logo', caption: 'Approved primary logo', tags: ['brand'] },
        },
      ],
    });
    hoisted.mocks.getGlobalAsset.mockResolvedValue({
      asset: {
        assetId: 'brand/logo-primary.png',
        scope: 'global',
        path: 'brand/logo-primary.png',
        name: 'logo-primary.png',
        folder: 'brand',
        size: 1337,
        type: 'image',
        url: 'https://example.com/global/logo-primary.png',
        lastModified: '2026-01-05T00:00:00.000Z',
        metadata: { altText: 'Primary brand logo', caption: 'Approved primary logo', tags: ['brand'] },
      },
    });
    hoisted.mocks.uploadGlobalAsset.mockImplementation(async (_projectId: string, filename: string, _content: string, folder?: string, tags?: string[]) => ({
      asset: {
        assetId: `${folder || 'images'}/${filename}`,
        scope: 'global',
        path: `${folder || 'images'}/${filename}`,
        name: filename,
        folder: folder || 'images',
        size: 2048,
        type: folder === 'documents' ? 'document' : 'image',
        url: `https://example.com/global/${filename}`,
        lastModified: '2026-01-06T00:00:00.000Z',
        metadata: tags?.length ? { tags } : {},
      },
    }));
    hoisted.mocks.updateGlobalAssetMetadata.mockImplementation(async (_projectId: string, assetId: string, metadata: Record<string, unknown>) => ({
      asset: {
        assetId,
        scope: 'global',
        path: assetId,
        name: assetId.split('/').pop() || assetId,
        folder: assetId.includes('/') ? assetId.slice(0, assetId.lastIndexOf('/')) : '',
        size: 2048,
        type: assetId.endsWith('.pdf') ? 'document' : 'image',
        url: `https://example.com/global/${assetId}`,
        lastModified: '2026-01-06T00:00:00.000Z',
        metadata,
      },
      metadata,
    }));
    hoisted.mocks.deleteGlobalAsset.mockResolvedValue(undefined);
    hoisted.mocks.updateAssetMetadata.mockResolvedValue({ metadata: {} });
    hoisted.mocks.deleteAsset.mockResolvedValue(undefined);
    hoisted.mocks.listBuilds.mockResolvedValue({
      builds: [
        { id: 'build-1', status: 'running', branch: 'main', commit: 'abcdef1234567890', commitMessage: 'Deploy homepage refresh', commitAuthor: 'Owner', triggeredBy: 'manual', createdAt: '2026-01-02T00:00:00.000Z', duration: 45000, outputUrl: 'https://preview.example.com' },
        { id: 'build-2', status: 'failed', branch: 'preview', commit: '1234567890abcdef', commitMessage: 'Preview deploy', commitAuthor: 'Owner', triggeredBy: 'manual', createdAt: '2026-01-01T00:00:00.000Z', duration: 32000 },
      ],
      pagination: { total: 2, limit: 20, offset: 0, hasMore: false },
    });
    hoisted.mocks.buildSummary.mockResolvedValue({
      latestBuild: { id: 'build-1', status: 'running', branch: 'main', commit: 'abcdef1234567890', commitMessage: 'Deploy homepage refresh', commitAuthor: 'Owner', triggeredBy: 'manual', createdAt: '2026-01-02T00:00:00.000Z' },
      counts: { pending: 0, running: 1, success: 4, failed: 1, cancelled: 0, total: 6 },
    });
    hoisted.mocks.triggerBuild.mockResolvedValue({ build: {}, message: 'Build triggered successfully' });
    hoisted.mocks.cancelBuild.mockResolvedValue({ build: {}, message: 'Build cancelled' });
    hoisted.mocks.getProject.mockResolvedValue({ project: { id: 'project-1', name: 'Project One', slug: 'project-one', repoUrl: 'https://github.com/example/project-one', repoProvider: 'github', defaultBranch: 'main', description: 'A managed project', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', settings: { contentRoot: 'content', environments: [{ id: 'env-preview', name: 'Preview', url: 'https://preview.example.com', type: 'preview', order: 0 }, { id: 'env-live', name: 'Production', url: 'https://example.com', type: 'live', order: 1 }], defaultEnvironmentId: 'env-preview', collections: defaultCollections } } });
    hoisted.mocks.updateProject.mockResolvedValue({ project: {} });
    hoisted.mocks.listBranchMappings.mockResolvedValue({ mappings: [{ id: 'map-1', projectId: 'project-1', branchPattern: 'main', environmentId: 'env-live', autoDeploy: true, deployOnMerge: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], defaults: [] });
    hoisted.mocks.createBranchMapping.mockResolvedValue({ mapping: {} });
    hoisted.mocks.updateBranchMappingApi.mockResolvedValue({ mapping: {} });
    hoisted.mocks.deleteBranchMappingApi.mockResolvedValue(undefined);
    hoisted.mocks.useMembersHook.mockReturnValue({ data: { members: defaultMembers }, isLoading: false, isError: false });
    hoisted.mocks.inviteMemberHook.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    hoisted.mocks.updateMemberRoleHook.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hoisted.mocks.removeMemberHook.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hoisted.mocks.addAgentMemberHook.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ token: 'agt_demo_token', member: defaultMembers[1] }), isPending: false });
    hoisted.mocks.getComponentSchemas.mockResolvedValue({ schemas: [{ path: 'schemas/components/callout-block.json' }, { path: 'schemas/components/quote-block.json' }] });
    hoisted.mocks.getTypeSchemas.mockResolvedValue({ schemas: [{ path: 'schemas/types/post.json' }, { path: 'schemas/types/page.json' }] });
    hoisted.mocks.getSchema.mockImplementation(async (_projectId: string, path: string) => {
      if (path.includes('schemas/types/post.json')) return { content: JSON.stringify(defaultContentTypes[0]) };
      if (path.includes('schemas/types/page.json')) return { content: JSON.stringify(defaultContentTypes[1]) };
      if (path.includes('callout-block')) return { content: JSON.stringify({ $id: 'callout-block', name: 'callout-block', label: 'Callout Block', fields: [{ key: 'headline', label: 'Headline', type: 'string' }, { key: 'tone', label: 'Tone', type: 'select', options: { choices: [{ value: 'info', label: 'Info' }] } }] }) };
      return { content: JSON.stringify({ $id: 'quote-block', name: 'quote-block', label: 'Quote Block', fields: [{ key: 'quote', label: 'Quote', type: 'text' }, { key: 'attribution', label: 'Attribution', type: 'string' }] }) };
    });
    hoisted.mocks.saveSchema.mockResolvedValue(undefined);
    hoisted.mocks.getBranches.mockImplementation(async () => ({
      branches: [
        { name: 'main', isCurrent: hoisted.gitState.currentBranch === 'main', isDefault: true, isProtected: true, lastCommit: { hash: '', message: '', author: '', date: '' } },
        { name: 'staging', isCurrent: hoisted.gitState.currentBranch === 'staging', isDefault: false, isProtected: false, lastCommit: { hash: '', message: '', author: '', date: '' } },
      ],
      current: hoisted.gitState.currentBranch,
    }));
    hoisted.mocks.switchBranchApi.mockImplementation(async (_projectId: string, branchName: string) => {
      hoisted.gitState.currentBranch = branchName;
      return {
        branches: [
          { name: 'main', isCurrent: branchName === 'main', isDefault: true, isProtected: true, lastCommit: { hash: '', message: '', author: '', date: '' } },
          { name: 'staging', isCurrent: branchName === 'staging', isDefault: false, isProtected: false, lastCommit: { hash: '', message: '', author: '', date: '' } },
        ],
        current: branchName,
      };
    });
    hoisted.mocks.createBranchApi.mockResolvedValue({
      branches: [
        { name: 'main', isCurrent: true, isDefault: true, isProtected: true, lastCommit: { hash: '', message: '', author: '', date: '' } },
        { name: 'staging', isCurrent: false, isDefault: false, isProtected: false, lastCommit: { hash: '', message: '', author: '', date: '' } },
        { name: 'release', isCurrent: false, isDefault: false, isProtected: false, lastCommit: { hash: '', message: '', author: '', date: '' } },
      ],
      current: 'main',
    });
    hoisted.mocks.switchBranchApi.mockResolvedValue({
      branches: [
        { name: 'main', isCurrent: false, isDefault: true, isProtected: true, lastCommit: { hash: '', message: '', author: '', date: '' } },
        { name: 'staging', isCurrent: true, isDefault: false, isProtected: false, lastCommit: { hash: '', message: '', author: '', date: '' } },
      ],
      current: 'staging',
    });
    hoisted.mocks.renameBranchApi.mockResolvedValue({ branch: { name: 'release' }, updatedMappings: 1 });
    hoisted.mocks.deleteBranchApi.mockResolvedValue({ deleted: true, removedMappings: 1 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
}

export async function waitForCollectionsHeading(name: string) {
  await waitFor(() => {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });
}
