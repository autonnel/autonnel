import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageList } from '@/components/ai-panel/MessageList';
import { Composer } from '@/components/ai-panel/Composer';
import type { AiPanelAdapter, ChatMessage } from '@/components/ai-panel/types';
import type { AssistantTimeline } from '@/components/ai-panel/timeline';
import { applyTimelineEvent } from '@/components/ai-panel/timeline';

interface AnalystPanelProps {
  funnelId?: string;
}

const ENDPOINT = '/api/analytics/analyst-chat';

const WELCOME: ChatMessage = {
  role: 'assistant',
  text: 'Hi — I\'m your conversion analyst. Ask me about funnel drop-off, orders, revenue, or a specific page, and I\'ll dig into your live data.',
};

function toolLabel(toolName: string, input: unknown): string {
  const arg = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case 'getFunnelList':
      return 'Listing funnels…';
    case 'getFunnelMetrics':
      return `Querying funnel metrics${arg.funnelId ? ` (${String(arg.funnelId).slice(0, 12)})` : ''}…`;
    case 'getOrders':
      return `Querying orders${arg.status ? ` (${String(arg.status)})` : ''}…`;
    case 'getPageContent':
      return 'Inspecting page structure…';
    case 'screenshotPage':
      return 'Screenshotting page…';
    default:
      return `${toolName}…`;
  }
}

// Minimal adapter: Composer only reads `placeholder` and (optional) `clearSelection`.
const composerAdapter = { placeholder: 'Ask about conversion, funnels, orders…' } as unknown as AiPanelAdapter;

