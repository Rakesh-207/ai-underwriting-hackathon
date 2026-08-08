export type AgentChatRole = 'user' | 'agent';

export type AgentChatStatus =
  | 'Checking consent'
  | 'Loading application evidence'
  | 'Running deterministic score'
  | 'Retrieving policy context'
  | 'Preparing explanation';

export type AgentChatErrorCode =
  | 'connection'
  | 'model-unavailable'
  | 'cancelled'
  | 'unknown';

export interface AgentChatCitation {
  id: string;
  label: string;
  source: string;
  detail?: string;
}

export interface AgentChatMessage {
  id: string;
  role: AgentChatRole;
  content: string;
  citations?: AgentChatCitation[];
  isStreaming?: boolean;
  wasCancelled?: boolean;
}

export interface AgentChatRequest {
  prompt: string;
  history: AgentChatMessage[];
}

export interface AgentChatDisplayError {
  code: AgentChatErrorCode;
  message: string;
  retryable: boolean;
}

export type AgentChatEvent =
  | { type: 'message-start'; messageId: string }
  | { type: 'text-delta'; messageId: string; text: string }
  | { type: 'status'; status: AgentChatStatus }
  | { type: 'citation'; messageId: string; citation: AgentChatCitation }
  | { type: 'message-complete'; messageId: string }
  | { type: 'done' }
  | { type: 'error'; error: AgentChatDisplayError };

export interface AgentChatTransport {
  stream(
    request: AgentChatRequest,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<AgentChatEvent>;
}

export function toDisplayError(error: unknown): AgentChatDisplayError {
  if (isDisplayError(error)) return error;

  return {
    code: 'unknown',
    message: 'The underwriting agent could not complete this response.',
    retryable: true,
  };
}

function isDisplayError(error: unknown): error is AgentChatDisplayError {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<AgentChatDisplayError>;
  return (
    (candidate.code === 'connection' ||
      candidate.code === 'model-unavailable' ||
      candidate.code === 'cancelled' ||
      candidate.code === 'unknown') &&
    typeof candidate.message === 'string' &&
    typeof candidate.retryable === 'boolean'
  );
}
