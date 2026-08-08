import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { AgentChatPanel, type AgentChatPanelProps } from './AgentChatPanel.tsx';
import type { AgentChatEvent, AgentChatTransport } from './types.ts';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(transport: AgentChatTransport, initialMessages: AgentChatPanelProps['initialMessages'] = []) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<AgentChatPanel initialMessages={initialMessages} transport={transport} />);
  });
}

function submitPrompt(prompt: string) {
  const input = container?.querySelector<HTMLInputElement>('input[name="agent-chat-prompt"]');
  const form = container?.querySelector<HTMLFormElement>('form');
  if (!input || !form) throw new Error('chat composer was not rendered');
  input.value = prompt;
  act(() => {
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
  });
}

describe('AgentChatPanel', () => {
  test('renders history, streams status and text, then exposes citations', async () => {
    let releaseStatus: (() => void) | undefined;
    const events: AgentChatEvent[] = [
      { type: 'text-delta', messageId: 'agent-1', text: 'Consent is recorded.' },
      {
        type: 'citation',
        messageId: 'agent-1',
        citation: { id: 'receipt', label: 'Consent receipt', source: 'consent' },
      },
      { type: 'message-complete', messageId: 'agent-1' },
      { type: 'done' },
    ];
    const transport: AgentChatTransport = {
      async *stream() {
        yield { type: 'status', status: 'Checking consent' };
        await new Promise<void>((resolve) => { releaseStatus = resolve; });
        yield* events;
      },
    };

    render(transport);
    expect(container?.textContent).toContain('Ask the underwriting agent');
    submitPrompt('Is consent ready?');
    await act(async () => Promise.resolve());

    expect(container?.textContent).toContain('Checking consent');
    act(() => releaseStatus?.());
    await act(async () => Promise.resolve());
    expect(container?.textContent).toContain('Consent is recorded.');
    expect(container?.textContent).toContain('Consent receipt');
  });

  test('shows a model-unavailable fallback and lets the user retry', async () => {
    let calls = 0;
    const transport: AgentChatTransport = {
      async *stream() {
        calls += 1;
        yield {
          type: 'error',
          error: {
            code: 'model-unavailable',
            message: 'The underwriting agent is temporarily unavailable.',
            retryable: true,
          },
        };
      },
    };

    render(transport);
    submitPrompt('Explain the application.');
    await act(async () => Promise.resolve());
    expect(container?.textContent).toContain('temporarily unavailable');

    const retry = container?.querySelector<HTMLButtonElement>('button[aria-label="Retry response"]');
    expect(retry).toBeTruthy();
    act(() => retry?.click());
    await act(async () => Promise.resolve());
    expect(calls).toBe(2);
  });

  test('supports stop and keeps partial streamed text', async () => {
    let release: (() => void) | undefined;
    const transport: AgentChatTransport = {
      async *stream() {
        yield { type: 'text-delta', messageId: 'agent-1', text: 'Partial answer' };
        await new Promise<void>((resolve) => { release = resolve; });
        yield { type: 'done' };
      },
    };

    render(transport);
    submitPrompt('Start an explanation.');
    await act(async () => Promise.resolve());
    expect(container?.textContent).toContain('Partial answer');

    const stop = container?.querySelector<HTMLButtonElement>('button[aria-label="Stop response"]');
    expect(stop).toBeTruthy();
    act(() => stop?.click());
    expect(container?.textContent).toContain('Response stopped');
    await act(async () => {
      release?.();
      await Promise.resolve();
    });
  });

  test('renders initial history and exposes keyboard-resizable collapse controls', () => {
    render({ stream: async function* () { yield { type: 'done' }; } }, [
      { id: 'prior', role: 'agent', content: 'Prior explanation.' },
    ]);
    expect(container?.textContent).toContain('Prior explanation.');

    const separator = container?.querySelector<HTMLDivElement>('div[role="separator"]');
    expect(separator?.getAttribute('aria-valuenow')).toBe('420');
    act(() => separator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(separator?.getAttribute('aria-valuenow')).toBe('436');

    const collapse = container?.querySelector<HTMLButtonElement>('button[aria-label="Collapse agent panel"]');
    act(() => collapse?.click());
    expect(container?.querySelector('[aria-label="Open agent panel"]')).toBeTruthy();
    act(() => container?.querySelector<HTMLButtonElement>('[aria-label="Open agent panel"]')?.click());
    expect(container?.querySelector('div[role="separator"]')).toBeTruthy();
  });
});
