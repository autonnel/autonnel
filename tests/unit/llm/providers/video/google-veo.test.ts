import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleVeoProvider } from '@/lib/llm/providers/video/google-veo';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'video', provider: 'google-veo',
  name: 'r', modelId: 'veo-3.0-generate-001',
  baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AIza-test',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('googleVeoProvider.createJob', () => {
  it('POSTs to predictLongRunning with key in query and instances/parameters body', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ name: 'operations/op-1' }));
    const out = await googleVeoProvider.createJob(
      { prompt: 'a cat', aspectRatio: '16:9', duration: 8 },
      MODEL,
    );
    expect(out.id).toBe('operations/op-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-001:predictLongRunning?key=AIza-test');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.instances).toEqual([{ prompt: 'a cat' }]);
    expect(body.parameters.aspectRatio).toBe('16:9');
    expect(body.parameters.durationSeconds).toBe(8);
    expect(body.parameters.sampleCount).toBe(1);
  });

  it('encodes URL input image as bytesBase64Encoded', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([0x89, 0x50, 0x4e]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(jsonRes({ name: 'operations/op-2' }));
    await googleVeoProvider.createJob(
      { prompt: 'edit', image: 'https://example.com/in.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body.instances[0].image.mimeType).toBe('image/png');
    expect(typeof body.instances[0].image.bytesBase64Encoded).toBe('string');
    expect(body.instances[0].image.bytesBase64Encoded.length).toBeGreaterThan(0);
  });

  it('parses data URL image into bytesBase64Encoded', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ name: 'operations/op-3' }));
    await googleVeoProvider.createJob(
      { prompt: 'edit', image: 'data:image/jpeg;base64,AAAA' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.instances[0].image).toEqual({
      bytesBase64Encoded: 'AAAA',
      mimeType: 'image/jpeg',
    });
  });

  it('falls back to 16:9 for unsupported aspect ratio', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ name: 'operations/op-4' }));
    await googleVeoProvider.createJob(
      { prompt: 'x', aspectRatio: 'weird' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.parameters.aspectRatio).toBe('16:9');
  });
});

describe('googleVeoProvider.getJob', () => {
  it('returns processing when done is false', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ name: 'operations/op-5', done: false }));
    const job = await googleVeoProvider.getJob('operations/op-5', MODEL);
    expect(job.status).toBe('processing');
    expect(fetchMock.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/operations/op-5?key=AIza-test');
  });

  it('returns succeeded with outputUrl when response has uri', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      name: 'operations/op-6',
      done: true,
      response: {
        generateVideoResponse: {
          generatedSamples: [{ video: { uri: 'https://veo/v.mp4' } }],
        },
      },
    }));
    const job = await googleVeoProvider.getJob('operations/op-6', MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputUrl).toBe('https://veo/v.mp4');
  });

  it('returns succeeded with outputBytes when response has bytesBase64Encoded', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      name: 'operations/op-7',
      done: true,
      response: {
        generateVideoResponse: {
          generatedSamples: [{ video: { bytesBase64Encoded: 'AABBCC', mimeType: 'video/mp4' } }],
        },
      },
    }));
    const job = await googleVeoProvider.getJob('operations/op-7', MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputBytes).toEqual({ data: 'AABBCC', mimeType: 'video/mp4' });
  });

  it('returns failed when done with error', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      name: 'operations/op-8',
      done: true,
      error: { message: 'quota' },
    }));
    const job = await googleVeoProvider.getJob('operations/op-8', MODEL);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/quota/);
  });
});
