import { Money } from '../../shared-kernel/money';
import {
  PaymentIntentStatus,
  PaymentIntentStateMachine,
} from './payment-intent-state-machine';
import {
  CaptureResult,
  ProviderRef,
  SaleRef,
  CaptureMethod,
} from './value-objects';
import type { PspSlug } from './value-objects';
import { IntentNotCapturedError } from './errors';

export interface RefundRecord {
  transactionId: string;
  amount: Money;
}

export interface CreatePaymentIntentProps {
  id: string;
  saleRef: SaleRef;
  provider: PspSlug;
  amount: Money;
  captureMethod: CaptureMethod;
  // Opaque blob owned by the checkout/handoff/order contexts; payments never reads it.
  checkoutSnapshot?: unknown;
}

const sm = new PaymentIntentStateMachine();

export class PaymentIntent {
  private constructor(
    public readonly id: string,
    public readonly saleRef: SaleRef,
    public readonly provider: PspSlug,
    public readonly amount: Money,
    public readonly captureMethod: CaptureMethod,
    private _status: PaymentIntentStatus,
    private _providerRef: ProviderRef | undefined,
    private _captureResult: CaptureResult | undefined,
    private _refundRecords: RefundRecord[],
    private readonly _checkoutSnapshot: unknown,
    private _stripeCustomerId: string | undefined,
    private _stripePaymentMethodId: string | undefined,
    private _captureDeferred: boolean,
    private _handoffDeferred: boolean,
  ) {}

  static create(props: CreatePaymentIntentProps): PaymentIntent {
    if (!props.amount.isPositive()) throw new Error('PaymentIntent requires Money > 0');
    return new PaymentIntent(
      props.id, props.saleRef, props.provider, props.amount, props.captureMethod,
      PaymentIntentStatus.REQUIRES_PAYMENT, undefined, undefined, [], props.checkoutSnapshot,
      undefined, undefined, false, false,
    );
  }

  static rehydrate(args: {
    id: string; saleRef: SaleRef; provider: PspSlug; amount: Money; captureMethod: CaptureMethod;
    status: PaymentIntentStatus; providerRef?: ProviderRef; captureResult?: CaptureResult; refundRecords: RefundRecord[];
    checkoutSnapshot?: unknown; stripeCustomerId?: string; stripePaymentMethodId?: string; captureDeferred?: boolean; handoffDeferred?: boolean;
  }): PaymentIntent {
    return new PaymentIntent(
      args.id, args.saleRef, args.provider, args.amount, args.captureMethod,
      args.status, args.providerRef, args.captureResult, args.refundRecords, args.checkoutSnapshot,
      args.stripeCustomerId, args.stripePaymentMethodId, args.captureDeferred ?? false, args.handoffDeferred ?? false,
    );
  }

  get status() { return this._status; }
  get checkoutSnapshot(): unknown { return this._checkoutSnapshot; }
  get providerRef() { return this._providerRef; }
  get captureResult() { return this._captureResult; }
  get refundRecords(): ReadonlyArray<RefundRecord> { return this._refundRecords; }
  get stripeCustomerId() { return this._stripeCustomerId; }
  get stripePaymentMethodId() { return this._stripePaymentMethodId; }
  get captureDeferred() { return this._captureDeferred; }
  get handoffDeferred() { return this._handoffDeferred; }

  // Saved payment method for off-session upsell charges; set incrementally (customer at create,
  // method after confirm).
  setStripeVault(args: { customerId?: string; paymentMethodId?: string }): void {
    if (args.customerId !== undefined) this._stripeCustomerId = args.customerId;
    if (args.paymentMethodId !== undefined) this._stripePaymentMethodId = args.paymentMethodId;
  }

  setCaptureDeferred(deferred: boolean): void {
    this._captureDeferred = deferred;
  }

  setHandoffDeferred(deferred: boolean): void {
    this._handoffDeferred = deferred;
  }

  bindProvider(ref: ProviderRef): void {
    if (this._providerRef) throw new Error('PaymentIntent already bound to a provider intent');
    this._providerRef = ref;
  }

  markProcessing(): void {
    sm.assertTransition(this._status, PaymentIntentStatus.PROCESSING);
    this._status = PaymentIntentStatus.PROCESSING;
  }

  markAuthorized(): void {
    sm.assertTransition(this._status, PaymentIntentStatus.AUTHORIZED);
    this._status = PaymentIntentStatus.AUTHORIZED;
  }

  markCaptured(result: CaptureResult): void {
    if (this._status === PaymentIntentStatus.CAPTURED &&
        this._captureResult?.providerChargeId === result.providerChargeId) {
      return; // idempotent replay
    }
    sm.assertTransition(this._status, PaymentIntentStatus.CAPTURED);
    this._status = PaymentIntentStatus.CAPTURED;
    this._captureResult = result;
  }

  markFailed(): void {
    sm.assertTransition(this._status, PaymentIntentStatus.FAILED);
    this._status = PaymentIntentStatus.FAILED;
  }

  markCanceled(): void {
    sm.assertTransition(this._status, PaymentIntentStatus.CANCELED);
    this._status = PaymentIntentStatus.CANCELED;
  }

  totalRefunded(): Money {
    return this._refundRecords.reduce(
      (acc, r) => acc.add(r.amount),
      Money.of(0, this.amount.currencyCode),
    );
  }

  recordRefund(record: RefundRecord): void {
    if (this._status !== PaymentIntentStatus.CAPTURED) throw new IntentNotCapturedError(this.id);
    this._refundRecords = [...this._refundRecords, record];
    // A refund leaves the intent in CAPTURED; lifecycle status lives on the Order.
  }
}
