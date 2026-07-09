import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Drawer, Button as DsButton } from '../../primitives/ds';
import { FormInput, FormSelect, AlertBox, Textarea, Checkbox, dsFieldLabelClass } from '../../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { LlmModelInput } from '@/contracts/settings';
import type { LlmModel, LlmModelType } from '@/lib/config/llm-models-types';

export type DrawerMode = { kind: 'add' } | { kind: 'edit'; row: LlmModel };

interface Props {
  open: boolean;
  mode: DrawerMode | null;
  onClose: () => void;
  onSaved: (rows: LlmModel[]) => void;
}

const TEXT_PROVIDERS = [
  { id: 'openai-chat', label: 'OpenAI Chat Completions', baseUrlPlaceholder: 'https://api.openai.com/v1', modelIdPlaceholder: 'gpt-4o' },
  { id: 'anthropic-messages', label: 'Anthropic Messages', baseUrlPlaceholder: 'https://api.anthropic.com', modelIdPlaceholder: 'claude-sonnet-4-5-20250929' },
] as const;

const IMAGE_PROVIDERS = [
  { id: 'openai-images',          label: 'OpenAI Images',              baseUrlPlaceholder: 'https://api.openai.com/v1',                  modelIdPlaceholder: 'gpt-image-1' },
  { id: 'gemini-image',           label: 'Google Gemini / Imagen',     baseUrlPlaceholder: 'https://generativelanguage.googleapis.com', modelIdPlaceholder: 'imagen-4.0-generate-001' },
  { id: 'bfl-flux',               label: 'Black Forest Labs (FLUX)',   baseUrlPlaceholder: 'https://api.bfl.ai',                        modelIdPlaceholder: 'flux-pro-1.1' },
  { id: 'stability',              label: 'Stability AI',               baseUrlPlaceholder: 'https://api.stability.ai',                  modelIdPlaceholder: 'sd3.5-large' },
  { id: 'replicate',              label: 'Replicate',                  baseUrlPlaceholder: 'https://api.replicate.com',                 modelIdPlaceholder: 'stability-ai/sdxl:abc123…' },
  { id: 'fal',                    label: 'fal.ai',                     baseUrlPlaceholder: 'https://queue.fal.run',                     modelIdPlaceholder: 'fal-ai/flux-pro/v1.1' },
  { id: 'huggingface-inference',  label: 'Hugging Face Inference',     baseUrlPlaceholder: 'https://api-inference.huggingface.co',      modelIdPlaceholder: 'black-forest-labs/FLUX.1-schnell' },
] as const;

const VIDEO_PROVIDERS = [
  { id: 'openai-video',      label: 'OpenAI Video (Sora)',          baseUrlPlaceholder: 'https://api.openai.com',                     modelIdPlaceholder: 'sora-2' },
  { id: 'runway-video',      label: 'Runway',                       baseUrlPlaceholder: 'https://api.dev.runwayml.com',               modelIdPlaceholder: 'gen3a_turbo' },
  { id: 'luma-video',        label: 'Luma Dream Machine',           baseUrlPlaceholder: 'https://api.lumalabs.ai',                    modelIdPlaceholder: 'ray-2' },
  { id: 'google-veo',        label: 'Google Veo',                   baseUrlPlaceholder: 'https://generativelanguage.googleapis.com',  modelIdPlaceholder: 'veo-3.0-generate-001' },
  { id: 'replicate-video',   label: 'Replicate (Video)',            baseUrlPlaceholder: 'https://api.replicate.com',                  modelIdPlaceholder: 'tencent/hunyuan-video:847abc...' },
  { id: 'fal-video',         label: 'fal.ai (Video)',               baseUrlPlaceholder: 'https://queue.fal.run',                      modelIdPlaceholder: 'fal-ai/kling-video/v1.5/pro' },
] as const;

interface FormState {
  type: LlmModelType;
  provider: string;
  name: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  optionsJson: string;
  isDefault: boolean;
  storedKeyMask: string;
}

const EMPTY: FormState = {
  type: 'text', provider: 'openai-chat',
  name: '', modelId: '',
  baseUrl: '', apiKey: '',
  optionsJson: '',
  isDefault: false, storedKeyMask: '',
};

function defaultProviderFor(type: LlmModelType): string {
  if (type === 'text') return 'openai-chat';
  if (type === 'image') return 'openai-images';
  return 'openai-video';
}

