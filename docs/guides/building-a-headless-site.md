# Building a Headless Site

Use this guide when your frontend is a separate consumer of OriCMS content rather than a repo-local adapter integration.

This guide answers the first practical questions:

- should I use an adapter, REST, or GraphQL?
- how do I authenticate delivery requests?
- what is the first request I should make?
- when should I use preview instead of delivery?

## Choose The Right Model First

OriCMS supports two broad frontend models.

### Model 1: repo-local adapter

Use this when the frontend reads the project repository directly.

Examples:

- `@oricms/astro`
- `@oricms/nextjs`

This is a good fit when:

- the site and content repo are tightly coupled
- the frontend can read the project repo locally or during build
- you want a repo-native integration model

### Model 2: headless API consumer

Use this when the frontend is a separate consumer of published content.

This is a good fit when:

- the frontend is deployed separately from the content repo
- you want the frontend to fetch published content over HTTP
- you are building a remote website, app, or integration

In this model, start with:

- published REST delivery, or
- published GraphQL delivery

## REST vs GraphQL

### Start with REST if:

- you want stable resource URLs
- your content reads are collection-oriented
- your team prefers straightforward HTTP fetches

Published REST base:

```text
/api/v1/delivery/projects/:projectId/collections/:collectionId
```

### Start with GraphQL if:

- the frontend needs shaped queries
- the frontend wants to avoid over-fetching
- the team already has a GraphQL consumption model

Published GraphQL base:

```text
/api/v1/delivery/projects/:projectId/graphql
```

### Use preview only when:

- the content is draft-only
- the content is branch-specific
- the request is for editorial preview rather than production delivery

Preview base:

```text
/api/v1/projects/:projectId/preview
```

## What You Need Before You Start

For a normal published delivery integration, you need:

- `projectId`
- the relevant collection IDs
- a delivery API key if the project requires one

If delivery-key enforcement is enabled, generate or inspect the key through the project settings surface or the delivery-key settings routes.

Current settings routes:

- `GET /api/v1/projects/:projectId/delivery-key`
- `POST /api/v1/projects/:projectId/delivery-key`
- `DELETE /api/v1/projects/:projectId/delivery-key`

The normal first move is:

1. confirm the project ID
2. generate or verify the delivery key
3. make one successful REST request before you write frontend code

## Delivery Authentication

Published delivery accepts either:

- `x-oricms-delivery-key: <key>`
- `Authorization: Bearer <key>`

If the project requires a delivery key and you omit it, published delivery reads will fail.

## Verify Delivery Before You Build The Frontend

Use one direct REST request to prove the delivery contract is working:

```bash
curl \
  -H "x-oricms-delivery-key: $ORICMS_DELIVERY_KEY" \
  "https://your-oricms.example.com/api/v1/delivery/projects/$ORICMS_PROJECT_ID/collections/$ORICMS_COLLECTION_ID"
```

Interpret the first response like this:

- `200`: the delivery route, project ID, collection ID, and key are all valid
- `401`: the key is missing or invalid
- `503`: the project requires a delivery key but does not have one configured yet

## First Working REST Request

Example:

```ts
const projectId = process.env.ORICMS_PROJECT_ID!;
const deliveryKey = process.env.ORICMS_DELIVERY_KEY!;

const response = await fetch(
  `https://your-oricms.example.com/api/v1/delivery/projects/${projectId}/collections/posts`,
  {
    headers: {
      'x-oricms-delivery-key': deliveryKey,
    },
  }
);

const payload = await response.json();
console.log(payload.data);
```

Use REST first if you want to prove:

- the project is reachable
- the delivery key works
- the collection ID is correct
- published records are actually available

## First Working GraphQL Request

Example:

```ts
const projectId = process.env.ORICMS_PROJECT_ID!;
const deliveryKey = process.env.ORICMS_DELIVERY_KEY!;
const collectionId = process.env.ORICMS_COLLECTION_ID!;

const response = await fetch(
  `https://your-oricms.example.com/api/v1/delivery/projects/${projectId}/graphql`,
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${deliveryKey}`,
    },
    body: JSON.stringify({
      query: `
        query DeliveryRecords($type: String!) {
          records(type: $type) {
            records {
              id
              data
            }
          }
        }
      `,
      variables: {
        type: collectionId,
      },
    }),
  }
);

const payload = await response.json();
console.log(payload.data);
```

Use GraphQL first if the frontend team already thinks in terms of:

- query shape
- schema introspection
- persisted queries

## How To Verify You Chose The Right Surface

### You chose the right delivery surface if:

- the frontend only needs published content
- the same endpoint can be used safely in production
- the response contract is stable enough for frontend integration

### You chose the wrong surface if:

- you are using preview in production
- you are using management GraphQL for public frontend reads
- you are trying to fetch draft content from published delivery

## Common Confusions

### “I’m using Next.js or Astro. Should I always use the adapter?”

No.

Use the adapter when the frontend should read the project repo directly. Use REST or GraphQL when the frontend is a remote headless consumer.

### “Should I use management GraphQL for my website?”

No, not by default.

For a published website, the correct GraphQL surface is:

```text
/api/v1/delivery/projects/:projectId/graphql
```

### “Should I use preview for local development?”

Maybe, but only if you need draft or branch-aware reads during editorial work.

Preview is an editorial surface, not the normal production delivery contract.

## Recommended Order

1. Confirm the `projectId`
2. Confirm the collection IDs you need
3. Generate or verify the delivery key
4. Make one successful REST request
5. Decide whether REST is enough
6. Move to GraphQL only if the frontend needs shaped queries
7. Use preview only for draft or branch-aware workflows

## Related Docs

- [../reference/content-delivery.md](../reference/content-delivery.md)
- [../reference/api/collections-and-entries.md](../reference/api/collections-and-entries.md)
- [../reference/api/graphql.md](../reference/api/graphql.md)
- [../reference/api/preview.md](../reference/api/preview.md)
- [../integrations/astro.md](../integrations/astro.md)
- [../integrations/nextjs.md](../integrations/nextjs.md)
