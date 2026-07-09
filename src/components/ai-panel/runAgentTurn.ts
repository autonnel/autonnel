import type { AiPanelAdapter, AdapterCapabilities, ChatMessage, DonePayload } from './types';
import type { AssistantTimeline } from './timeline';
import { applyTimelineEvent } from './timeline';
import { generatePendingMedia } from './media-autogen';

interface RunAgentTurnDeps {
  adapter: AiPanelAdapter;
  capabilities: AdapterCapabilities;
  selectedModel: string;
  autoGenerateImages: boolean;
  pageId: string;
  streamingTimelineRef: { current: AssistantTimeline };
  forceRender: (updater: (n: number) => number) => void;
  updateStreamingTimeline: (mutator: (cur: AssistantTimeline) => AssistantTimeline) => void;
  setError: (v: string | null) => void;
  setGenerating: (v: boolean) => void;
  setProgressText: (v: string | null) => void;
  setMessages: (v: ChatMessage[]) => void;
  persistSession: (messages: ChatMessage[]) => void | Promise<unknown>;
}

export async function runAgentTurn(allMessages: ChatMessage[], deps: RunAgentTurnDeps) {
  const {
    adapter,
    capabilities,
    selectedModel,
    autoGenerateImages,
    streamingTimelineRef,
    forceRender,
    updateStreamingTimeline,
    setError,
    setGenerating,
    setProgressText,
    setMessages,
    persistSession,
  } = deps;

  setError(null);
  setGenerating(true);

  const apiMessages = allMessages.map((m) => ({
    role: m.role,
    text: m.text,
    ...(m.images && m.images.length > 0 ? { images: m.images } : {}),
  }));
  const stateField = adapter.getStateField();
  const hint = adapter.getSelectionHint();
  const enrichedMessages = hint
    ? apiMessages.map((m, i, arr) =>
        i === arr.length - 1 && m.role === 'user'
          ? { ...m, text: `${hint.description}\n\n${m.text}` }
          : m,
      )
    : apiMessages;
  const requestBody = JSON.stringify({
    messages: enrichedMessages,
    [stateField]: adapter.getState(),
    ...(selectedModel ? { modelName: selectedModel } : {}),
    ...(capabilities.supportsImageGeneration ? { autoGenerateImages } : {}),
  });

  const startedAt = Date.now();
  let finalMessages: ChatMessage[] = allMessages;
  const appendMessage = (msg: ChatMessage) => {
    finalMessages = [...finalMessages, msg];
    setMessages(finalMessages);
  };

  streamingTimelineRef.current = { segments: [] };
  forceRender((n) => n + 1);

  try {
    const res = await fetch(adapter.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    if (!res.ok) {
      const status = res.status;
      const rawText = await res.text().catch(() => '');
      let parsed: { error?: string; code?: string } | null = null;
      try {
        parsed = JSON.parse(rawText) as { error?: string; code?: string };
      } catch {
      }
      console.error('[AiPanelBase] ai-chat failed', {
        endpoint: adapter.endpoint,
        status,
        contentType: res.headers.get('content-type'),
        bodyPreview: rawText.slice(0, 500),
        requestSize: requestBody.length,
        messageCount: apiMessages.length,
      });
      const baseMsg =
        parsed?.code === 'LLM_NOT_CONFIGURED'
          ? 'LLM is not configured. Go to Settings → LLM to set it up.'
          : parsed?.error
            ? `${parsed.error} (HTTP ${status})`
            : `Server returned HTTP ${status}${parsed ? '' : ' (non-JSON response)'}. See browser console for details.`;
      appendMessage({ role: 'assistant', text: baseMsg, error: true });
      return;
    }

    const contentType = res.headers.get('content-type') ?? '';
    const isStream = contentType.includes('application/x-ndjson');

    if (isStream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneEvt: DonePayload | null = null;
      let errorEvtMsg: string | null = null;

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
              if (!delta) break;
              updateStreamingTimeline((t) => applyTimelineEvent(t, { type: 'text-delta', delta }));
              break;
            }
            case 'tool-call': {
              const toolName = evt.toolName as string;
              const input = evt.input;
              const label = adapter.formatToolLabel(toolName, input);
              updateStreamingTimeline((t) =>
                applyTimelineEvent(t, { type: 'tool-call', toolName, input, label }),
              );
              if (adapter.isMutatingTool(toolName)) {
                adapter.applyTool({ toolName, input });
              }
              break;
            }
            case 'tool-result': {
              const toolName = evt.toolName as string;
              const added = typeof evt.added === 'number' ? (evt.added as number) : undefined;
              const removed = typeof evt.removed === 'number' ? (evt.removed as number) : undefined;
              const unit = typeof evt.unit === 'string' ? (evt.unit as string) : undefined;
              updateStreamingTimeline((t) =>
                applyTimelineEvent(t, { type: 'tool-result', toolName, added, removed, unit }),
              );
              break;
            }
            case 'tool-error': {
              const toolName = evt.toolName as string;
              const error = (evt.error as string) || 'tool error';
              updateStreamingTimeline((t) =>
                applyTimelineEvent(t, { type: 'tool-error', toolName, error }),
              );
              break;
            }
            case 'done':
              doneEvt = evt as unknown as DonePayload;
              break;
            case 'error':
              errorEvtMsg = (evt.error as string) || 'Agent generation failed';
              break;
          }
        }
      }

      const finalTimeline = streamingTimelineRef.current;
      streamingTimelineRef.current = { segments: [] };
      forceRender((n) => n + 1);

      if (errorEvtMsg) {
        appendMessage({ role: 'assistant', text: errorEvtMsg, error: true, timeline: finalTimeline });
        return;
      }
      if (doneEvt) {
        adapter.applyDone({ ...doneEvt, autoGenerateImages });
        appendMessage({
          role: 'assistant',
          text: doneEvt.explanation,
          timeline: finalTimeline,
        });
        if (autoGenerateImages && adapter.getPendingMedia && adapter.applyGeneratedMedia) {
          await runMediaGenerationPhase(deps, appendMessage);
        }
      } else {
        appendMessage({
          role: 'assistant',
          text: 'Stream ended without a result. See server logs.',
          error: true,
          timeline: finalTimeline,
        });
      }
    } else {
      appendMessage({
        role: 'assistant',
        text: 'Server returned a non-streaming response. See server logs.',
        error: true,
      });
    }
  } catch (e) {
    console.error('[AiPanelBase] ai-chat threw', {
      endpoint: adapter.endpoint,
      error: e,
      elapsedMs: Date.now() - startedAt,
      requestSize: requestBody.length,
    });
    const msg = e instanceof Error ? e.message : 'Network error';
    appendMessage({
      role: 'assistant',
      text: `Network error: ${msg}. Check your connection or server logs.`,
      error: true,
    });
  } finally {
    setGenerating(false);
    setProgressText(null);
    void persistSession(finalMessages);
  }
}

