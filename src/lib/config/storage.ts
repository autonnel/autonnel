import type { SiteS3Config } from '@/lib/s3';
import { StorageNotConfiguredError } from '@/lib/s3';
import { getConfig } from './get-config';
import { getDefaultCdnUrl } from './keys';
import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId, runWithTenant } from '@/lib/tenant/context';

export interface StorageContext {
  s3Config: SiteS3Config | null;
  staticDomain: string | null;
  primaryDomain: string | null;
}

export async function getS3Config(): Promise<SiteS3Config | null> {
  const value = await getConfig<SiteS3Config>('storage.s3');
  if (!value || !value.endpoint || !value.bucket || !value.accessKeyId || !value.secretAccessKey) {
    return null;
  }
  return value;
}

export async function requireS3Config(): Promise<SiteS3Config> {
  const cfg = await getS3Config();
  if (!cfg) throw new StorageNotConfiguredError();
  return cfg;
}

export async function getStorageContext(): Promise<StorageContext> {
  const prisma = getBasePrisma();
  const tenantId = getCurrentTenantId();
  const [s3Config, staticDomain, primary] = await Promise.all([
    getS3Config(),
    getDefaultCdnUrl(),
    prisma.domain.findFirst({
      where: { tenantId, isPrimary: true },
      select: { host: true },
    }),
  ]);

  return {
    s3Config,
    staticDomain: staticDomain ?? null,
    primaryDomain: primary?.host ?? null,
  };
}


export async function getStorageContextByPage(pageId: string): Promise<StorageContext | null> {
  const prisma = getBasePrisma();
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { tenantId: true },
  });
  if (!page) return null;
  const [s3Config, staticDomain, primary] = await Promise.all([
    runWithTenant(page.tenantId, () => getConfig<SiteS3Config>('storage.s3')).then((v) => v ?? null),
    runWithTenant(page.tenantId, () => getDefaultCdnUrl()),
    prisma.domain.findFirst({
      where: { tenantId: page.tenantId, isPrimary: true },
      select: { host: true },
    }),
  ]);

  const validS3 =
    s3Config &&
    s3Config.endpoint &&
    s3Config.bucket &&
    s3Config.accessKeyId &&
    s3Config.secretAccessKey
      ? s3Config
      : null;

  return {
    s3Config: validS3,
    staticDomain: staticDomain ?? null,
    primaryDomain: primary?.host ?? null,
  };
}
