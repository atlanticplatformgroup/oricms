# Search and Indexing

Use this guide when you are deciding whether OriCMS alone is enough for search or whether you need a separate index.

## What OriCMS Gives You Natively

OriCMS already gives you built-in collection search for modeled content.

That is often enough when the job is modest:

- editorial lookup
- lightweight content browse filtering
- small headless search surfaces

If people mainly need to find entries, filter content, or power a simple search box over structured records, the built-in model may be all you need.

## When You Should Add External Indexing

Bring in a dedicated search engine when you need search to behave like a product in its own right:

- typo tolerance
- stronger ranking
- facets
- large public-facing search
- indexing over rendered frontend output

## Recommended Mental Model

Treat OriCMS as the source of truth for content and the search index as a downstream consumer.

That framing keeps responsibilities clean:

- OriCMS owns modeling, workflow, and delivery
- the search engine owns ranking, tokenization, facets, and public-query performance

Once you need serious site search, trying to make the CMS itself act like Algolia, Meilisearch, or Elasticsearch is usually the wrong fight.

## Related Docs

- [../reference/search.md](../reference/search.md)
- [../reference/preview-and-delivery.md](../reference/preview-and-delivery.md)
