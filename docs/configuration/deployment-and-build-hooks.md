# Deployment and Build Hooks

Use this page when you are wiring OriCMS publish activity to a build, deploy, or revalidation target.

OriCMS does not assume a single hosting model. Instead, it lets projects trigger environment actions after real content mutations. That keeps the CMS responsible for content and the frontend responsible for its own deployment model.

## What Hooks Are For

Common uses include:

- rebuild a static site
- revalidate preview output
- trigger a publish pipeline

## The Safe Setup Pattern

The most reliable setup pattern is:

- keep preview and published targets separate
- map branches intentionally
- prefer explicit environment actions over hidden deployment behavior
- verify rebuild loops with local labs before calling an integration first-class

That keeps “publish” from becoming a black box.

## Local Verification

Current first-class adapter labs exercise this path:

- Astro lab
- Next.js lab

Both validate preview and published targets with local hooks.

## Related Docs

- [environments-and-branch-mappings.md](./environments-and-branch-mappings.md)
- [../guides/builds-and-revalidation.md](../guides/builds-and-revalidation.md)
- [../integrations/astro.md](../integrations/astro.md)
- [../integrations/nextjs.md](../integrations/nextjs.md)
