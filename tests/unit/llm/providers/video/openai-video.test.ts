import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openaiVideoProvider } from '@/lib/llm/providers/video/openai-video';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'video', provider: 'openai-video',
  name: 'r', modelId: 'sora-2',
  baseUrl: 'https://api.openai.com', apiKey: 'sk-test',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('openaiVideoProvider.createJob', () => {
  it('POSTs JSON body to /v1/videos with bearer auth and size mapping', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'vid-1', status: 'queued' }));
    const out = await openaiVideoProvider.createJob(
      { prompt: 'a cat', aspectRatio: '16:9', duration: 5 },
      MODEL,
    );
    expect(out.id).toBe('vid-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/videos');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: 'sora-2',
      prompt: 'a cat',
      seconds: 5,
      size: '1280x720',
    });
  });

  it('maps aspectRatio 9:16 to size 720x1280', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'vid-2' }));
    await openaiVideoProvider.createJob({ prompt: 'x', aspectRatio: '9:16' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBe('720x1280');
  });

  it('uses multipart when image present', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(jsonRes({ id: 'vid-3' }));
    await openaiVideoProvider.createJob(
      { prompt: 'edit', image: 'https://example.com/in.png', aspectRatio: '1:1' },
      MODEL,
    );
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.openai.com/v1/videos');
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('writes OpenAI-Organization header when options.organization set', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'vid-4' }));
    await openaiVideoProvider.createJob(
      { prompt: 'x' },
      { ...MODEL, options: { organization: 'org-1' } },
    );
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('OpenAI-Organization')).toBe('org-1');
  });

  it('throws ProviderHttpError on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad key', { status: 401 }));
    await expect(
      openaiVideoProvider.createJob({ prompt: 'x' }, MODEL),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });
});

describe('openaiVideoProvider.getJob', () => {
  it('maps in_progress status to processing', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'vid-5', status: 'in_progress' }));
    const job = await openaiVideoProvider.getJob('vid-5', MODEL);
    expect(job.status).toBe('processing');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/videos/vid-5');
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
  });

  it('on completed: fetches /content with auth and sets outputBytes', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ id: 'vid-6', status: 'completed' }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0xff, 0xd8]), {
        status: 200,
        headers: { 'content-type': 'video/mp4' },
      }));
    const job = await openaiVideoProvider.getJob('vid-6', MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputBytes?.mimeType).toBe('video/mp4');
    expect(job.outputBytes?.data.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.openai.com/v1/videos/vid-6/content');
    const headers = new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
  });

  it('maps failed status to failed with error', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'vid-7', status: 'failed', error: { message: 'safety blocked' },
    }));
    const job = await openaiVideoProvider.getJob('vid-7', MODEL);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/safety blocked/);
  });
});
