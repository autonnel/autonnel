import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/llm-models');
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn((modelId: string) => ({ __anthropic: modelId }))),
}));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({ chat: vi.fn((modelId: string) => ({ __openai: modelId })) })),
}));
vi.mock('workers-ai-provider', () => ({
  createWorkersAI: vi.fn(() => vi.fn((modelId: string) => ({ __workersAi: modelId }))),
}));

import { resolveLlmModel } from '@/lib/ai/provider';
import { getLlmModel } from '@/lib/config/llm-models';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createWorkersAI } from 'workers-ai-provider';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { setRuntimeEnv } from '@/lib/runtime/env';

describe('resolveLlmModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRuntimeEnv(undefined);
  });

  it('routes the anthropic-messages provider through createAnthropic regardless of URL path', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'prod', provider: 'anthropic-messages', modelId: 'claude-sonnet-4-5',
      baseUrl: 'https://api.anthropic.com', apiKey: 'sk-xxx',
    } as any);

    const result = await resolveLlmModel();

    expect(result.protocol).toBe('anthropic');
    expect(createAnthropic).toHaveBeenCalledWith({ baseURL: 'https://api.anthropic.com/v1', apiKey: 'sk-xxx' });
    expect(result.model).toEqual({ __anthropic: 'claude-sonnet-4-5' });
  });

  it('routes workers-ai with a REST base URL through createWorkersAI credentials', async () => {
    const accountId = 'a'.repeat(32);
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'cf', provider: 'workers-ai', modelId: '@cf/zai-org/glm-4.7-flash',
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`, apiKey: 'cf-token',
    } as any);

    const result = await resolveLlmModel();

    expect(result.protocol).toBe('workers-ai');
    expect(createWorkersAI).toHaveBeenCalledWith({ accountId, apiKey: 'cf-token' });
    expect(result.model).toEqual({ __workersAi: '@cf/zai-org/glm-4.7-flash' });
  });

  it('routes workers-ai with an empty base URL through the AI binding', async () => {
    const binding = { run: vi.fn() };
    setRuntimeEnv({ AI: binding });
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'cf', provider: 'workers-ai', modelId: '@cf/zai-org/glm-4.7-flash', baseUrl: '', apiKey: '',
    } as any);

    await resolveLlmModel();

    expect(createWorkersAI).toHaveBeenCalledWith({ binding });
  });

  it('fails clearly when workers-ai binding mode has no AI binding', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'cf', provider: 'workers-ai', modelId: '@cf/zai-org/glm-4.7-flash', baseUrl: '', apiKey: '',
    } as any);

    await expect(resolveLlmModel()).rejects.toThrow(/no "AI" binding/);
  });

  it('routes anthropic URLs through createAnthropic with /v1 appended', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-sonnet-4-row',
      provider: 'openai-chat',
      modelId: 'claude-sonnet-4',
      baseUrl: 'https://example.com/anthropic',
      apiKey: 'sk-xxx',
    } as any);

    const result = await resolveLlmModel();

    expect(result.protocol).toBe('anthropic');
    expect(result.modelId).toBe('claude-sonnet-4');
    expect(createAnthropic).toHaveBeenCalledWith({
      baseURL: 'https://example.com/anthropic/v1',
      apiKey: 'sk-xxx',
    });
    expect(createOpenAI).not.toHaveBeenCalled();
  });

  it('passes through the requested name to getLlmModel', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-opus-4-row',
      provider: 'openai-chat',
      modelId: 'claude-opus-4',
      baseUrl: 'https://example.com/anthropic',
      apiKey: 'sk-xxx',
    } as any);

    await resolveLlmModel('claude-opus-4-row');

    expect(getLlmModel).toHaveBeenCalledWith('text', 'claude-opus-4-row');
  });

  it('routes non-anthropic URLs through createOpenAI and strips trailing slash', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'gpt-4o-row',
      provider: 'openai-chat',
      modelId: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1/',
      apiKey: 'sk-yyy',
    } as any);

    const result = await resolveLlmModel('gpt-4o');

    expect(result.protocol).toBe('openai-compatible');
    expect(result.modelId).toBe('gpt-4o');
    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-yyy',
    });
    expect(createAnthropic).not.toHaveBeenCalled();
  });

  it('throws LlmNotConfiguredError when no model row exists', async () => {
    vi.mocked(getLlmModel).mockResolvedValue(null as any);
    await expect(resolveLlmModel()).rejects.toThrow(LlmNotConfiguredError);
  });

  it('handles trailing slashes consistently on anthropic URLs', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-opus-4-row',
      provider: 'openai-chat',
      modelId: 'claude-opus-4',
      baseUrl: 'https://example.com/anthropic/',
      apiKey: 'sk-zzz',
    } as any);

    await resolveLlmModel();

    expect(createAnthropic).toHaveBeenCalledWith({
      baseURL: 'https://example.com/anthropic/v1',
      apiKey: 'sk-zzz',
    });
  });

  it('detects anthropic case-insensitively', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-sonnet-4-row',
      provider: 'openai-chat',
      modelId: 'claude-sonnet-4',
      baseUrl: 'https://example.com/Anthropic',
      apiKey: 'sk-xxx',
    } as any);

    const result = await resolveLlmModel();

    expect(result.protocol).toBe('anthropic');
    expect(createAnthropic).toHaveBeenCalled();
  });

  it('returns a model with the correct shape from the openai factory', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'gpt-4o-mini-row',
      provider: 'openai-chat',
      modelId: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-yyy',
    } as any);

    const result = await resolveLlmModel();

    expect(result.model).toEqual({ __openai: 'gpt-4o-mini' });
  });

  it('returns a model with the correct shape from the anthropic factory', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-sonnet-4-row',
      provider: 'openai-chat',
      modelId: 'claude-sonnet-4',
      baseUrl: 'https://api.example.com/anthropic',
      apiKey: 'sk-xxx',
    } as any);

    const result = await resolveLlmModel();

    expect(result.model).toEqual({ __anthropic: 'claude-sonnet-4' });
  });
});
