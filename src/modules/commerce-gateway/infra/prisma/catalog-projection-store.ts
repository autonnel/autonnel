import type {
  CatalogProjectionStorePort,
  CatalogProjectionListResult,
} from "../../application/ports/outbound";
import { CatalogProductView, CatalogVariantView } from "../../domain/catalog-projection";
import { ExternalRef } from "../../domain/value-objects/external-ref";
import { PresentmentPriceMap } from "../../domain/value-objects/presentment-price";
import { InventorySnapshot, type InventoryPolicy } from "../../domain/value-objects/inventory-snapshot";
import { Market } from "../../domain/value-objects/market";
import { Money } from "../../../shared-kernel/money";
import { getCurrentTenantId } from "../../../../lib/tenant/context";

type Client = ReturnType<typeof import("../../../platform/infra/prisma-tenant-extension").getTenantPrisma>;

// tenantId is auto-injected by the Prisma extension on writes; the upsert where clause needs
// the compound key, so the scope tenantId is read from ALS (never a literal) — the extension does
// not inject into upsert.where.
export class PrismaCatalogProjectionStore implements CatalogProjectionStorePort {
  constructor(private readonly db: Client | any) {}

  async upsertProducts(products: CatalogProductView[]): Promise<void> {
    const tenantId = getCurrentTenantId();
    for (const p of products) {
      await this.db.catalogProductView.upsert({
        where: {
          tenantId_backendKind_externalProductRef: {
            tenantId,
            backendKind: p.backendKind,
            externalProductRef: p.externalProductRef.toString(),
          },
        },
        create: {
          backendKind: p.backendKind,
          externalProductRef: p.externalProductRef.toString(),
          title: p.title,
          status: p.status,
          mediaRefs: p.mediaRefs,
          syncedAt: new Date(),
          variants: { create: p.variants.map((v) => toVariantRow(v, tenantId)) },
        },
        update: {
          title: p.title,
          status: p.status,
          mediaRefs: p.mediaRefs,
          syncedAt: new Date(),
          deletedAtSource: null,
        },
      });
    }
  }

  async tombstoneProducts(productRefs: ExternalRef[], at: Date): Promise<void> {
    await this.db.catalogProductView.updateMany({
      where: { externalProductRef: { in: productRefs.map((r) => r.toString()) } },
      data: { deletedAtSource: at },
    });
  }

  async tombstoneStaleProducts(syncedBefore: Date, at: Date): Promise<void> {
    await this.db.catalogProductView.updateMany({
      where: { deletedAtSource: null, syncedAt: { lt: syncedBefore } },
      data: { deletedAtSource: at },
    });
  }

  async findByVariantRefs(variantRefs: ExternalRef[]): Promise<CatalogProductView[]> {
    const rows = await this.db.catalogProductView.findMany({
      where: { variants: { some: { externalVariantRef: { in: variantRefs.map((r) => r.toString()) } } } },
      include: { variants: true },
    });
    return rows.map(toDomainProduct);
  }

  async search(term: string, limit: number): Promise<CatalogProductView[]> {
    const rows = await this.db.catalogProductView.findMany({
      where: { title: { contains: term, mode: "insensitive" }, deletedAtSource: null },
      include: { variants: true },
      take: limit,
    });
    return rows.map(toDomainProduct);
  }

  async listProducts(limit: number, offset: number): Promise<CatalogProjectionListResult> {
    const rows = await this.db.catalogProductView.findMany({
      where: { deletedAtSource: null },
      include: { variants: true },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    return { products: rows.slice(0, limit).map(toDomainProduct), hasMore };
  }

  async findByProductRef(productRef: ExternalRef): Promise<CatalogProductView | null> {
    const row = await this.db.catalogProductView.findFirst({
      where: { externalProductRef: productRef.toString(), deletedAtSource: null },
      include: { variants: true },
    });
    return row ? toDomainProduct(row) : null;
  }

  async distinctCurrencyCodes(scanLimit: number): Promise<string[]> {
    const rows = await this.db.catalogVariantView.findMany({
      select: { presentmentPrices: true },
      take: scanLimit,
    });
    const codes = new Set<string>();
    for (const row of rows) {
      const prices = (row.presentmentPrices as Array<{ currencyCode?: string }> | null) ?? [];
      for (const p of prices) {
        if (p?.currencyCode) codes.add(p.currencyCode.toUpperCase());
      }
    }
    return Array.from(codes);
  }
}

function toVariantRow(v: CatalogVariantView, tenantId: string) {
  return {
    tenantId,
    externalVariantRef: v.externalVariantRef.toString(),
    title: v.title,
    sku: v.sku ?? null,
    presentmentPrices: serializePrices(v.presentmentPrices),
    inventoryAvailable: v.inventory.available,
    inventoryPolicy: v.inventory.policy,
    inventoryAsOf: v.inventory.asOf,
  };
}

interface PriceEntry {
  price: Money;
  compareAtPrice?: Money;
}

function serializePrices(map: PresentmentPriceMap): unknown {
  // stored as [{ countryCode, currencyCode, amountMinor, compareAtMinor? }]; reconstructed on read
  const byKey = (map as unknown as { byKey: Map<string, PriceEntry> }).byKey;
  return byKey
    ? Array.from(byKey.entries()).map(([key, entry]) => {
        const [countryCode, currencyCode] = key.split(":");
        return {
          countryCode,
          currencyCode,
          amountMinor: entry.price.amountMinor,
          ...(entry.compareAtPrice ? { compareAtMinor: entry.compareAtPrice.amountMinor } : {}),
        };
      })
    : [];
}

function toDomainProduct(row: any): CatalogProductView {
  const now = new Date();
  return CatalogProductView.create({
    backendKind: row.backendKind,
    externalProductRef: ExternalRef.of(row.externalProductRef),
    title: row.title,
    status: row.status,
    mediaRefs: (row.mediaRefs as string[]) ?? [],
    deletedAtSource: row.deletedAtSource,
    variants: (row.variants ?? []).map((v: any) =>
      CatalogVariantView.create({
        externalVariantRef: ExternalRef.of(v.externalVariantRef),
        title: v.title,
        sku: v.sku ?? undefined,
        presentmentPrices: PresentmentPriceMap.from(
          (v.presentmentPrices as Array<{ countryCode: string; currencyCode: string; amountMinor: number; compareAtMinor?: number }>).map((p) => ({
            market: Market.of(p.countryCode, p.currencyCode),
            price: Money.of(p.amountMinor, p.currencyCode),
            compareAtPrice:
              typeof p.compareAtMinor === "number" ? Money.of(p.compareAtMinor, p.currencyCode) : undefined,
          })),
        ),
        inventory: InventorySnapshot.of(v.inventoryAvailable, v.inventoryPolicy as InventoryPolicy, v.inventoryAsOf ?? now),
      }),
    ),
  });
}
