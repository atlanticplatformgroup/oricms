# Extending Workspace

Use this page when adding a workspace section, sidebar control, toolbar action, header action, or other shell contribution.

## Core Files

- `packages/web/src/lib/workspace/registry.tsx`
- `packages/web/src/App.tsx`
- `packages/web/src/AppWrapper.tsx`

## Current Model

Workspace extensibility is registry-based.

The workspace registry currently supports:

- sections
- sidebar actions
- sidebar controls
- section header actions
- browse toolbar slots
- secondary panels
- browse decorations

Built-in sections register through the same registry future extensions use.

## Stable Registration Types

The main contracts in `registry.tsx` are:

- `WorkspaceSectionRegistration`
- `WorkspaceSectionHeaderActionRegistration`
- `WorkspaceBrowseToolbarRegistration`
- `WorkspaceSecondaryPanelRegistration`
- `WorkspaceBrowseDecorationRegistration`

Important properties:

- stable `id`
- target `section`
- optional `priority`
- render function with a typed context

## Permission Model

Sections are permission-aware.

Every section registration declares:

- `resource`
- `action`

The shell filters sections through the shared permission model before rendering them.

Do not add private visibility checks in view components if the section itself can be permission-gated at registration time.

## Ordering Rules

- Sections render in registration order.
- Header actions, toolbar items, decorations, and secondary panels sort by higher `priority` first, then registration order.

If two contributions need deterministic ordering, use `priority` explicitly instead of depending on import order.

## Where To Put State

Do not push new domain state into `App.tsx`.

Prefer:

- a feature hook
- a workspace-specific context
- a typed context object passed into a registry render function

`App.tsx` should stay focused on shell composition and routing.

## Current Limits

The workspace registry is real and stable enough for repository-level extension work, but the general workspace is not a fully public plugin API yet.

Treat these as stable enough:

- section registration
- toolbar and header contribution registration
- static sidebar option registration

Treat these as internal:

- arbitrary deep shell composition
- direct manipulation of feature internals without a registry seam

## Testing

Registry behavior is tested in:

- `packages/web/src/lib/workspace/__tests__/registry.test.tsx`

Add tests when you change:

- ordering
- priority behavior
- replacement semantics
- section registration shape

## Practical Checklist

1. Decide whether the change is a section, slot contribution, or feature-local implementation.
2. Add or update the registry registration.
3. Keep permissions in the registration contract.
4. Put state in a provider or feature hook, not `App.tsx`.
5. Add registry tests if ordering or resolution changed.
6. Update extension docs if the seam itself changed.

## Related Docs

- [../extensions/workspace-extensions.md](../extensions/workspace-extensions.md)
- [extending-fields.md](./extending-fields.md)
- [shared-contracts.md](./shared-contracts.md)
