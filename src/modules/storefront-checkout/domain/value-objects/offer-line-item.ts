import { Money } from '@/modules/shared-kernel/money';
import { ExternalRef } from '@/modules/shared-kernel/external-ref';
import { PriceSnapshot } from './price-snapshot';

export interface OfferLineItemProps {
  variantExternalId: ExternalRef;
  title: string;
  quantity: number;
  unitPrice: PriceSnapshot;
}

export class OfferLineItem {
  private constructor(private readonly props: OfferLineItemProps) {}

  static create(props: OfferLineItemProps): OfferLineItem {
    if (!Number.isInteger(props.quantity) || props.quantity <= 0) {
      throw new Error('OfferLineItem quantity must be a positive integer');
    }
    return new OfferLineItem({ ...props });
  }

  get variantExternalId() { return this.props.variantExternalId; }
  get title() { return this.props.title; }
  get quantity() { return this.props.quantity; }
  get unitPrice() { return this.props.unitPrice; }

  lineTotal(): Money {
    return this.props.unitPrice.amount.multiplyByFraction(this.props.quantity, 1);
  }
}
