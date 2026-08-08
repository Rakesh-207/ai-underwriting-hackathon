# RAG Retrieval

Retrieval-only knowledge access for underwriting explanations. The production
provider is Cloudflare AI Search; `LocalRagProvider` is deterministic test and
fallback infrastructure. This package retrieves cited chunks and never
generates an explanation or calls `chatCompletions`.

## Query Boundary

`createSanitizedQuery()` accepts only:

- feature keys;
- anomaly types;
- behavior-change categories;
- an explanation question;
- allowed corpus topics.

It rejects unknown fields and applicant data including names, addresses, email,
phone numbers, account numbers, raw transactions, exact salary, employer or
institution names, protected traits, proxy fields, uploaded documents, and
consent receipt contents. No corpus item contains applicant data. The package
does not infer a protected trait or proxy from any input.

## Providers

Production retrieval uses the Cloudflare binding:

```ts
const provider = new CloudflareAiSearchProvider(env);
const result = await provider.retrieve(query);
```

The provider performs exactly this retrieval operation:

```ts
env.AI_SEARCH.get('underwriting-knowledge').search({
  messages: [{ role: 'user', content: queryText }],
  ai_search_options: {
    retrieval: {
      filters: { topic: { $in: ['consent', 'scoring'] } },
    },
  },
});
```

It does not call `chatCompletions`. Returned chunks preserve `chunkId`, text,
title, source URL, topic, version, and available relevance metadata so a later
explanation adapter can cite context. A consumer can wrap it with
`createFallbackProvider(cloudflareProvider, new LocalRagProvider(CURATED_CORPUS))`
to use deterministic local results when remote retrieval errors or returns no
chunks.

## Cloudflare Setup

This lane documents setup only. It does not create resources, deploy a Worker,
or modify Wrangler configuration.

### Dashboard

1. Open the Cloudflare dashboard and select the account that owns the Worker.
2. Open **AI > AI Search** and choose **Create instance**.
3. Set the instance name to `underwriting-knowledge`.
4. Select the `default` namespace.
5. Select built-in AI Search storage for the MVP corpus.
6. Configure vector or hybrid search according to the corpus search needs.
7. Upload or paste the curated corpus documents from `src/corpus.ts`, preserving
   metadata fields `title`, `sourceUrl`, `topic`, and `version`.
8. Confirm indexing completes and run a dashboard search for a non-sensitive
   topic such as consent or scoring.

R2 is intentionally not used by this MVP. It is a future option for corpus
ingestion and document lifecycle management, not a dependency of this package.

### Wrangler Binding

In the Worker configuration owned by the integration lane, add the AI Search
namespace binding below. Do not add it to this package:

```json
{
  "ai_search_namespaces": [
    {
      "binding": "AI_SEARCH",
      "namespace": "default",
      "remote": true
    }
  ]
}
```

Then run the integration Worker's normal type generation command:

```bash
npx wrangler types
```

The generated environment type should expose `AI_SEARCH`. The integration
Worker constructs `CloudflareAiSearchProvider(env)` and passes the returned
chunks to the private VPS LFM service. The VPS service receives retrieved
context and citations only; it is responsible for any later explanation
generation. Never pass raw applicant data to this retrieval package or use
AI Search to generate the explanation.

### Official References

- AI Search overview: https://developers.cloudflare.com/ai-search/
- Workers binding and search: https://developers.cloudflare.com/ai-search/llms-full.txt
- Retrieval filtering: https://developers.cloudflare.com/ai-search/configuration/retrieval/filtering/
- Chunk citations: https://developers.cloudflare.com/ai-search/how-to/chunk-citations/

## Corpus

The bundled corpus is a small, curated, static fixture covering consent and
purpose limitation, alternative-data feature definitions, anomaly and fraud
definitions, fairness methodology, explanation rules, limitations, and cost
and architecture notes. It is authored in the package and does not scrape
websites. URLs are citation metadata, not a runtime fetch instruction.

## Testing

The tests cover deterministic local retrieval, topic filtering, empty results,
Cloudflare request shape, source URL preservation, query sanitization,
applicant-data exclusion, and deterministic fallback behavior.
