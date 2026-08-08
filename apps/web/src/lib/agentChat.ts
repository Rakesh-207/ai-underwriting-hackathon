import type { ApiClient } from './api.ts';
import type { AgentChatEvent, AgentChatTransport } from '../features/agent-chat/types.ts';

export function createAgentChatTransport(simulationId: string, api: Pick<ApiClient, 'getAgentChat'>): AgentChatTransport {
  return {
    async *stream(request, options) {
      if (options?.signal?.aborted) return;
      yield { type: 'status', status: 'Checking consent' } satisfies AgentChatEvent;
      yield { type: 'status', status: 'Loading application evidence' } satisfies AgentChatEvent;
      const response = await api.getAgentChat(simulationId, request.prompt);
      if (options?.signal?.aborted) return;
      const messageId = `agent-${crypto.randomUUID()}`;
      yield { type: 'message-start', messageId } satisfies AgentChatEvent;
      const availability = response.explanation.trace.fallback
        ? 'model unavailable; deterministic fallback used; completed, non-streaming response.'
        : 'completed, non-streaming response.';
      const reasons = response.explanation.reasons.map((reason) => reason.text).join(' ');
      yield { type: 'text-delta', messageId, text: `${availability}\n\n${reasons}` } satisfies AgentChatEvent;
      for (const citationId of response.citationIds) {
        yield { type: 'citation', messageId, citation: { id: citationId, label: citationId, source: citationId } } satisfies AgentChatEvent;
      }
      yield { type: 'message-complete', messageId } satisfies AgentChatEvent;
      yield { type: 'done' } satisfies AgentChatEvent;
    },
  };
}
