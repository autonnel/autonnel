import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '@/lib/api/client';
import {
  EVENT,
  SAMPLE_CART,
  emit,
  inTenant,
  tenantId,
  type AppliedCoupon,
  type SelectedProduct,
  type Translate,
} from './types';

export function useSelectedProducts() {
  const [products, setProducts] = useState<SelectedProduct[]>([]);
  const [currency, setCurrency] = useState<string | undefined>();

  useEffect(() => {
    const onSelected = (event: CustomEvent) => {
      const detail = event.detail || {};
      setProducts(detail.products || []);
      if (detail.currency) setCurrency(detail.currency);
    };
    const listener = onSelected as EventListener;

    window.addEventListener(EVENT.productsSelected, listener);

    if (inTenant()) {
      emit(EVENT.requestSelection);
    } else {
      setProducts(SAMPLE_CART);
    }

    return () => window.removeEventListener(EVENT.productsSelected, listener);
  }, []);

  return { products, currency };
}

export function useExternalCouponEvents(
  setAppliedCoupon: (coupon: AppliedCoupon | null) => void,
  clearCodeAndError: () => void,
) {
  useEffect(() => {
    const onApplied = (event: CustomEvent) => {
      const { couponId, code, discount, discountType, discountValue } = event.detail || {};
      if (!code || discount === undefined) return;
      setAppliedCoupon({ code, discount, couponId, discountType, discountValue });
      clearCodeAndError();
    };
    const onRemoved = () => {
      setAppliedCoupon(null);
      clearCodeAndError();
    };
    const appliedListener = onApplied as EventListener;

    window.addEventListener(EVENT.couponApplied, appliedListener);
    window.addEventListener(EVENT.couponRemoved, onRemoved);
    return () => {
      window.removeEventListener(EVENT.couponApplied, appliedListener);
      window.removeEventListener(EVENT.couponRemoved, onRemoved);
    };
  }, [clearCodeAndError, setAppliedCoupon]);
}

export function useCouponState(subtotal: number, t: Translate) {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);

  const clearEntry = useCallback(() => {
    setCouponCode('');
    setCouponError('');
  }, []);

  const applyCoupon = useCallback(
    async (codeOverride?: string) => {
      const code = (codeOverride ?? couponCode).trim();
      if (!code) return;

      setApplying(true);
      setCouponError('');

      const id = tenantId();
      try {
        if (id) {
          const data = await apiCall('GET /api/shop/coupon', null, { query: { code, subtotal } });
          if (data.valid) {
            const applied: AppliedCoupon = {
              code: data.code || code,
              discount: data.discount ?? 0,
              couponId: data.couponId,
              discountType: data.discountType,
              discountValue: data.discountValue,
            };
            setAppliedCoupon(applied);
            setCouponCode('');
            emit(EVENT.couponApplied, applied);
          } else {
            setCouponError(data.error || t('orderSummary.invalidCoupon'));
          }
        } else if (code.toLowerCase() === 'save10') {
          setAppliedCoupon({ code, discount: subtotal * 0.1 });
          setCouponCode('');
        } else {
          setCouponError(t('orderSummary.invalidCoupon'));
        }
      } catch {
        setCouponError(t('orderSummary.couponFailed'));
      } finally {
        setApplying(false);
      }
    },
    [couponCode, subtotal, t],
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError('');
    emit(EVENT.couponRemoved);
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('coupon');
    if (fromUrl && !appliedCoupon) applyCoupon(fromUrl);
  }, []);

  useExternalCouponEvents(setAppliedCoupon, clearEntry);

  return {
    couponCode,
    setCouponCode,
    appliedCoupon,
    couponError,
    applying,
    applyCoupon,
    removeCoupon,
  };
}

export function useOrderSummaryEvent(
  subtotal: number,
  discount: number,
  total: number,
  coupon: AppliedCoupon | null,
) {
  useEffect(() => {
    emit(EVENT.summaryChange, {
      subtotal,
      discount,
      total,
      coupon,
      couponId: coupon?.couponId || null,
      couponCode: coupon?.code || null,
    });
  }, [coupon, discount, subtotal, total]);
}
