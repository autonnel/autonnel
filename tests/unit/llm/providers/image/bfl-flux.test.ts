import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bflFluxProvider } from '@/lib/llm/providers/image/bfl-flux';
import { PollTimeoutError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'bfl-flux',
  name: 'r', modelId: 'flux-pro-1.1',
  baseUrl: 'https://api.bfl.ai', apiKey: 'bfl-key',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('bflFluxProvider.generateImage', () => {
  it('POSTs to /v1/{modelId} with x-key auth and polls /v1/get_result', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ id: 't-1' }))
      .mockResolvedValueOnce(jsonRes({ status: 'Ready', result: { sample: 'https://bfl/out.png' } }));
    const out = await bflFluxProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '16:9' },
      MODEL,
    );
    expect(out).toEqual([{ type: 'url', url: 'https://bfl/out.png' }]);
    const [submitUrl, submitInit] = fetchMock.mock.calls[0];
    expect(submitUrl).toBe('https://api.bfl.ai/v1/flux-pro-1.1');
    expect(new Headers((submitInit as RequestInit).headers).get('x-key')).toBe('bfl-key');
    const body = JSON.parse((submitInit as RequestInit).body as string);
    expect(body).toMatchObject({ prompt: 'a cat', aspect_ratio: '16:9' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.bfl.ai/v1/get_result?id=t-1');
  });

  it('uses polling_url when present', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ id: 't-2', polling_url: 'https://other-host/poll?id=t-2' }))
      .mockResolvedValueOnce(jsonRes({ status: 'Ready', result: { sample: 'https://bfl/out.png' } }));
    await bflFluxProvider.generateImage({ prompt: 'x' }, MODEL);
    expect(fetchMock.mock.calls[1][0]).toBe('https://other-host/poll?id=t-2');
  });

  it('throws when status is Error', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ id: 't-3' }))
      .mockResolvedValueOnce(jsonRes({ status: 'Error', message: 'rejected' }));
    await expect(
      bflFluxProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toThrow();
  });

  it('falls back to 1:1 for unsupported aspect ratio', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ id: 't-4' }))
      .mockResolvedValueOnce(jsonRes({ status: 'Ready', result: { sample: 'https://x' } }));
    await bflFluxProvider.generateImage({ prompt: 'x', aspectRatio: 'weird' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.aspect_ratio).toBe('1:1');
  });

  it('includes image_prompt when inputImageBase64 given', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ id: 't-5' }))
      .mockResolvedValueOnce(jsonRes({ status: 'Ready', result: { sample: 'https://x' } }));
    await bflFluxProvider.generateImage(
      { prompt: 'edit', inputImageBase64: 'AAA' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.image_prompt).toBe('AAA');
  });

  it('throws PollTimeoutError when polling never finishes', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 't-6' }));
    fetchMock.mockResolvedValue(jsonRes({ status: 'Pending' }));
    await expect(
      bflFluxProvider.generateImage(
        { prompt: 'x' },
        { ...MODEL, options: { pollIntervalMs: 5, pollTimeoutMs: 30 } },
      ),
    ).rejects.toBeInstanceOf(PollTimeoutError);
  });
});