export default function AnalystPanel({ funnelId }: AnalystPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const streamingTimelineRef = useRef<AssistantTimeline>({ segments: [] });
  const [, forceRender] = useState(0);
  const bumpTimeline = useCallback((mutator: (cur: AssistantTimeline) => AssistantTimeline) => {
    streamingTimelineRef.current = mutator(streamingTimelineRef.current);
    forceRender((n) => n + 1);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const runTurn = useCallback(
    async (allMessages: ChatMessage[]) => {
      setGenerating(true);
      streamingTimelineRef.current = { segments: [] };
      forceRender((n) => n + 1);

      let finalMessages = allMessages;
      const appendMessage = (msg: ChatMessage) => {
        finalMessages = [...finalMessages, msg];
        setMessages(finalMessages);
      };

      const requestBody = JSON.stringify({
        messages: allMessages.map((m) => ({ role: m.role, text: m.text })),
        ...(funnelId ? { funnelId } : {}),
      });

      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });

        if (!res.ok) {
          const rawText = await res.text().catch(() => '');
          let parsed: { error?: string; code?: string } | null = null;
          try {
            parsed = JSON.parse(rawText) as { error?: string; code?: string };
          } catch {
            /* non-JSON */
          }
          console.error('[AnalystPanel] analyst-chat failed', { status: res.status, bodyPreview: rawText.slice(0, 500) });
          const baseMsg =
            parsed?.code === 'LLM_NOT_CONFIGURED'
              ? 'LLM is not configured. Go to Settings → LLM to set it up.'
              : parsed?.error
                ? `${parsed.error} (HTTP ${res.status})`
                : `Server returned HTTP ${res.status}. See browser console for details.`;
          appendMessage({ role: 'assistant', text: baseMsg, error: true });
          return;
        }

        if (!res.body) {
          appendMessage({ role: 'assistant', text: 'Empty response from server.', error: true });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let doneText: string | null = null;
        let errorMsg: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let evt: { type: string; [k: string]: unknown };
            try {
              evt = JSON.parse(trimmed) as { type: string; [k: string]: unknown };
            } catch {
              continue;
            }
            switch (evt.type) {
              case 'start':
              case 'ping':
              case 'reasoning-delta':
              case 'step-start':
                break;
              case 'text-delta': {
                const delta = (evt.delta as string) ?? '';
                if (delta) bumpTimeline((t) => applyTimelineEvent(t, { type: 'text-delta', delta }));
                break;
              }
              case 'tool-call': {
                const toolName = evt.toolName as string;
                bumpTimeline((t) =>
                  applyTimelineEvent(t, {
                    type: 'tool-call',
                    toolName,
                    input: evt.input,
                    label: toolLabel(toolName, evt.input),
                  }),
                );
                break;
              }
              case 'tool-result': {
                const toolName = evt.toolName as string;
                bumpTimeline((t) =>
                  applyTimelineEvent(t, {
                    type: 'tool-result',
                    toolName,
                    added: typeof evt.added === 'number' ? (evt.added as number) : undefined,
                    removed: typeof evt.removed === 'number' ? (evt.removed as number) : undefined,
                    unit: typeof evt.unit === 'string' ? (evt.unit as string) : undefined,
                  }),
                );
                break;
              }
              case 'tool-error': {
                const toolName = evt.toolName as string;
                bumpTimeline((t) =>
                  applyTimelineEvent(t, { type: 'tool-error', toolName, error: (evt.error as string) || 'tool error' }),
                );
                break;
              }
              case 'done':
                doneText = (evt.explanation as string) ?? '';
                break;
              case 'error':
                errorMsg = (evt.error as string) || 'Analysis failed';
                break;
            }
          }
        }

        const finalTimeline = streamingTimelineRef.current;
        streamingTimelineRef.current = { segments: [] };
        forceRender((n) => n + 1);

        if (errorMsg) {
          appendMessage({ role: 'assistant', text: errorMsg, error: true, timeline: finalTimeline });
        } else if (doneText !== null) {
          appendMessage({ role: 'assistant', text: doneText, timeline: finalTimeline });
        } else {
          appendMessage({ role: 'assistant', text: 'Stream ended without a result. See server logs.', error: true, timeline: finalTimeline });
        }
      } catch (e) {
        console.error('[AnalystPanel] analyst-chat threw', e);
        const msg = e instanceof Error ? e.message : 'Network error';
        appendMessage({ role: 'assistant', text: `Network error: ${msg}.`, error: true });
      } finally {
        setGenerating(false);
      }
    },
    [funnelId, bumpTimeline],
  );

  const sendMessage = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;
    const userMessage: ChatMessage = { role: 'user', text: trimmed };
    setPrompt('');
    setMessages((prev) => {
      const next = [...prev, userMessage];
      void runTurn(next);
      return next;
    });
  }, [prompt, generating, runTurn]);

  const retryLastMessage = useCallback(() => {
    if (generating) return;
    setMessages((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 1) return prev;
      if (prev[lastIdx].role !== 'assistant') return prev;
      if (prev[lastIdx - 1]?.role !== 'user') return prev;
      const trimmed = prev.slice(0, lastIdx);
      void runTurn(trimmed);
      return trimmed;
    });
  }, [generating, runTurn]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canSend = !generating && prompt.trim().length > 0;

  return (
    <div className="autonnel-puck-ai-panel" style={{ height: '100%' }}>
      <MessageList
        messages={messages}
        generating={generating}
        uploading={false}
        streamingTimeline={streamingTimelineRef.current}
        messagesEndRef={messagesEndRef}
        onRetryLastMessage={retryLastMessage}
      />
      <Composer
        adapter={composerAdapter}
        capabilities={{}}
        selectionLabel={null}
        onClearSelection={() => {}}
        autoGenerateImages={false}
        setAutoGenerateImages={() => {}}
        showTray={false}
        pendingImages={[]}
        uploading={false}
        error={null}
        removePendingImage={() => {}}
        llmLoading={false}
        llmConfigured={true}
        prompt={prompt}
        setPrompt={setPrompt}
        onKeyDown={handleKeyDown}
        onPaste={() => {}}
        generating={generating}
        textModels={null}
        selectedModel=""
        setSelectedModel={() => {}}
        canSend={canSend}
        onSend={sendMessage}
      />
    </div>
  );
}
