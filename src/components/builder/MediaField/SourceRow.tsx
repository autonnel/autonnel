import React from 'react';
import { iconButtonStyle, spinnerStyle } from './styles';

interface Props {
  url: string;
  onUrlChange: (next: string) => void;
  onUploadClick: () => void;
  uploading: boolean;
  aiOpen: boolean;
  onAiToggle: () => void;
  generating: boolean;
  hasUnsentPrompt: boolean;
}

export function SourceRow({
  url,
  onUrlChange,
  onUploadClick,
  uploading,
  aiOpen,
  onAiToggle,
  generating,
  hasUnsentPrompt,
}: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
      <input
        type="text"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="Media URL (image or video)"
        style={{
          flex: 1,
          padding: '8px 10px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 12,
          boxSizing: 'border-box',
          background: '#ffffff',
          color: '#111827',
        }}
      />
      <button
        type="button"
        onClick={onUploadClick}
        disabled={uploading || generating}
        style={iconButtonStyle(uploading || generating)}
        aria-label="Upload image or video"
      >
        {uploading ? (
          <span style={spinnerStyle} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onAiToggle}
        disabled={generating}
        aria-label="Toggle AI generation"
        style={iconButtonStyle(generating, aiOpen || generating)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.4 5.4L20 11l-5.6 2.6L12 19l-2.4-5.4L4 11l5.6-2.6L12 3z" />
        </svg>
        {!aiOpen && hasUnsentPrompt && (
          <span
            data-testid="ai-unsent-dot"
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#7c3aed',
              border: '1.5px solid #ffffff',
            }}
          />
        )}
      </button>
    </div>
  );
}
