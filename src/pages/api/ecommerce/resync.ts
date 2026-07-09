import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeSyncCatalogService } from '@/composition/make-commerce-gateway';
import { createLogger } from '@/lib/logger';

const logger = createLogger('EcommerceResync');

export const POST = defineRoute(
  'POST /api/ecommerce/resync',
  { feature: 'SETTINGS_ECOMMERCE' },
  async (): Promise<{ synced: number }> => {
    let sync: Awaited<ReturnType<typeof makeSyncCatalogService>>;
    try {
      sync = await makeSyncCatalogService();
    } catch {
      throw new ApiError(400, 'No active e-commerce backend. Configure and save one under Settings → Ecommerce first.');
    }

    try {
      return await sync.execute(100);
    } catch (err) {
      logger.error('Catalog resync failed', { error: err });
      throw new ApiError(502, err instanceof Error ? err.message : 'Failed to sync products from the e-commerce platform.');
    }
  },
);
