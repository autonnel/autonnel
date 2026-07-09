// Money on catalog/coupon/tracking DTOs is decimal-major on the wire to match what
// the existing checkout JS already reads.
// Payment endpoints keep provider-specific raw-but-typed shapes (clientSecret for Stripe,
// redirectUrl/paypalOrderId for PayPal) because they are SDK handshakes / redirects, not
// clean read models. They are pinned here so the payment forms compile against the wire.
//
// Product/region shapes mirror the ecommerce-adapter projections the Puck ProductSelector
// editor consumes directly (rich variants + per-region pricing), which the collapsed DDD
// CatalogReadPort (Purchasable/Market) does NOT expose.

export interface ShopVariantDto {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  thumbnail?: string;
}

export interface ShopProductDto {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  price: number;
  comparePrice: number | null;
  currency: string;
  variants: ShopVariantDto[];
}

export interface ShopProductListDto {
  products: ShopProductDto[];
  regionId?: string | null;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  message?: string;
  error?: string;
}

export interface ShopProductSingleDto {
  product: ShopProductDto | null;
  regionId?: string | null;
}

export interface ShopRegionDto {
  id: string;
  name: string;
  currencyCode: string;
  countries: { id: string; iso2: string; name: string }[];
}

export interface ShopRegionListDto {
  regions: ShopRegionDto[];
  supportsMultiCurrency?: boolean;
}

export interface ShopCouponValidDto {
  valid: true;
  discount: number;
  discountType: string;
  discountValue: number;
  couponId: string;
  code: string;
}

export interface ShopCouponInvalidDto {
  valid: false;
  error: string;
}

export type ShopCouponDto = ShopCouponValidDto | ShopCouponInvalidDto;

export interface TrackedOrderItemDto {
  id: string;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface TrackedOrderShippingAddressDto {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface TrackedOrderDto {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  items: TrackedOrderItemDto[];
  total: number;
  currency: string;
  shippingAddress?: TrackedOrderShippingAddressDto;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingCompany?: string;
  shipmentStatus?: string;
}

export interface ShopOrderTrackingDto {
  orders: TrackedOrderDto[];
}

export interface ShopPaymentConfigDto {
  stripe: { publishableKey?: string; enabled: boolean } | null;
  paypal: { clientId?: string; enabled: boolean } | null;
}

export interface ShopUpsellInput {
  trackingId: string;
  parentOrderId: string;
  action: "accept" | "decline";
  productId?: string;
  variantId?: string;
  quantity?: number;
  upsellIndex?: number;
  funnelId?: string;
  pageId?: string;
}

export interface ShopUpsellDto {
  success: boolean;
  action?: "accepted" | "declined";
  order?: { id: string; orderNumber: string; total: number; currency: string; items: unknown };
  addedItem?: Record<string, unknown>;
  nextStepUrl?: string;
  error?: string;
}

export interface ShopStripePaymentInput {
  action: "confirm" | "finalize";
  orderId: string;
  trackingId: string;
  paymentMethodId?: string;
  paymentIntentId?: string;
  funnelId?: string;
  pageId?: string;
}

export interface ShopStripePaymentDto {
  success?: boolean;
  status?: string;
  orderId?: string;
  error?: string;
  code?: string;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  redirectUrl?: string;
}

export interface ShopPayPalPaymentInput {
  action: "create" | "approved" | "save-error";
  orderId: string;
  trackingId: string;
  paypalType?: string;
  paypalOrderId?: string;
  payerId?: string;
  skipAddressOverride?: boolean;
  error?: string;
  customerInfo?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  funnelId?: string;
  pageId?: string;
}

export interface ShopPayPalPaymentDto {
  success?: boolean;
  status?: string;
  orderId?: string;
  orderNumber?: string;
  paypalOrderId?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
}

export interface ShopPaymentCompleteInput {
  orderId: string;
  trackingId: string;
}

export interface ShopPaymentCompleteDto {
  success?: boolean;
  status?: string;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  currency?: string;
  message?: string;
  error?: string;
}

export interface ShopPaymentRedirectDto {
  success?: boolean;
  redirectUrl?: string;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export interface ShopContracts {
  "GET /api/shop/products": { input: null; output: ShopProductListDto | ShopProductSingleDto };
  "GET /api/shop/regions": { input: null; output: ShopRegionListDto };
  "GET /api/shop/coupon": { input: null; output: ShopCouponDto };
  "GET /api/shop/order-tracking": { input: null; output: ShopOrderTrackingDto };
  "GET /api/shop/payment-config": { input: null; output: ShopPaymentConfigDto };

  "POST /api/shop/upsell": { input: ShopUpsellInput; output: ShopUpsellDto };
  "POST /api/shop/payment/stripe": { input: ShopStripePaymentInput; output: ShopStripePaymentDto };
  "POST /api/shop/payment/paypal": { input: ShopPayPalPaymentInput; output: ShopPayPalPaymentDto };
  "POST /api/shop/payment/complete": { input: ShopPaymentCompleteInput; output: ShopPaymentCompleteDto };
  "GET /api/shop/payment/redirect": { input: null; output: ShopPaymentRedirectDto };
}