export default function LlmModelDrawer({ open, mode, onClose, onSaved }: Props) {
  const isEdit = mode?.kind === 'edit';
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!mode) return;
    setError(null);
    setTestResult(null);
    if (mode.kind === 'edit') {
      setForm({
        type: mode.row.type,
        provider: mode.row.provider,
        name: mode.row.name,
        modelId: mode.row.modelId,
        baseUrl: mode.row.baseUrl,
        apiKey: '',
        optionsJson: mode.row.options ? JSON.stringify(mode.row.options, null, 2) : '',
        isDefault: mode.row.isDefault === true,
        storedKeyMask: mode.row.apiKey,
      });
    } else {
      setForm(EMPTY);
    }
  }, [mode]);

  const isText = form.type === 'text';
  const isImage = form.type === 'image';

  const providers = isText ? TEXT_PROVIDERS : isImage ? IMAGE_PROVIDERS : VIDEO_PROVIDERS;
  const providerMeta =
    providers.find((p) => p.id === form.provider) ?? providers[0];
  const baseUrlPlaceholder = providerMeta.baseUrlPlaceholder;
  const modelIdPlaceholder = providerMeta.modelIdPlaceholder;

  const apiKeyPlaceholder = isEdit && form.storedKeyMask
    ? `Stored: ${form.storedKeyMask} (leave blank to keep)`
    : 'sk-...';

  const onTypeChange = (next: LlmModelType) => {
    setForm({ ...form, type: next, provider: defaultProviderFor(next) });
  };

  const buildPayload = (): LlmModelInput => {
    let options: Record<string, unknown> | undefined;
    if (form.optionsJson.trim()) {
      try {
        const parsed = JSON.parse(form.optionsJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          options = parsed as Record<string, unknown>;
        } else {
          throw new Error('options must be a JSON object');
        }
      } catch (err) {
        throw new Error(`Invalid options JSON: ${err instanceof Error ? err.message : 'parse error'}`);
      }
    }
    return {
      type: form.type,
      provider: form.provider,
      name: form.name.trim(),
      modelId: form.modelId.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey,
      ...(options ? { options } : {}),
      isDefault: form.isDefault,
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const data = await apiCall('POST /api/settings/llm', payload);
      onSaved(data.models);
      onClose();
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = buildPayload();
      const data = await apiCall('POST /api/settings/llm/test', payload);
      setTestResult(data.ok
        ? { ok: true, msg: 'Connection successful' }
        : { ok: false, msg: data.error ?? 'Connection failed' });
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const canSubmit =
    !!form.name.trim() &&
    !!form.modelId.trim() &&
    !!form.baseUrl.trim() &&
    (isEdit ? true : !!form.apiKey);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${form.type} model` : 'Add LLM model'}
      footer={
        <>
          <DsButton variant="default" onClick={onClose} disabled={saving}>Cancel</DsButton>
          <DsButton
            variant="default"
            onClick={handleTest}
            disabled={testing || !canSubmit}
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test connection
          </DsButton>
          <DsButton variant="primary" onClick={handleSave} disabled={saving || !canSubmit}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </DsButton>
        </>
      }
    >
      <div className="px-5 py-4 flex flex-col gap-4">
        {error && <AlertBox type="error">{error}</AlertBox>}
        {testResult && (
          <AlertBox type={testResult.ok ? 'success' : 'error'}>{testResult.msg}</AlertBox>
        )}

        <FormSelect
          label="Type"
          value={form.type}
          disabled={isEdit}
          onChange={(e) => onTypeChange(e.target.value as LlmModelType)}
        >
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </FormSelect>

        <FormSelect
          label="Provider"
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </FormSelect>

        <FormInput
          label="Name"
          value={form.name}
          disabled={isEdit}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. openai-prod, anthropic-dev"
          hint={isEdit ? 'Name is the stable key — delete and re-add to rename.' : 'Display label for this row.'}
        />

        <FormInput
          label="Model ID"
          value={form.modelId}
          onChange={(e) => setForm({ ...form, modelId: e.target.value })}
          placeholder={modelIdPlaceholder}
          hint="The model identifier sent in API requests."
        />

        <FormInput
          label="Base URL"
          value={form.baseUrl}
          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
          placeholder={baseUrlPlaceholder}
        />

        <FormInput
          label="API Key"
          type="password"
          value={form.apiKey}
          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          placeholder={apiKeyPlaceholder}
        />

        <details>
          <summary className="text-[12.5px] text-ds-muted cursor-pointer select-none">
            Advanced options (JSON)
          </summary>
          <Textarea
            className="mt-2 font-mono text-[12px] min-h-[120px]"
            value={form.optionsJson}
            onChange={(e) => setForm({ ...form, optionsJson: e.target.value })}
            placeholder={
              form.provider === 'anthropic-messages'   ? '{ "anthropicVersion": "2023-06-01" }'
            : form.provider === 'openai-chat'          ? '{ "organization": "org-..." }'
            : form.provider === 'openai-images'        ? '{ "organization": "org-..." }'
            : form.provider === 'openai-video'         ? '{ "organization": "org-..." }'
            : form.provider === 'runway-video'         ? '{ "runwayVersion": "2024-11-06" }'
            : form.provider === 'stability'            ? '{ "endpoint": "sd3" }'
            : form.provider === 'bfl-flux'             ? '{ "pollIntervalMs": 2000, "pollTimeoutMs": 300000 }'
            : form.provider === 'replicate'            ? '{ "pollIntervalMs": 2000, "pollTimeoutMs": 300000 }'
            : form.provider === 'replicate-video'      ? '{ "pollIntervalMs": 3000, "pollTimeoutMs": 600000 }'
            : form.provider === 'fal'                  ? '{ "pollIntervalMs": 2000, "pollTimeoutMs": 300000 }'
            : form.provider === 'fal-video'            ? '{ "pollIntervalMs": 3000, "pollTimeoutMs": 600000 }'
            : form.provider === 'luma-video'           ? '{ "pollIntervalMs": 3000, "pollTimeoutMs": 600000 }'
            : form.provider === 'google-veo'           ? '{ "pollIntervalMs": 5000, "pollTimeoutMs": 600000 }'
            : '{}'
            }
            spellCheck={false}
          />
        </details>

        <label className={`flex items-center gap-2 ${dsFieldLabelClass}`}>
          <Checkbox
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          Set as default for this type
        </label>
      </div>
    </Drawer>
  );
}
