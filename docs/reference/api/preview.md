# Preview API

Use the preview API when an authenticated workspace client needs branch-aware repository content before it is published.

## Base Route

```text
/api/v1/projects/:projectId/preview/*
```

## Current Surface

- `GET /content`
- `GET /pages`
- `POST /validate`

## What These Routes Do

`GET /content` reads preview content from the project workspace. Callers can target:

- the current branch
- a specific branch
- a specific git ref
- one content path or the whole preview tree
- an optional preview locale

`GET /pages` is the legacy page-oriented helper. It lists markdown files under `content/pages` when that directory exists. Collections-based projects do not need it, but it remains useful for older preview flows and adapter compatibility.

`POST /validate` validates submitted content against a schema loaded from the repository rather than the database.

## Important Distinction

Preview is not a delivery surface.

- preview can inspect draft or branch-only repository state
- delivery is the published contract used by frontends and external consumers

## Related Docs

- [../preview-and-delivery.md](../preview-and-delivery.md)
- [graphql.md](./graphql.md)
