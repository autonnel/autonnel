import type { PlatformCapability } from '../../../domain/value-objects/platform-ref';

export const googleCapability: PlatformCapability = {
  platform: 'GOOGLE',
  apiVersion: 'v18',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  requiredConversionScopes: ['https://www.googleapis.com/auth/adwords'],
  standardEventNames: ['page_view', 'begin_checkout', 'add_payment_info', 'purchase'],
  dedupField: 'order_id',
};
