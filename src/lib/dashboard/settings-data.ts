import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '@/lib/db';
import { readEnv } from '@/lib/runtime/env';
import {
  describeRuntime,
  describeDbProvider,
  maskDbUrl,
  type SystemInfo,
  type LogRow,
} from './settings-helpers';

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export async function loadSystemInfo(): Promise<SystemInfo> {
  const db = getTenantPrisma();
  const base = getBasePrisma();

  const [pageCount, funnelCount, userCount, orderCount, dbCheck] = await Promise.all([
    safe(db.page.count(), 0),
    safe(db.funnel.count(), 0),
    safe(base.user.count(), 0),
    safe(db.order.count(), 0),
    safe(base.$queryRawUnsafe<unknown[]>('SELECT 1').then(() => true), false),
  ]);

  const isCf = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
  const { runtime, runtimeLabel } = describeRuntime(isCf);
  const dbUrl = readEnv('DATABASE_URL') || null;

  return {
    version: readEnv('npm_package_version') || '0.1.0',
    runtime,
    runtimeLabel,
    dbProvider: describeDbProvider(dbUrl) + (dbUrl ? ` · ${maskDbUrl(dbUrl)}` : ''),
    dbConnected: dbCheck,
    totalPages: pageCount,
    totalFunnels: funnelCount,
    totalUsers: userCount,
    totalOrders: orderCount,
  };
}

export async function loadRecentRequestLogs(_limit = 50): Promise<LogRow[]> {
  return [];
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key: string;
  writeAccess: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

// ApiKey schema stores a masked prefix + keyHash (the raw key is never re-readable);
// status string maps to isActive for the UI.
export async function loadApiKeysForUser(_userId: string): Promise<ApiKeyRow[]> {
  const rows = await safe(
    getTenantPrisma().apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        writeAccess: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    }) as Promise<Array<{
      id: string;
      name: string | null;
      prefix: string;
      writeAccess: boolean;
      status: string;
      expiresAt: Date | null;
      createdAt: Date;
    }>>,
    [],
  );
  return rows.map((k) => ({
    id: k.id,
    name: k.name ?? '',
    key: `${k.prefix}••••••••`,
    writeAccess: k.writeAccess,
    isActive: k.status === 'active',
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
  }));
}
