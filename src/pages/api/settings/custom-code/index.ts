import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeSiteConfig } from '@/composition/make-site-config';
import type { GlobalScript } from '@/modules/site-config/domain/global-script';
import type { ScriptDto } from '@/contracts/site-config';

function toDto(s: GlobalScript): ScriptDto {
  return { id: s.id, name: s.name, position: s.position, content: s.content, enabled: s.enabled, order: s.order };
}

export const GET = defineRoute('GET /api/settings/custom-code', { feature: 'SETTINGS_CUSTOM_CODE' }, async () => {
  const { scripts } = makeSiteConfig();
  const rows = await scripts.list();
  return rows.map(toDto);
});

export const POST = defineRoute('POST /api/settings/custom-code', { feature: 'SETTINGS_CUSTOM_CODE', status: 201 }, async ({ input }) => {
  if (!input) throw new ApiError(400, 'Invalid request body');
  const { scripts } = makeSiteConfig();
  const created = await scripts.create({
    name: input.name,
    content: input.content,
    position: input.position,
    enabled: input.enabled,
    order: input.order,
  });
  return toDto(created);
});
