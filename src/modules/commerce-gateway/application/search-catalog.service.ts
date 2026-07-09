import type { CatalogProjectionStorePort } from "./ports/outbound";
import { PurchasableAssembler } from "../domain/services/purchasable-assembler";
import type { Purchasable } from "../domain/value-objects/purchasable";
import { DEFAULT_MARKET } from "../domain/value-objects/market";

export class SearchCatalogService {
  constructor(
    private readonly store: CatalogProjectionStorePort,
    private readonly assembler: PurchasableAssembler,
  ) {}

  async execute(term: string, limit: number): Promise<Purchasable[]> {
    const products = await this.store.search(term, limit);
    const now = new Date();
    return products.flatMap((p) =>
      p.variants.map((v) => this.assembler.assemble(p, v, DEFAULT_MARKET, now)),
    );
  }
}
