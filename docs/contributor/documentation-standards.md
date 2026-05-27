# Documentation Standards

Use this guide when creating, moving, or rewriting repository documentation.

## Primary Goals

Documentation in this repo should be:

- current
- concise
- easy to route by intent
- explicit about historical vs current behavior

## Current Vocabulary

Prefer the current product terms:

- `project`, not `site`
- `collection`, not legacy page-model categories
- `entry`, not generic page language unless the content is literally about pages as a content domain
- `published` as the stored state, with `Ready` called out as a UI label when relevant

If you mention an older term for context, label it clearly as historical.

## Source of Truth Rules

- live code beats old docs
- current docs should not preserve obsolete behavior for nostalgia
- unreleased product docs should delete stale material instead of archiving it as if it were part of a public history

## Structure Rules

Put docs in the section that matches reader intent:

- `getting-started`: first-use path
- `guides`: task-oriented how-to docs
- `reference`: lookup material
- `integrations`: framework/platform integrations
- `contributor`: repo workflow and contribution guidance
- `product`: feature and policy docs
- `architecture`: current system design

Do not add new top-level docs unless there is a strong structural reason.

## Tone Rules

- write plainly
- prefer current behavior over roadmap language
- avoid hype and marketing language
- avoid "this will become" unless the doc is explicitly a placeholder
- keep examples grounded in the current repo and product model

## Document Shape

For most docs:

1. state what the doc is for
2. explain the current model or workflow
3. list the concrete steps, rules, or constraints
4. link to the next relevant docs

For architecture or feature docs, the `Feature` / `Status` block pattern is appropriate when it helps readers distinguish current docs from older conceptual material.

## Historical Material

If a current doc must mention a historical concept:

- label it as historical
- explain the current equivalent
- do not let historical language dominate the page

Examples:

- `Site` -> historical term, current equivalent is `Project`
- `Template Picker` -> historical page-model concept

## Docs-Only Changes

For docs-only changes:

- do not invent runtime behavior
- say whether checks were run if the change depends on verification
- prefer updating existing canonical docs before adding another explanation somewhere else

## Internal Consistency

When you add a new doc:

- update the relevant section README
- update [docs/README.md](../README.md) if it is now a top-level entry point
- make sure links point to the new canonical location

## Related Docs

- [../README.md](../README.md)
- [../developer/local-development.md](../developer/local-development.md)
- [../developer/testing.md](../developer/testing.md)
