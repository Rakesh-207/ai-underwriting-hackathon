import { createSanitizedQuery, queryText } from './sanitize';
import type {
  AiSearchEnvironment,
  CloudflareSearchChunk,
  CloudflareSearchRequest,
  RagChunk,
  RagProvider,
  RagRetrievalResult,
  SanitizedRagQuery,
} from './types';

export const DEFAULT_AI_SEARCH_INSTANCE = 'underwriting-knowledge';

export class CloudflareAiSearchProvider implements RagProvider {
  private readonly environment: AiSearchEnvironment;
  private readonly instanceName: string;

  constructor(environment: AiSearchEnvironment, instanceName = DEFAULT_AI_SEARCH_INSTANCE) {
    this.environment = environment;
    this.instanceName = instanceName;
  }

  async retrieve(input: SanitizedRagQuery): Promise<RagRetrievalResult> {
    const query = createSanitizedQuery(input);
    const request: CloudflareSearchRequest = {
      messages: [{ role: 'user', content: queryText(query) }],
      ai_search_options: {
        retrieval: {
          filters: { topic: { $in: [...query.allowedCorpusTopics] } },
        },
      },
    };
    const response = await this.environment.AI_SEARCH.get(this.instanceName).search(request);
    const chunks = response.chunks ?? response.result?.chunks ?? [];
    return {
      provider: 'cloudflare-ai-search',
      query,
      chunks: chunks.map(toRagChunk),
    };
  }
}

function toRagChunk(chunk: CloudflareSearchChunk): RagChunk {
  const metadata = chunk.item?.metadata ?? {};
  const chunkId = stringValue(chunk.id) ?? stringValue(chunk.item?.key) ?? 'cloudflare-unknown-chunk';
  const text = stringValue(chunk.text) ?? '';
  return {
    chunkId,
    text,
    title: stringValue(metadata.title) ?? chunkId,
    sourceUrl: stringValue(metadata.sourceUrl) ?? stringValue(metadata.source_url) ?? stringValue(metadata.url) ?? '',
    topic: stringValue(metadata.topic) ?? 'unknown',
    version: stringValue(metadata.version) ?? 'unknown',
    relevance: chunk.score === undefined && !chunk.scoring_details ? undefined : {
      score: chunk.score,
      scoringDetails: chunk.scoring_details,
    },
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
