import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeSiteConfig } from '@/composition/make-site-config';
import { ScriptNotFoundError } from '@/modules/site-config/application/manage-scripts.service';
import type { GlobalScript } from '@/modules/site-config/domain/global-script';
import type { ScriptDto } from '@/contracts/site-config';

function toDto(s: GlobalScript): ScriptDto {
  return { id: s.id, name: s.name, position: s.position, content: s.content, enabled: s.enabled, order: s.order };
}

export const PUT = defineRoute('PUT /api/settings/custom-code/:id', { feature: 'SETTINGS_CUSTOM_CODE' }, async ({ input, params }) => {
  const id = params.id;
  if (!id) throw new ApiError(400, 'Script id is required');
  const { scripts } = makeSiteConfig();
  try {
    const updated = await scripts.update(id, {
      name: input?.name,
      content: input?.content,
      position: input?.position,
      enabled: input?.enabled,
      order: input?.order,
    });
    return toDto(updated);
  } catch (err) {
    if (err instanceof ScriptNotFoundError) throw new ApiError(404, 'Script not found');
    throw err;
  }
});

export const DELETE = defineRoute('DELETE /api/settings/custom-code/:id', { feature: 'SETTINGS_CUSTOM_CODE' }, async ({ params }) => {
  const id = params.id;
  if (!id) throw new ApiError(400, 'Script id is required');
  const { scripts } = makeSiteConfig();
  try {
    await scripts.remove(id);
  } catch (err) {
    if (err instanceof ScriptNotFoundError) throw new ApiError(404, 'Script not found');
    throw err;
  }
  return { success: true } as const;
});
