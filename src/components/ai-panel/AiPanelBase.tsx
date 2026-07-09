import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatHistoryList } from './ChatHistoryList';
import { useChatSessions } from './useChatSessions';
import type { AiPanelAdapter, ChatMessage, SelectionLabel } from './types';
import type { AssistantTimeline } from './timeline';
import { apiCall } from '@/lib/api/client';
import {
  fileToBase64,
  MAX_IMAGE_SIZE_BYTES,
  type LlmModelOption,
} from './panel-helpers';
import { runAgentTurn as runAgentTurnImpl } from './runAgentTurn';
import { PanelHeader } from './PanelHeader';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

interface AiPanelBaseProps {
  pageId: string;
  adapter: AiPanelAdapter;
}

export function AiPanelBase({ pageId, adapter }: AiPanelBaseProps) {
  const WELCOME_MESSAGE: ChatMessage = useMemo(
    () => ({ role: 'assistant', text: adapter.welcomeMessage }),
    [adapter.welcomeMessage],
  );
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textModels, setTextModels] = useState<LlmModelOption[] | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sessionsView, setSessionsView] = useState<'chat' | 'history'>('chat');
  const {
    sessions,
    currentSessionId,
    sessionsLoading,
    loadSession: loadSessionMessages,
    persistSession,
    deleteSession,
    resetCurrent,
  } = useChatSessions(pageId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  const capabilities = adapter.getCapabilities?.() ?? {};
  const autoGenStorageKey = `autonnel:ai-panel:auto-generate-images:${adapter.endpoint}`;
  const [autoGenerateImages, setAutoGenerateImages] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(autoGenStorageKey);
    return stored === null ? true : stored === '1';
  });

  const streamingTimelineRef = useRef<AssistantTimeline>({ segments: [] });
  const [, forceRender] = useState(0);
  const updateStreamingTimeline = useCallback(
    (mutator: (cur: AssistantTimeline) => AssistantTimeline) => {
      streamingTimelineRef.current = mutator(streamingTimelineRef.current);
      forceRender((n) => n + 1);
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(autoGenStorageKey, autoGenerateImages ? '1' : '0');
  }, [autoGenStorageKey, autoGenerateImages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const currentSessionTitle = useMemo(
    () => sessions.find((s) => s.id === currentSessionId)?.title ?? 'New chat',
    [sessions, currentSessionId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiCall('GET /api/page/ai-models', null);
        if (cancelled) return;
        const models = (data.models ?? []) as LlmModelOption[];
        setTextModels(models);
        const def = models.find((m) => m.isDefault) ?? models[0];
        if (def) setSelectedModel(def.name);
      } catch {
        if (!cancelled) setTextModels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openSession = useCallback(
    async (id: string) => {
      const loaded = await loadSessionMessages(id);
      if (loaded === null) return;
      setMessages(loaded.length > 0 ? loaded : [WELCOME_MESSAGE]);
      setSessionsView('chat');
      setError(null);
    },
    [loadSessionMessages, WELCOME_MESSAGE],
  );

  const initialOpenedRef = useRef(false);
  useEffect(() => {
    if (sessionsLoading) return;
    if (initialOpenedRef.current) return;
    initialOpenedRef.current = true;
    // The sessions list loads async; if the user already started chatting before it
    // resolved, opening the latest session here would clobber the in-flight turn.
    if (generating || messagesRef.current.length > 1) return;
    if (sessions.length > 0) {
      void openSession(sessions[0].id);
    }
  }, [sessionsLoading, sessions, openSession, generating]);

  const handleNewChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    resetCurrent();
    setPendingImages([]);
    setError(null);
    setPrompt('');
    setSessionsView('chat');
  }, [resetCurrent, WELCOME_MESSAGE]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const wasCurrent = id === currentSessionId;
      const list = await deleteSession(id);
      if (wasCurrent) {
        if (list.length > 0) await openSession(list[0].id);
        else handleNewChat();
      }
    },
    [currentSessionId, deleteSession, openSession, handleNewChat],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingImages]);

  const uploadImages = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const base64s = await Promise.all(
        files.map(async (file) => {
          if (file.size > MAX_IMAGE_SIZE_BYTES) {
            throw new Error(`Image "${file.name || 'pasted'}" exceeds 10 MB`);
          }
          return {
            base64: await fileToBase64(file),
            fileName: file.name || `pasted-${Date.now()}.png`,
          };
        }),
      );

      const res = await fetch('/api/page/ai-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: base64s }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Upload failed' }))) as {
          error?: string;
        };
        throw new Error(err.error || 'Upload failed');
      }

      const data = (await res.json()) as { images: Array<{ url: string }> };
      setPendingImages((prev) => [...prev, ...data.images.map((i) => i.url)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void uploadImages(files);
    }
  };

  const removePendingImage = (idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const runAgentTurn = (allMessages: ChatMessage[]) =>
    runAgentTurnImpl(allMessages, {
      adapter,
      capabilities,
      selectedModel,
      autoGenerateImages,
      pageId,
      streamingTimelineRef,
      forceRender,
      updateStreamingTimeline,
      setError,
      setGenerating,
      setProgressText,
      setMessages,
      persistSession,
    });

  const sendMessage = async () => {
    const trimmed = prompt.trim();
    if ((!trimmed && pendingImages.length === 0) || generating || uploading) return;
    adapter.beforeSend();

    const userMessage: ChatMessage = {
      role: 'user',
      text: trimmed,
      ...(pendingImages.length > 0 ? { images: pendingImages } : {}),
    };

    setPrompt('');
    setPendingImages([]);
    setMessages((prev) => [...prev, userMessage]);

    await runAgentTurn([...messages, userMessage]);
  };

  const retryLastMessage = async () => {
    if (generating || uploading) return;
    const current = messagesRef.current;
    const lastIdx = current.length - 1;
    if (lastIdx < 1) return;
    const last = current[lastIdx];
    if (last.role !== 'assistant') return;
    const prev = current[lastIdx - 1];
    if (!prev || prev.role !== 'user') return;
    const trimmed = current.slice(0, lastIdx);
    setMessages(trimmed);
    await runAgentTurn(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const [, setClearSelectionTick] = useState(0);
  const selectionLabel: SelectionLabel | null = adapter.getSelectionLabel?.() ?? null;

  const llmConfigured = textModels !== null && textModels.length > 0;
  const llmLoading = textModels === null;
  const canSend =
    llmConfigured &&
    !generating &&
    !uploading &&
    (prompt.trim().length > 0 || pendingImages.length > 0);
  const showTray = pendingImages.length > 0 || uploading || error;

  const inHistoryView = sessionsView === 'history';

  return (
    <div className="autonnel-puck-ai-panel">
      <PanelHeader
        inHistoryView={inHistoryView}
        currentSessionTitle={currentSessionTitle}
        onNewChat={handleNewChat}
        onToggleHistory={() => setSessionsView(inHistoryView ? 'chat' : 'history')}
      />

      {inHistoryView && (
        <ChatHistoryList
          sessions={sessions}
          currentSessionId={currentSessionId}
          loading={sessionsLoading}
          onOpen={(id) => void openSession(id)}
          onDelete={(id) => void handleDeleteSession(id)}
        />
      )}

      {!inHistoryView && (
      <>
      <MessageList
        messages={messages}
        generating={generating}
        uploading={uploading}
        streamingTimeline={streamingTimelineRef.current}
        messagesEndRef={messagesEndRef}
        onRetryLastMessage={() => void retryLastMessage()}
      />

      <Composer
        adapter={adapter}
        capabilities={capabilities}
        selectionLabel={selectionLabel}
        onClearSelection={() => {
          adapter.clearSelection?.();
          setClearSelectionTick((t) => t + 1);
        }}
        autoGenerateImages={autoGenerateImages}
        setAutoGenerateImages={setAutoGenerateImages}
        showTray={showTray}
        pendingImages={pendingImages}
        uploading={uploading}
        error={error}
        removePendingImage={removePendingImage}
        llmLoading={llmLoading}
        llmConfigured={llmConfigured}
        prompt={prompt}
        setPrompt={setPrompt}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        generating={generating}
        textModels={textModels}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        canSend={canSend}
        onSend={sendMessage}
      />
      </>
      )}
    </div>
  );
}
