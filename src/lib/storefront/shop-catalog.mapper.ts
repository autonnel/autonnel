import { readEnv } from '@/lib/runtime/env';
import type {
  StorefrontProductView,
  StorefrontVariantView,
} from '@/modules/commerce-gateway/application/ports/inbound';
import type { ShopProductDto, ShopVariantDto } from '@/contracts/shop';

const FALLBACK_CURRENCY = 'USD';

export function getDefaultCurrencyCode(): string {
  return (readEnv('DEFAULT_CURRENCY') || FALLBACK_CURRENCY).toUpperCase();
}

function minorToMajor(minor: number | null): number {
  return minor === null ? 0 : minor / 100;
}

function minorToMajorOrNull(minor: number | null): number | null {
  return minor === null ? null : minor / 100;
}

function toVariantDto(variant: StorefrontVariantView): ShopVariantDto {
  return {
    id: variant.ref,
    name: variant.title,
    price: minorToMajor(variant.priceMinor),
    comparePrice: variant.comparePriceMinor === null ? undefined : variant.comparePriceMinor / 100,
    thumbnail: variant.thumbnail ?? undefined,
  };
}

export function toShopProductDto(view: StorefrontProductView, fallbackCurrency: string): ShopProductDto {
  return {
    id: view.ref,
    name: view.title,
    // description is not persisted in the catalog projection; surfaced as null.
    description: null,
    thumbnail: view.thumbnail,
    price: minorToMajor(view.priceMinor),
    comparePrice: minorToMajorOrNull(view.comparePriceMinor),
    currency: view.currencyCode ?? fallbackCurrency,
    variants: view.variants.map(toVariantDto),
  };
}
