import { defineRoute } from '@/lib/api/define-route';
import { listLlmModels } from '@/lib/config/llm-models';
import { LLM_MODEL_TYPES, type LlmModelType } from '@/lib/config/llm-models-types';

export const GET = defineRoute('GET /api/page/ai-models', { feature: 'PAGES' }, async ({ query }) => {
  const typeParam = query.get('type');
  const type: LlmModelType = (LLM_MODEL_TYPES as readonly string[]).includes(typeParam ?? '')
    ? (typeParam as LlmModelType)
    : 'text';
  const rows = await listLlmModels();
  const models = rows
    .filter((r) => r.type === type)
    .map((r) => ({ name: r.name, provider: r.provider, isDefault: r.isDefault === true }));
  return { models };
});
