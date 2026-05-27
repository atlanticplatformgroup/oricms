import { describe, expect, it } from 'vitest';
import { buildWorkspaceCompatibilityRedirect, buildWorkspacePath, normalizeWorkspaceCompatibilityRoute, parseLegacyWorkspacePath, parseWorkspacePath } from '../routing';

describe('workspace routing', () => {
  it('parses only canonical branch-aware workspace routes as current-state paths', () => {
    expect(parseWorkspacePath('/project-one/b/main/settings/general')).toMatchObject({
      projectSlug: 'project-one',
      branchName: 'main',
      section: 'settings',
      secondaryId: 'general',
    });

    expect(parseWorkspacePath('/project-one/settings/general')).toBeNull();
  });

  it('parses legacy workspace routes separately for compatibility redirects', () => {
    expect(parseLegacyWorkspacePath('/project-one/settings/general')).toMatchObject({
      projectSlug: 'project-one',
      branchName: null,
      section: 'settings',
      secondaryId: 'general',
    });
  });

  it('normalizes legacy settings aliases and missing branches into canonical routes', () => {
    const legacyRoute = parseLegacyWorkspacePath('/project-one/settings/branch-mappings');

    expect(legacyRoute).not.toBeNull();
    expect(normalizeWorkspaceCompatibilityRoute(legacyRoute!)).toMatchObject({
      section: 'settings',
      secondaryId: 'environments',
    });
    expect(buildWorkspaceCompatibilityRedirect(legacyRoute!, 'main')).toBe('/project-one/b/main/settings/environments');
  });

  it('redirects canonical branch-aware settings aliases to the canonical environments view', () => {
    const canonicalAliasRoute = parseWorkspacePath('/project-one/b/main/settings/branch-mappings');

    expect(canonicalAliasRoute).not.toBeNull();
    expect(normalizeWorkspaceCompatibilityRoute(canonicalAliasRoute!)).toMatchObject({
      section: 'settings',
      branchName: 'main',
      secondaryId: 'environments',
    });
    expect(buildWorkspaceCompatibilityRedirect(canonicalAliasRoute!, 'main')).toBe('/project-one/b/main/settings/environments');
  });

  it('uses content as the canonical route segment for entry browsing', () => {
    expect(buildWorkspacePath('project-one', 'collections', 'posts', { branchName: 'main' })).toBe('/project-one/b/main/content/posts');
    expect(buildWorkspacePath('project-one', 'collections', 'posts', {
      branchName: 'main',
      entryId: 'post-1',
    })).toBe('/project-one/b/main/content/posts/entries/post-1');

    expect(parseWorkspacePath('/project-one/b/main/content/posts')).toMatchObject({
      projectSlug: 'project-one',
      branchName: 'main',
      section: 'collections',
      secondaryId: 'posts',
    });
  });

  it('redirects legacy collections routes to canonical content routes', () => {
    const legacyCollectionRoute = parseWorkspacePath('/project-one/b/main/collections/posts');

    expect(legacyCollectionRoute).not.toBeNull();
    expect(buildWorkspaceCompatibilityRedirect(legacyCollectionRoute!, 'main')).toBe('/project-one/b/main/content/posts');
  });

  it('does not redirect canonical branch-aware routes that already match the contract', () => {
    const canonicalRoute = parseWorkspacePath('/project-one/b/main/settings/environments');

    expect(canonicalRoute).not.toBeNull();
    expect(buildWorkspaceCompatibilityRedirect(canonicalRoute!, 'main')).toBeNull();
  });
});
