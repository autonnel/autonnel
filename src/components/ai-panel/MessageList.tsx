import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from './types';
import type { AssistantTimeline } from './timeline';
import { timelineHasText } from './timeline';
import { TimelineView } from './TimelineView';

interface MessageListProps {
  messages: ChatMessage[];
  generating: boolean;
  uploading: boolean;
  streamingTimeline: AssistantTimeline;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onRetryLastMessage: () => void;
}

export function MessageList({
  messages,
  generating,
  uploading,
  streamingTimeline,
  messagesEndRef,
  onRetryLastMessage,
}: MessageListProps) {
  return (
    <div className="autonnel-puck-ai-panel__messages">
      {messages.map((msg, i) => {
        const isLastAssistant =
          i === messages.length - 1 &&
          msg.role === 'assistant' &&
          i > 0 &&
          messages[i - 1]?.role === 'user';
        const textInTimeline = msg.role === 'assistant' && !msg.error && timelineHasText(msg.timeline);
        return (
        <div
          key={i}
          className={`autonnel-puck-ai-panel__message autonnel-puck-ai-panel__message--${msg.role}`}
          style={
            msg.error
              ? {
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: 10,
                  padding: '10px 12px',
                  alignSelf: 'stretch',
                }
              : undefined
          }
        >
          {msg.images && msg.images.length > 0 && (
            <div
              className="autonnel-puck-ai-panel__message-images"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: msg.text ? 6 : 0,
              }}
            >
              {msg.images.map((url, j) => (
                <img
                  key={j}
                  src={url}
                  alt=""
                  className="autonnel-puck-ai-panel__message-image"
                  style={{
                    maxWidth: 200,
                    maxHeight: 200,
                    width: 'auto',
                    height: 'auto',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    display: 'block',
                    objectFit: 'cover',
                  }}
                />
              ))}
            </div>
          )}
          {msg.timeline && msg.timeline.segments.length > 0 && msg.role === 'assistant' && (
            <TimelineView timeline={msg.timeline} />
          )}
          {msg.text && !textInTimeline && (
            msg.role === 'assistant' && !msg.error ? (
              <div className="autonnel-puck-ai-panel__markdown">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
            )
          )}
          {isLastAssistant && (
            <button
              type="button"
              onClick={() => void onRetryLastMessage()}
              disabled={generating || uploading}
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                border: `1px solid ${msg.error ? '#fca5a5' : '#d1d5db'}`,
                borderRadius: 6,
                background: '#ffffff',
                color: msg.error ? '#991b1b' : '#374151',
                cursor: generating || uploading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {msg.error ? 'Retry' : 'Regenerate'}
            </button>
          )}
        </div>
        );
      })}
      {generating && streamingTimeline.segments.length > 0 && (
        <div className="autonnel-puck-ai-panel__message autonnel-puck-ai-panel__message--assistant">
          <TimelineView timeline={streamingTimeline} />
        </div>
      )}
      {generating && streamingTimeline.segments.length === 0 && (
        <div className="autonnel-puck-ai-panel__status">
          <span className="autonnel-puck-ai-panel__spinner" />
          Thinking…
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
