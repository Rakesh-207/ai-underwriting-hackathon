import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import {
  agentChatReducer,
  createInitialAgentChatState,
} from './reducer.ts';
import {
  toDisplayError,
  type AgentChatMessage,
  type AgentChatStatus,
  type AgentChatTransport,
} from './types.ts';
import type { AgentChatAction, AgentChatState } from './reducer.ts';

const MIN_WIDTH = 320;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 420;

export interface AgentChatPanelProps {
  transport: AgentChatTransport;
  initialMessages?: AgentChatMessage[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  width?: number;
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
  title?: string;
}

export function AgentChatPanel({
  transport,
  initialMessages = [],
  open: controlledOpen,
  defaultOpen = true,
  onOpenChange,
  width: controlledWidth,
  defaultWidth = DEFAULT_WIDTH,
  onWidthChange,
  title = 'Underwriting agent',
}: AgentChatPanelProps) {
  const [state, dispatch] = useReducerWithInitialMessages(initialMessages);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [uncontrolledWidth, setUncontrolledWidth] = useState(clampWidth(defaultWidth));
  const [isMobile, setIsMobile] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const messageViewport = useRef<HTMLDivElement>(null);
  const wasNearBottom = useRef(true);
  const open = controlledOpen ?? uncontrolledOpen;
  const width = clampWidth(controlledWidth ?? uncontrolledWidth);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(max-width: 767px)') ?? {
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const updateMobile = () => setIsMobile(mediaQuery.matches);
    updateMobile();
    mediaQuery.addEventListener('change', updateMobile);
    return () => mediaQuery.removeEventListener('change', updateMobile);
  }, []);

  useEffect(() => {
    const viewport = messageViewport.current;
    if (!viewport || !wasNearBottom.current) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [state.messages, state.status]);

  useEffect(() => () => abortController.current?.abort(), []);

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const updateWidth = (nextWidth: number) => {
    const safeWidth = clampWidth(nextWidth);
    if (controlledWidth === undefined) setUncontrolledWidth(safeWidth);
    onWidthChange?.(safeWidth);
  };

  const consume = async (prompt: string, history: AgentChatMessage[]) => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    try {
      for await (const event of transport.stream({ prompt, history }, { signal: controller.signal })) {
        dispatch(eventToAction(event));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({ type: 'error', error: toDisplayError(error) });
      }
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = String(new FormData(event.currentTarget).get('agent-chat-prompt') ?? '').trim();
    if (!prompt || state.activeMessageId) return;
    dispatch({ type: 'submit', prompt });
    event.currentTarget.reset();
    void consume(prompt, state.messages);
  };

  const retry = () => {
    if (!state.lastPrompt || state.activeMessageId) return;
    dispatch({ type: 'retry' });
    void consume(state.lastPrompt, state.messages);
  };

  const stop = () => {
    if (!state.activeMessageId) return;
    abortController.current?.abort();
    dispatch({ type: 'cancel' });
  };

  const onViewportScroll = () => {
    const viewport = messageViewport.current;
    if (!viewport) return;
    wasNearBottom.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
  };

  const resizeHandle = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const move = (moveEvent: PointerEvent) => updateWidth(startWidth + startX - moveEvent.clientX);
    const stopResize = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stopResize);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stopResize);
  };

  const onResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === 'ArrowLeft') updateWidth(width + step);
    if (event.key === 'ArrowRight') updateWidth(width - step);
    if (event.key === 'Home') updateWidth(MIN_WIDTH);
    if (event.key === 'End') updateWidth(MAX_WIDTH);
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.preventDefault();
  };

  const panel = (
    <section
      aria-label={title}
      aria-modal={isMobile ? true : undefined}
      className="flex h-full min-h-0 flex-col bg-surface text-ink shadow-xl"
      role={isMobile ? 'dialog' : undefined}
      style={isMobile ? undefined : { width }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Live review</p>
          <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Collapse agent panel"
            className="hidden rounded-md px-2 py-1 text-xs text-muted hover:bg-bg hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:inline-flex"
            onClick={() => setOpen(false)}
            type="button"
          >
            Collapse
          </button>
          <button
            aria-label="Close agent panel"
            className="rounded-md px-2 py-1 text-xs text-muted hover:bg-bg hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:hidden"
            onClick={() => setOpen(false)}
            type="button"
          >
            Close
          </button>
        </div>
      </header>

      <div
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
        onScroll={onViewportScroll}
        ref={messageViewport}
      >
        {state.messages.length === 0 ? (
          <div className="my-auto px-2 py-8 text-center">
            <p className="text-sm font-semibold">Ask the underwriting agent</p>
            <p className="mt-2 text-sm leading-6 text-muted">Get a source-linked explanation of the current application evidence.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {state.messages.map((message) => <ChatMessageView key={message.id} message={message} />)}
          </div>
        )}
        {state.status && <StatusIndicator status={state.status} />}
        {state.error && <ErrorNotice error={state.error} onRetry={retry} />}
      </div>

      <form className="shrink-0 border-t border-border bg-surface px-4 py-3" onSubmit={submit}>
        <label className="sr-only" htmlFor="agent-chat-prompt">Ask the underwriting agent</label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <input
            aria-label="Ask the underwriting agent"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-muted"
            disabled={Boolean(state.activeMessageId)}
            name="agent-chat-prompt"
            placeholder="Ask about this application..."
            type="text"
          />
          {state.activeMessageId ? (
            <Button aria-label="Stop response" onClick={stop} size="sm" type="button" variant="secondary">Stop</Button>
          ) : (
            <Button aria-label="Send message" size="sm" type="submit">Send</Button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">Responses cite the evidence and policy context used.</p>
      </form>
    </section>
  );

  if (isMobile) {
    return open ? (
      <div className="fixed inset-0 z-50 md:hidden">
        <button aria-label="Close agent panel" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} type="button" />
        <div className="absolute inset-0">{panel}</div>
      </div>
    ) : null;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 hidden md:flex">
      {open ? (
        <>
          <div
            aria-label="Resize agent panel"
            aria-orientation="vertical"
            aria-valuemax={MAX_WIDTH}
            aria-valuemin={MIN_WIDTH}
            aria-valuenow={width}
            className="w-2 cursor-col-resize touch-none border-l border-border bg-bg hover:bg-primary/20"
            onKeyDown={onResizeKeyDown}
            onPointerDown={resizeHandle}
            role="separator"
            tabIndex={0}
          />
          {panel}
        </>
      ) : (
        <button
          aria-expanded={false}
          aria-label="Open agent panel"
          className="my-6 flex w-11 items-center justify-center rounded-l-lg border border-r-0 border-border bg-surface px-2 text-xs font-semibold text-muted shadow-lg [writing-mode:vertical-rl] hover:text-primary"
          onClick={() => setOpen(true)}
          type="button"
        >
          Agent
        </button>
      )}
    </aside>
  );
}

function ChatMessageView({ message }: { message: AgentChatMessage }) {
  const isAgent = message.role === 'agent';
  return (
    <article className={isAgent ? 'max-w-[92%]' : 'ml-auto max-w-[88%]'}>
      <div className={isAgent ? 'rounded-lg border border-border bg-bg px-3 py-2.5' : 'rounded-lg bg-primary px-3 py-2.5 text-primary-contrast'}>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.content || (message.isStreaming ? ' ' : '')}</p>
        {message.wasCancelled && <p className="mt-2 text-xs text-muted">Response stopped</p>}
      </div>
      {message.citations && message.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.citations.map((citation) => (
            <details className="group" key={citation.id}>
              <summary className="list-none"><Badge className="cursor-pointer hover:border-primary hover:text-primary" tone="neutral">{citation.label}</Badge></summary>
              {citation.detail && <p className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-xs leading-5 text-muted">{citation.detail}<span className="mt-1 block font-mono text-[10px]">{citation.source}</span></p>}
            </details>
          ))}
        </div>
      )}
    </article>
  );
}

function StatusIndicator({ status }: { status: AgentChatStatus }) {
  return <div className="mt-4 flex items-center gap-2 text-xs text-muted"><span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />{status}</div>;
}

function ErrorNotice({ error, onRetry }: { error: AgentChatState['error']; onRetry: () => void }) {
  if (!error) return null;
  return (
    <div aria-live="assertive" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-3" role="alert">
      <p className="text-sm font-medium">{error.message}</p>
      {error.code === 'model-unavailable' && <p className="mt-1 text-xs leading-5 text-muted">The agent is unavailable right now. You can retry when the service is ready.</p>}
      {error.retryable && <Button aria-label="Retry response" className="mt-3" onClick={onRetry} size="sm" type="button" variant="secondary">Retry</Button>}
    </div>
  );
}

function eventToAction(event: import('./types.ts').AgentChatEvent): AgentChatAction {
  if (event.type === 'error') return { type: 'error', error: event.error };
  return event;
}

function useReducerWithInitialMessages(initialMessages: AgentChatMessage[]): [AgentChatState, import('react').Dispatch<AgentChatAction>] {
  return useReducer(agentChatReducer, initialMessages, createInitialAgentChatState);
}

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number.isFinite(width) ? width : DEFAULT_WIDTH));
}
