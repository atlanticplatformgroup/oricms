import { Button, SegmentedControl } from '@mantine/core';
import {
  Cog6ToothIcon,
  PhotoIcon,
  RectangleStackIcon,
  RocketLaunchIcon,
  Square3Stack3DIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import type { Action, ContentType, Resource } from '@ori/shared';
import type { ComponentType, ReactNode } from 'react';
import { DEFAULT_SCHEMA_SECONDARY } from './constants';
import { buildWorkspacePath } from './routing';
import type { LoadedSchemaDocument, SchemaMode, SectionKey, SidebarOption } from './types';

type IconType = ComponentType<{ width?: number | string; height?: number | string }>;

export interface WorkspaceSectionRegistration {
  id: string;
  key: SectionKey;
  label: string;
  icon: IconType;
  secondaryNavigation?: 'rail' | 'inline';
  permission: {
    resource: Resource;
    action: Action;
  };
  staticSidebarOptions?: SidebarOption[];
  renderSidebarAction?: (context: WorkspaceSidebarActionContext) => ReactNode;
  renderSidebarControl?: (context: WorkspaceSidebarControlContext) => ReactNode;
}

export interface WorkspaceSidebarActionContext {
  canCreateCollections: boolean;
  onCreateCollection: () => void;
}

export interface WorkspaceSidebarControlContext {
  activeProjectSlug: string | null;
  activeBranchName: string | null;
  activeSchemaMode: SchemaMode;
  componentSchemaData: LoadedSchemaDocument[];
  contentTypes: ContentType[];
  navigateTo: (to: string, replace?: boolean) => void;
}

export interface WorkspaceSectionHeaderActionContext {
  section: SectionKey;
}

export interface WorkspaceBrowseToolbarContext {
  section: SectionKey;
}

export interface WorkspaceSectionHeaderActionRegistration {
  id: string;
  section: SectionKey;
  priority?: number;
  render: (context: WorkspaceSectionHeaderActionContext) => ReactNode;
}

export interface WorkspaceBrowseToolbarRegistration {
  id: string;
  section: SectionKey;
  slot: 'controls' | 'actions';
  priority?: number;
  render: (context: WorkspaceBrowseToolbarContext) => ReactNode;
}

export interface WorkspaceSecondaryPanelRegistration {
  id: string;
  section: SectionKey;
  priority?: number;
  render: (context: WorkspaceSectionHeaderActionContext) => ReactNode;
}

export interface WorkspaceBrowseDecorationRegistration {
  id: string;
  section: SectionKey;
  priority?: number;
  render: (context: WorkspaceBrowseToolbarContext) => ReactNode;
}

interface StoredSectionRegistration extends WorkspaceSectionRegistration {
  order: number;
}

interface StoredWorkspaceSectionHeaderActionRegistration extends WorkspaceSectionHeaderActionRegistration {
  order: number;
}

interface StoredWorkspaceBrowseToolbarRegistration extends WorkspaceBrowseToolbarRegistration {
  order: number;
}

interface StoredWorkspaceSecondaryPanelRegistration extends WorkspaceSecondaryPanelRegistration {
  order: number;
}

interface StoredWorkspaceBrowseDecorationRegistration extends WorkspaceBrowseDecorationRegistration {
  order: number;
}

export interface WorkspaceExtensionRegistry {
  registerSection: (registration: WorkspaceSectionRegistration) => void;
  registerHeaderAction: (registration: WorkspaceSectionHeaderActionRegistration) => void;
  registerBrowseToolbar: (registration: WorkspaceBrowseToolbarRegistration) => void;
  registerSecondaryPanel: (registration: WorkspaceSecondaryPanelRegistration) => void;
  registerBrowseDecoration: (registration: WorkspaceBrowseDecorationRegistration) => void;
  getSections: () => WorkspaceSectionRegistration[];
  getSection: (key: SectionKey) => WorkspaceSectionRegistration | null;
  getHeaderActions: (section: SectionKey) => WorkspaceSectionHeaderActionRegistration[];
  getBrowseToolbar: (section: SectionKey, slot: WorkspaceBrowseToolbarRegistration['slot']) => WorkspaceBrowseToolbarRegistration[];
  getSecondaryPanels: (section: SectionKey) => WorkspaceSecondaryPanelRegistration[];
  getBrowseDecorations: (section: SectionKey) => WorkspaceBrowseDecorationRegistration[];
  reset: () => void;
  initBuiltins: () => void;
}

export function registerBuiltinWorkspaceExtensions(registry: WorkspaceExtensionRegistry): void {
  registry.initBuiltins();
}

function rankByPriority<T extends { priority?: number; order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftPriority = left.priority ?? 0;
    const rightPriority = right.priority ?? 0;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
    return left.order - right.order;
  });
}

