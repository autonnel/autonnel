import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';

export interface PaletteFunnel {
  id: string;
  name: string;
}

export interface PaletteSite {
  id: string;
  name: string;
}

export interface PaletteSeed {
  funnels: PaletteFunnel[];
  sites: PaletteSite[];
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export async function loadPaletteSeed(): Promise<PaletteSeed> {
  const funnels = await safe(
    getTenantPrisma().funnel.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true },
    }) as Promise<Array<{ id: string; name: string }>>,
    [],
  );

  return {
    funnels: funnels.map((f) => ({ id: f.id, name: f.name })),
    sites: [],
  };
}
