import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@/lib/config/get-config', () => ({
  getConfig: vi.fn(async (key: string) => store.get(key)),
  setConfig: vi.fn(async (key: string, value: string) => void store.set(key, value)),
  deleteConfig: vi.fn(async (key: string) => void store.delete(key)),
}));

const emptyDelegate = {} as never;
vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => ({
    adAccountConnection: emptyDelegate,
    adConversionDestination: emptyDelegate,
    postback: emptyDelegate,
    eventMappingProfile: emptyDelegate,
    adAttributionTouch: emptyDelegate,
    funnelAdConnection: emptyDelegate,
    adCreative: emptyDelegate,
    adDailyMetric: emptyDelegate,
    adSyncRun: emptyDelegate,
    page: emptyDelegate,
    funnel: emptyDelegate,
    job: emptyDelegate,
    configEntry: emptyDelegate,
  }),
}));
vi.mock('@/lib/db', () => ({ getBasePrisma: () => ({}) }));

import { createAdsDepsForRequest, clientIdFor } from './make-ads-deps';
import { makeAcquisitionAds } from './make-acquisition-ads';

beforeEach(() => store.clear());

// This is a regression test for a real bug: clientIdFor used to build its KV key by string
// interpolation (`ads.${platform.toLowerCase()}.client_id`), which for a 'FACEBOOK' connection
// produced 'ads.facebook.client_id' -- a key that was never written, since the real key is
// 'ads.facebook.app_id' (ADS_APP_KEYS.META.clientId). oauthFor's credentials and clientIdFor's
// authorize-url client_id must always agree, or StartAdConnectionService builds an authorize URL
// with the wrong (or an empty) client_id.
describe('clientIdFor / oauthFor key parity', () => {
  it('resolves the exact same client id for a FACEBOOK alias as the Meta oauth adapter is built with', async () => {
    store.set('ads.facebook.app_id', 'meta-cid');
    store.set('ads.facebook.app_secret', 'meta-secret');

    const deps = await createAdsDepsForRequest();
    const ads = await makeAcquisitionAds(deps);

    const fromClientIdFor = await deps.clientIdFor('FACEBOOK');
    const fromOauthFor = (ads.oauthFor('FACEBOOK') as any).creds.clientId;

    expect(fromClientIdFor).toBe('meta-cid');
    expect(fromOauthFor).toBe('meta-cid');
    expect(fromClientIdFor).toBe(fromOauthFor);
  });

  it('resolves the exact same client id for GOOGLE_ADS as the Google oauth adapter is built with', async () => {
    store.set('ads.google_ads.client_id', 'g-cid');
    store.set('ads.google_ads.client_secret', 'g-secret');

    const deps = await createAdsDepsForRequest();
    const ads = await makeAcquisitionAds(deps);

    const fromClientIdFor = await deps.clientIdFor('GOOGLE_ADS');
    const fromOauthFor = (ads.oauthFor('GOOGLE_ADS') as any).creds.clientId;

    expect(fromClientIdFor).toBe('g-cid');
    expect(fromOauthFor).toBe('g-cid');
  });

  it('returns an empty string, not a guessed key, when the platform app is not configured', async () => {
    expect(await clientIdFor('TIKTOK')).toBe('');
  });
});
