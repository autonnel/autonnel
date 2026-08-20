// Visitor badges in the funnel activity feed are rendered twice — server-side for the initial rows and
// client-side for SSE rows — so the id truncation, the color hash and the dwell format live in one place.

// Readable on the feed's #1F2937 console background; ordering is part of the hash contract.
const VISITOR_COLORS = [
  '#F87171',
  '#FB7185',
  '#F472B6',
  '#E879F9',
  '#C084FC',
  '#A78BFA',
  '#818CF8',
  '#60A5FA',
  '#38BDF8',
  '#22D3EE',
  '#2DD4BF',
  '#34D399',
  '#4ADE80',
  '#A3E635',
  '#FACC15',
  '#FB923C',
];

// anid = base36 timestamp (8 chars) + random tail, so concurrent visitors share the leading chars.
// Skip the timestamp when the id is long enough to have one, otherwise the badges all look alike.
const ANID_TIMESTAMP_LEN = 8;
const BADGE_LEN = 6;

export function shortVisitorId(visitorId: string | null | undefined): string | null {
  if (!visitorId) return null;
  const start = visitorId.length >= ANID_TIMESTAMP_LEN + BADGE_LEN ? ANID_TIMESTAMP_LEN : 0;
  return visitorId.slice(start, start + BADGE_LEN);
}

// FNV-1a with an avalanche fold: the palette length is a power of two, so a weakly mixed hash
// would collapse onto a handful of hues for the base36 ids the tracker mints.
export function visitorColor(shortId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < shortId.length; i++) {
    hash ^= shortId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return VISITOR_COLORS[hash % VISITOR_COLORS.length];
}

export function formatDwell(ms: unknown): string | null {
  const value = typeof ms === 'number' ? ms : Number(ms);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}
