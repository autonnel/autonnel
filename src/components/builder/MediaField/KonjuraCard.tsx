import React from 'react';

export interface KonjuraHandoffInput {
  prompt: string;
  referenceImageUrl: string;
  mediaType: 'image' | 'video';
}

export function buildKonjuraCanvasUrl(input: KonjuraHandoffInput): string {
  const url = new URL('https://konjura.com/canvas');
  url.searchParams.set('source', 'autonnel');
  url.searchParams.set('type', input.mediaType);
  if (input.prompt) url.searchParams.set('prompt', input.prompt);
  if (input.referenceImageUrl) url.searchParams.set('refImage', input.referenceImageUrl);
  return url.toString();
}

interface KonjuraCardProps {
  prompt: string;
  referenceImageUrl: string;
  mediaType: 'image' | 'video';
  generating: boolean;
}

function ctaLabel(prompt: string, referenceImageUrl: string): string {
  if (!prompt) return 'Explore Konjura Canvas';
  if (referenceImageUrl) return 'Continue in Konjura Canvas';
  return 'Try this in Konjura Canvas';
}

export function KonjuraCard({ prompt, referenceImageUrl, mediaType, generating }: KonjuraCardProps) {
  const url = buildKonjuraCanvasUrl({ prompt, referenceImageUrl, mediaType });
  const label = ctaLabel(prompt, referenceImageUrl);

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
        border: '1px solid #ddd6fe',
        opacity: generating ? 0.6 : 1,
        transition: 'opacity 120ms',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4338ca', marginBottom: 2 }}>
        Need more control?
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
        Multi-image edit · Inpainting · Layers
      </div>
      <button
        type="button"
        disabled={generating}
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        style={{
          width: '100%',
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: '#ffffff',
          background: '#4f46e5',
          border: 0,
          borderRadius: 6,
          cursor: generating ? 'not-allowed' : 'pointer',
        }}
      >
        {label} →
      </button>
    </div>
  );
}
