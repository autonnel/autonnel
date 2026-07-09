import { CatalogProductView, CatalogVariantView, type CatalogStatus } from "../../../domain/catalog-projection";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { Market } from "../../../domain/value-objects/market";
import { PresentmentPriceMap } from "../../../domain/value-objects/presentment-price";
import { InventorySnapshot, type InventoryPolicy } from "../../../domain/value-objects/inventory-snapshot";
import { Money } from "../../../../shared-kernel/money";

export interface WooImage {
  src: string;
}

export interface WooAttribute {
  name?: string;
  option?: string;
}

export interface WooVariation {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  image?: WooImage | null;
  attributes?: WooAttribute[];
}

export interface WooProduct {
  id: number;
  name: string;
  status?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  images?: WooImage[];
  variations?: number[];
}

function toMinor(amount: string | undefined): number {
  if (!amount) return 0;
  // Woo prices are decimal strings; assume 2-decimal currencies (the common case).
  return Math.round(parseFloat(amount) * 100);
}

function pickPriceAmount(p: { price?: string; regular_price?: string; sale_price?: string }): string | undefined {
  return p.price ?? p.regular_price ?? p.sale_price;
}

// regular_price is the strikethrough compare-at, but only when it is strictly above the
// current selling price (otherwise there is no discount to show).
function pickCompareAmount(
  p: { price?: string; regular_price?: string; sale_price?: string },
  currentAmount: string | undefined,
): string | undefined {
  if (!p.regular_price || !currentAmount) return undefined;
  return toMinor(p.regular_price) > toMinor(currentAmount) ? p.regular_price : undefined;
}

function mapStatus(status: string | undefined): CatalogStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "publish") return "active";
  if (s === "trash") return "archived";
  if (s === "draft" || s === "pending" || s === "private") return "draft";
  return "active";
}

// Woo "manage_stock" maps to the Shopify inventory-policy contract: tracked stock denies oversell.
function mapPolicy(manageStock: boolean | undefined): InventoryPolicy {
  if (manageStock === true) return "deny";
  if (manageStock === false) return "continue";
  return "unknown";
}

function variantName(node: WooVariation): string {
  const parts = (node.attributes ?? [])
    .map((a) => a.option)
    .filter((o): o is string => Boolean(o));
  return parts.length > 0 ? parts.join(" / ") : "Default";
}

function singleMarketPrices(
  amount: string | undefined,
  compareAmount: string | undefined,
  currency: string,
): PresentmentPriceMap {
  if (!amount) return PresentmentPriceMap.from([]);
  return PresentmentPriceMap.from([
    {
      market: Market.of(defaultCountryFor(currency), currency),
      price: Money.of(toMinor(amount), currency),
      compareAtPrice: compareAmount ? Money.of(toMinor(compareAmount), currency) : undefined,
    },
  ]);
}

// Woo is single-currency; we anchor its one market to a representative country for the currency.
function defaultCountryFor(currency: string): string {
  const c = currency.toUpperCase();
  const table: Record<string, string> = { USD: "US", EUR: "DE", GBP: "GB", CAD: "CA", AUD: "AU" };
  return table[c] ?? "US";
}

export function mapVariation(node: WooVariation, currency: string, now: Date): CatalogVariantView {
  const amount = pickPriceAmount(node);
  return CatalogVariantView.create({
    externalVariantRef: ExternalRef.of(String(node.id)),
    title: variantName(node),
    sku: node.sku || undefined,
    presentmentPrices: singleMarketPrices(amount, pickCompareAmount(node, amount), currency),
    inventory: InventorySnapshot.of(
      typeof node.stock_quantity === "number" ? node.stock_quantity : null,
      mapPolicy(node.manage_stock),
      now,
    ),
  });
}

// A simple (non-variable) Woo product is exposed as a single Default variant keyed by the product id.
function simpleVariant(node: WooProduct, currency: string, now: Date): CatalogVariantView {
  const amount = pickPriceAmount(node);
  return CatalogVariantView.create({
    externalVariantRef: ExternalRef.of(String(node.id)),
    title: "Default",
    sku: node.sku || undefined,
    presentmentPrices: singleMarketPrices(amount, pickCompareAmount(node, amount), currency),
    inventory: InventorySnapshot.of(
      typeof node.stock_quantity === "number" ? node.stock_quantity : null,
      mapPolicy(node.manage_stock),
      now,
    ),
  });
}

export function mapProduct(
  node: WooProduct,
  variations: WooVariation[],
  currency: string,
  now: Date,
): CatalogProductView {
  const mediaRefs = (node.images ?? []).map((img) => img.src).filter((u): u is string => Boolean(u));
  const variants =
    variations.length > 0
      ? variations.map((v) => mapVariation(v, currency, now))
      : [simpleVariant(node, currency, now)];
  return CatalogProductView.create({
    backendKind: "woocommerce",
    externalProductRef: ExternalRef.of(String(node.id)),
    title: node.name,
    status: mapStatus(node.status),
    mediaRefs,
    variants,
  });
}
