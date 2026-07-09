import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { CustomField } from '@puckeditor/core';
import { MediaPreview } from './MediaPreview';
import { SourceRow } from './SourceRow';
import { AiSection } from './AiSection';
import { DisplaySizePopover } from './DisplaySizePopover';
import {
  addPollingTask,
  getMediaState,
  readPersistedJobs,
  setMediaState,
  subscribeToMediaState,
  persistJob,
} from './state';
import type { DisplaySizeMode } from '../DisplaySizeControls';
import { resolveGenerationParams } from './generation';

export { getMediaDisplayStyle, ASPECT_RATIO_PRESETS } from '../DisplaySizeControls';
export type { DisplaySizeMode } from '../DisplaySizeControls';

export interface MediaFieldValue {
  url: string;
  prompt: string;
  mediaType: 'image' | 'video';
  referenceImageUrl?: string;
  displaySizeMode?: DisplaySizeMode;
  displayRatio?: string;
  displayWidth?: number | '';
  displayHeight?: number | '';
  generationAspectRatio?: string;
}

export interface MediaFieldHandle {
  triggerGenerate: (type: 'image' | 'video', prompt: string) => void;
}

function extractPageId(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/\/page\/([^/]+)/);
  return m?.[1] || null;
}

export const MediaFieldComponent = forwardRef<MediaFieldHandle, {
  value: MediaFieldValue;
  onChange: (value: MediaFieldValue) => void;
  label?: string;
  planId: string;
  aspectRatio?: string;
  fieldName?: string;
  fieldId: string;
}>(({ value, onChange, label, planId, aspectRatio = '4:5', fieldId }, ref) => {
  const mediaUrl = value?.url || '';
  const mediaPrompt = value?.prompt || '';
  const mediaType = value?.mediaType || 'image';
  const referenceImageUrl = value?.referenceImageUrl || '';

  const [uploading, setUploading] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(() => Boolean(mediaPrompt));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const [localState, setLocalState] = useState(() => getMediaState(fieldId));

  useEffect(() => {
    const unsubscribe = subscribeToMediaState(fieldId, () => {
      const s = getMediaState(fieldId);
      setLocalState(s);
      if (s.completedUrl && s.completedUrl !== valueRef.current.url) {
        onChange({ ...valueRef.current, url: s.completedUrl });
        setMediaState(fieldId, { completedUrl: undefined });
      }
    });

    const s = getMediaState(fieldId);
    setLocalState(s);

    if (s.completedUrl && s.completedUrl !== valueRef.current.url) {
      setTimeout(() => {
        onChange({ ...valueRef.current, url: s.completedUrl! });
        setMediaState(fieldId, { completedUrl: undefined });
      }, 100);
    }

    if (s.generating && s.mediaId) {
      addPollingTask({ mediaId: s.mediaId, fieldId, type: s.generatingType ?? 'image', startedAt: Date.now(), consecutiveErrors: 0 });
    } else {
      const persisted = readPersistedJobs()[fieldId];
      if (persisted && !valueRef.current.url) {
        setMediaState(fieldId, { generating: true, generatingType: persisted.type, mediaId: persisted.mediaId });
        addPollingTask({ mediaId: persisted.mediaId, fieldId, type: persisted.type, startedAt: persisted.startedAt, consecutiveErrors: 0 });
      }
    }

    return unsubscribe;
  }, [fieldId]);

  const { generating, generatingType, error, autoGenerateTriggered } = localState;

  const handleGenerate = useCallback(async (type: 'image' | 'video', usePrompt: string) => {
    const current = getMediaState(fieldId);
    if (!usePrompt.trim() || current.generating) return;

    const { effectiveAspectRatio, updatedValue } = resolveGenerationParams(valueRef.current, aspectRatio);
    if (
      updatedValue.displayRatio !== valueRef.current.displayRatio ||
      updatedValue.displaySizeMode !== valueRef.current.displaySizeMode
    ) {
      onChange(updatedValue);
    }

    setMediaState(fieldId, { generating: true, generatingType: type, error: '' });

    try {
      const refImage = valueRef.current.referenceImageUrl || undefined;
      const response = await fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          type,
          prompt: usePrompt.trim(),
          purpose: 'component_media',
          aspectRatio: effectiveAspectRatio,
          ...(refImage ? { inputImage: refImage } : {}),
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { id: string };
        setMediaState(fieldId, { mediaId: data.id });
        const startedAt = Date.now();
        persistJob(fieldId, { mediaId: data.id, type, startedAt });
        addPollingTask({ mediaId: data.id, fieldId, type, startedAt, consecutiveErrors: 0 });
      } else {
        setMediaState(fieldId, { generating: false, generatingType: null, error: `Failed to start ${type} generation` });
      }
    } catch {
      setMediaState(fieldId, { generating: false, generatingType: null, error: `Failed to generate ${type}` });
    }
  }, [fieldId, planId, aspectRatio, onChange]);

  useEffect(() => {
    if (mediaPrompt && !mediaUrl && !generating && !autoGenerateTriggered) {
      setMediaState(fieldId, { autoGenerateTriggered: true });
      const timer = setTimeout(() => handleGenerate(mediaType, mediaPrompt), 500);
      return () => clearTimeout(timer);
    }
    if (!mediaPrompt) setMediaState(fieldId, { autoGenerateTriggered: false });
  }, [mediaPrompt, mediaUrl, generating, mediaType, autoGenerateTriggered, fieldId, handleGenerate]);

  useImperativeHandle(ref, () => ({
    triggerGenerate: (type, newPrompt) => {
      if (newPrompt) {
        onChange({ ...value, prompt: newPrompt, mediaType: type });
        handleGenerate(type, newPrompt);
      }
    },
  }));

  const uploadOne = async (file: File, target: 'url' | 'referenceImageUrl') => {
    const setBusy = target === 'url' ? setUploading : setUploadingReference;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const pageId = extractPageId();
      if (pageId) formData.append('pageId', pageId);
      const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = (await response.json()) as { url: string };
        onChange({ ...valueRef.current, [target]: data.url });
      } else {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        setMediaState(fieldId, { error: errorData.error || 'Upload failed' });
      }
    } catch {
      setMediaState(fieldId, { error: 'Failed to upload file' });
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadOne(file, 'url');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasUnsentPrompt = Boolean(mediaPrompt) && !generating && !mediaUrl;
  const aiVisible = aiExpanded || generating;

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            marginBottom: 8,
          }}
        >
          {label}
        </label>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        style={{ display: 'none' }}
      />

      <MediaPreview
        url={mediaUrl}
        prompt={mediaPrompt}
        mediaType={mediaType}
        generating={generating}
        generatingType={generatingType}
        chipSlot={<DisplaySizePopover value={value} onChange={onChange} />}
        onClearPrompt={() => onChange({ ...valueRef.current, prompt: '' })}
      />

      <SourceRow
        url={mediaUrl}
        onUrlChange={(next) => onChange({ ...value, url: next })}
        onUploadClick={() => fileInputRef.current?.click()}
        uploading={uploading}
        aiOpen={aiVisible}
        onAiToggle={() => {
          if (generating) return;
          setAiExpanded((v) => !v);
        }}
        generating={generating}
        hasUnsentPrompt={hasUnsentPrompt}
      />

      {aiVisible && (
        <AiSection
          mediaType={mediaType}
          onMediaTypeChange={(t) => onChange({ ...value, mediaType: t })}
          prompt={mediaPrompt}
          onPromptChange={(next) => onChange({ ...value, prompt: next })}
          referenceImageUrl={referenceImageUrl}
          onReferenceImageChange={(next) => onChange({ ...value, referenceImageUrl: next })}
          uploadReference={(file) => uploadOne(file, 'referenceImageUrl')}
          uploadingReference={uploadingReference}
          onGenerate={handleGenerate}
          generating={generating}
          generatingType={generatingType}
          error={error}
          generationAspectRatio={value?.generationAspectRatio}
          onGenerationAspectRatioChange={(next) => onChange({ ...valueRef.current, generationAspectRatio: next })}
        />
      )}
    </div>
  );
});

