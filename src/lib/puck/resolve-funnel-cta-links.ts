type UnknownRecord = Record<string, unknown>;
type Mapper = (value: UnknownRecord) => UnknownRecord | undefined;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mapPuckTree(value: unknown, mapper: Mapper): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => mapPuckTree(entry, mapper));
  }

  if (!isRecord(value)) {
    return value;
  }

  const mapped = mapper(value);
  if (mapped) return mapped;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, mapPuckTree(child, mapper)]),
  );
}

function isFunnelCtaRecord(value: UnknownRecord) {
  return value.type === 'funnel-cta' && Object.prototype.hasOwnProperty.call(value, 'url');
}

function appendParams(url: string, paramString: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${paramString}`;
}

export function resolveFunnelCtaLinksInPuckData<T>(
  puckData: T,
  funnelCtaUrl: string | null | undefined,
): T {
  if (!puckData || !funnelCtaUrl) return puckData;

  return mapPuckTree(puckData, (node) => {
    if (!isFunnelCtaRecord(node)) return undefined;
    return { ...node, url: funnelCtaUrl };
  }) as T;
}

export function appendQueryParamsToPuckCtaLinks<T>(
  puckData: T,
  queryParams: Record<string, string>,
): T {
  if (!puckData) return puckData;

  const paramString = new URLSearchParams(queryParams).toString();
  if (!paramString) return puckData;

  return mapPuckTree(puckData, (node) => {
    if (!isFunnelCtaRecord(node) || typeof node.url !== 'string' || !node.url.includes('/n/')) {
      return undefined;
    }

    return { ...node, url: appendParams(node.url, paramString) };
  }) as T;
}
