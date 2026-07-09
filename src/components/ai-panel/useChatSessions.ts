import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionSummary } from './ChatHistoryList';
import { apiCall } from '@/lib/api/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  error?: boolean;
}

interface UseChatSessionsResult {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  sessionsLoading: boolean;
  refreshSessions: () => Promise<SessionSummary[]>;
  loadSession: (id: string) => Promise<ChatMessage[] | null>;
  persistSession: (messages: ChatMessage[]) => Promise<void>;
  deleteSession: (id: string) => Promise<SessionSummary[]>;
  resetCurrent: () => void;
}

export function useChatSessions(pageId: string): UseChatSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const refreshSessions = useCallback(async (): Promise<SessionSummary[]> => {
    if (!pageId) return [];
    try {
      const data = await apiCall('GET /api/page/:pageId/chat-sessions', null, { params: { pageId } });
      const list = (data.sessions ?? []) as SessionSummary[];
      setSessions(list);
      return list;
    } catch {
      return [];
    }
  }, [pageId]);

  const loadSession = useCallback(
    async (id: string): Promise<ChatMessage[] | null> => {
      if (!pageId) return null;
      try {
        const data = await apiCall('GET /api/page/:pageId/chat-sessions/:sessionId', null, {
          params: { pageId, sessionId: id },
        });
        const msgs = Array.isArray(data.session.messages) ? (data.session.messages as ChatMessage[]) : [];
        setCurrentSessionId(data.session.id);
        return msgs;
      } catch {
        return null;
      }
    },
    [pageId],
  );

  const persistSession = useCallback(
    async (messages: ChatMessage[]) => {
      if (!pageId) return;
      const hasUserMessage = messages.some((m) => m.role === 'user');
      if (!hasUserMessage) return;

      const existingId = currentSessionIdRef.current;
      if (!existingId) {
        const firstUser = messages.find((m) => m.role === 'user');
        const titleSource = (firstUser?.text ?? '').trim();
        const title = titleSource ? titleSource.slice(0, 60) : 'New chat';
        try {
          const data = await apiCall('POST /api/page/:pageId/chat-sessions', { title, messages }, { params: { pageId } });
          setCurrentSessionId(data.session.id);
          await refreshSessions();
        } catch {
        }
        return;
      }

      try {
        await apiCall('PUT /api/page/:pageId/chat-sessions/:sessionId', { messages }, {
          params: { pageId, sessionId: existingId },
        });
        await refreshSessions();
      } catch {
      }
    },
    [pageId, refreshSessions],
  );

  const deleteSession = useCallback(
    async (id: string): Promise<SessionSummary[]> => {
      if (!pageId) return sessions;
      try {
        await apiCall('DELETE /api/page/:pageId/chat-sessions/:sessionId', null, {
          params: { pageId, sessionId: id },
        });
      } catch {
      }
      const list = await refreshSessions();
      if (currentSessionIdRef.current === id) {
        setCurrentSessionId(null);
      }
      return list;
    },
    [pageId, refreshSessions, sessions],
  );

  const resetCurrent = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      await refreshSessions();
      if (!cancelled) setSessionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSessions]);

  return {
    sessions,
    currentSessionId,
    sessionsLoading,
    refreshSessions,
    loadSession,
    persistSession,
    deleteSession,
    resetCurrent,
  };
}
