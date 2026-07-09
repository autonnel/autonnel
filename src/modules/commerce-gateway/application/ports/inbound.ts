import type { Purchasable } from "../../domain/value-objects/purchasable";
import { Market } from "../../domain/value-objects/market";
import { ExternalRef } from "../../domain/value-objects/external-ref";
import { CapabilityProfile } from "../../domain/value-objects/capability-profile";

export interface ResolvePurchasablesQuery {
  variantRefs: ExternalRef[];
  market: Market;
}

export interface CatalogReadPort {
  resolvePurchasables(query: ResolvePurchasablesQuery): Promise<Purchasable[]>;
  searchCatalog(term: string, limit: number): Promise<Purchasable[]>;
  describeCapabilities(): Promise<CapabilityProfile>;
}

export interface StorefrontVariantView {
  ref: string;
  title: string;
  sku?: string;
  priceMinor: number | null;
  comparePriceMinor: number | null;
  currencyCode: string | null;
  thumbnail: string | null;
}

export interface StorefrontProductView {
  ref: string;
  title: string;
  status: string;
  thumbnail: string | null;
  mediaRefs: string[];
  priceMinor: number | null;
  comparePriceMinor: number | null;
  currencyCode: string | null;
  variants: StorefrontVariantView[];
}

export interface StorefrontCatalogQuery {
  limit: number;
  offset: number;
  currencyCode?: string;
  countryCode?: string;
}

export interface StorefrontCatalogListResult {
  products: StorefrontProductView[];
  hasMore: boolean;
}

// Rich, product-grouped read model for the storefront/Puck editor. Unlike the collapsed
// CatalogReadPort (Purchasable), this keeps variants grouped under their product and exposes
// the per-market presentment price resolved against the requested currency/country.
export interface StorefrontCatalogReadPort {
  list(query: StorefrontCatalogQuery): Promise<StorefrontCatalogListResult>;
  getByRef(ref: string, query: Omit<StorefrontCatalogQuery, "limit" | "offset">): Promise<StorefrontProductView | null>;
  search(term: string, query: StorefrontCatalogQuery): Promise<StorefrontProductView[]>;
  availableCurrencies(): Promise<string[]>;
}

export interface SubmitHandoffCommand {
  saleRef: string;
  capturedTotalMinor: number;
  currencyCode: string;
  lines: Array<{ variantRef: string; quantity: number; unitPriceMinor: number; currencyCode: string }>;
  customer: Record<string, unknown>;
  appliedDiscount?: { amountMinor: number; currencyCode: string; code: string };
  // Backend order tags (e.g. `autonnel:parent:<mainOrderNumber>` for split-fulfillment upsell orders).
  tags?: string[];
  // Overrides the saleRef-derived key so independent upsell pushes dedupe per upsell, not per sale.
  idempotencyKey?: string;
}

export interface HandoffResult {
  status: "succeeded" | "failed" | "abandoned" | "pending";
  backendOrderRef?: string;
}

export interface CommerceHandoffPort {
  submitHandoff(command: SubmitHandoffCommand): Promise<HandoffResult>;
  retryHandoff(saleRef: string): Promise<HandoffResult>;
}

export interface CatalogDelta {
  backendKind: string;
  changedProductRefs: string[];
  deletedProductRefs: string[];
}

export interface CatalogDeltaInboundPort {
  ingestDelta(delta: CatalogDelta): Promise<void>;
}

export type FulfillmentStatus = "unfulfilled" | "in_transit" | "delivered" | "unknown";

export interface BackendFulfillmentReadResult {
  status: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface BackendFulfillmentPort {
  readFulfillmentStatus(backendOrderRef: string): Promise<BackendFulfillmentReadResult>;
}
