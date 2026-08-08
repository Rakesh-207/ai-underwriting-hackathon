import type {
  AgentChatCitation,
  AgentChatDisplayError,
  AgentChatMessage,
  AgentChatStatus,
} from './types.ts';

export interface AgentChatState {
  messages: AgentChatMessage[];
  status: AgentChatStatus | null;
  activeMessageId: string | null;
  lastPrompt: string | null;
  error: AgentChatDisplayError | null;
}

export type AgentChatAction =
  | { type: 'submit'; prompt: string }
  | { type: 'retry' }
  | { type: 'message-start'; messageId: string }
  | { type: 'text-delta'; messageId: string; text: string }
  | { type: 'status'; status: AgentChatStatus }
  | { type: 'citation'; messageId: string; citation: AgentChatCitation }
  | { type: 'message-complete'; messageId: string }
  | { type: 'done' }
  | { type: 'cancel' }
  | { type: 'error'; error: AgentChatDisplayError };

let messageSequence = 0;

export function createInitialAgentChatState(messages: AgentChatMessage[] = []): AgentChatState {
  return {
    messages,
    status: null,
    activeMessageId: null,
    lastPrompt: null,
    error: null,
  };
}

export function agentChatReducer(state: AgentChatState, action: AgentChatAction): AgentChatState {
  switch (action.type) {
    case 'submit':
      return startPrompt(state, action.prompt, false);
    case 'retry':
      return state.lastPrompt ? startPrompt(state, state.lastPrompt, true) : state;
    case 'message-start':
      return startAgentMessage(state, action.messageId);
    case 'text-delta':
      return updateMessage(state, action.messageId, (message) => ({
        ...message,
        content: message.content + action.text,
        isStreaming: true,
      }));
    case 'status':
      return { ...state, status: action.status };
    case 'citation':
      return updateMessage(state, action.messageId, (message) => ({
        ...message,
        citations: [...(message.citations ?? []), action.citation],
      }));
    case 'message-complete':
      return updateMessage(state, action.messageId, (message) => ({
        ...message,
        isStreaming: false,
      }));
    case 'done':
      return { ...state, activeMessageId: null, status: null };
    case 'cancel':
      return {
        ...state,
        activeMessageId: null,
        status: null,
        messages: state.messages.map((message) =>
          message.id === state.activeMessageId
            ? { ...message, isStreaming: false, wasCancelled: true }
            : message,
        ),
      };
    case 'error':
      return {
        ...state,
        activeMessageId: null,
        status: null,
        error: action.error,
        messages: state.messages.map((message) =>
          message.id === state.activeMessageId
            ? { ...message, isStreaming: false }
            : message,
        ),
      };
    default:
      return state;
  }
}

function startPrompt(state: AgentChatState, prompt: string, isRetry: boolean): AgentChatState {
  const userMessage: AgentChatMessage = {
    id: nextMessageId('user'),
    role: 'user',
    content: prompt,
  };
  const agentMessage: AgentChatMessage = {
    id: nextMessageId('agent'),
    role: 'agent',
    content: '',
    isStreaming: true,
  };

  return {
    ...state,
    messages: isRetry ? [...state.messages, agentMessage] : [...state.messages, userMessage, agentMessage],
    activeMessageId: agentMessage.id,
    lastPrompt: prompt,
    status: null,
    error: null,
  };
}

function ensureAgentMessage(state: AgentChatState, messageId: string): AgentChatState {
  if (state.messages.some((message) => message.id === messageId)) {
    return { ...state, activeMessageId: messageId };
  }
  return {
    ...state,
    activeMessageId: messageId,
    messages: [
      ...state.messages,
      { id: messageId, role: 'agent', content: '', isStreaming: true },
    ],
  };
}

function startAgentMessage(state: AgentChatState, messageId: string): AgentChatState {
  if (state.messages.some((message) => message.id === messageId)) {
    return { ...state, activeMessageId: messageId };
  }
  if (state.activeMessageId) {
    return {
      ...state,
      activeMessageId: messageId,
      messages: state.messages.map((message) =>
        message.id === state.activeMessageId && message.role === 'agent'
          ? { ...message, id: messageId }
          : message,
      ),
    };
  }
  return ensureAgentMessage(state, messageId);
}

function updateMessage(
  state: AgentChatState,
  messageId: string,
  update: (message: AgentChatMessage) => AgentChatMessage,
): AgentChatState {
  const targetId = state.messages.some((message) => message.id === messageId)
    ? messageId
    : state.activeMessageId;
  return {
    ...state,
    activeMessageId: targetId,
    messages: state.messages.map((message) =>
      message.id === targetId ? update(message) : message,
    ),
  };
}

function nextMessageId(role: 'user' | 'agent'): string {
  messageSequence += 1;
  return `${role}-${messageSequence}`;
}
