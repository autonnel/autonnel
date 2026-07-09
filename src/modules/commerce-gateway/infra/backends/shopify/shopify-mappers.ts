import { CatalogProductView, CatalogVariantView, type CatalogStatus } from "../../../domain/catalog-projection";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { Market } from "../../../domain/value-objects/market";
import { PresentmentPriceMap } from "../../../domain/value-objects/presentment-price";
import { InventorySnapshot, type InventoryPolicy } from "../../../domain/value-objects/inventory-snapshot";
import { Money } from "../../../../shared-kernel/money";

export interface ShopifyVariantNode {
  id: string;
  title: string;
  sku?: string | null;
  inventoryQuantity?: number | null;
  inventoryPolicy?: string | null;
  inventoryItem?: { tracked?: boolean | null } | null;
  contextualPricing?: {
    price?: { amount: string; currencyCode: string } | null;
    compareAtPrice?: { amount: string; currencyCode: string } | null;
  } | null;
}

export interface ShopifyProductNode {
  id: string;
  title: string;
  status: string;
  media?: { nodes: Array<{ preview?: { image?: { url?: string } } }> };
  variants: { nodes: ShopifyVariantNode[] };
}

function toMinor(amount: string): number {
  // ISO money string "19.99" -> 1999 minor units (2-decimal assumption for the common case).
  return Math.round(parseFloat(amount) * 100);
}

function mapStatus(status: string): CatalogStatus {
  const s = status.toLowerCase();
  if (s === "active") return "active";
  if (s === "archived") return "archived";
  return "draft";
}

function mapPolicy(policy: string | null | undefined): InventoryPolicy {
  if (policy === "DENY") return "deny";
  if (policy === "CONTINUE") return "continue";
  return "unknown";
}

// Shopify variants whose inventory tracking is OFF are always sellable regardless of
// quantity (Shopify keeps availableForSale = true and reports inventoryQuantity 0).
// Model that as the "continue" policy so the sellability check does not mistake the
// reported 0 for out-of-stock.
function resolvePolicy(node: ShopifyVariantNode): InventoryPolicy {
  if (node.inventoryItem?.tracked === false) return "continue";
  return mapPolicy(node.inventoryPolicy);
}

export function mapVariant(node: ShopifyVariantNode, countryCode: string, now: Date): CatalogVariantView {
  const ctx = node.contextualPricing?.price;
  const compareCtx = node.contextualPricing?.compareAtPrice;
  const prices = ctx
    ? PresentmentPriceMap.from([
        {
          market: Market.of(countryCode, ctx.currencyCode),
          price: Money.of(toMinor(ctx.amount), ctx.currencyCode),
          compareAtPrice: compareCtx
            ? Money.of(toMinor(compareCtx.amount), compareCtx.currencyCode)
            : undefined,
        },
      ])
    : PresentmentPriceMap.from([]);
  return CatalogVariantView.create({
    externalVariantRef: ExternalRef.of(node.id),
    title: node.title,
    sku: node.sku ?? undefined,
    presentmentPrices: prices,
    inventory: InventorySnapshot.of(node.inventoryQuantity ?? null, resolvePolicy(node), now),
  });
}

export function mapProduct(node: ShopifyProductNode, countryCode: string, now: Date): CatalogProductView {
  const mediaRefs = (node.media?.nodes ?? [])
    .map((m) => m.preview?.image?.url)
    .filter((u): u is string => Boolean(u));
  return CatalogProductView.create({
    backendKind: "shopify",
    externalProductRef: ExternalRef.of(node.id),
    title: node.title,
    status: mapStatus(node.status),
    mediaRefs,
    variants: node.variants.nodes.map((v) => mapVariant(v, countryCode, now)),
  });
}
