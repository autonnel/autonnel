import { ExternalRef } from "./value-objects/external-ref";
import { PresentmentPriceMap } from "./value-objects/presentment-price";
import { InventorySnapshot } from "./value-objects/inventory-snapshot";

export interface CatalogVariantViewProps {
  externalVariantRef: ExternalRef;
  title: string;
  sku?: string;
  presentmentPrices: PresentmentPriceMap;
  inventory: InventorySnapshot;
}

export class CatalogVariantView {
  private constructor(private readonly props: CatalogVariantViewProps) {}
  static create(props: CatalogVariantViewProps): CatalogVariantView {
    return new CatalogVariantView(props);
  }
  get externalVariantRef(): ExternalRef {
    return this.props.externalVariantRef;
  }
  get title(): string {
    return this.props.title;
  }
  get sku(): string | undefined {
    return this.props.sku;
  }
  get presentmentPrices(): PresentmentPriceMap {
    return this.props.presentmentPrices;
  }
  get inventory(): InventorySnapshot {
    return this.props.inventory;
  }
  hasResolvablePrice(): boolean {
    return !this.props.presentmentPrices.isEmpty();
  }
}

export type CatalogStatus = "active" | "archived" | "draft";

export interface CatalogProductViewProps {
  backendKind: string;
  externalProductRef: ExternalRef;
  title: string;
  status: CatalogStatus;
  mediaRefs: string[];
  variants: CatalogVariantView[];
  deletedAtSource?: Date | null;
}

export class CatalogProductView {
  private deletedAtSource: Date | null;
  private constructor(private readonly props: CatalogProductViewProps) {
    this.deletedAtSource = props.deletedAtSource ?? null;
  }
  static create(props: CatalogProductViewProps): CatalogProductView {
    return new CatalogProductView(props);
  }
  get backendKind(): string {
    return this.props.backendKind;
  }
  get externalProductRef(): ExternalRef {
    return this.props.externalProductRef;
  }
  get title(): string {
    return this.props.title;
  }
  get status(): CatalogStatus {
    return this.props.status;
  }
  get mediaRefs(): string[] {
    return this.props.mediaRefs;
  }
  get variants(): CatalogVariantView[] {
    return this.props.variants;
  }
  identityKey(): string {
    return `${this.props.backendKind}:${this.props.externalProductRef.toString()}`;
  }
  tombstone(at: Date): void {
    this.deletedAtSource = at;
  }
  isTombstoned(): boolean {
    return this.deletedAtSource !== null;
  }
  findVariant(ref: ExternalRef): CatalogVariantView | undefined {
    return this.props.variants.find((v) => v.externalVariantRef.equals(ref));
  }
}
