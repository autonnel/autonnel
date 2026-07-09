import { useTranslation } from '../../LanguageContext';

export type Translate = ReturnType<typeof useTranslation>;

export interface SelectedProduct {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  name: string;
  productName?: string;
  thumbnail?: string;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  couponId?: string;
  discountType?: string;
  discountValue?: number;
}

export interface MoneyContext {
  currency?: string;
  borderColor: string;
  // Optional theme overrides — when set, parts use these instead of the default
  // light PALETTE so the card renders correctly on dark/neon surfaces.
  textColor?: string;
  mutedColor?: string;
  successColor?: string;
}

export const EVENT = {
  productsSelected: 'autonnel:productsSelected',
  requestSelection: 'autonnel:requestProductSelection',
  couponApplied: 'autonnel:couponApplied',
  couponRemoved: 'autonnel:couponRemoved',
  summaryChange: 'autonnel:orderSummaryChange',
} as const;

export const PALETTE = {
  ink: '#111827',
  slate: '#6b7280',
  faint: '#9ca3af',
  green: '#16a34a',
  greenDark: '#15803d',
  red: '#ef4444',
  field: '#333333',
};

export const SAMPLE_CART: SelectedProduct[] = [
  {
    productId: 'demo-1',
    variantId: 'v1',
    quantity: 1,
    price: 89.99,
    name: 'Premium Bundle - 3 Month Supply',
    productName: 'Premium Bundle - 3 Month Supply',
    thumbnail: 'https://placehold.co/64x64/e2e8f0/475569?text=Product',
  },
];

export const tenantId = (): string | undefined => (window as any).__AUTONNEL_TENANT_ID__;
export const inTenant = (): boolean => Boolean(tenantId());

export const emit = (name: string, detail?: unknown) =>
  window.dispatchEvent(new CustomEvent(name, detail === undefined ? undefined : { detail }));

export function sumPrices(items: SelectedProduct[]): number {
  let acc = 0;
  for (const it of items) acc += it.price;
  return acc;
}

export function resolveDiscount(coupon: AppliedCoupon | null, subtotal: number): number {
  if (!coupon) return 0;

  const hasRule = subtotal > 0 && Boolean(coupon.discountType) && Boolean(coupon.discountValue);
  if (!hasRule) return coupon.discount;

  const baseCents = Math.round(subtotal * 100);
  const rawCents =
    coupon.discountType === 'PERCENTAGE'
      ? Math.floor((baseCents * (coupon.discountValue as number)) / 100)
      : Math.round((coupon.discountValue as number) * 100);
  const capped = Math.min(rawCents, Math.max(baseCents - 1, 0));
  return capped / 100;
}
