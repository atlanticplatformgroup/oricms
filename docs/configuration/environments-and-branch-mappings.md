# Environments and Branch Mappings

Environments define where a project publishes or previews. Branch mappings decide which branch goes to which target.

This is the part of OriCMS that connects editorial work to real frontend surfaces. If the wrong branch is mapped to the wrong environment, everything downstream becomes confusing fast.

## Environments

An environment represents a deployment target such as:

- local preview
- staging
- production

Environment configuration typically includes:

- label
- target URL
- optional publish or rebuild hook behavior

An environment answers the question, “Where should this content go?”

## Branch Mappings

Branch mappings answer the question, “Which branch is allowed to drive which environment?”

A common setup looks like this:

- `main` -> production
- feature or review branches -> preview or staging targets

## How OriCMS Treats This

- branch mappings are project-scoped
- environments are project-scoped
- publish and revalidation behavior can be driven from environment actions
- adapter labs use this same environment model for local verification

## Practical Guidance

- keep preview and live environments separate
- make published targets branch-aware where needed
- document build hooks alongside environment setup so preview and publish behavior stay understandable

In practice, the cleanest teams treat environments and branch mappings as part of release design, not just deployment plumbing.

## Related Docs

- [deployment-and-build-hooks.md](./deployment-and-build-hooks.md)
- [../guides/builds-and-revalidation.md](../guides/builds-and-revalidation.md)
- [../guides/branching-and-promotion.md](../guides/branching-and-promotion.md)
