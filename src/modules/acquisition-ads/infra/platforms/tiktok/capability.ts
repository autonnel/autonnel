import type { PlatformCapability } from '../../../domain/value-objects/platform-ref';

export const tiktokCapability: PlatformCapability = {
  platform: 'TIKTOK',
  apiVersion: 'v1.3',
  authorizeUrl: 'https://business-api.tiktok.com/portal/auth',
  tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
  requiredConversionScopes: ['user.info.basic', 'events.manage'],
  standardEventNames: ['Pageview', 'InitiateCheckout', 'AddPaymentInfo', 'CompletePayment'],
  dedupField: 'event_id',
};
