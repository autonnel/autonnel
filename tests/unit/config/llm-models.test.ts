import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getConfigMock, setConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  setConfigMock: vi.fn(),
}));

vi.mock('@/lib/config/get-config', () => ({
  getConfig: getConfigMock,
  setConfig: setConfigMock,
}));

import {
  listLlmModels,
  getLlmModel,
  upsertLlmModel,
  deleteLlmModel,
} from '@/lib/config/llm-models';
import type { LlmModel } from '@/lib/config/llm-models-types';

const ROW_TEXT: LlmModel = {
  type: 'text', provider: 'openai-chat', name: 'gpt-4o-mini', modelId: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-t',
  isDefault: true,
};
const ROW_IMG: LlmModel = {
  type: 'image', provider: 'openai-images', name: 'dall-e-3', modelId: 'dall-e-3',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-i',
};

beforeEach(() => {
  getConfigMock.mockReset();
  setConfigMock.mockReset();
});

describe('listLlmModels', () => {
  it('returns empty array when KV is unset', async () => {
    getConfigMock.mockResolvedValue(undefined);
    expect(await listLlmModels()).toEqual([]);
  });
  it('returns stored array as-is', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT, ROW_IMG]);
    expect(await listLlmModels()).toEqual([ROW_TEXT, ROW_IMG]);
  });
});

describe('getLlmModel', () => {
  it('prefers the explicit default, else falls back to the first row of the type', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT, ROW_IMG]);
    expect(await getLlmModel('text')).toEqual(ROW_TEXT); // ROW_TEXT is marked default
    expect(await getLlmModel('image')).toEqual(ROW_IMG); // no default -> first image row

    const imgDefault: LlmModel = { ...ROW_IMG, name: 'flux', modelId: 'flux', isDefault: true };
    getConfigMock.mockResolvedValue([ROW_IMG, imgDefault]);
    expect(await getLlmModel('image')).toEqual(imgDefault); // default wins over first
  });
  it('returns exact match by (type, name)', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT, ROW_IMG]);
    expect(await getLlmModel('image', 'dall-e-3')).toEqual(ROW_IMG);
    expect(await getLlmModel('image', 'nope')).toBeUndefined();
  });
});

describe('upsertLlmModel', () => {
  it('appends a new row', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT]);
    await upsertLlmModel(ROW_IMG);
    expect(setConfigMock).toHaveBeenCalledWith('llm.models', [ROW_TEXT, ROW_IMG]);
  });
  it('replaces existing row with same (type, name)', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT]);
    const updated: LlmModel = { ...ROW_TEXT, baseUrl: 'https://new.example/v1', apiKey: 'sk-new' };
    await upsertLlmModel(updated);
    expect(setConfigMock).toHaveBeenCalledWith('llm.models', [updated]);
  });
  it('clears other defaults of the same type when isDefault=true', async () => {
    const existing: LlmModel = { ...ROW_TEXT, name: 'old-default', isDefault: true };
    const incoming: LlmModel = { ...ROW_TEXT, name: 'new-default', isDefault: true };
    getConfigMock.mockResolvedValue([existing, ROW_IMG]);
    await upsertLlmModel(incoming);
    const written = setConfigMock.mock.calls[0][1] as LlmModel[];
    expect(written.find((m) => m.name === 'old-default')?.isDefault).toBe(false);
    expect(written.find((m) => m.name === 'new-default')?.isDefault).toBe(true);
    expect(written.find((m) => m.name === 'dall-e-3')?.isDefault).toBeUndefined();
  });
  it('does not affect defaults of other types', async () => {
    const otherTypeDefault: LlmModel = { ...ROW_IMG, isDefault: true };
    getConfigMock.mockResolvedValue([otherTypeDefault]);
    const incoming: LlmModel = { ...ROW_TEXT, isDefault: true };
    await upsertLlmModel(incoming);
    const written = setConfigMock.mock.calls[0][1] as LlmModel[];
    expect(written.find((m) => m.type === 'image')?.isDefault).toBe(true);
  });
});

describe('deleteLlmModel', () => {
  it('removes the row with matching (type, name)', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT, ROW_IMG]);
    await deleteLlmModel('image', 'dall-e-3');
    expect(setConfigMock).toHaveBeenCalledWith('llm.models', [ROW_TEXT]);
  });
  it('is a no-op when no row matches', async () => {
    getConfigMock.mockResolvedValue([ROW_TEXT]);
    await deleteLlmModel('image', 'nope');
    expect(setConfigMock).toHaveBeenCalledWith('llm.models', [ROW_TEXT]);
  });
});
