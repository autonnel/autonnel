import React, { useState } from 'react';
import { AlertBox } from '../primitives';
import { toast } from '@/components/primitives/ds/ToastProvider';
import LlmModelTable from './llm/LlmModelTable';
import LlmModelDrawer, { type DrawerMode } from './llm/LlmModelDrawer';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { LlmModel } from '@/lib/config/llm-models-types';

interface Props {
  initialModels: LlmModel[];
}

export default function LlmPanel({ initialModels }: Props) {
  const [models, setModels] = useState<LlmModel[]>(initialModels);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => setDrawerMode({ kind: 'add' });
  const handleEdit = (row: LlmModel) => setDrawerMode({ kind: 'edit', row });

  const handleDelete = async (row: LlmModel) => {
    if (!confirm(`Delete ${row.type} model "${row.name}"?`)) return;
    setError(null);
    try {
      const data = await apiCall('DELETE /api/settings/llm', null, { query: { type: row.type, name: row.name } });
      setModels(data.models);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSetDefault = async (row: LlmModel) => {
    setError(null);
    try {
      const data = await apiCall('POST /api/settings/llm', {
        type: row.type,
        provider: row.provider,
        name: row.name,
        modelId: row.modelId,
        baseUrl: row.baseUrl,
        apiKey: '',
        ...(row.options ? { options: row.options } : {}),
        isDefault: true,
      });
      setModels(data.models);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleTest = async (row: LlmModel) => {
    const pendingId = toast.info(`Testing ${row.name}...`, { durationMs: 0 });
    try {
      const data = await apiCall('POST /api/settings/llm/test', {
        type: row.type,
        provider: row.provider,
        name: row.name,
        modelId: row.modelId,
        baseUrl: row.baseUrl,
        apiKey: '',
        ...(row.options ? { options: row.options } : {}),
      });
      toast.dismiss(pendingId);
      if (data.ok) {
        toast.success(`Test OK for ${row.name}`);
      } else {
        toast.error(`Test failed for ${row.name}`, { description: data.error ?? 'unknown' });
      }
    } catch (err) {
      toast.dismiss(pendingId);
      toast.error('Test failed', { description: err instanceof Error ? err.message : 'unknown' });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        Configure OpenAI-compatible models for text, image, and video generation.
        Per-type default model is used when callers don't specify one.
      </div>
      <AlertBox type="warning">
        LLM is optional. If no models are configured, AI-powered features
        (page generation, translation, conversion analysis, media generation)
        will be unavailable but the rest of the app works normally.
      </AlertBox>
      {error && <AlertBox type="error">{error}</AlertBox>}

      <LlmModelTable
        type="text"
        models={models}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTest={handleTest}
        onSetDefault={handleSetDefault}
      />
      <LlmModelTable
        type="image"
        models={models}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTest={handleTest}
        onSetDefault={handleSetDefault}
      />
      <LlmModelTable
        type="video"
        models={models}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTest={handleTest}
        onSetDefault={handleSetDefault}
      />

      <LlmModelDrawer
        open={drawerMode !== null}
        mode={drawerMode}
        onClose={() => setDrawerMode(null)}
        onSaved={(rows) => setModels(rows)}
      />
    </div>
  );
}
