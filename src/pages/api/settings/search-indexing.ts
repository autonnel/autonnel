import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getSiteNoindex, setSiteNoindex } from '@/lib/config/keys';
import type { SearchIndexingDto } from '@/contracts/site-config';

async function read(): Promise<SearchIndexingDto> {
  return { noindex: await getSiteNoindex() };
}

export const GET = defineRoute(
  'GET /api/settings/search-indexing',
  { feature: 'SETTINGS_DOMAINS' },
  async () => read(),
);

export const PUT = defineRoute(
  'PUT /api/settings/search-indexing',
  { feature: 'SETTINGS_DOMAINS' },
  async ({ input }) => {
    if (typeof input?.noindex !== 'boolean') throw new ApiError(400, 'noindex must be a boolean');
    await setSiteNoindex(input.noindex);
    return read();
  },
);