export function createWorkspaceExtensionRegistry(): WorkspaceExtensionRegistry {
  const sections = new Map<SectionKey, StoredSectionRegistration>();
  const headerActions = new Map<string, StoredWorkspaceSectionHeaderActionRegistration>();
  const browseToolbar = new Map<string, StoredWorkspaceBrowseToolbarRegistration>();
  const secondaryPanels = new Map<string, StoredWorkspaceSecondaryPanelRegistration>();
  const browseDecorations = new Map<string, StoredWorkspaceBrowseDecorationRegistration>();
  let order = 0;
  let builtinsInitialized = false;

  const registerSection = (registration: WorkspaceSectionRegistration) => {
    sections.set(registration.key, { ...registration, order: ++order });
  };

  const registerHeaderAction = (registration: WorkspaceSectionHeaderActionRegistration) => {
    headerActions.set(registration.id, { ...registration, order: ++order });
  };

  const registerBrowseToolbar = (registration: WorkspaceBrowseToolbarRegistration) => {
    browseToolbar.set(registration.id, { ...registration, order: ++order });
  };

  const registerSecondaryPanel = (registration: WorkspaceSecondaryPanelRegistration) => {
    secondaryPanels.set(registration.id, { ...registration, order: ++order });
  };

  const registerBrowseDecoration = (registration: WorkspaceBrowseDecorationRegistration) => {
    browseDecorations.set(registration.id, { ...registration, order: ++order });
  };

  return {
    registerSection,
    registerHeaderAction,
    registerBrowseToolbar,
    registerSecondaryPanel,
    registerBrowseDecoration,
    getSections: () => [...sections.values()].sort((left, right) => left.order - right.order),
    getSection: (key) => sections.get(key) ?? null,
    getHeaderActions: (section) => rankByPriority(
      [...headerActions.values()].filter((registration) => registration.section === section),
    ),
    getBrowseToolbar: (section, slot) => rankByPriority(
      [...browseToolbar.values()].filter((registration) => registration.section === section && registration.slot === slot),
    ),
    getSecondaryPanels: (section) => rankByPriority(
      [...secondaryPanels.values()].filter((registration) => registration.section === section),
    ),
    getBrowseDecorations: (section) => rankByPriority(
      [...browseDecorations.values()].filter((registration) => registration.section === section),
    ),
    reset: () => {
      sections.clear();
      headerActions.clear();
      browseToolbar.clear();
      secondaryPanels.clear();
      browseDecorations.clear();
      order = 0;
      builtinsInitialized = false;
    },
    initBuiltins: () => {
      if (builtinsInitialized) return;

      registerSection({
        id: 'builtin:collections',
        key: 'collections',
        label: 'Entries',
        icon: RectangleStackIcon,
        permission: { resource: 'entries', action: 'read' },
        renderSidebarAction: ({ canCreateCollections, onCreateCollection }) => (
          <Button size="xs" variant="default" onClick={onCreateCollection} disabled={!canCreateCollections}>
            New schema
          </Button>
        ),
      });

      registerSection({
        id: 'builtin:schemas',
        key: 'schemas',
        label: 'Schemas',
        icon: Square3Stack3DIcon,
        permission: { resource: 'schemas', action: 'read' },
        renderSidebarControl: ({ activeProjectSlug, activeBranchName, activeSchemaMode, componentSchemaData, contentTypes, navigateTo }) => (
          <SegmentedControl
            size="xs"
            value={activeSchemaMode}
            data={[{ label: 'Content Types', value: 'types' }, { label: 'Components', value: 'components' }]}
            fullWidth
            radius={6}
            styles={(theme) => ({
              root: {
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.gray[3]}`,
                padding: 0,
              },
              control: {
                '&[dataActive="true"]': {
                  boxShadow: 'none',
                },
              },
              indicator: {
                backgroundColor: theme.white,
                border: `1px solid ${theme.colors.gray[3]}`,
                boxShadow: 'none',
              },
              label: {
                color: theme.colors.gray[7],
                fontWeight: 600,
              },
            })}
            onChange={(nextMode) => {
              if (!activeProjectSlug) return;
              const mode = nextMode === 'components' ? 'components' : 'types';
              const fallback = mode === 'components'
                ? (componentSchemaData[0]?.schema.$id || DEFAULT_SCHEMA_SECONDARY)
                : (contentTypes[0]?.$id || DEFAULT_SCHEMA_SECONDARY);
              navigateTo(buildWorkspacePath(activeProjectSlug, 'schemas', fallback, { schemaMode: mode, branchName: activeBranchName }));
            }}
          />
        ),
      });

      registerSection({
        id: 'builtin:media',
        key: 'media',
        label: 'Media',
        icon: PhotoIcon,
        secondaryNavigation: 'inline',
        permission: { resource: 'assets', action: 'read' },
        staticSidebarOptions: [
          { id: 'all-assets', label: 'All Assets', description: 'Browse all files' },
          { id: 'images', label: 'Images', description: 'Image uploads' },
          { id: 'documents', label: 'Documents', description: 'File attachments' },
        ],
      });

      registerSection({
        id: 'builtin:builds',
        key: 'builds',
        label: 'Builds',
        icon: RocketLaunchIcon,
        secondaryNavigation: 'inline',
        permission: { resource: 'entries', action: 'read' },
        staticSidebarOptions: [
          { id: 'recent', label: 'Recent Builds', description: 'Latest deployment runs' },
          { id: 'running', label: 'Running', description: 'Active build jobs' },
          { id: 'failed', label: 'Failed', description: 'Requires attention' },
        ],
      });

      registerSection({
        id: 'builtin:members',
        key: 'members',
        label: 'Members',
        icon: UsersIcon,
        permission: { resource: 'members', action: 'read' },
        staticSidebarOptions: [
          { id: 'all-members', label: 'All Members', description: 'Humans and agents' },
          { id: 'humans', label: 'Humans', description: 'People with access' },
          { id: 'agents', label: 'AI Agents', description: 'Service accounts and roles' },
        ],
      });

      registerSection({
        id: 'builtin:settings',
        key: 'settings',
        label: 'Settings',
        icon: Cog6ToothIcon,
        permission: { resource: 'settings', action: 'read' },
        staticSidebarOptions: [
          { id: 'general', label: 'General', description: 'Project identity and defaults' },
          { id: 'branches', label: 'Branches', description: 'Create, rename, and remove branches' },
          { id: 'environments', label: 'Environments', description: 'Deployment targets and branch mappings' },
        ],
      });

      builtinsInitialized = true;
    },
  };
}

type GlobalState = typeof globalThis & { __oriWorkspaceExtensionRegistry__?: WorkspaceExtensionRegistry };
const globalState = globalThis as GlobalState;

export const workspaceExtensionRegistry = globalState.__oriWorkspaceExtensionRegistry__ ?? createWorkspaceExtensionRegistry();
globalState.__oriWorkspaceExtensionRegistry__ = workspaceExtensionRegistry;

export function initializeWorkspaceExtensions(): void {
  registerBuiltinWorkspaceExtensions(workspaceExtensionRegistry);
}

export function getStaticSidebarOptions(section: Exclude<SectionKey, 'collections' | 'schemas'>): SidebarOption[] {
  workspaceExtensionRegistry.initBuiltins();
  return workspaceExtensionRegistry.getSection(section)?.staticSidebarOptions ?? [];
}

export function getSectionSecondaryNavigation(section: SectionKey): 'rail' | 'inline' {
  workspaceExtensionRegistry.initBuiltins();
  return workspaceExtensionRegistry.getSection(section)?.secondaryNavigation ?? 'rail';
}
