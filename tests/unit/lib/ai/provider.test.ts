import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/llm-models');
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn((modelId: string) => ({ __anthropic: modelId }))),
}));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((modelId: string) => ({ __openai: modelId }))),
}));

import { resolveLlmModel } from '@/lib/ai/provider';
import { getLlmModel } from '@/lib/config/llm-models';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { LlmNotConfiguredError } from '@/lib/llm/errors';

describe('resolveLlmModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes anthropic URLs through createAnthropic with /v1 appended', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-sonnet-4',
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
      name: 'claude-opus-4',
      baseUrl: 'https://example.com/anthropic',
      apiKey: 'sk-xxx',
    } as any);

    await resolveLlmModel('claude-opus-4');

    expect(getLlmModel).toHaveBeenCalledWith('text', 'claude-opus-4');
  });

  it('routes non-anthropic URLs through createOpenAI and strips trailing slash', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'gpt-4o',
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
      name: 'claude-opus-4',
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
      name: 'claude-sonnet-4',
      baseUrl: 'https://example.com/Anthropic',
      apiKey: 'sk-xxx',
    } as any);

    const result = await resolveLlmModel();

    expect(result.protocol).toBe('anthropic');
    expect(createAnthropic).toHaveBeenCalled();
  });

  it('returns a model with the correct shape from the openai factory', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-yyy',
    } as any);

    const result = await resolveLlmModel();

    expect(result.model).toEqual({ __openai: 'gpt-4o-mini' });
  });

  it('returns a model with the correct shape from the anthropic factory', async () => {
    vi.mocked(getLlmModel).mockResolvedValue({
      name: 'claude-sonnet-4',
      baseUrl: 'https://api.example.com/anthropic',
      apiKey: 'sk-xxx',
    } as any);

    const result = await resolveLlmModel();

    expect(result.model).toEqual({ __anthropic: 'claude-sonnet-4' });
  });
});
