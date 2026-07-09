import { defineRoute } from '@/lib/api/define-route';
import { getS3Config } from '@/lib/config/storage';
import type { StorageStatusWire } from '@/contracts/settings';

export const GET = defineRoute('GET /api/settings/storage/status', { feature: 'SETTINGS' }, async (): Promise<StorageStatusWire> => {
  const cfg = await getS3Config();
  return { configured: !!cfg };
});
