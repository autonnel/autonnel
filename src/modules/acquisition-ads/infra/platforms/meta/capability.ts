import type { PlatformCapability } from '../../../domain/value-objects/platform-ref';

export const metaCapability: PlatformCapability = {
  platform: 'META',
  apiVersion: 'v21.0',
  authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  requiredConversionScopes: ['ads_management', 'business_management'],
  standardEventNames: ['PageView', 'ViewContent', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'],
  dedupField: 'event_id',
};
