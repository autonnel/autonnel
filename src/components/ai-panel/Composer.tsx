import React from 'react';
import type { AiPanelAdapter, AdapterCapabilities, SelectionLabel } from './types';
import type { LlmModelOption } from './panel-helpers';

interface ComposerProps {
  adapter: AiPanelAdapter;
  capabilities: AdapterCapabilities;
  selectionLabel: SelectionLabel | null;
  onClearSelection: () => void;
  autoGenerateImages: boolean;
  setAutoGenerateImages: (v: boolean) => void;
  showTray: boolean | string | null;
  pendingImages: string[];
  uploading: boolean;
  error: string | null;
  removePendingImage: (idx: number) => void;
  llmLoading: boolean;
  llmConfigured: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  generating: boolean;
  textModels: LlmModelOption[] | null;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
}

export function Composer({
  adapter,
  capabilities,
  selectionLabel,
  onClearSelection,
  autoGenerateImages,
  setAutoGenerateImages,
  showTray,
  pendingImages,
  uploading,
  error,
  removePendingImage,
  llmLoading,
  llmConfigured,
  prompt,
  setPrompt,
  onKeyDown,
  onPaste,
  generating,
  textModels,
  selectedModel,
  setSelectedModel,
  canSend,
  onSend,
}: ComposerProps) {
  return (
    <div className="autonnel-puck-ai-panel__composer">
      <div
        className="autonnel-puck-ai-panel__input-stack"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}
      >
        {selectionLabel && (
          <div
            className="autonnel-puck-ai-panel__selected"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              fontSize: 12,
              color: '#1e3a8a',
              lineHeight: 1.3,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span style={{ fontWeight: 600 }}>Editing:</span>
            <span style={{ fontWeight: 500 }}>{selectionLabel.label}</span>
            {selectionLabel.sublabel && (
              <span style={{ color: '#3b5fa3', opacity: 0.7 }}>{selectionLabel.sublabel}</span>
            )}
            {adapter.clearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Clear selection"
                title="Clear selection (edit whole page)"
                style={{
                  marginLeft: 'auto',
                  width: 18,
                  height: 18,
                  minWidth: 0,
                  minHeight: 0,
                  border: 0,
                  borderRadius: '50%',
                  background: 'transparent',
                  color: '#1e3a8a',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
        {capabilities.supportsImageGeneration && (
          <label
            className="autonnel-puck-ai-panel__autogen"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: 11,
              color: '#6b7280',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            title="After the agent finishes, automatically generate media for every image/video prompt it wrote."
          >
            <input
              type="checkbox"
              checked={autoGenerateImages}
              onChange={(e) => setAutoGenerateImages(e.target.checked)}
              style={{ margin: 0 }}
            />
            Auto-generate images
          </label>
        )}
        {showTray && (
          <div
            className="autonnel-puck-ai-panel__pending"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {pendingImages.map((url, idx) => (
              <div
                key={idx}
                className="autonnel-puck-ai-panel__thumb"
                style={{
                  position: 'relative',
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  flexShrink: 0,
                }}
              >
                <img
                  src={url}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <button
                  type="button"
                  className="autonnel-puck-ai-panel__thumb-remove"
                  onClick={() => removePendingImage(idx)}
                  aria-label="Remove image"
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 18,
                    height: 18,
                    minWidth: 0,
                    minHeight: 0,
                    border: 0,
                    borderRadius: '50%',
                    background: 'rgba(17, 24, 39, 0.78)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {uploading && (
              <div
                className="autonnel-puck-ai-panel__thumb autonnel-puck-ai-panel__thumb--loading"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  border: '1px dashed #d1d5db',
                  background: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="autonnel-puck-ai-panel__spinner" />
              </div>
            )}
            {error && (
              <div
                className="autonnel-puck-ai-panel__error"
                style={{
                  flexBasis: '100%',
                  color: '#b91c1c',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}
          </div>
        )}
        {!llmLoading && !llmConfigured && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              color: '#92400e',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            No text LLM configured. Open{' '}
            <a
              href="/settings/llm"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#92400e', textDecoration: 'underline', fontWeight: 600 }}
            >
              Settings → LLM
            </a>{' '}
            to add a text model.
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={
            llmLoading
              ? 'Loading…'
              : llmConfigured
                ? adapter.placeholder
                : 'Configure a text LLM to enable the assistant.'
          }
          disabled={generating || !llmConfigured}
          rows={3}
        />
        {llmConfigured && textModels && textModels.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#6b7280',
            }}
          >
            <span>Model</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={generating}
              style={{
                flex: 1,
                minWidth: 0,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#ffffff',
                color: '#111827',
                padding: '6px 8px',
                fontSize: 13,
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              {textModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {m.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button type="button" onClick={onSend} disabled={!canSend} aria-label="Send message">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
