# Builds and Revalidation

Use this guide when you need to understand what happens after a content change leaves the editor.

Publishing in OriCMS changes project content. It does not, by itself, guarantee that a frontend has rebuilt, a cache has been cleared, or a public site is serving the new version yet.

That downstream work depends on how the project is configured.

## What Usually Happens After Publish

Projects can be set up to trigger things like:

- preview/live environment webhook calls
- revalidation hooks
- explicit build records
- CDN/export flows

Some projects do only one of those. Others do several.

## A Practical Publish Checklist

When something is not showing up where you expect, walk through it in this order:

1. Confirm which branch and environment the content change belongs to.
2. Publish the change.
3. Check whether that publish is supposed to trigger a build, revalidation call, export, or webhook.
4. Watch the downstream status if the project records it.
5. Verify the target site or delivery surface directly.

This helps separate “the content changed” from “the website updated.”

## The Important Distinction

- content mutation changes repository state
- builds and revalidation move that state into deployed output

That distinction is the source of a lot of confusion, especially in headless setups. If the content is correct in OriCMS but not on the site, the problem is often downstream from the content change itself.

## Related Docs

- [../reference/builds-and-cdn.md](../reference/builds-and-cdn.md)
- [../reference/webhooks.md](../reference/webhooks.md)
