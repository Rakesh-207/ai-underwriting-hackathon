import { describe, expect, test } from 'vitest';
import {
  agentChatReducer,
  createInitialAgentChatState,
} from './reducer.ts';
import type { AgentChatMessage } from './types.ts';

const initialMessages: AgentChatMessage[] = [
  { id: 'welcome', role: 'agent', content: 'How can I help?' },
];

describe('agentChatReducer', () => {
  test('builds a streaming agent response from deltas and citations', () => {
    let state = createInitialAgentChatState(initialMessages);

    state = agentChatReducer(state, { type: 'submit', prompt: 'Explain the evidence.' });
    const streamingId = state.activeMessageId;
    expect(streamingId).toBeTruthy();

    state = agentChatReducer(state, {
      type: 'text-delta',
      messageId: streamingId!,
      text: 'The evidence shows ',
    });
    state = agentChatReducer(state, {
      type: 'status',
      status: 'Retrieving policy context',
    });
    state = agentChatReducer(state, {
      type: 'citation',
      messageId: streamingId!,
      citation: {
        id: 'source-1',
        label: 'Consent receipt',
        source: 'consent',
        detail: 'Purpose-bound receipt recorded for this application.',
      },
    });
    state = agentChatReducer(state, {
      type: 'text-delta',
      messageId: streamingId!,
      text: 'the consent receipt.',
    });

    const message = state.messages.find(({ id }) => id === streamingId);
    expect(message).toMatchObject({
      role: 'agent',
      content: 'The evidence shows the consent receipt.',
      isStreaming: true,
    });
    expect(message?.citations).toHaveLength(1);
    expect(state.status).toBe('Retrieving policy context');
  });

  test('preserves partial text when a stream is cancelled', () => {
    let state = createInitialAgentChatState();
    state = agentChatReducer(state, { type: 'submit', prompt: 'Summarize.' });
    const streamingId = state.activeMessageId!;
    state = agentChatReducer(state, {
      type: 'text-delta',
      messageId: streamingId,
      text: 'Partial explanation',
    });
    state = agentChatReducer(state, { type: 'cancel' });

    expect(state.messages.at(-1)).toMatchObject({
      content: 'Partial explanation',
      isStreaming: false,
      wasCancelled: true,
    });
    expect(state.activeMessageId).toBeNull();
    expect(state.status).toBeNull();
  });

  test('retries the last prompt without duplicating the user message', () => {
    let state = createInitialAgentChatState();
    state = agentChatReducer(state, { type: 'submit', prompt: 'Try again.' });
    state = agentChatReducer(state, {
      type: 'error',
      error: { code: 'connection', message: 'Connection interrupted.', retryable: true },
    });
    state = agentChatReducer(state, { type: 'retry' });

    expect(state.messages.filter(({ role }) => role === 'user')).toHaveLength(1);
    expect(state.lastPrompt).toBe('Try again.');
    expect(state.activeMessageId).toBeTruthy();
    expect(state.error).toBeNull();
    expect(state.messages.at(-2)?.isStreaming).toBe(false);
  });
});
