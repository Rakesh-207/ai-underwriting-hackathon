import { queryText } from './sanitize';
import type { CorpusChunk, RagChunk, RagProvider, RagRetrievalResult, SanitizedRagQuery } from './types';

export class LocalRagProvider implements RagProvider {
  private readonly corpus: readonly CorpusChunk[];

  constructor(corpus: readonly CorpusChunk[]) {
    this.corpus = corpus.map((chunk) => ({ ...chunk }));
  }

  async retrieve(query: SanitizedRagQuery): Promise<RagRetrievalResult> {
    const terms = retrievalTerms(queryText(query));
    const allowedTopics = new Set(query.allowedCorpusTopics);
    const ranked = this.corpus
      .filter((chunk) => allowedTopics.has(chunk.topic))
      .map((chunk) => ({ chunk, score: overlapScore(terms, retrievalTerms(`${chunk.title} ${chunk.text}`)) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.chunk.chunkId.localeCompare(right.chunk.chunkId))
      .slice(0, 5);
    return {
      provider: 'local',
      query,
      chunks: ranked.map(({ chunk, score }) => toRagChunk(chunk, score / Math.max(terms.size, 1))),
    };
  }
}

function toRagChunk(chunk: CorpusChunk, score: number): RagChunk {
  return {
    chunkId: chunk.chunkId,
    text: chunk.text,
    title: chunk.title,
    sourceUrl: chunk.sourceUrl,
    topic: chunk.topic,
    version: chunk.version,
    relevance: { score },
  };
}

function retrievalTerms(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []);
}

function overlapScore(queryTerms: Set<string>, documentTerms: Set<string>): number {
  let score = 0;
  for (const term of queryTerms) {
    if (documentTerms.has(term)) score += 1;
  }
  return score;
}
