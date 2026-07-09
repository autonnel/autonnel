import React, { useEffect } from 'react';
import { ReferenceImage } from './ReferenceImage';
import { KonjuraCard } from './KonjuraCard';

const IMAGE_RATIOS = ['1:1', '4:5', '4:3', '3:4', '16:9', '9:16'] as const;
const VIDEO_RATIOS = ['1:1', '16:9', '9:16'] as const;

interface Props {
  mediaType: 'image' | 'video';
  onMediaTypeChange: (t: 'image' | 'video') => void;
  prompt: string;
  onPromptChange: (next: string) => void;
  referenceImageUrl: string;
  onReferenceImageChange: (next: string) => void;
  uploadReference: (file: File) => Promise<void>;
  uploadingReference: boolean;
  onGenerate: (type: 'image' | 'video', prompt: string) => void;
  generating: boolean;
  generatingType: 'image' | 'video' | null;
  error: string;
  generationAspectRatio: string | undefined;
  onGenerationAspectRatioChange: (next: string | undefined) => void;
}

export function AiSection({
  mediaType,
  onMediaTypeChange,
  prompt,
  onPromptChange,
  referenceImageUrl,
  onReferenceImageChange,
  uploadReference,
  uploadingReference,
  onGenerate,
  generating,
  error,
  generationAspectRatio,
  onGenerationAspectRatioChange,
}: Props) {
  const canGenerate = prompt.trim().length > 0 && !generating;
  const availableRatios = mediaType === 'video' ? VIDEO_RATIOS : IMAGE_RATIOS;

  useEffect(() => {
    if (
      generationAspectRatio &&
      mediaType === 'video' &&
      !VIDEO_RATIOS.includes(generationAspectRatio as typeof VIDEO_RATIOS[number])
    ) {
      onGenerationAspectRatioChange(undefined);
    }
  }, [mediaType, generationAspectRatio, onGenerationAspectRatioChange]);

  return (
    <div
      style={{
        marginTop: 4,
        padding: 12,
        borderRadius: 8,
        background: '#faf5ff',
        border: '1px solid #ede9fe',
      }}
    >
      <div
        role="radiogroup"
        aria-label="Media type"
        style={{
          display: 'inline-flex',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: 2,
          background: '#f9fafb',
          marginBottom: 8,
        }}
      >
        {(['image', 'video'] as const).map((t) => {
          const active = mediaType === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t}
              disabled={generating}
              onClick={() => onMediaTypeChange(t)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                border: 0,
                borderRadius: 4,
                background: active ? '#ffffff' : 'transparent',
                color: active ? '#111827' : '#6b7280',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: generating ? 'not-allowed' : 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label="Generation ratio"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: 2,
          background: '#f9fafb',
          marginBottom: 10,
          width: 'fit-content',
          maxWidth: '100%',
        }}
      >
        {[
          { label: 'Auto', value: undefined as string | undefined },
          ...availableRatios.map((r) => ({ label: r, value: r as string | undefined })),
        ].map(({ label, value }) => {
          const active = generationAspectRatio === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              disabled={generating}
              onClick={() => onGenerationAspectRatioChange(value)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                border: 0,
                borderRadius: 4,
                background: active ? '#ffffff' : 'transparent',
                color: active ? '#111827' : '#6b7280',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
        Prompt
      </div>
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Describe the image/video you want to generate..."
        rows={3}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 12,
          resize: 'vertical',
          boxSizing: 'border-box',
          marginBottom: 10,
        }}
      />

      <div style={{ marginBottom: 10 }}>
        <ReferenceImage
          value={referenceImageUrl}
          onChange={onReferenceImageChange}
          onUpload={uploadReference}
          uploading={uploadingReference}
          disabled={generating}
        />
      </div>

      {error && (
        <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>
      )}

      <button
        type="button"
        onClick={() => onGenerate(mediaType, prompt)}
        disabled={!canGenerate}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: canGenerate ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e5e7eb',
          color: canGenerate ? '#ffffff' : '#9ca3af',
          border: 0,
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {generating ? (
          <>
            <span
              style={{
                width: 12,
                height: 12,
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'mediaSpin 1s linear infinite',
              }}
            />
            Generating…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l2.4 5.4L20 11l-5.6 2.6L12 19l-2.4-5.4L4 11l5.6-2.6L12 3z" />
            </svg>
            Generate
          </>
        )}
      </button>

      <KonjuraCard
        prompt={prompt}
        referenceImageUrl={referenceImageUrl}
        mediaType={mediaType}
        generating={generating}
      />
    </div>
  );
}
