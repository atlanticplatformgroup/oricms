# OriCMS Glossary

> A comprehensive dictionary of terms used throughout OriCMS

## A

### Adapter
Framework integration bridge used at runtime/build time (for example, Astro adapter export and integration logic). Adapters connect OriCMS-managed content with a frontend framework.

### AI Agent
An automated assistant that accesses OriCMS through the project-scoped agent gateway using an agent token. In the current product, agents share the same underlying project-role model as human members.

### async-mutex
Library for preventing race conditions in concurrent code. OriCMS uses per-project mutex locks in the Git service to ensure only one Git operation runs for a project at a time.

### Asset
Any file uploaded to OriCMS (images, documents, videos). Stored in the project's Git repository under `assets/`.

### Asset Browser
UI component for browsing, uploading, and selecting assets. Includes drag-and-drop upload and thumbnail previews.

### Audit Log
Record of all significant actions performed in the system. Tracks who did what and when for compliance and debugging.

## B

### Blue-Green Deployment
General deployment strategy that maintains two production environments and switches traffic between them. OriCMS should not be documented as if blue-green deployment is the default product deployment model.

## C

### CDN (Content Delivery Network)
Distributed network of servers that cache and deliver static content. OriCMS supports CDN and object-storage delivery workflows, but the product should not be documented as if one specific CDN vendor is always required.

### Commit
A snapshot of changes in Git. Each save operation in OriCMS creates a commit with a message describing the change.

### Component
Reusable field group inside a content model. Components let teams define structured blocks once and reuse them across content types and entries.

## D

### Dark Mode
UI theme preference with three options: light, dark, or system (follows OS preference). Persisted across devices via User Preferences Sync.

### Deployment
Process of releasing new code to production. OriCMS supports both automated (CI/CD) and manual deployments.

### Docker
Containerization platform. OriCMS uses Docker to package applications for consistent deployment across environments.

## E

### Editor
User interface for modifying content. OriCMS has specialized editors for entries, schemas, collections, media, and settings.

## F

### Field (Schema)
Individual data element in a schema. Has properties like type, label, required, and validation rules.

### Field Type
Data type for a schema field. The current product supports a larger built-in field surface than the short historical list often seen in older docs, including string-like, numeric, boolean, date, enum/select, relation/reference, media/image, component, blocks, array, object, rich text, and JSON-oriented types.

### Frontend
The client-side application built with React that users interact with. Communicates with the backend API.

## G

### Git
Distributed version control system. OriCMS uses Git as the source of truth for all content.

### Git-as-Source-of-Truth
Architecture pattern where Git repositories store all content, providing version history, branching, and rollback capabilities.

### GitHub OAuth
Authentication method using GitHub credentials. Users can sign in with their GitHub account.

### Git Proxy
Server-side API that proxies Git operations. Clients interact with Git through this API for security.

### Grafana
Open-source analytics and monitoring platform. It may appear in surrounding deployment environments, but it is not part of the current built-in OriCMS stack documented in this repository.

## H

### Health Check
Endpoint that returns runtime status for monitoring and load balancers. In the current stack, `GET /health` checks database connectivity and basic Git availability, while `GET /api/v1/system/status` reports first-run setup state.

## I

### i18n (Internationalization)
Process of designing software to support multiple languages. Planned feature for OriCMS.

### Idempotent
Operation that produces the same result whether executed once or multiple times. OriCMS operations are designed to be idempotent.

## J

### JWT (JSON Web Token)
Compact, URL-safe means of representing claims between parties. OriCMS uses JWT for authentication.

## L

### localStorage
Browser storage mechanism. OriCMS uses browser-side storage for selected cached preferences and client state. Do not assume older token-storage descriptions are still canonical without checking the current auth implementation.

## M

### MCP (Model Context Protocol)
Protocol for AI agents to interact with external systems. It may be relevant in surrounding tooling, but it is not the primary current OriCMS agent API surface documented in this repository.

### Middleware
Software that acts as a bridge between applications. OriCMS uses Express middleware for auth, logging, and permissions.

### Migration (Database)
Process of changing database schema. OriCMS uses Prisma migrations for versioned schema changes.

### Multi-tenancy
Architecture where a single instance serves multiple tenants (projects), with data isolation enforced at the application and repository levels.

## N

### Nginx
High-performance web server and reverse proxy. It may be used in surrounding deployment environments, but it is not part of the current built-in OriCMS stack documented in this repository.

## O

### OAuth
Open standard for access delegation. OriCMS supports GitHub OAuth for authentication.

