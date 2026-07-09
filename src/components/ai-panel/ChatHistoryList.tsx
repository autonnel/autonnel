import React from 'react';

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface Props {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ChatHistoryList(props: Props) {
  const { sessions, currentSessionId, loading, onOpen, onDelete } = props;

  if (loading) {
    return (
      <div style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>Loading…</div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>
        No chat history yet. Start a conversation to save it here.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 12,
        overflow: 'auto',
        flex: 1,
        minHeight: 0,
      }}
    >
      {sessions.map((s) => {
        const active = s.id === currentSessionId;
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(s.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(s.id);
              }
            }}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '10px 36px 10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              background: active ? '#eef2ff' : 'transparent',
              border: `1px solid ${active ? '#c7d2fe' : 'transparent'}`,
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.title || 'Untitled chat'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 8 }}>
              <span>{formatRelative(s.updatedAt)}</span>
              <span>·</span>
              <span>{s.messageCount} msg</span>
            </div>
            <button
              type="button"
              aria-label="Delete session"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this chat?')) onDelete(s.id);
              }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 22,
                height: 22,
                border: 0,
                borderRadius: 4,
                background: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.color = '#b91c1c';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
