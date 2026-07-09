import { describe, it, expect } from 'vitest';
import { activitySseResponse, type StreamLine } from './activity-stream';

function line(id: string, text: string): StreamLine {
  return { id, ts: 1_700_000_000_000, text, tone: 'muted', payload: 'p' };
}

async function readAll(res: Response): Promise<string> {
  return new Response(res.body).text();
}

describe('activitySseResponse', () => {
  it('frames lines as SSE events, advances the cursor, and heartbeats when idle', async () => {
    const controller = new AbortController();
    const cursors: Array<string | null> = [];
    let calls = 0;

    const res = activitySseResponse({
      request: new Request('http://x/stream', { signal: controller.signal }),
      queryCursor: null,
      pollIntervalMs: 1,
      maxConnectionMs: 1000,
      logLabel: 'Test',
      poll: async (cursor) => {
        cursors.push(cursor);
        calls += 1;
        if (calls === 1) return [line('a', 'first'), line('b', 'second')];
        if (calls === 2) return []; // idle -> heartbeat
        controller.abort();
        return [];
      },
    });

    const text = await readAll(res);

    expect(text).toContain('retry: 3000');
    expect(text).toContain('event: activity');
    expect(text).toContain('id: a');
    expect(text).toContain('id: b');
    expect(text).toContain('"text":"first"');
    expect(text).toContain(': ping');
    // first poll has no cursor; second poll receives the last emitted line id ('b')
    expect(cursors[0]).toBeNull();
    expect(cursors[1]).toBe('b');
  });

  it('prefers the Last-Event-ID header over the query cursor on reconnect', async () => {
    const controller = new AbortController();
    let firstCursor: string | null | undefined;

    const res = activitySseResponse({
      request: new Request('http://x/stream', {
        headers: { 'last-event-id': 'resume-token' },
        signal: controller.signal,
      }),
      queryCursor: 'query-token',
      pollIntervalMs: 1,
      maxConnectionMs: 1000,
      logLabel: 'Test',
      poll: async (cursor) => {
        firstCursor = cursor;
        controller.abort();
        return [];
      },
    });

    await readAll(res);
    expect(firstCursor).toBe('resume-token');
  });
});
