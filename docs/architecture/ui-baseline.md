# UI Baseline

> **Feature:** Admin UI baseline
> **Status:** Current

## Overview

OriCMS admin surfaces now standardize on:

- Mantine defaults first for layout, typography, forms, overlays, data display, and interaction primitives
- tokenized Mantine overrides only when product requirements justify divergence
- shared workspace wrappers in `packages/web/src/components/ui/*` and `packages/web/src/components/workspace/*` where the shell benefits from stable composition seams
- TanStack Query hooks for async state and cache coordination

## Current Baseline

- Mantine is the canonical admin UI baseline.
- Tailwind and `shadcn/ui` are not the active dashboard primitive layer.
- Older Radix-oriented guidance is obsolete for new dashboard work.

## Rules of Use

- Prefer Mantine defaults before custom styling.
- When customization is needed, put it into Mantine theme/config tokens before per-component overrides.
- New extension slots, field renderers, and workspace surfaces should compose through Mantine-based wrappers rather than bypassing the shell primitives.
- Respect permission gates rather than rendering actions optimistically.
- Keep new surfaces consistent with the existing project shell, density, and navigation patterns.
- Use query hooks instead of ad hoc fetch state for project data.
