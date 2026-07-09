import { createLogger } from '@/lib/logger';

export interface StreamLine {
  // Opaque cursor + dedup token. Must lead with the occurredAt millis so the endpoint can parse a
  // resume point out of Last-Event-ID. Funnel feed: `${ts}:${rowId}`. System feed: `${ts}|${kind}|...`.
  id: string;
  ts: number;
  text: string;
  tone: 'ok' | 'bad' | 'muted' | 'highlight';
  payload: string;
}

export interface ActivitySseOptions {
  request: Request;
  // Cursor from the query string (?cursor=). Last-Event-ID header takes precedence over this on reconnect.
  queryCursor: string | null;
  // Each call mints + disposes its own short-lived DB client and returns lines strictly newer than cursor,
  // ordered oldest -> newest. Tenant scoping is the caller's responsibility (explicit tenantId, no ALS).
  poll: (cursor: string | null) => Promise<StreamLine[]>;
  pollIntervalMs?: number;
  maxConnectionMs?: number;
  logLabel: string;
}

const DEFAULT_POLL_MS = 2500;
// Cap each connection well under Workers' streaming limits; EventSource auto-reconnects with Last-Event-ID.
const DEFAULT_MAX_MS = 55_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function activitySseResponse(opts: ActivitySseOptions): Response {
  const logger = createLogger(opts.logLabel);
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const maxMs = opts.maxConnectionMs ?? DEFAULT_MAX_MS;
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const lastEventId = opts.request.headers.get('last-event-id');
  let cursor: string | null = lastEventId || opts.queryCursor;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      opts.request.signal.addEventListener('abort', close);
      // retry hint + a comment to flush headers immediately past any buffering proxy.
      enqueue('retry: 3000\n: open\n\n');

      try {
        while (!closed && !opts.request.signal.aborted && Date.now() - startedAt < maxMs) {
          let lines: StreamLine[] = [];
          try {
            lines = await opts.poll(cursor);
          } catch (error) {
            logger.error('activity poll failed', { error });
          }
          if (lines.length > 0) {
            for (const line of lines) {
              const data = JSON.stringify({ id: line.id, ts: line.ts, text: line.text, tone: line.tone, payload: line.payload });
              enqueue(`id: ${line.id}\nevent: activity\ndata: ${data}\n\n`);
              cursor = line.id;
            }
          } else {
            enqueue(': ping\n\n');
          }
          if (closed) break;
          await sleep(pollMs);
        }
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