MediaFieldComponent.displayName = 'MediaFieldComponent';

declare global {
  interface Window {
    __mediaFieldRefs?: Map<string, MediaFieldHandle>;
  }
}

export function createMediaField(options: { label?: string; aspectRatio?: string; fieldName?: string } = {}): CustomField<MediaFieldValue> {
  const fieldName = options.fieldName || 'productImage';
  return {
    type: 'custom',
    render: ({ value, onChange, id }) => {
      const planId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '';
      const fieldId = id || `${fieldName}-${Date.now()}`;
      const normalized: MediaFieldValue = typeof value === 'string'
        ? { url: value, prompt: '', mediaType: 'image' }
        : value || { url: '', prompt: '', mediaType: 'image' };
      const ref = React.useRef<MediaFieldHandle>(null);
      React.useEffect(() => {
        if (!window.__mediaFieldRefs) window.__mediaFieldRefs = new Map();
        if (ref.current) window.__mediaFieldRefs.set(fieldName, ref.current);
        return () => {
          window.__mediaFieldRefs?.delete(fieldName);
        };
      }, []);
      return (
        <MediaFieldComponent
          ref={ref}
          value={normalized}
          onChange={onChange}
          label={options.label}
          planId={planId}
          aspectRatio={options.aspectRatio}
          fieldName={fieldName}
          fieldId={fieldId}
        />
      );
    },
  };
}

export const createImageField = createMediaField;