async function runMediaGenerationPhase(
  deps: RunAgentTurnDeps,
  appendMessage: (msg: ChatMessage) => void,
) {
  const {
    adapter,
    pageId,
    streamingTimelineRef,
    forceRender,
    updateStreamingTimeline,
    setProgressText,
  } = deps;

  const pending = adapter.getPendingMedia!();
  if (pending.length === 0) return;

  streamingTimelineRef.current = { segments: [] };
  forceRender((n) => n + 1);

  const total = pending.length;
  let settled = 0;
  setProgressText(`Generating media 0/${total}…`);

  const result = await generatePendingMedia(pending, {
    planId: pageId,
    apply: (item, url) => adapter.applyGeneratedMedia!(item, url),
    onStart: (item) => {
      updateStreamingTimeline((t) =>
        applyTimelineEvent(t, {
          type: 'tool-call',
          toolName: `media:${item.key}`,
          input: undefined,
          label: `Generating ${item.mediaType}: ${item.label}`,
        }),
      );
    },
    onDone: (item) => {
      settled += 1;
      setProgressText(`Generating media ${settled}/${total}…`);
      updateStreamingTimeline((t) =>
        applyTimelineEvent(t, { type: 'tool-result', toolName: `media:${item.key}` }),
      );
    },
    onError: (item, message) => {
      settled += 1;
      setProgressText(`Generating media ${settled}/${total}…`);
      updateStreamingTimeline((t) =>
        applyTimelineEvent(t, { type: 'tool-error', toolName: `media:${item.key}`, error: message }),
      );
    },
  });

  const genTimeline = streamingTimelineRef.current;
  streamingTimelineRef.current = { segments: [] };
  forceRender((n) => n + 1);

  const summary =
    result.failed > 0
      ? `Generated ${result.succeeded}/${total} media assets — ${result.failed} failed. You can retry a failed slot from that component's media field.`
      : `Generated ${result.succeeded} media asset${result.succeeded === 1 ? '' : 's'}.`;
  appendMessage({ role: 'assistant', text: summary, timeline: genTimeline });
}
