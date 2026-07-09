import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmModel } from '@/lib/config/llm-models-types';
import type { ImageProvider } from '@/lib/llm/types';

const { getLlmModelMock, normalizeToS3UrlMock } = vi.hoisted(() => ({
  getLlmModelMock: vi.fn(),
  normalizeToS3UrlMock: vi.fn(),
}));

vi.mock('@/lib/config/llm-models', () => ({ getLlmModel: getLlmModelMock }));
vi.mock('@/lib/llm/image-output', () => ({ normalizeToS3Url: normalizeToS3UrlMock }));

import { registerImageProvider, __resetRegistry } from '@/lib/llm/registry';
import { callImage } from '@/lib/llm/call-image';
import { LlmNotConfiguredError, UnknownProviderError } from '@/lib/llm/errors';

const IMAGE_DEFAULT: LlmModel = {
  type: 'image', provider: 'fake-image',
  name: 'r', modelId: 'x',
  baseUrl: 'https://x.example', apiKey: 'k',
  isDefault: true,
};

const fakeProvider: ImageProvider = {
  id: 'fake-image',
  generateImage: vi.fn(),
};

beforeEach(() => {
  __resetRegistry();
  registerImageProvider(fakeProvider);
  (fakeProvider.generateImage as ReturnType<typeof vi.fn>).mockReset();
  getLlmModelMock.mockReset();
  normalizeToS3UrlMock.mockReset();
});

describe('callImage', () => {
  it('throws LlmNotConfiguredError when no row resolves', async () => {
    getLlmModelMock.mockResolvedValue(undefined);
    await expect(callImage({ prompt: 'hi' })).rejects.toBeInstanceOf(LlmNotConfiguredError);
  });

  it('throws UnknownProviderError when row.provider is not registered', async () => {
    getLlmModelMock.mockResolvedValue({ ...IMAGE_DEFAULT, provider: 'mystery' });
    await expect(callImage({ prompt: 'hi' })).rejects.toBeInstanceOf(UnknownProviderError);
  });

  it('throws when provider returns empty outputs', async () => {
    getLlmModelMock.mockResolvedValue(IMAGE_DEFAULT);
    (fakeProvider.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await expect(callImage({ prompt: 'hi' })).rejects.toThrow(/no image generated/i);
  });

  it('routes default row to the provider and returns normalized S3 URL', async () => {
    getLlmModelMock.mockResolvedValue(IMAGE_DEFAULT);
    (fakeProvider.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { type: 'url', url: 'https://cdn/x.png' },
    ]);
    normalizeToS3UrlMock.mockResolvedValue('https://static.example/x.png');
    const out = await callImage({ prompt: 'a cat', aspectRatio: '1:1', userId: 'u1' });
    expect(out).toBe('https://static.example/x.png');
    expect(fakeProvider.generateImage).toHaveBeenCalledWith(
      { prompt: 'a cat', aspectRatio: '1:1', inputImageUrl: undefined, inputImageBase64: undefined, inputImageMimeType: undefined },
      IMAGE_DEFAULT,
    );
    expect(normalizeToS3UrlMock).toHaveBeenCalledWith(
      { type: 'url', url: 'https://cdn/x.png' },
      'u1',
    );
  });

  it('uses explicit modelName when provided', async () => {
    const explicit: LlmModel = { ...IMAGE_DEFAULT, name: 'special', modelId: 's' };
    getLlmModelMock.mockImplementation((type: string, name?: string) => {
      if (name === 'special') return Promise.resolve(explicit);
      if (!name) return Promise.resolve(IMAGE_DEFAULT);
      return Promise.resolve(undefined);
    });
    (fakeProvider.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { type: 'url', url: 'https://cdn/y.png' },
    ]);
    normalizeToS3UrlMock.mockResolvedValue('https://static.example/y.png');
    await callImage({ modelName: 'special', prompt: 'x' });
    expect(getLlmModelMock).toHaveBeenCalledWith('image', 'special');
  });

  it('forwards input image fields to the provider', async () => {
    getLlmModelMock.mockResolvedValue(IMAGE_DEFAULT);
    (fakeProvider.generateImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { type: 'url', url: 'https://cdn/z.png' },
    ]);
    normalizeToS3UrlMock.mockResolvedValue('https://static.example/z.png');
    await callImage({
      prompt: 'p',
      inputImageUrl: 'https://in/a.png',
      inputImageBase64: 'xxx',
      inputImageMimeType: 'image/png',
    });
    const callArg = (fakeProvider.generateImage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg).toEqual({
      prompt: 'p',
      aspectRatio: undefined,
      inputImageUrl: 'https://in/a.png',
      inputImageBase64: 'xxx',
      inputImageMimeType: 'image/png',
    });
  });
});
