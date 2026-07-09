import { Money } from "../../../shared-kernel/money";
import { ExternalRef } from "./external-ref";
import { Market } from "./market";
import { Sellability } from "./sellability";

export interface Purchasable {
  productRef: ExternalRef;
  variantRef: ExternalRef;
  title: string;
  market: Market;
  price?: Money; // undefined => price_unavailable
  sellability: Sellability;
  mediaRefs: string[];
}
