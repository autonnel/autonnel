import {
  MarketplaceClient,
  MarketplaceError,
  readCredentials,
  type OrderEntitlement,
  type StoredCredentials,
} from './marketplace-client.js';

const AUTHORIZE_HINT = 'Run: npx autonnel authorize';

export interface GetEntitlementsResult {
  ok: boolean;
  reason?: 'no-credentials' | 'unauthorized' | 'error';
  message?: string;
  items?: OrderEntitlement[];
}

export async function getEntitlements(
  creds: StoredCredentials | null,
  client: MarketplaceClient,
): Promise<GetEntitlementsResult> {
  if (!creds) return { ok: false, reason: 'no-credentials', message: AUTHORIZE_HINT };
  try {
    const res = await client.listOrders(creds.accessToken);
    return { ok: true, items: res.items };
  } catch (err) {
    if (err instanceof MarketplaceError && err.status === 401) {
      return { ok: false, reason: 'unauthorized', message: AUTHORIZE_HINT };
    }
    return { ok: false, reason: 'error', message: (err as Error).message };
  }
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function renderOrdersTable(items: OrderEntitlement[]): string {
  if (items.length === 0) return 'No purchased plugins or templates yet.';
  const rows = items.map((i) => ({
    item: i.item ?? i.slug,
    kind: i.kind,
    version: i.version,
    purchased: i.purchasedAt.slice(0, 10),
  }));
  const head = { item: 'ITEM', kind: 'KIND', version: 'VERSION', purchased: 'PURCHASED' };
  const w = {
    item: Math.max(head.item.length, ...rows.map((r) => r.item.length)),
    kind: Math.max(head.kind.length, ...rows.map((r) => r.kind.length)),
    version: Math.max(head.version.length, ...rows.map((r) => r.version.length)),
    purchased: Math.max(head.purchased.length, ...rows.map((r) => r.purchased.length)),
  };
  const line = (r: { item: string; kind: string; version: string; purchased: string }): string =>
    `${pad(r.item, w.item)}  ${pad(r.kind, w.kind)}  ${pad(r.version, w.version)}  ${pad(r.purchased, w.purchased)}`;
  return [line(head), line(head).replace(/[^\s]/g, '-'), ...rows.map(line)].join('\n');
}

interface OrdersArgs {
  base?: string;
  json: boolean;
}

function parseArgs(args: string[]): OrdersArgs {
  const out: OrdersArgs = { json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') out.json = true;
    else if (args[i] === '--base' && args[i + 1]) out.base = args[++i];
    else if (args[i].startsWith('--base=')) out.base = args[i].slice('--base='.length);
  }
  return out;
}

export interface RunOrdersDeps {
  consumerRoot: string;
  client?: MarketplaceClient;
  log?: (msg: string) => void;
}

export async function runOrdersWith(args: string[], deps: RunOrdersDeps): Promise<boolean> {
  const parsed = parseArgs(args);
  const client = deps.client ?? new MarketplaceClient({ base: parsed.base });
  const log = deps.log ?? ((m: string) => process.stdout.write(m + '\n'));

  const creds = readCredentials(deps.consumerRoot);
  const result = await getEntitlements(creds, client);
  if (!result.ok) {
    log(result.message ?? AUTHORIZE_HINT);
    return false;
  }

  const items = result.items ?? [];
  if (parsed.json) {
    log(JSON.stringify({ items }, null, 2));
  } else {
    log(renderOrdersTable(items));
  }
  return true;
}

export async function runOrders(args: string[]): Promise<void> {
  const { resolveConsumerRoot } = await import('./index.js');
  const consumerRoot = resolveConsumerRoot();
  const ok = await runOrdersWith(args, { consumerRoot });
  if (!ok) process.exit(1);
}
