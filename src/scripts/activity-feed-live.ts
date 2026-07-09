// Live activity feed: opens one SSE connection per feed container and prepends new rows as they arrive.
// No client polling — EventSource pushes and auto-reconnects (resuming via Last-Event-ID). The matching
// server endpoint tails the DB tenant-scoped. Container is configured entirely via data-* attributes so
// the same script drives both the overview "System activity" and the funnel "Recent activity" feeds.

interface ActivityPayload {
  id: string;
  ts: number;
  text: string;
  tone: 'ok' | 'bad' | 'muted' | 'highlight';
  payload: string;
}

const TONE_COLOR: Record<string, string> = {
  ok: '#A7F3D0',
  bad: '#FCA5A5',
  muted: '#9CA3AF',
  highlight: '#E5E7EB',
};

function hms(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function buildRow(item: ActivityPayload): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'flex gap-3 items-baseline';

  const time = document.createElement('span');
  time.className = 'text-[#9CA3AF] tabular shrink-0';
  time.textContent = hms(item.ts);

  const body = document.createElement('span');
  body.className = 'min-w-0 break-words';
  body.appendChild(document.createTextNode(`${item.text} · `));

  const payload = document.createElement('span');
  payload.style.color = TONE_COLOR[item.tone] ?? TONE_COLOR.muted;
  payload.textContent = item.payload;
  body.appendChild(payload);

  row.appendChild(time);
  row.appendChild(body);
  return row;
}

function initContainer(container: HTMLElement): void {
  const endpoint = container.dataset.feedEndpoint;
  const list = container.querySelector<HTMLElement>('[data-feed-list]');
  if (!endpoint || !list) return;

  const max = Number(container.dataset.feedMax ?? '50') || 50;
  const since = container.dataset.feedSince ?? '';
  const countEl = container.querySelector<HTMLElement>('[data-feed-count]');
  const seen = new Set<string>();

  // tail -f semantics: newest row sits at the bottom next to the cursor. Stick the
  // viewport to the bottom unless the user has scrolled up to read history.
  const isPinnedToBottom = () =>
    container.scrollHeight - container.scrollTop - container.clientHeight < 24;
  const scrollToBottom = () => {
    container.scrollTop = container.scrollHeight;
  };
  scrollToBottom();

  const url = since ? `${endpoint}?cursor=${encodeURIComponent(since)}` : endpoint;
  const source = new EventSource(url);

  const updateCount = () => {
    if (!countEl) return;
    const n = list.querySelectorAll('[data-feed-row]').length;
    countEl.textContent = String(n);
  };

  source.addEventListener('activity', (event) => {
    let item: ActivityPayload;
    try {
      item = JSON.parse((event as MessageEvent).data);
    } catch {
      return;
    }
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    if (seen.size > 1000) seen.clear();

    list.querySelector('[data-feed-empty]')?.remove();

    const pinned = isPinnedToBottom();
    const row = buildRow(item);
    row.setAttribute('data-feed-row', '');
    list.appendChild(row);

    const rows = list.querySelectorAll('[data-feed-row]');
    for (let i = 0; i < rows.length - max; i++) rows[i].remove();
    updateCount();
    if (pinned) scrollToBottom();
  });

  source.addEventListener('error', () => {
    // EventSource reconnects on its own; nothing to do but surface it for debugging.
    console.debug('[activity-feed] connection interrupted, awaiting auto-reconnect');
  });
}

function init(): void {
  document.querySelectorAll<HTMLElement>('[data-activity-feed]').forEach(initContainer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
