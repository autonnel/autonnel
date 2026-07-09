import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeSiteConfig } from '@/composition/make-site-config';
import { DomainConflictError } from '@/modules/site-config/application/manage-domains.service';
import type { Domain } from '@/modules/site-config/domain/domain';
import type { DomainDto } from '@/contracts/site-config';

function toDto(d: Domain): DomainDto {
  return { id: d.id, domain: d.host, isPrimary: d.isPrimary };
}

export const GET = defineRoute('GET /api/settings/domains', { feature: 'SETTINGS_DOMAINS' }, async () => {
  const { domains } = makeSiteConfig();
  const rows = await domains.list();
  return rows.map(toDto);
});

export const POST = defineRoute('POST /api/settings/domains', { feature: 'SETTINGS_DOMAINS', status: 201 }, async ({ input }) => {
  if (!input?.domain) throw new ApiError(400, 'Domain is required');
  const { domains } = makeSiteConfig();
  try {
    const created = await domains.add({ host: input.domain, isPrimary: input.isPrimary === true });
    return toDto(created);
  } catch (err) {
    if (err instanceof DomainConflictError) throw new ApiError(400, 'Domain already in use');
    throw err;
  }
});
