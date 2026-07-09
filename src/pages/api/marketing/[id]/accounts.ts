import { defineRoute } from '@/lib/api/define-route';
import type { AdAccountsResponseDto } from '@/contracts/ads';

export const GET = defineRoute('GET /api/marketing/:id/accounts', { feature: 'MARKETING' }, async (): Promise<AdAccountsResponseDto> => {
  return { platform: null, adAccounts: [], pluginRequired: true };
});
