import { describe, expect, it } from 'vitest';
import { createAgentChatTransport } from './agentChat.ts';

describe('agent chat transport', () => {
  it('emits a completed non-streaming grounded response', async () => {
    const transport = createAgentChatTransport('sim-1', {
      getAgentChat: async () => ({
        simulationId: 'sim-1',
        explanation: { score: 700, riskBand: 'moderate', reasons: [{ evidenceId: 'bureau_score', text: 'The bureau signal supports the result.' }], citationIds: ['chunk-scoring'], trace: { model: 'lfm2.5-1.2b', latencyMs: 3, fallback: true, usedEvidenceIds: ['bureau_score'] } },
        citationIds: ['chunk-scoring'],
        modelStatus: 'model-unavailable-fallback',
        streaming: false,
      }),
    });
    const events = [];
    for await (const event of transport.stream({ prompt: 'Why did the score change?', history: [] })) events.push(event);
    expect(events.some((event) => event.type === 'text-delta' && event.text.includes('completed, non-streaming'))).toBe(true);
    expect(events.some((event) => event.type === 'text-delta' && event.text.includes('model unavailable'))).toBe(true);
    expect(events.some((event) => event.type === 'citation' && event.citation.id === 'chunk-scoring')).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });
});
