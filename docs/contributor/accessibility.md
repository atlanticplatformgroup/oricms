# Accessibility

Use this guide when contributing UI changes that affect keyboard use, focus flow, semantic markup, or screen-reader behavior.

## Current Baseline

OriCMS should maintain a solid baseline for:

- keyboard navigation
- visible focus states
- semantic form labeling
- modal and overlay accessibility
- accessible feedback during async actions

## Contributor Expectations

When you add or change UI:

- keep all interactive elements keyboard reachable
- preserve visible focus styles
- provide accessible names for icon-only actions
- keep form labels and errors associated with their inputs
- make sure modal and drawer flows trap and restore focus correctly

## Areas to Watch Closely

### Forms

- every input should have an associated label
- required state should be explicit
- validation errors should be tied to the field they describe

### Buttons and Action Icons

- icon-only buttons need an accessible name
- loading or disabled state should still communicate meaning to assistive technology

### Dialogs and Overlays

- dialogs should expose correct semantics
- focus should move into the dialog when it opens
- focus should return to a sensible place when it closes
- Escape handling should remain predictable

### Complex Editors

Rich text, drag-and-drop, and highly visual workflows need extra care. Treat them as higher-risk surfaces during review.

## Manual Accessibility Checklist

- [ ] all interactive elements are keyboard accessible
- [ ] tab order is logical
- [ ] focus indicators are visible
- [ ] color contrast is acceptable for the affected surface
- [ ] screen-reader-relevant changes are announced appropriately
- [ ] images and media affordances expose text alternatives where needed
- [ ] form errors are connected to the right fields

## Verification

For UI work, accessibility review should sit alongside the normal web checks:

```bash
npm run build:check -w @ori/web
npm run test -w @ori/web
```

Use manual keyboard checks for modal, menu, editor, and form-heavy changes.

## Current Risk Areas

- complex editor interactions
- drag-and-drop flows
- visually driven preview surfaces

These areas deserve explicit review instead of assuming the baseline components make them accessible automatically.

## Related Docs

- [../developer/local-development.md](../developer/local-development.md)
- [../developer/testing.md](../developer/testing.md)
- [documentation-standards.md](./documentation-standards.md)
