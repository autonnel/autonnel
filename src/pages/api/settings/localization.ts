import { defineRoute, ApiError } from '@/lib/api/define-route';
import { setConfig } from '@/lib/config/get-config';
import { getSiteTimezone, ConfigKeys } from '@/lib/config/keys';
import { TIMEZONE_OPTIONS } from '@/lib/constants/timezone';
import type { LocalizationWire } from '@/contracts/settings';

async function read(): Promise<LocalizationWire> {
  return { timezone: await getSiteTimezone() };
}

export const GET = defineRoute('GET /api/settings/localization', { feature: 'SETTINGS_LOCALIZATION' }, async () => read());

export const PUT = defineRoute('PUT /api/settings/localization', { feature: 'SETTINGS_LOCALIZATION' }, async ({ input }) => {
  const tz = input?.timezone;
  if (typeof tz !== 'string' || !TIMEZONE_OPTIONS.some((o) => o.value === tz)) {
    throw new ApiError(400, 'Invalid timezone');
  }
  await setConfig(ConfigKeys.LOCALIZATION_TIMEZONE.key, tz);
  return read();
});
