import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 requires a driver adapter; no query is issued, so no DB is contacted.
function makeClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

describe('Authoring prisma models', () => {
  it('exposes page/funnel/template/pagePublication/funnelPublication/pageAsset/aiChatSession delegates', () => {
    const client = makeClient();
    for (const model of [
      'page',
      'funnel',
      'template',
      'pagePublication',
      'funnelPublication',
      'pageAsset',
      'aiChatSession',
    ]) {
      expect((client as unknown as Record<string, unknown>)[model]).toBeDefined();
    }
  });
});
