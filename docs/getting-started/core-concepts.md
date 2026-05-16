# Core Concepts

OriCMS is easiest to understand from the repository outward.

The UI, APIs, preview flow, and delivery hooks all exist to manage a project-backed content repository in a controlled way.

## Project

A project is the main working unit in OriCMS.

It owns:

- members
- settings
- repository workspace
- build and delivery configuration
- agent access

## Repository

Each project maps to a Git-backed workspace managed by the API.

That repository is the source of truth for:

- collection definitions
- schemas
- entries
- assets

Current repository shape:

```text
repo/
├── oricms/
│   └── collections.json
├── schemas/
│   └── types/
│       └── *.json
├── content/
│   └── <collection-path>/
│       └── <entryId>.json
└── assets/
```

## Content Types, Components, and Collections

A content type defines the shape of a top-level entry: which fields exist, which are required, and how values are validated.

A component schema defines a reusable nested structure that content types can embed through `component` and `blocks` fields.

A collection gives a content type a real home in the repository. It decides where entries live, how they are browsed, and which content type they use.

Examples:

- content types: `blog-post`, `author`, `landing-page`
- component schemas: `quote-block`, `hero-banner`, `faq-item`
- collections: `blog-posts`, `authors`, `pages`

## Entries

An entry is one content record stored in the repository.

The key identity rule is simple:

- `$id` is the canonical identifier
- `slug` is content data, not identity

After creating an entry, always trust the returned `entryId` / `$id`.

## Branches

OriCMS is branch-aware.

Branches let teams isolate work, review larger changes, and stage releases without editing the default branch directly. Preview reads branch state, and promotion moves reviewed work forward.

## Draft and Ready

The stored workflow values are:

- `draft`
- `published`

In the UI, `published` is shown as `Ready`.

That means the editorial label and the stored value are different on purpose:

- `draft` means still in progress
- `Ready` means the stored status is `published`

## Members, Roles, and Agents

Humans and AI agents use the same project role model:

- `owner`
- `admin`
- `editor`
- `viewer`

The difference is authentication:

- humans use user sessions
- agents use bearer tokens

## Preview, Delivery, and Publish

OriCMS keeps three concerns separate:

- editing changes repository-backed content
- preview shows branch-aware content before release
- delivery and build systems consume published content

That separation is one of the product’s main strengths. Publishing is explicit, not hidden inside a generic save button.

## Next

- [Create Your First Project](./first-project.md)
- [First Publish](./first-publish.md)
- [Content Modeling](../guides/content-modeling.md)
