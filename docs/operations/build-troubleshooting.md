# Build and Revalidation Troubleshooting

Use this page when preview or published targets stop reflecting OriCMS changes.

## Common Checks

- verify the environment mapping points at the expected target
- confirm the publish or rebuild hook URL is current
- confirm the target distinguishes preview from published mode
- confirm the adapter is reading the project repo path you expect

## Adapter-Specific Verification

- use the Astro integration guide and package tests for Astro behavior
- use the Next.js integration guide, example, and package tests for Next.js behavior

## Related Docs

- [../configuration/deployment-and-build-hooks.md](../configuration/deployment-and-build-hooks.md)
