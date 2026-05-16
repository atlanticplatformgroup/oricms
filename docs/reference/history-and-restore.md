# History and Restore

Use this page to understand the current history model in OriCMS.

## Repository Source of Truth

History is fundamentally Git-backed.

That means the product can expose:

- branch history
- commit history
- file history
- entry-oriented history views

## Entry History

Collections entry flows expose entry-specific history and point-in-time inspection on top of the Git repository.

## Restore Expectations

Restore should be understood as a controlled mutation that brings content back to a prior known state. It is not an out-of-band bypass of the normal repository workflow.

At the moment, that does **not** mean there is a dedicated public restore route in the collections API. The current product flow restores by taking historical content and writing it back as a normal update.

## Related Docs

- [entries.md](./entries.md)
- [locking-and-concurrency.md](./locking-and-concurrency.md)
- [../guides/editing-and-publishing.md](../guides/editing-and-publishing.md)
