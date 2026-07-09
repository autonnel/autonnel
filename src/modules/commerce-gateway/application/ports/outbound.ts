import { CatalogProductView } from "../../domain/catalog-projection";
import { SyncCursor } from "../../domain/value-objects/sync-cursor";
import { ExternalRef } from "../../domain/value-objects/external-ref";
import { Market } from "../../domain/value-objects/market";
import type { Purchasable } from "../../domain/value-objects/purchasable";
import { CapabilityProfile } from "../../domain/value-objects/capability-profile";
import type { HandoffOrderInput } from "../../domain/services/handoff-translator";
import type { BackendFulfillmentReadResult } from "./inbound";

export interface CatalogPage {
  products: CatalogProductView[];
  nextCursor: SyncCursor | null;
}

export interface BackendCatalogPort {
  listProducts(cursor: SyncCursor, pageSize: number): Promise<CatalogPage>;
  getProduct(productRef: ExternalRef): Promise<CatalogProductView | null>;
  getVariants(productRef: ExternalRef): Promise<CatalogProductView | null>;
  contextualPrices(productRef: ExternalRef, market: Market): Promise<CatalogProductView | null>;
  getInventory(variantRefs: ExternalRef[]): Promise<Map<string, number | null>>;
  describeCapabilities(): CapabilityProfile;
}

export interface BackendOrderCreateResult {
  backendOrderRef: ExternalRef;
}

export interface BackendOrderPort {
  createPaidOrder(input: HandoffOrderInput, idempotencyKey: string): Promise<BackendOrderCreateResult>;
}

export interface BackendFulfillmentReaderPort {
  readFulfillment(backendOrderRef: ExternalRef): Promise<BackendFulfillmentReadResult>;
}

export interface ProjectionUpsert {
  product: CatalogProductView;
}

export interface CatalogProjectionListResult {
  products: CatalogProductView[];
  hasMore: boolean;
}

export interface CatalogProjectionStorePort {
  upsertProducts(products: CatalogProductView[]): Promise<void>;
  tombstoneProducts(productRefs: ExternalRef[], at: Date): Promise<void>;
  tombstoneStaleProducts(syncedBefore: Date, at: Date): Promise<void>;
  findByVariantRefs(variantRefs: ExternalRef[]): Promise<CatalogProductView[]>;
  search(term: string, limit: number): Promise<CatalogProductView[]>;
  listProducts(limit: number, offset: number): Promise<CatalogProjectionListResult>;
  findByProductRef(productRef: ExternalRef): Promise<CatalogProductView | null>;
  distinctCurrencyCodes(scanLimit: number): Promise<string[]>;
}

export interface BackendCredentials {
  backendKind: string;
  shopDomain?: string;
  accessToken: string;
  disableNotifications: boolean;
  isActive: boolean;
  siteUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  apiVersion?: string;
}

export interface BackendCredentialsPort {
  load(): Promise<BackendCredentials | null>;
}
