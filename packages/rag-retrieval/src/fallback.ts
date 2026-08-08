import type { RagProvider, RagRetrievalResult, SanitizedRagQuery } from './types';

export function createFallbackProvider(primary: RagProvider, fallback: RagProvider): RagProvider {
  return {
    async retrieve(query: SanitizedRagQuery): Promise<RagRetrievalResult> {
      try {
        const result = await primary.retrieve(query);
        if (result.chunks.length > 0) return result;
      } catch {
        // A local result is safer and deterministic when the remote provider is unavailable.
      }
      return fallback.retrieve(query);
    },
  };
}
