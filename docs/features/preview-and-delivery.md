# Preview and Delivery

Preview and delivery are deliberately different surfaces in OriCMS.

Preview exists so teams can inspect in-progress content. Delivery exists so published content can feed real consumers.

## The Important Distinction

- preview can include drafts
- published delivery excludes drafts
- REST and GraphQL delivery surfaces expose published behavior
- frontend adapters follow the same preview-versus-published distinction

This separation is one of the clearest product boundaries in OriCMS. It keeps editorial review from being confused with live delivery.

## Why It Matters

Without this split, teams end up treating “saved” as “live.” OriCMS avoids that by making preview and delivery different on purpose.

That affects:

- editorial review
- frontend builds
- delivery API expectations
- rebuild and revalidation hooks

## Related Docs

- [Preview and Delivery Reference](../reference/preview-and-delivery.md)
- [GraphQL Delivery](../reference/graphql-delivery.md)
- [Astro Integration](../integrations/astro.md)
- [Next.js Integration](../integrations/nextjs.md)
