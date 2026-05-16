# Extending Fields

Use this page when adding a field type, replacing a renderer, or changing browse and readonly semantics for a field.

## Core Files

- `packages/web/src/components/fields/contracts.ts`
- `packages/web/src/components/fields/registry.tsx`
- `packages/web/src/components/fields/EditorField.tsx`
- `packages/web/src/components/fields/ReadonlyFieldValue.tsx`
- `packages/shared/src/field-capabilities.ts`

## Current Model

Field extensibility is registry-based.

The field registry controls:

- which editor component renders a field type
- whether a field uses a special presentation like a toggle row
- how browse, sort, search, and readonly behavior resolve for that type

Built-in registrations are initialized at module load in `registry.tsx`.

## Adding a Renderer

Add a renderer when the field needs an editing surface in the workspace.

The registration contract is `FieldRendererRegistration` in `contracts.ts`:

- `type`
- `id`
- `component`
- optional `presentation`
- optional `capabilities`
- optional `priority`

Use a stable `id`. The registry uses `type + id` to replace registrations cleanly under HMR.

## Capability Behavior

Display and browse semantics should come from capability resolution, not scattered switches.

Use `packages/shared/src/field-capabilities.ts` for:

- browse/list eligibility
- display text
- sort token
- search tokens
- readonly display text
- relation resolution hints

If a new field changes how entries should sort or search, update capability resolution instead of patching individual browse views.

## Registration Rules

- Register once at bootstrap.
- Keep registration idempotent under HMR.
- Use `priority` only when intentionally replacing an existing type.
- Prefer capability handlers over view-specific conditionals.
- Reuse `ReadonlyFieldValue` for readonly surfaces rather than inventing a second display contract.

## Current Bootstrap Point

The workspace app currently initializes registries during app startup from:

- `packages/web/src/AppWrapper.tsx`
- `packages/web/src/lib/workspace/registry.tsx`

There is not yet a general third-party runtime loader for field packages. For now, treat field registration as a repository-level extension seam, not a marketplace-style plugin API.

## Testing

Add or update tests in:

- `packages/web/src/components/fields/__tests__/registry.test.tsx`
- renderer-specific tests if the field behavior is non-trivial

If the field changes browse or readonly behavior, also verify the relevant reference docs:

- `docs/reference/field-types.md`
- `docs/reference/field-capabilities.md`

## Practical Checklist

1. Add or update the shared field contract if needed.
2. Implement the renderer component.
3. Register it in the field registry.
4. Add or update capability resolution.
5. Verify editor and readonly rendering.
6. Add tests for registry and behavior.
7. Update reference docs.

## Related Docs

- [../extensions/workspace-extensions.md](../extensions/workspace-extensions.md)
- [shared-contracts.md](./shared-contracts.md)
- [extending-workspace.md](./extending-workspace.md)
