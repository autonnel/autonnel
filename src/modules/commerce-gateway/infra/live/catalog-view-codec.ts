// JSON codec for CatalogProductView so the live catalog cache can live in the shared cache
// adapter (Cloudflare KV in production) instead of a per-isolate Map. On workerd an in-process
// cache is nearly always cold — isolates are short-lived and numerous — so every request paid a
// full upstream catalog fetch. The shared cache makes the TTL actually mean something.
import { CatalogProductView, CatalogVariantView } from "../../domain/catalog-projection";
import { ExternalRef } from "../../domain/value-objects/external-ref";
import { Market } from "../../domain/value-objects/market";
import { PresentmentPriceMap } from "../../domain/value-objects/presentment-price";
import { InventorySnapshot, type InventoryPolicy } from "../../domain/value-objects/inventory-snapshot";
import { Money } from "../../../shared-kernel/money";

interface PriceEntry {
  price: Money;
  compareAtPrice?: Money;
}

export interface SerializedPrice {
  countryCode: string;
  currencyCode: string;
  amountMinor: number;
  compareAtMinor?: number;
}

export interface SerializedVariant {
  externalVariantRef: string;
  title: string;
  sku?: string;
  presentmentPrices: SerializedPrice[];
  // null means "quantity unknown" (InventorySnapshot.isKnown()); it must survive the round trip,
  // otherwise an unknown stock level would decode as 0 and read as out of stock.
  inventoryAvailable: number | null;
  inventoryPolicy: string;
  inventoryAsOf: string;
}

export interface SerializedProduct {
  backendKind: string;
  externalProductRef: string;
  title: string;
  status: string;
  mediaRefs: string[];
  deletedAtSource: string | null;
  variants: SerializedVariant[];
}

function serializePrices(map: PresentmentPriceMap): SerializedPrice[] {
  const byKey = (map as unknown as { byKey: Map<string, PriceEntry> }).byKey;
  if (!byKey) return [];
  return Array.from(byKey.entries()).map(([key, entry]) => {
    const [countryCode, currencyCode] = key.split(":");
    return {
      countryCode,
      currencyCode,
      amountMinor: entry.price.amountMinor,
      ...(entry.compareAtPrice ? { compareAtMinor: entry.compareAtPrice.amountMinor } : {}),
    };
  });
}

export function encodeProduct(p: CatalogProductView): SerializedProduct {
  return {
    backendKind: p.backendKind,
    externalProductRef: p.externalProductRef.toString(),
    title: p.title,
    status: p.status,
    mediaRefs: p.mediaRefs ?? [],
    deletedAtSource: p.isTombstoned() ? new Date().toISOString() : null,
    variants: p.variants.map((v) => ({
      externalVariantRef: v.externalVariantRef.toString(),
      title: v.title,
      sku: v.sku ?? undefined,
      presentmentPrices: serializePrices(v.presentmentPrices),
      inventoryAvailable: v.inventory.available,
      inventoryPolicy: v.inventory.policy,
      inventoryAsOf: v.inventory.asOf.toISOString(),
    })),
  };
}

export function decodeProduct(row: SerializedProduct): CatalogProductView {
  return CatalogProductView.create({
    backendKind: row.backendKind,
    externalProductRef: ExternalRef.of(row.externalProductRef),
    title: row.title,
    status: row.status as never,
    mediaRefs: row.mediaRefs ?? [],
    deletedAtSource: row.deletedAtSource ? new Date(row.deletedAtSource) : null,
    variants: (row.variants ?? []).map((v) =>
      CatalogVariantView.create({
        externalVariantRef: ExternalRef.of(v.externalVariantRef),
        title: v.title,
        sku: v.sku ?? undefined,
        presentmentPrices: PresentmentPriceMap.from(
          (v.presentmentPrices ?? []).map((p) => ({
            market: Market.of(p.countryCode, p.currencyCode),
            price: Money.of(p.amountMinor, p.currencyCode),
            compareAtPrice:
              typeof p.compareAtMinor === "number" ? Money.of(p.compareAtMinor, p.currencyCode) : undefined,
          })),
        ),
        inventory: InventorySnapshot.of(
          v.inventoryAvailable,
          v.inventoryPolicy as InventoryPolicy,
          new Date(v.inventoryAsOf),
        ),
      }),
    ),
  });
}
