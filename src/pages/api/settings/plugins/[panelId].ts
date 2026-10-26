import { defineRoute, ApiError } from '@/lib/api/define-route';
import { setConfig, deleteConfig } from '@/lib/config/get-config';
import { getPluginSettingsPanel } from '@/lib/plugins/registry';
import { sanitizeSettingsValues } from '@/lib/plugins/settings-values';
import { loadPluginSettingsWire } from '@/lib/plugins/settings-wire';

export const prerender = false;

function panelOr404(panelId: string | undefined) {
  const panel = panelId ? getPluginSettingsPanel(panelId) : undefined;
  if (!panel) throw new ApiError(404, 'Settings panel not found');
  return panel;
}

export const GET = defineRoute('GET /api/settings/plugins/:panelId', { feature: 'SETTINGS' }, async ({ params }) =>
  loadPluginSettingsWire(panelOr404(params.panelId)),
);

export const PUT = defineRoute('PUT /api/settings/plugins/:panelId', { feature: 'SETTINGS' }, async ({ params, input }) => {
  const panel = panelOr404(params.panelId);
  const result = sanitizeSettingsValues(panel, input?.values);
  if (!result.ok) throw new ApiError(400, result.error);
  await setConfig(panel.configKey, result.values);
  return loadPluginSettingsWire(panel, { stored: result.values });
});

export const DELETE = defineRoute('DELETE /api/settings/plugins/:panelId', { feature: 'SETTINGS' }, async ({ params }) => {
  const panel = panelOr404(params.panelId);
  await deleteConfig(panel.configKey);
  return loadPluginSettingsWire(panel, { stored: null });
});
