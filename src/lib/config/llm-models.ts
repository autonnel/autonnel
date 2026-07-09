import { getConfig, setConfig } from './get-config';
import type { LlmModel, LlmModelType } from './llm-models-types';

const KV_KEY = 'llm.models';

export async function listLlmModels(): Promise<LlmModel[]> {
  const rows = await getConfig<LlmModel[]>(KV_KEY);
  return Array.isArray(rows) ? rows : [];
}

export async function getLlmModel(
  type: LlmModelType,
  name?: string,
): Promise<LlmModel | undefined> {
  const rows = await listLlmModels();
  if (name && name.trim()) {
    return rows.find((r) => r.type === type && r.name === name);
  }
  // Prefer the explicit default; fall back to the first model of the type so a
  // single configured model works without having to be marked default.
  const ofType = rows.filter((r) => r.type === type);
  return ofType.find((r) => r.isDefault === true) ?? ofType[0];
}

export async function upsertLlmModel(model: LlmModel): Promise<LlmModel[]> {
  const rows = await listLlmModels();
  const idx = rows.findIndex((r) => r.type === model.type && r.name === model.name);
  let next = idx >= 0 ? [...rows.slice(0, idx), model, ...rows.slice(idx + 1)] : [...rows, model];
  if (model.isDefault === true) {
    next = next.map((r) =>
      r.type === model.type && r.name !== model.name && r.isDefault
        ? { ...r, isDefault: false }
        : r,
    );
  }
  await setConfig(KV_KEY, next);
  return next;
}

export async function deleteLlmModel(
  type: LlmModelType,
  name: string,
): Promise<LlmModel[]> {
  const rows = await listLlmModels();
  const next = rows.filter((r) => !(r.type === type && r.name === name));
  await setConfig(KV_KEY, next);
  return next;
}
