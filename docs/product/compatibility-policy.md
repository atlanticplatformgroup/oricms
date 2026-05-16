# Compatibility Policy

This page explains how OriCMS should think about compatibility surfaces.

## Current Product Model

The current model is:

- project-based tenancy
- collections-native repositories
- shared human and agent roles
- role-based permissions
- preview versus published delivery

## Compatibility-Only Paths

Compatibility paths may remain in the codebase, but they should not drive current product language or new design decisions.

Examples:

- legacy `content/pages` loaders in integrations
- historical `site` terminology

## Extension Compatibility

Only documented extension seams should be treated as stable enough for extension work.

Anything outside those seams should be treated as internal unless the docs say otherwise.

## Related Docs

- [support-policy.md](./support-policy.md)
- [../reference/extension-stability-matrix.md](../reference/extension-stability-matrix.md)
