# Locks and Concurrency

OriCMS uses a mixed coordination model:

- hard locks for structural or destructive work
- soft coordination and stale-revision checks for normal content editing

## Current Behavior

- branch-aware lock scopes
- explicit lock errors for blocked operations
- stale revision protection for entry editing and agent mutations

## Related Docs

- [../reference/locking-and-concurrency.md](../reference/locking-and-concurrency.md)
- [../product/workflow-model.md](../product/workflow-model.md)
