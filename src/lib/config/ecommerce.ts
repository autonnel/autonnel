import { getConfig } from './get-config';
import type { FulfillmentMode } from '@/contracts/settings';

// Drives how accepted upsells are pushed to the external commerce backend (see ecommerce.config).
// merged: main order + accepted upsells become ONE external order. split: each upsell is pushed as a
// separate external order tagged to the parent (dropship). Defaults to merged when unset.
export async function getFulfillmentMode(): Promise<FulfillmentMode> {
  const cfg = await getConfig<{ fulfillmentMode?: unknown }>('ecommerce.config');
  return cfg?.fulfillmentMode === 'split' ? 'split' : 'merged';
}
