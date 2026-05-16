# Developer

Developer documentation explains how to work on the OriCMS codebase itself.

Current contents:

- [local-development.md](./local-development.md)
- [testing.md](./testing.md)
- [package-map.md](./package-map.md)
- [shared-contracts.md](./shared-contracts.md)
- [extending-fields.md](./extending-fields.md)
- [extending-workspace.md](./extending-workspace.md)
- [extending-backend.md](./extending-backend.md)
- [building-adapters.md](./building-adapters.md)

Recommended order:

1. Read [local-development.md](./local-development.md)
2. Use [package-map.md](./package-map.md) to orient yourself in the monorepo
3. Read [shared-contracts.md](./shared-contracts.md) before changing cross-package behavior
4. Use [extending-fields.md](./extending-fields.md) for field-type and renderer work
5. Use [extending-workspace.md](./extending-workspace.md) for workspace section and shell contributions
6. Use [extending-backend.md](./extending-backend.md) for lifecycle, plugin, and backend extension work
7. Use [building-adapters.md](./building-adapters.md) for Astro, Next.js, or new adapter work
8. Use [testing.md](./testing.md) before and after changes
