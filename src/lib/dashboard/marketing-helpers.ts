
export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'default';

export type MarketingTab = 'platforms' | 'postbacks' | 'bindings';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MarketingKpi {
  connectedPlatforms: number;
  conversions24h: number;
  pendingPostbacks: number;
  failed24h: number;
}

export interface AggregateMarketingInput {
  platforms: Array<{ id: string; isActive?: boolean | null }>;
  postbacks: Array<{ status: string; createdAt: Date | string }>;
  now?: Date;
}

export function aggregateMarketingKpi(input: AggregateMarketingInput): MarketingKpi {
  const now = input.now ?? new Date();
  const start24 = now.getTime() - DAY_MS;

  let conversions24h = 0;
  let pendingPostbacks = 0;
  let failed24h = 0;

  for (const p of input.postbacks) {
    const ts = typeof p.createdAt === 'string' ? new Date(p.createdAt).getTime() : p.createdAt.getTime();
    const inWindow = ts >= start24 && ts <= now.getTime();
    if (p.status === 'PENDING' || p.status === 'DISPATCHING') pendingPostbacks++;
    if (p.status === 'ACKNOWLEDGED' && inWindow) conversions24h++;
    if ((p.status === 'FAILED' || p.status === 'DEAD') && inWindow) failed24h++;
  }

  const connectedPlatforms = input.platforms.filter((p) => p.isActive !== false).length;

  return {
    connectedPlatforms,
    conversions24h,
    pendingPostbacks,
    failed24h,
  };
}

export function postbackStatusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ACKNOWLEDGED':
      return 'ok';
    case 'PENDING':
    case 'DISPATCHING':
      return 'warn';
    case 'FAILED':
    case 'DEAD':
      return 'bad';
    case 'SUPPRESSED':
      return 'muted';
    default:
      return 'default';
  }
}

export function platformActiveTone(isActive: boolean | null | undefined): Tone {
  if (isActive === false) return 'muted';
  return 'ok';
}

export function statusBadgeClasses(tone: Tone): string {
  switch (tone) {
    case 'ok':   return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
    case 'warn': return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
    case 'bad':  return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
    case 'muted': return 'bg-ds-surface2 border-ds-line text-ds-muted';
    default:     return 'bg-ds-surface2 border-ds-line text-ds-slate';
  }
}

export function platformLabel(p: string): string {
  switch (p) {
    case 'FACEBOOK':   return 'Facebook Ads';
    case 'TIKTOK':     return 'TikTok Ads';
    case 'GOOGLE_ADS': return 'Google Ads';
    case 'BING_ADS':   return 'Bing Ads';
    default:           return p;
  }
}

export function platformShort(p: string): string {
  switch (p) {
    case 'FACEBOOK':   return 'FB';
    case 'TIKTOK':     return 'TT';
    case 'GOOGLE_ADS': return 'GA';
    case 'BING_ADS':   return 'BA';
    default:           return p.slice(0, 2);
  }
}

export function authModeLabel(credentials: Record<string, any> | null | undefined): 'OAuth' | 'Token' {
  if (credentials && (credentials.mode === 'oauth' || credentials.refreshToken)) return 'OAuth';
  return 'Token';
}

export function accountIdentifier(credentials: Record<string, any> | null | undefined): string {
  if (!credentials) return '—';
  return (
    credentials.adAccountId ||
    credentials.pixelId ||
    credentials.advertiserId ||
    credentials.customerId ||
    credentials.accountId ||
    '—'
  );
}

export function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function parseMarketingTab(value: string | null | undefined): MarketingTab {
  const v = (value || '').toLowerCase();
  if (v === 'postbacks' || v === 'bindings') return v;
  return 'platforms';
}

export function marketingTabs(): Array<{ id: MarketingTab; label: string }> {
  return [
    { id: 'platforms', label: 'Platforms' },
    { id: 'postbacks', label: 'Postbacks' },
    { id: 'bindings',  label: 'Bindings' },
  ];
}

export interface BindingAggregateInput {
  bindings: Array<{
    funnelId: string;
    funnelName: string;
    platform: string;
    platformId: string;
    platformName: string;
  }>;
}

export interface BindingFunnelGroup {
  funnelId: string;
  funnelName: string;
  platforms: Array<{ id: string; platform: string; platformLabel: string; platformName: string }>;
}

export function aggregateBindingsByFunnel(input: BindingAggregateInput): BindingFunnelGroup[] {
  const map = new Map<string, BindingFunnelGroup>();
  for (const b of input.bindings) {
    let g = map.get(b.funnelId);
    if (!g) {
      g = {
        funnelId: b.funnelId,
        funnelName: b.funnelName,
        platforms: [],
      };
      map.set(b.funnelId, g);
    }
    g.platforms.push({
      id: b.platformId,
      platform: b.platform,
      platformLabel: platformLabel(b.platform),
      platformName: b.platformName,
    });
  }
  return Array.from(map.values());
}
