import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api/client';
import type { ShopProductDto, ShopProductListDto } from '@/contracts/shop';
import { useCheckoutCurrency, useLivePricing } from '../live-pricing';
import { hasPriceIn, type SelectedItem } from './product-selection-types';

export const CART_LINE_REJECTED_EVENT = 'autonnel:cartLineRejected';

interface PricedEntity {
  price: number;
  comparePrice?: number | null;
  priceCurrency?: string;
}

function findPriced(item: SelectedItem, products: ShopProductDto[]): PricedEntity | null {
  const product = products.find((p) => p.id === item.productId);
  if (!product) return null;
  if (item.id === product.id && product.variants.length === 0) return product;
  return product.variants.find((v) => v.id === item.id) ?? null;
}

const toMinor = (amount: number) => Math.round(amount * 100);
const RETRY_DELAY_MS = 800;

async function fetchLiveProducts(productIds: string[], currency: string): Promise<ShopProductDto[]> {
  const query = { productIds: productIds.join(','), regionId: currency || undefined };
  try {
    return ((await apiCall('GET /api/shop/products', null, { query })) as ShopProductListDto).products ?? [];
  } catch {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return ((await apiCall('GET /api/shop/products', null, { query })) as ShopProductListDto).products ?? [];
  }
}

// Line price = live unit price x quantity, exactly what the cart charges. An item without a
// price in the checkout currency is dropped; the stored editor price is never a fallback.
// A price of 0 in that currency is a sellable free gift.
export function priceSelectionLive(items: SelectedItem[], products: ShopProductDto[], currency: string): SelectedItem[] {
  const out: SelectedItem[] = [];
  for (const item of items) {
    const priced = findPriced(item, products);
    if (!priced || !priced.priceCurrency || !hasPriceIn(priced, currency) || !(priced.price >= 0)) continue;
    const quantity = item.quantity > 0 ? item.quantity : 1;
    const { comparePrice: _stored, ...rest } = item;
    const next: SelectedItem = {
      ...rest,
      price: (toMinor(priced.price) * quantity) / 100,
      currency: priced.priceCurrency.toUpperCase(),
    };
    if (priced.comparePrice && priced.comparePrice > priced.price) {
      next.comparePrice = (toMinor(priced.comparePrice) * quantity) / 100;
    }
    out.push(next);
  }
  return out;
}

export interface LiveSelection {
  items: SelectedItem[];
  currency: string;
  loading: boolean;
  live: boolean;
}

export function useLiveSelection(items: SelectedItem[], storedCurrency: string): LiveSelection {
  const live = useLivePricing();
  const currency = useCheckoutCurrency();
  const signature = JSON.stringify(items.map((i) => [i.id, i.productId, i.quantity]));
  const [state, setState] = useState<{ key: string; items: SelectedItem[] } | null>(null);
  const key = `${currency}|${signature}`;

  useEffect(() => {
    if (!live) return;
    let stale = false;
    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    if (productIds.length === 0) {
      setState({ key, items: [] });
      return;
    }
    fetchLiveProducts(productIds, currency)
      .then((products) => {
        if (!stale) setState({ key, items: priceSelectionLive(items, products, currency) });
      })
      .catch((err) => {
        console.error('Live price lookup failed:', err);
        if (!stale) setState({ key, items: [] });
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key]);

  if (!live) return { items, currency: storedCurrency, loading: false, live };
  const ready = state?.key === key;
  return { items: ready ? state.items : [], currency, loading: !ready, live };
}
