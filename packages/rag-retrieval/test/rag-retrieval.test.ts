import { describe, expect, it } from 'vitest';
import {
  CloudflareAiSearchProvider,
  LocalRagProvider,
  RagQueryValidationError,
  createFallbackProvider,
  createSanitizedQuery,
  CURATED_CORPUS,
  type AiSearchEnvironment,
  type CloudflareSearchResponse,
  type RagProvider,
} from '../src/index';

const query = createSanitizedQuery({
  featureKeys: ['cashFlowStability'],
  anomalyTypes: ['duplicate-transaction'],
  behaviorChangeCategories: ['payment-pattern'],
  explanationQuestion: 'What explains the cash-flow stability feature?',
  allowedCorpusTopics: ['scoring', 'anomaly'],
});

describe('RAG retrieval', () => {
  it('returns deterministic local results and preserves source metadata', async () => {
    const provider = new LocalRagProvider(CURATED_CORPUS);

    const first = await provider.retrieve(query);
    const second = await provider.retrieve(query);

    expect(first).toEqual(second);
    expect(first.provider).toBe('local');
    expect(first.chunks.length).toBeGreaterThan(0);
    expect(first.chunks[0]).toMatchObject({
      chunkId: expect.any(String),
      title: expect.any(String),
      sourceUrl: expect.stringMatching(/^https:\/\//),
      topic: expect.any(String),
      version: expect.any(String),
    });
  });

  it('filters local retrieval by allowed corpus topics', async () => {
    const result = await new LocalRagProvider(CURATED_CORPUS).retrieve({
      ...query,
      featureKeys: [],
      anomalyTypes: [],
      behaviorChangeCategories: [],
      explanationQuestion: 'How are fairness audit cohorts compared?',
      allowedCorpusTopics: ['fairness'],
    });

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every((chunk) => chunk.topic === 'fairness')).toBe(true);
  });

  it('returns an empty result when no corpus chunk matches', async () => {
    const result = await new LocalRagProvider(CURATED_CORPUS).retrieve({
      ...query,
      explanationQuestion: 'unmatched phrase qzv-991',
      featureKeys: ['unmatched-feature'],
      anomalyTypes: [],
      behaviorChangeCategories: [],
      allowedCorpusTopics: ['limitations'],
    });

    expect(result.chunks).toEqual([]);
  });

  it('builds a sanitized query and rejects applicant data or unknown fields', () => {
    expect(() => createSanitizedQuery({
      ...query,
      explanationQuestion: 'Explain account number 1234567890',
    })).toThrow(RagQueryValidationError);
    expect(() => createSanitizedQuery({
      ...query,
      applicantName: 'Example Applicant',
    } as never)).toThrow(RagQueryValidationError);
    expect(() => createSanitizedQuery({
      ...query,
      explanationQuestion: 'Explain the salary paid by Example Employer at 12 Main Street',
    })).toThrow(RagQueryValidationError);
  });

  it('sends the Cloudflare retrieval request without chat completion', async () => {
    let capturedRequest: unknown;
    const response: CloudflareSearchResponse = {
      chunks: [{
        id: 'chunk-cloudflare-1',
        text: 'Cash-flow stability is a bounded signal.',
        item: {
          key: 'scoring-cash-flow',
          metadata: { title: 'Cash-flow stability', sourceUrl: 'https://docs.example/scoring/cash-flow', topic: 'scoring', version: 'v1' },
        },
        score: 0.91,
        scoring_details: { vector_score: 0.91 },
      }],
    };
    const environment: AiSearchEnvironment = {
      AI_SEARCH: {
        get(instanceName: string) {
          expect(instanceName).toBe('underwriting-knowledge');
          return {
            async search(request: unknown) {
              capturedRequest = request;
              return response;
            },
          };
        },
      },
    };

    const result = await new CloudflareAiSearchProvider(environment).retrieve(query);

    expect(capturedRequest).toEqual({
      messages: [{ role: 'user', content: expect.stringContaining('cashFlowStability') }],
      ai_search_options: {
        retrieval: {
          filters: { topic: { $in: ['scoring', 'anomaly'] } },
        },
      },
    });
    expect(result.chunks[0]).toMatchObject({
      chunkId: 'chunk-cloudflare-1',
      sourceUrl: 'https://docs.example/scoring/cash-flow',
      relevance: { score: 0.91, scoringDetails: { vector_score: 0.91 } },
    });
  });

  it('falls back deterministically on provider errors and empty retrieval', async () => {
    const fallback = new LocalRagProvider(CURATED_CORPUS);
    const failingProvider: RagProvider = { retrieve: async () => { throw new Error('remote unavailable'); } };
    const emptyProvider: RagProvider = { retrieve: async () => ({ provider: 'cloudflare-ai-search', chunks: [], query }) };

    const errorFallback = await createFallbackProvider(failingProvider, fallback).retrieve(query);
    const emptyFallback = await createFallbackProvider(emptyProvider, fallback).retrieve(query);

    expect(errorFallback).toEqual(emptyFallback);
    expect(errorFallback.provider).toBe('local');
  });
});
