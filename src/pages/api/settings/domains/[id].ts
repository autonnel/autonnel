import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeSiteConfig } from '@/composition/make-site-config';
import { DomainNotFoundError } from '@/modules/site-config/application/manage-domains.service';
import type { Domain } from '@/modules/site-config/domain/domain';
import type { DomainDto } from '@/contracts/site-config';

function toDto(d: Domain): DomainDto {
  return { id: d.id, domain: d.host, isPrimary: d.isPrimary };
}

export const PUT = defineRoute('PUT /api/settings/domains/:id', { feature: 'SETTINGS_DOMAINS' }, async ({ input, params }) => {
  const id = params.id;
  if (!id) throw new ApiError(400, 'Domain id is required');
  const { domains } = makeSiteConfig();
  try {
    if (input?.isPrimary) return toDto(await domains.setPrimary(id));
    const existing = (await domains.list()).find((d) => d.id === id);
    if (!existing) throw new ApiError(404, 'Domain not found');
    return toDto(existing);
  } catch (err) {
    if (err instanceof DomainNotFoundError) throw new ApiError(404, 'Domain not found');
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/settings/domains/:id', { feature: 'SETTINGS_DOMAINS' }, async ({ params }) => {
  const id = params.id;
  if (!id) throw new ApiError(400, 'Domain id is required');
  const { domains } = makeSiteConfig();
  try {
    await domains.remove(id);
  } catch (err) {
    if (err instanceof DomainNotFoundError) throw new ApiError(404, 'Domain not found');
    throw err;
  }
  return { success: true } as const;
});
