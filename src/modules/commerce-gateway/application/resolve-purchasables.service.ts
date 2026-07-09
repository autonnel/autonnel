import type { CatalogProjectionStorePort } from "./ports/outbound";
import { PurchasableAssembler } from "../domain/services/purchasable-assembler";
import type { ResolvePurchasablesQuery } from "./ports/inbound";
import type { Purchasable } from "../domain/value-objects/purchasable";

export class ResolvePurchasablesService {
  constructor(
    private readonly store: CatalogProjectionStorePort,
    private readonly assembler: PurchasableAssembler,
  ) {}

  async execute(query: ResolvePurchasablesQuery): Promise<Purchasable[]> {
    const products = await this.store.findByVariantRefs(query.variantRefs);
    const now = new Date();
    const out: Purchasable[] = [];
    for (const ref of query.variantRefs) {
      for (const product of products) {
        const variant = product.findVariant(ref);
        if (variant) {
          out.push(this.assembler.assemble(product, variant, query.market, now));
        }
      }
    }
    return out;
  }
}
