# Collections and Entries

Collections are the editorial homes for content. Entries are the records inside them.

Together they are the center of everyday work in OriCMS.

## How They Behave

- collections map to content paths in the project repository
- entries are JSON records stored under those collection paths
- `$id` is the canonical entry identifier
- `$status` stores editorial state

## Why Collections Matter

A collection is more than a folder. It defines:

- where a record family lives in the repository
- which content type that family uses
- how editors browse and create records
- how the collection participates in preview and delivery workflows

## What Editors Actually Do Here

Most editorial work happens at this layer:

- browse entries
- create and edit entries
- inspect history
- restore older revisions
- move content through the current workflow model

If collections are modeled well, the rest of the product feels straightforward. If they are modeled poorly, everything from editing to preview gets harder.

## Related Docs

- [Editing and Publishing](../guides/editing-and-publishing.md)
- [Collections Reference](../reference/collections.md)
- [Entries Reference](../reference/entries.md)
