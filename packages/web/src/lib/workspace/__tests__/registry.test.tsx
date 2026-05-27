import { describe, expect, it } from 'vitest';
import { createWorkspaceExtensionRegistry } from '../registry';

describe('workspace extension registry', () => {
  it('registers builtin sections once', () => {
    const registry = createWorkspaceExtensionRegistry();
    registry.initBuiltins();
    const firstCount = registry.getSections().length;
    registry.initBuiltins();
    expect(registry.getSections()).toHaveLength(firstCount);
    expect(registry.getSection('collections')?.label).toBe('Entries');
  });

  it('defines builtin sections and static sidebar options in registry order', () => {
    const registry = createWorkspaceExtensionRegistry();
    registry.initBuiltins();

    expect(registry.getSections().map((section) => section.key)).toEqual([
      'collections',
      'schemas',
      'media',
      'builds',
      'members',
      'settings',
    ]);

    expect(registry.getSection('media')?.staticSidebarOptions).toEqual([
      { id: 'all-assets', label: 'All Assets', description: 'Browse all files' },
      { id: 'images', label: 'Images', description: 'Image uploads' },
      { id: 'documents', label: 'Documents', description: 'File attachments' },
    ]);

    expect(registry.getSection('settings')?.staticSidebarOptions).toEqual([
      { id: 'general', label: 'General', description: 'Project identity and defaults' },
      { id: 'branches', label: 'Branches', description: 'Create, rename, and remove branches' },
      { id: 'environments', label: 'Environments', description: 'Deployment targets and branch mappings' },
    ]);

    expect(registry.getSection('schemas')?.renderSidebarControl).toBeTypeOf('function');
  });

  it('keeps header actions deterministic by priority then registration order', () => {
    const registry = createWorkspaceExtensionRegistry();
    registry.registerHeaderAction({
      id: 'plugin:low',
      section: 'collections',
      priority: 1,
      render: () => 'low',
    });
    registry.registerHeaderAction({
      id: 'plugin:high',
      section: 'collections',
      priority: 10,
      render: () => 'high',
    });
    registry.registerHeaderAction({
      id: 'plugin:late',
      section: 'collections',
      priority: 10,
      render: () => 'late',
    });

    expect(registry.getHeaderActions('collections').map((item) => item.id)).toEqual([
      'plugin:high',
      'plugin:late',
      'plugin:low',
    ]);
  });

  it('replaces toolbar contributions from the same source under HMR', () => {
    const registry = createWorkspaceExtensionRegistry();
    registry.registerBrowseToolbar({
      id: 'plugin:toolbar',
      section: 'collections',
      slot: 'actions',
      render: () => 'first',
    });
    registry.registerBrowseToolbar({
      id: 'plugin:toolbar',
      section: 'collections',
      slot: 'actions',
      render: () => 'second',
    });

    const registrations = registry.getBrowseToolbar('collections', 'actions');
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.render({ section: 'collections' })).toBe('second');
  });
});