### ORM (Object-Relational Mapping)
Technique for converting data between incompatible type systems. OriCMS uses Prisma as its ORM.

## P

### Project
Primary tenancy boundary in OriCMS. A project owns memberships, settings, repository workspace, builds, and agent configuration.

### Permission
Authorization to perform a specific action on a resource. OriCMS uses RBAC with granular permissions.

### Permission Gate
UI component that conditionally renders children based on user permissions.

### Plugin
An extension mechanism for OriCMS capabilities (for example hooks, field/view contributions, and automation behavior). Plugins extend CMS behavior, not frontend presentation bundles.

### Prisma
Modern database toolkit. OriCMS uses Prisma for database access, migrations, and type safety.

### Prometheus
Open-source monitoring system. It may be used alongside OriCMS in external infrastructure, but it is not part of the current built-in OriCMS stack documented in this repository.

## R

### RBAC (Role-Based Access Control)
Access control method where permissions are associated with roles, and users are assigned to roles.

### Refresh Token
Long-lived token used to obtain new access tokens. Stored securely and rotated on each use.

### Repository (Git)
Data structure storing files and their history. Each project has its own repository workspace.

### Rollback
Operation to revert to a previous state. OriCMS allows rolling back content to any previous commit.

## S

### Schema
Definition of content structure. Specifies fields, types, and validation rules for content.

### Schema Editor
UI for creating and editing content types, fields, components, and validation rules.

### Server-side
Operations executed on the server rather than client. OriCMS Git operations are server-side.

### Shallow Clone
Git clone with limited history (`--depth 1`). Used by OriCMS for faster repository initialization.

### Site
Historical term from older OriCMS docs. The current product model is project-based, and `project` is the correct term for new documentation.

### Slug
URL-friendly version of a name. `My Page` becomes `my-page`.

## T

### Theme
Not a runtime core primitive in OriCMS. When this term is used, it should mean a visual baseline, not a swappable runtime package.

### Tenant
Isolated instance in a multi-tenant system. In OriCMS, a project is the practical tenant boundary.

### Toast Notification
Temporary message displayed to users for feedback on actions such as saves, errors, and confirmations.

## U

### UI (User Interface)
Visual elements users interact with. OriCMS has a modern React-based UI.

### URL
Uniform Resource Locator. OriCMS can derive delivery paths from collection configuration and entry data such as slugs.

### User Preferences
Database-backed user settings that sync across all devices. Includes theme, editor mode, notification settings, and project-specific defaults.

## V

### Version History
Feature showing all previous versions of content. Powered by Git commit history.

### Vite
Modern frontend build tool. OriCMS uses Vite for fast development and optimized builds.

## W

### Webhook
HTTP callback triggered by events. Can be configured for deployments or notifications.

### Workspace
Directory where Git repositories are stored. Each project has its own workspace directory.

## Y

### YAML
General data serialization format. OriCMS does not use YAML as the primary format for current project content, schemas, or entry data.

## Z

### Zero-downtime Deployment
Deployment method that aims to keep a service available during releases. Whether OriCMS achieves that depends on the surrounding infrastructure and rollout strategy, not on a single built-in product deployment mode.

### Zod
TypeScript-first schema validation library. OriCMS uses Zod for input validation on all API endpoints, ensuring type safety and data integrity.

---

## Abbreviations

| Abbreviation | Full Form |
|--------------|-----------|
| API | Application Programming Interface |
| CDN | Content Delivery Network |
| CI/CD | Continuous Integration / Continuous Deployment |
| CORS | Cross-Origin Resource Sharing |
| CSRF | Cross-Site Request Forgery |
| CSS | Cascading Style Sheets |
| DB | Database |
| DNS | Domain Name System |
| DOM | Document Object Model |
| ENCRYPTION_KEY | Environment variable for AES-256-GCM encryption key |
| HTML | HyperText Markup Language |
| HTTP | Hypertext Transfer Protocol |
| HTTPS | HTTP Secure |
| JWT | JSON Web Token |
| MCP | Model Context Protocol |
| ORM | Object-Relational Mapping |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SEO | Search Engine Optimization |
| SLA | Service Level Agreement |
| SQL | Structured Query Language |
| SSL | Secure Sockets Layer |
| TLS | Transport Layer Security |
| UI | User Interface |
| URL | Uniform Resource Locator |
| UUID | Universally Unique Identifier |
| UX | User Experience |
| XSS | Cross-Site Scripting |
| YAML | YAML Ain't Markup Language |
