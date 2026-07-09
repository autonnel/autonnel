import { defineRoute } from '@/lib/api/define-route';
import {
  getBrandingName,
  setBrandingName,
  getBrandingLogo,
  setBrandingLogo,
  getBrandingFavicon,
  setBrandingFavicon,
  type BrandingLogo,
  type BrandingFavicon,
} from '@/lib/config/keys';
import type { BrandingDto } from '@/contracts/settings';

async function readBranding(): Promise<BrandingDto> {
  const [name, logo, favicon] = await Promise.all([
    getBrandingName(),
    getBrandingLogo(),
    getBrandingFavicon(),
  ]);
  return {
    name: name ?? null,
    favicon: favicon ? { url: favicon.url } : null,
    logo: logo ? { url: logo.url } : null,
  };
}

export const GET = defineRoute('GET /api/settings/branding', { feature: 'SETTINGS_BRANDING' }, async () => {
  return readBranding();
});

export const PUT = defineRoute('PUT /api/settings/branding', { feature: 'SETTINGS_BRANDING' }, async ({ input }) => {
  if (input?.name !== undefined) await setBrandingName(String(input.name));
  if (input?.favicon !== undefined && input.favicon !== null) {
    await setBrandingFavicon(input.favicon as BrandingFavicon);
  }
  if (input?.logo !== undefined && input.logo !== null) {
    await setBrandingLogo(input.logo as BrandingLogo);
  }
  return readBranding();
});
