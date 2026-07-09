import { useEffect, useRef, useState } from 'react';
import { KonjuraCard } from '@/components/builder/MediaField/KonjuraCard';
import { useImagePrompts } from './ImagePromptsContext';
import { useImageGeneration, type MediaKind } from './useImageGeneration';
import { apiCall } from '@/lib/api/client';

const IMAGE_RATIOS = ['1:1', '4:5', '4:3', '3:4', '16:9', '9:16'] as const;
const VIDEO_RATIOS = ['1:1', '16:9', '9:16'] as const;
const VIDEO_DURATIONS = [5, 8, 10] as const;
const DEFAULT_VIDEO_DURATION = 5;

interface MediaModel {
  name: string;
  provider?: string;
  isDefault?: boolean;
  type: MediaKind;
}

interface Props {
  pid: string;
  pageId: string;
  currentSrc: string;
  onApplyUrl: (url: string) => void;
  onClose: () => void;
}

async function uploadFile(pageId: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/page/${pageId}/upload-asset`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const data = (await res.json()) as { data?: string[] };
  const url = data.data?.[0];
  if (!url) throw new Error('Upload returned no URL');
  return url;
}

async function fetchModels(): Promise<MediaModel[]> {
  const [imgData, vidData] = await Promise.all([
    apiCall('GET /api/page/ai-models', null, { query: { type: 'image' } }).catch(() => ({ models: [] })),
    apiCall('GET /api/page/ai-models', null, { query: { type: 'video' } }).catch(() => ({ models: [] })),
  ]);
  return [
    ...(imgData.models ?? []).map((m) => ({ ...m, type: 'image' as const })),
    ...(vidData.models ?? []).map((m) => ({ ...m, type: 'video' as const })),
  ];
}

export function ImageAiPanel({ pid, pageId, currentSrc, onApplyUrl, onClose }: Props) {
  const { imagePrompts, setPromptForPid } = useImagePrompts();
  const initialPrompt = imagePrompts[pid] ?? '';
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [editingUrl, setEditingUrl] = useState<string>(currentSrc);
  const [refOverride, setRefOverride] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<MediaModel[]>([]);
  const [modelKey, setModelKey] = useState<string>('');
  const [duration, setDuration] = useState<number>(DEFAULT_VIDEO_DURATION);
  const { generate } = useImageGeneration();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedSrcRef = useRef<string>(currentSrc);

  useEffect(() => {
    setPrompt(imagePrompts[pid] ?? '');
  }, [pid, imagePrompts]);

  useEffect(() => {
    setEditingUrl(currentSrc);
    appliedSrcRef.current = currentSrc;
  }, [currentSrc, pid]);

  useEffect(() => {
    let alive = true;
    fetchModels().then((rows) => {
      if (!alive) return;
      setModels(rows);
      if (rows.length === 0) return;
      const def = rows.find((m) => m.type === 'image' && m.isDefault)
        ?? rows.find((m) => m.type === 'image')
        ?? rows.find((m) => m.isDefault)
        ?? rows[0];
      setModelKey(`${def.type}:${def.name}`);
    });
    return () => { alive = false; };
  }, []);

  const selectedModel = models.find((m) => `${m.type}:${m.name}` === modelKey) ?? null;
  const mediaKind: MediaKind = selectedModel?.type ?? 'image';
  const availableRatios = mediaKind === 'video' ? VIDEO_RATIOS : IMAGE_RATIOS;

  useEffect(() => {
    if (mediaKind === 'video' && aspectRatio && !VIDEO_RATIOS.includes(aspectRatio as typeof VIDEO_RATIOS[number])) {
      setAspectRatio(undefined);
    }
  }, [mediaKind, aspectRatio]);

  const busy = generating || uploading;
  const canGenerate = prompt.trim().length > 0 && !busy;
  const effectiveRef = refOverride ?? currentSrc;

  const onSavePrompt = () => {
    if (prompt !== initialPrompt) {
      setPromptForPid(pid, prompt);
    }
  };

  const commitUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === appliedSrcRef.current) return;
    appliedSrcRef.current = trimmed;
    setError('');
    onApplyUrl(trimmed);
  };

  const onUploadFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const url = await uploadFile(pageId, file);
      appliedSrcRef.current = url;
      setEditingUrl(url);
      onApplyUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onPromptPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setError('');
        setUploading(true);
        try {
          const url = await uploadFile(pageId, file);
          setRefOverride(url);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Paste upload failed');
        } finally {
          setUploading(false);
        }
        return;
      }
    }
  };

  const onGenerate = async () => {
    setError('');
    setGenerating(true);
    setPromptForPid(pid, prompt);
    try {
      const url = await generate(pid, {
        prompt,
        type: mediaKind,
        aspectRatio: aspectRatio || '1:1',
        inputImage: effectiveRef || undefined,
        modelName: selectedModel?.name,
        duration: mediaKind === 'video' ? duration : undefined,
      });
      appliedSrcRef.current = url;
      setEditingUrl(url);
      setRefOverride(null);
      onApplyUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 12,
    boxSizing: 'border-box',
    background: '#ffffff',
  };

  return (
    <div
      className="autonnel-img-ai-panel"
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      style={{
        width: 320,
        padding: 12,
        borderRadius: 8,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>AI Generator</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            marginLeft: 'auto',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            color: '#6b7280',
          }}
        >
          ×
        </button>
      </div>

      {editingUrl && (
        <img
          src={editingUrl}
          alt=""
          style={{
            width: '100%',
            maxHeight: 120,
            objectFit: 'contain',
            background: '#f9fafb',
            borderRadius: 6,
            marginBottom: 8,
          }}
        />
      )}

      <div style={sectionLabelStyle}>Image URL</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          type="url"
          value={editingUrl}
          onChange={(e) => setEditingUrl(e.target.value)}
          onBlur={() => commitUrl(editingUrl)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitUrl(editingUrl);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="https://…"
          disabled={busy}
          style={{ ...fieldStyle, flex: '1 1 auto', minWidth: 0 }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUploadFile(f);
          }}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title="Upload from device"
          style={{
            flexShrink: 0,
            padding: '6px 10px',
            background: '#ffffff',
            color: busy ? '#9ca3af' : '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? '…' : 'Upload'}
        </button>
      </div>

      <div style={sectionLabelStyle}>Generate</div>

      <select
        value={modelKey}
        onChange={(e) => setModelKey(e.target.value)}
        disabled={busy || models.length === 0}
        style={{ ...fieldStyle, marginBottom: 8, cursor: busy ? 'not-allowed' : 'pointer' }}
        aria-label="Model"
      >
        {models.length === 0 && <option value="">No models configured</option>}
        {models.length > 0 && modelKey === '' && <option value="">Select a model…</option>}
        {models.map((m) => (
          <option key={`${m.type}:${m.name}`} value={`${m.type}:${m.name}`}>
            {m.name}
            {m.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>

      {mediaKind === 'video' && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center', marginRight: 4 }}>
            Duration
          </span>
          {VIDEO_DURATIONS.map((sec) => {
            const active = duration === sec;
            return (
              <button
                key={sec}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => setDuration(sec)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  background: active ? '#eff6ff' : '#ffffff',
                  color: active ? '#1d4ed8' : '#6b7280',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {sec}s
              </button>
            );
          })}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Aspect ratio"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: 8,
        }}
      >
        {[{ label: 'Auto', value: undefined as string | undefined }, ...availableRatios.map((r) => ({ label: r, value: r as string | undefined }))].map(({ label, value }) => {
          const active = aspectRatio === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => setAspectRatio(value)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                background: active ? '#eff6ff' : '#ffffff',
                color: active ? '#1d4ed8' : '#6b7280',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={onSavePrompt}
        onPaste={onPromptPaste}
        placeholder={
          mediaKind === 'video'
            ? 'Describe the video, or paste a reference image (Ctrl+V)…'
            : 'Describe the image, or paste a reference image (Ctrl+V)…'
        }
        rows={3}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 12,
          resize: 'vertical',
          boxSizing: 'border-box',
          marginBottom: 6,
        }}
      />

      {refOverride && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            border: '1px solid #ede9fe',
            background: '#faf5ff',
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          <img
            src={refOverride}
            alt=""
            style={{
              width: 36,
              height: 36,
              objectFit: 'cover',
              borderRadius: 4,
              border: '1px solid #e5e7eb',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: '#6b21a8', flex: '1 1 auto' }}>
            Pasted reference attached
          </span>
          <button
            type="button"
            onClick={() => setRefOverride(null)}
            aria-label="Remove reference"
            style={{
              flexShrink: 0,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              color: '#6b21a8',
            }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div style={{ color: '#dc2626', fontSize: 11, marginBottom: 6 }}>{error}</div>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: canGenerate ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#e5e7eb',
          color: canGenerate ? '#fff' : '#9ca3af',
          border: 0,
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          marginBottom: 8,
        }}
      >
        {generating ? 'Generating…' : mediaKind === 'video' ? 'Generate video' : 'Generate'}
      </button>

      <KonjuraCard
        prompt={prompt}
        referenceImageUrl={effectiveRef || ''}
        mediaType={mediaKind}
        generating={generating}
      />
    </div>
  );
}
