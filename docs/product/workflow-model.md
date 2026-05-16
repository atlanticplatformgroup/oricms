# Workflow Model

Use this page when you need the editorial model in one place.

## Current Stored States

OriCMS currently stores two entry workflow values:

- `draft`
- `published`

In the UI, `published` is shown as `Ready`.

That means:

- stored value: `published`
- editorial label in the workspace: `Ready`

That translation is easy to miss if you only look at the UI.

## Default Entry Lifecycle

The normal lifecycle is:

1. create entry
2. edit as `draft`
3. preview the result
4. mark the entry `Ready`
5. verify the delivery or frontend outcome

New entries default to `draft`.

## Preview and Publish

Preview and publish are related but not identical.

Preview:

- reads branch-aware repository state
- helps teams inspect work before release

Publish:

- moves content into the state consumed by delivery or frontend targets
- may trigger hooks or rebuilds depending on project setup

That separation is intentional. It lets teams verify content before they ask the rest of the stack to react to it.

## Branches and Promotion

Branch workflows are first-class in OriCMS.

They are useful for:

- staged launches
- review-heavy content work
- structural changes
- coordinated multi-entry changes

Promotion is the explicit step that moves reviewed work forward.

## Structural vs Routine Changes

Routine entry editing:

- uses presence and optimistic concurrency
- should reject stale saves rather than silently overwriting newer changes

Structural or destructive work:

- uses stronger coordination
- may require locks or explicit confirmation

## Agents in the Workflow

Agents follow the same workflow model but use a more explicit mutation contract.

Current agent workflow controls include:

- bootstrap context
- preflight validation
- explicit status transition endpoint
- idempotency
- confirmation for deletes
- stale-revision checks

## Current Scope

The current product does **not** expose a full customizable multi-step workflow model in the main editorial contract.

The active workflow is intentionally simpler:

- `draft`
- `published` (`Ready` in the UI)

That simpler workflow is a constraint, but it is also part of the product’s clarity right now.

## References

- [permissions-model.md](./permissions-model.md)
- [../getting-started/first-publish.md](../getting-started/first-publish.md)
- [../guides/editing-and-publishing.md](../guides/editing-and-publishing.md)
- [../guides/branching-and-promotion.md](../guides/branching-and-promotion.md)
