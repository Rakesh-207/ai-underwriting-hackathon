export const RAG_TOPICS = ['consent', 'scoring', 'anomaly', 'fairness', 'limitations', 'architecture', 'cost'] as const;
export type RagTopic = (typeof RAG_TOPICS)[number];

export interface RagQueryInput {
  featureKeys: string[];
  anomalyTypes: string[];
  behaviorChangeCategories: string[];
  explanationQuestion: string;
  allowedCorpusTopics: RagTopic[];
}

export type SanitizedRagQuery = Readonly<{
  featureKeys: readonly string[];
  anomalyTypes: readonly string[];
  behaviorChangeCategories: readonly string[];
  explanationQuestion: string;
  allowedCorpusTopics: readonly RagTopic[];
}>;

export interface RagRelevance {
  score?: number;
  scoringDetails?: Record<string, number | string>;
}

export interface RagChunk {
  chunkId: string;
  text: string;
  title: string;
  sourceUrl: string;
  topic: string;
  version: string;
  relevance?: RagRelevance;
}

export type RagProviderName = 'cloudflare-ai-search' | 'local';

export interface RagRetrievalResult {
  provider: RagProviderName;
  query: SanitizedRagQuery;
  chunks: RagChunk[];
}

export interface RagProvider {
  retrieve(query: SanitizedRagQuery): Promise<RagRetrievalResult>;
}

export interface CloudflareSearchChunk {
  id?: string;
  text?: string;
  score?: number;
  scoring_details?: Record<string, number | string>;
  item?: {
    key?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface CloudflareSearchResponse {
  chunks?: CloudflareSearchChunk[];
  result?: { chunks?: CloudflareSearchChunk[] };
}

export interface CloudflareSearchInstance {
  search(request: CloudflareSearchRequest): Promise<CloudflareSearchResponse>;
}

export interface CloudflareAiSearchBinding {
  get(instanceName: string): CloudflareSearchInstance;
}

export interface AiSearchEnvironment {
  AI_SEARCH: CloudflareAiSearchBinding;
}

export interface CloudflareSearchRequest {
  messages: Array<{ role: 'user'; content: string }>;
  ai_search_options: {
    retrieval: {
      filters: { topic: { $in: RagTopic[] } };
    };
  };
}

export interface CorpusChunk {
  chunkId: string;
  text: string;
  title: string;
  sourceUrl: string;
  topic: RagTopic;
  version: string;
}
