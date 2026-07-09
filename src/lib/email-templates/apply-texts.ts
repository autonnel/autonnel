const TEXT_MARKER_RE = /\{\{T:([\w-]+)\}\}/g;

function transform(value: unknown, texts: Record<string, string>): unknown {
  if (typeof value === 'string') {
    if (!value.includes('{{T:')) return value;
    return value.replace(TEXT_MARKER_RE, (_, id: string) => texts[id] ?? '');
  }
  if (Array.isArray(value)) return value.map((v) => transform(v, texts));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = transform(v, texts);
    return out;
  }
  return value;
}

export function applyTextsToDesign<T>(design: T, texts: Record<string, string>): T {
  return transform(design, texts) as T;
}
