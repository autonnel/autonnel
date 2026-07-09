// apiKey is masked on read and never returned in plaintext.
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { listLlmModels, upsertLlmModel, deleteLlmModel } from '@/lib/config/llm-models';
import { LLM_MODEL_TYPES, type LlmModel, type LlmModelType } from '@/lib/config/llm-models-types';
import type { LlmModelInput } from '@/contracts/settings';

function maskApiKey(key: string | undefined): string {
  if (!key) return '';
  if (key.length <= 4) return '••••';
  return `••••${key.slice(-4)}`;
}

function maskRow(row: LlmModel): LlmModel {
  return { ...row, apiKey: maskApiKey(row.apiKey) };
}

function isType(v: unknown): v is LlmModelType {
  return typeof v === 'string' && (LLM_MODEL_TYPES as readonly string[]).includes(v);
}

async function parseRow(body: LlmModelInput | null): Promise<LlmModel> {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Invalid body');
  if (!isType(body.type)) throw new ApiError(400, 'type must be text | image | video');
  if (typeof body.name !== 'string' || !body.name.trim()) throw new ApiError(400, 'name required');
  if (typeof body.provider !== 'string' || !body.provider.trim()) throw new ApiError(400, 'provider required');
  if (typeof body.modelId !== 'string' || !body.modelId.trim()) throw new ApiError(400, 'modelId required');
  if (typeof body.baseUrl !== 'string' || !body.baseUrl.trim()) throw new ApiError(400, 'baseUrl required');
  if (typeof body.apiKey !== 'string') throw new ApiError(400, 'apiKey must be string (empty to keep existing)');
  if (body.options !== undefined && (typeof body.options !== 'object' || body.options === null || Array.isArray(body.options))) {
    throw new ApiError(400, 'options must be an object when provided');
  }

  let apiKey = body.apiKey;
  if (apiKey === '') {
    const existing = (await listLlmModels()).find((r) => r.type === body.type && r.name === body.name);
    apiKey = existing?.apiKey ?? '';
    if (!apiKey) throw new ApiError(400, 'apiKey required for new row');
  }

  return {
    type: body.type,
    provider: body.provider.trim(),
    name: body.name.trim(),
    modelId: body.modelId.trim(),
    baseUrl: body.baseUrl.trim(),
    apiKey,
    options: body.options,
    isDefault: body.isDefault === true,
  };
}

export const GET = defineRoute('GET /api/settings/llm', { feature: 'SETTINGS_LLM' }, async () => {
  const rows = await listLlmModels();
  return { models: rows.map(maskRow) };
});

export const POST = defineRoute('POST /api/settings/llm', { feature: 'SETTINGS_LLM' }, async ({ input }) => {
  const parsed = await parseRow(input);
  const rows = await upsertLlmModel(parsed);
  return { models: rows.map(maskRow) };
});

export const DELETE = defineRoute('DELETE /api/settings/llm', { feature: 'SETTINGS_LLM' }, async ({ query }) => {
  const type = query.get('type');
  const name = query.get('name');
  if (!isType(type)) throw new ApiError(400, 'type must be text | image | video');
  if (!name) throw new ApiError(400, 'name required');
  const rows = await deleteLlmModel(type, name);
  return { models: rows.map(maskRow) };
});
