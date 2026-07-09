import { Money } from '../../shared-kernel/money';
import { RefundKind } from './value-objects';

export interface CreateRefundTransactionProps {
  id: string;
  parentTransactionId: string;
  kind: RefundKind;
  amount: Money;
  reason?: string;
}

export class RefundTransaction {
  private constructor(
    public readonly id: string,
    public readonly parentTransactionId: string,
    public readonly kind: RefundKind,
    public readonly amount: Money,
    public readonly reason: string | undefined,
    private _providerRefundRef: string | undefined,
    private _acknowledged: boolean,
  ) {}

  static create(props: CreateRefundTransactionProps): RefundTransaction {
    if (!props.amount.isPositive()) throw new Error('RefundTransaction requires Money > 0');
    return new RefundTransaction(props.id, props.parentTransactionId, props.kind, props.amount, props.reason, undefined, false);
  }

  get providerRefundRef() { return this._providerRefundRef; }
  get acknowledged() { return this._acknowledged; }

  acknowledge(providerRefundRef: string): void {
    if (this._acknowledged) throw new Error('RefundTransaction is immutable once acknowledged');
    this._providerRefundRef = providerRefundRef;
    this._acknowledged = true;
  }
}
