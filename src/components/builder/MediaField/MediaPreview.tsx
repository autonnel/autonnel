import React from 'react';
import { SPIN_KEYFRAMES } from './styles';

interface MediaPreviewProps {
  url: string;
  prompt: string;
  mediaType: 'image' | 'video';
  generating: boolean;
  generatingType: 'image' | 'video' | null;
  chipSlot?: React.ReactNode;
  onClearPrompt?: () => void;
}

const PREVIEW_MAX_HEIGHT = 140;

function isVideoUrl(url: string, generatingType: 'image' | 'video' | null): boolean {
  return url.includes('.mp4') || url.includes('.webm') || generatingType === 'video';
}

export function MediaPreview({ url, prompt, mediaType, generating, generatingType, chipSlot, onClearPrompt }: MediaPreviewProps) {
  const showVideo = url && isVideoUrl(url, generatingType);

  return (
    <div
      style={{
        width: '100%',
        maxHeight: `${PREVIEW_MAX_HEIGHT}px`,
        height: `${PREVIEW_MAX_HEIGHT}px`,
        marginBottom: 12,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#f1f5f9',
          position: 'relative',
        }}
      >
        {showVideo ? (
          <video
            src={url}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : url ? (
          <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : prompt ? (
          <PromptPlaceholder mediaType={mediaType} onClearPrompt={onClearPrompt} />
        ) : (
          <EmptyPlaceholder />
        )}

        {generating && <GeneratingOverlay generatingType={generatingType} />}
      </div>

      {chipSlot && (
        <div style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 2 }}>{chipSlot}</div>
      )}

      <style>{SPIN_KEYFRAMES}</style>
    </div>
  );
}

function PromptPlaceholder({
  mediaType,
  onClearPrompt,
}: {
  mediaType: 'image' | 'video';
  onClearPrompt?: () => void;
}) {
  const noun = mediaType === 'video' ? 'Video' : 'Image';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'repeating-linear-gradient(45deg, #eef2ff, #eef2ff 10px, #e0e7ff 10px, #e0e7ff 20px)',
        color: '#3730a3',
        gap: 6,
        padding: 12,
        textAlign: 'center',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <div style={{ fontWeight: 650, fontSize: 13 }}>{noun} to generate</div>
      <div style={{ fontSize: 11, lineHeight: 1.3, opacity: 0.8 }}>
        Editor preview only — hidden on your live page
      </div>
      {onClearPrompt && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClearPrompt();
          }}
          style={{
            marginTop: 2,
            background: '#fff',
            color: '#3730a3',
            border: '1px solid #c7d2fe',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Clear prompt to leave empty
        </button>
      )}
    </div>
  );
}

function EmptyPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 12,
        gap: 6,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <span>No media</span>
    </div>
  );
}

function GeneratingOverlay({ generatingType }: { generatingType: 'image' | 'video' | null }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(79, 70, 229, 0.15)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid #e0e7ff',
          borderTopColor: '#4f46e5',
          borderRadius: '50%',
          animation: 'mediaSpin 1s linear infinite',
        }}
      />
      <span style={{ color: '#4f46e5', fontWeight: 500, fontSize: 13 }}>
        {generatingType === 'video' ? 'Generating video...' : 'Generating image...'}
      </span>
    </div>
  );
}
