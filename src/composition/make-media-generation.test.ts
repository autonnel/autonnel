import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobDeferral } from '@/modules/platform/application/ports';

const { callImage, getVideoProvider, getLlmModel, normalizeVideoToS3Url, LlmNotConfiguredError } = vi.hoisted(() => {
  class LlmNotConfiguredError extends Error {}
  return {
    callImage: vi.fn(),
    getVideoProvider: vi.fn(),
    getLlmModel: vi.fn(),
    normalizeVideoToS3Url: vi.fn(),
    LlmNotConfiguredError,
  };
});

vi.mock('@/lib/llm', () => ({ callImage, getVideoProvider, LlmNotConfiguredError }));
vi.mock('@/lib/llm/video-output', () => ({ normalizeVideoToS3Url }));
vi.mock('@/lib/config/llm-models', () => ({ getLlmModel }));

import { runImageGeneration, runVideoGeneration } from './make-media-generation';

const videoModel = { type: 'video', provider: 'runway-video', name: 'rw', modelId: 'gen3', baseUrl: 'x', apiKey: 'k' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runImageGeneration', () => {
  it('returns the CDN url produced by callImage', async () => {
    callImage.mockResolvedValue('https://cdn.example.com/ai-generated/x.png');
    const out = await runImageGeneration({ prompt: 'a cat', aspectRatio: '1:1', inputImage: 'https://ref/p.png' });
    expect(out).toEqual({ url: 'https://cdn.example.com/ai-generated/x.png' });
    expect(callImage).toHaveBeenCalledWith({
      prompt: 'a cat', aspectRatio: '1:1', inputImageUrl: 'https://ref/p.png', modelName: undefined,
    });
  });
});

describe('runVideoGeneration', () => {
  it('first run creates the provider job and defers with its external id', async () => {
    const createJob = vi.fn(async () => ({ id: 'prov-job-9' }));
    getLlmModel.mockResolvedValue(videoModel);
    getVideoProvider.mockReturnValue({ createJob, getJob: vi.fn() });

    const out = await runVideoGeneration({ prompt: 'a wave' }, { externalRef: null });

    expect(out).toBeInstanceOf(JobDeferral);
    expect((out as JobDeferral).externalRef).toBe('prov-job-9');
    expect(createJob).toHaveBeenCalledOnce();
  });

  it('on poll, resolves to the stored video url when the provider job succeeded', async () => {
    getLlmModel.mockResolvedValue(videoModel);
    getVideoProvider.mockReturnValue({ createJob: vi.fn(), getJob: vi.fn(async () => ({ id: 'prov-job-9', status: 'succeeded', outputUrl: 'https://prov/v.mp4' })) });
    normalizeVideoToS3Url.mockResolvedValue('https://cdn.example.com/ai-generated/v.mp4');

    const out = await runVideoGeneration({ prompt: 'a wave' }, { externalRef: 'prov-job-9' });

    expect(out).toEqual({ url: 'https://cdn.example.com/ai-generated/v.mp4' });
  });

  it('on poll, keeps deferring while the provider job is still processing', async () => {
    getLlmModel.mockResolvedValue(videoModel);
    getVideoProvider.mockReturnValue({ createJob: vi.fn(), getJob: vi.fn(async () => ({ id: 'prov-job-9', status: 'processing' })) });

    const out = await runVideoGeneration({ prompt: 'a wave' }, { externalRef: 'prov-job-9' });

    expect(out).toBeInstanceOf(JobDeferral);
    expect((out as JobDeferral).externalRef).toBe('prov-job-9');
  });

  it('throws when the provider job failed (so the job machine fails it)', async () => {
    getLlmModel.mockResolvedValue(videoModel);
    getVideoProvider.mockReturnValue({ createJob: vi.fn(), getJob: vi.fn(async () => ({ id: 'prov-job-9', status: 'failed', error: 'boom' })) });

    await expect(runVideoGeneration({ prompt: 'a wave' }, { externalRef: 'prov-job-9' })).rejects.toThrow(/boom/);
  });

  it('throws LlmNotConfiguredError when no video model is configured', async () => {
    getLlmModel.mockResolvedValue(undefined);
    await expect(runVideoGeneration({ prompt: 'a wave' }, { externalRef: null })).rejects.toBeInstanceOf(LlmNotConfiguredError);
  });
});
