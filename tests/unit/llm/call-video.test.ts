import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmModel } from '@/lib/config/llm-models-types';
import type { VideoProvider, VideoJob } from '@/lib/llm/types';

const { getLlmModelMock, normalizeVideoToS3UrlMock, pollJobMock } = vi.hoisted(() => ({
  getLlmModelMock: vi.fn(),
  normalizeVideoToS3UrlMock: vi.fn(),
  pollJobMock: vi.fn(),
}));

vi.mock('@/lib/config/llm-models', () => ({ getLlmModel: getLlmModelMock }));
vi.mock('@/lib/llm/video-output', () => ({
  normalizeVideoToS3Url: normalizeVideoToS3UrlMock,
  ensureImageUrl: vi.fn(),
}));
vi.mock('@/lib/llm/poll', () => ({ pollJob: pollJobMock }));

import { registerVideoProvider, __resetRegistry } from '@/lib/llm/registry';
import { callVideo } from '@/lib/llm/call-video';
import { LlmNotConfiguredError, UnknownProviderError } from '@/lib/llm/errors';

const VIDEO_DEFAULT: LlmModel = {
  type: 'video', provider: 'fake-video',
  name: 'r', modelId: 'x',
  baseUrl: 'https://x.example', apiKey: 'k',
  isDefault: true,
};

const fakeProvider: VideoProvider = {
  id: 'fake-video',
  createJob: vi.fn(),
  getJob: vi.fn(),
};

beforeEach(() => {
  __resetRegistry();
  registerVideoProvider(fakeProvider);
  (fakeProvider.createJob as ReturnType<typeof vi.fn>).mockReset();
  (fakeProvider.getJob as ReturnType<typeof vi.fn>).mockReset();
  getLlmModelMock.mockReset();
  normalizeVideoToS3UrlMock.mockReset();
  pollJobMock.mockReset();
});

describe('callVideo', () => {
  it('throws LlmNotConfiguredError when no row resolves', async () => {
    getLlmModelMock.mockResolvedValue(undefined);
    await expect(callVideo({ prompt: 'hi' })).rejects.toBeInstanceOf(LlmNotConfiguredError);
  });

  it('throws UnknownProviderError when row.provider is not registered', async () => {
    getLlmModelMock.mockResolvedValue({ ...VIDEO_DEFAULT, provider: 'mystery' });
    await expect(callVideo({ prompt: 'hi' })).rejects.toBeInstanceOf(UnknownProviderError);
  });

  it('dispatches createJob and pollJob, returns normalized S3 URL on succeeded', async () => {
    getLlmModelMock.mockResolvedValue(VIDEO_DEFAULT);
    (fakeProvider.createJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-1' });
    const terminal: VideoJob = { id: 'job-1', status: 'succeeded', outputUrl: 'https://cdn/v.mp4' };
    pollJobMock.mockResolvedValue(terminal);
    normalizeVideoToS3UrlMock.mockResolvedValue('https://static.example/v.mp4');
    const out = await callVideo({ prompt: 'a cat', aspectRatio: '16:9', userId: 'u1' });
    expect(out).toBe('https://static.example/v.mp4');
    expect(fakeProvider.createJob).toHaveBeenCalledWith(
      { prompt: 'a cat', aspectRatio: '16:9', image: undefined, duration: undefined },
      VIDEO_DEFAULT,
    );
    expect(pollJobMock).toHaveBeenCalledWith(fakeProvider, 'job-1', VIDEO_DEFAULT, {
      intervalMs: 3000,
      timeoutMs: 600_000,
    });
    expect(normalizeVideoToS3UrlMock).toHaveBeenCalledWith(terminal, 'u1');
  });

  it('throws with error message when terminal status is not succeeded', async () => {
    getLlmModelMock.mockResolvedValue(VIDEO_DEFAULT);
    (fakeProvider.createJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-2' });
    pollJobMock.mockResolvedValue({ id: 'job-2', status: 'failed', error: 'gpu oom' });
    await expect(callVideo({ prompt: 'x' })).rejects.toThrow(/gpu oom/);
  });

  it('uses explicit modelName when provided', async () => {
    const explicit: LlmModel = { ...VIDEO_DEFAULT, name: 'special', modelId: 's' };
    getLlmModelMock.mockImplementation((type: string, name?: string) => {
      if (name === 'special') return Promise.resolve(explicit);
      if (!name) return Promise.resolve(VIDEO_DEFAULT);
      return Promise.resolve(undefined);
    });
    (fakeProvider.createJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-3' });
    pollJobMock.mockResolvedValue({ id: 'job-3', status: 'succeeded', outputUrl: 'https://x/v.mp4' });
    normalizeVideoToS3UrlMock.mockResolvedValue('https://static.example/v.mp4');
    await callVideo({ modelName: 'special', prompt: 'x' });
    expect(getLlmModelMock).toHaveBeenCalledWith('video', 'special');
  });

  it('forwards image and duration to provider unchanged', async () => {
    getLlmModelMock.mockResolvedValue(VIDEO_DEFAULT);
    (fakeProvider.createJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-4' });
    pollJobMock.mockResolvedValue({ id: 'job-4', status: 'succeeded', outputUrl: 'https://x' });
    normalizeVideoToS3UrlMock.mockResolvedValue('https://static/x');
    await callVideo({
      prompt: 'p',
      image: 'data:image/png;base64,AAA',
      duration: 5,
    });
    const arg = (fakeProvider.createJob as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg).toEqual({
      prompt: 'p',
      aspectRatio: undefined,
      image: 'data:image/png;base64,AAA',
      duration: 5,
    });
  });

  it('honors row.options.pollIntervalMs and pollTimeoutMs overrides', async () => {
    getLlmModelMock.mockResolvedValue({
      ...VIDEO_DEFAULT,
      options: { pollIntervalMs: 1000, pollTimeoutMs: 60_000 },
    });
    (fakeProvider.createJob as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-5' });
    pollJobMock.mockResolvedValue({ id: 'job-5', status: 'succeeded', outputUrl: 'https://x' });
    normalizeVideoToS3UrlMock.mockResolvedValue('https://static/x');
    await callVideo({ prompt: 'x' });
    expect(pollJobMock.mock.calls[0][3]).toEqual({ intervalMs: 1000, timeoutMs: 60_000 });
  });
});
