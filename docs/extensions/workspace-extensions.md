# Workspace Extensions

Use this page to understand the current frontend extension seams.

## Current Seams

The current architecture supports extension-oriented seams around:

- field renderers
- field capability behavior
- workspace view contributions
- UI policy allowlists for contributed views and field types

## What Is Stable Enough to Rely On

Today, the most defensible extension points are:

- field-type registration
- view contribution registration
- shared readonly/display contracts

## Implementation Boundary

Use this page to understand the public seam.

## What To Treat Carefully

Do not treat the entire workspace implementation as a public extension API. The current system has explicit seams, but the general web app composition is still an internal implementation.

## Related Docs

- [plugin-authoring.md](./plugin-authoring.md)
- [field-extensions.md](./field-extensions.md)
