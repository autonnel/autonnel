import { Money } from "@/modules/shared-kernel/money";
import { OrderLifecycleState } from "./order-lifecycle-state";
import { FulfillmentStatus } from "./fulfillment-status";
import { TrackingInfo } from "./tracking-info";
import {
  OfferLineSnapshot,
  CustomerSnapshot,
  ContactSnapshot,
  RefundRecordRef,
  BackendOrderRef,
} from "./value-objects";
import type { AttributionSnapshot, SaleRef } from "./value-objects";
import { OrderLifecyclePolicy } from "./services/order-lifecycle-policy";
import { FulfillmentStatusReconciler } from "./services/fulfillment-status-reconciler";
import { orderEvent } from "./events";
import type { OrderDomainEvent, OrderDomainEventType } from "./events";

const policy = new OrderLifecyclePolicy();
const reconciler = new FulfillmentStatusReconciler();

export interface CreateOrderProps {
  id: string;
  orderNumber: string;
  saleRef: SaleRef;
  capturedTotal: Money;
  lines: OfferLineSnapshot[];
  customer: CustomerSnapshot;
  contact?: ContactSnapshot;
  backendOrderRef?: BackendOrderRef;
  attribution?: AttributionSnapshot;
  checkoutLanguage?: string | null;
}

export interface RehydrateOrderProps extends CreateOrderProps {
  state: OrderLifecycleState;
  tracking?: TrackingInfo;
  refunds: RefundRecordRef[];
  note?: string | null;
}

export interface FulfillmentInput {
  backendStatus: FulfillmentStatus;
  tracking: TrackingInfo;
}

export class Order {
  private _events: OrderDomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly orderNumber: string,
    readonly saleRef: SaleRef,
    private _capturedTotal: Money,
    private _lines: OfferLineSnapshot[],
    readonly customer: CustomerSnapshot,
    readonly contact: ContactSnapshot | undefined,
    private _state: OrderLifecycleState,
    private _tracking: TrackingInfo | undefined,
    private _refunds: RefundRecordRef[],
    public backendOrderRef: BackendOrderRef | undefined,
    readonly attribution: AttributionSnapshot | undefined,
    private _note: string | null,
    readonly checkoutLanguage: string | null,
  ) {}

  static createFromPaidSale(p: CreateOrderProps): Order {
    const order = new Order(
      p.id,
      p.orderNumber,
      p.saleRef,
      p.capturedTotal,
      p.lines,
      p.customer,
      p.contact,
      OrderLifecycleState.PAID,
      undefined,
      [],
      p.backendOrderRef,
      p.attribution,
      null,
      p.checkoutLanguage ?? null,
    );
    order.emit("OrderCreated");
    return order;
  }

  static rehydrate(p: RehydrateOrderProps): Order {
    return new Order(
      p.id,
      p.orderNumber,
      p.saleRef,
      p.capturedTotal,
      p.lines,
      p.customer,
      p.contact,
      p.state,
      p.tracking,
      p.refunds,
      p.backendOrderRef,
      p.attribution,
      p.note ?? null,
      p.checkoutLanguage ?? null,
    );
  }

  get capturedTotal(): Money {
    return this._capturedTotal;
  }
  get lines(): readonly OfferLineSnapshot[] {
    return this._lines;
  }
  get state(): OrderLifecycleState {
    return this._state;
  }
  get tracking(): TrackingInfo | undefined {
    return this._tracking;
  }
  get refunds(): readonly RefundRecordRef[] {
    return this._refunds;
  }
  get note(): string | null {
    return this._note;
  }

  setNote(note: string | null): void {
    this._note = note && note.trim().length > 0 ? note.trim() : null;
  }

  // Post-purchase upsell accepted: append the line and grow the captured total so the order
  // reflects the merged purchase. Idempotent on the line's externalRef+quantity is the caller's job.
  addUpsellLine(line: OfferLineSnapshot): void {
    this._lines = [...this._lines, line];
    this._capturedTotal = this._capturedTotal.add(line.lineTotal);
  }

  applyFulfillment(input: FulfillmentInput): boolean {
    const { target } = reconciler.reconcile({
      current: this._state,
      backendStatus: input.backendStatus,
      tracking: input.tracking,
    });
    if (target === null) return false;
    if (input.tracking.hasTracking()) this._tracking = input.tracking;
    this._state = target;
    this.emit(target === OrderLifecycleState.DELIVERED ? "OrderDelivered" : "OrderShipped");
    return true;
  }

  markDeliveredExternally(): boolean {
    const decision = policy.advanceFulfillment(this._state, OrderLifecycleState.DELIVERED);
    if (!decision.changed) return false;
    this._state = decision.next;
    this.emit("OrderDelivered");
    return true;
  }

  recordRefund(ref: RefundRecordRef): boolean {
    if (this._refunds.some((r) => r.transactionId === ref.transactionId)) return false;
    const cumulativeMinor =
      this._refunds.reduce((acc, r) => acc + r.amount.amountMinor, 0) + ref.amount.amountMinor;
    const cumulative = Money.of(cumulativeMinor, this.capturedTotal.currencyCode);
    const decision = policy.applyRefund(this._state, this.capturedTotal, cumulative);
    this._refunds = [...this._refunds, ref];
    if (!decision.changed) return false;
    this._state = decision.next;
    this.emit("OrderRefunded");
    return true;
  }

  pullEvents(): OrderDomainEvent[] {
    const out = this._events;
    this._events = [];
    return out;
  }

  private emit(type: OrderDomainEventType): void {
    this._events.push(orderEvent(type, this.id, this.saleRef, this._state));
  }
}
