import { OfferLineItem } from './value-objects/offer-line-item';
import { AppliedCoupon } from './value-objects/applied-coupon';
import { AttributionSnapshot } from './value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from './value-objects/funnel-snapshot-ref';
import { ContactHandle } from './value-objects/contact-handle';
import { BuyerContact } from './value-objects/buyer-contact';

class Cart {
  lines: OfferLineItem[] = [];
  coupon: AppliedCoupon | null = null;
}

export interface StartFunnelSessionProps {
  sessionId: string;
  tenantId: string;
  snapshotRef: FunnelSnapshotRef;
  stepSlugs: StepSlug[];
  attribution: AttributionSnapshot;
  entryStep: StepSlug;
}

export class FunnelSession {
  readonly cart = new Cart();
  private _currentStep: StepSlug;
  private _contactHandle: ContactHandle | null = null;
  private _linkedSaleId: string | null = null;
  private _buyer: BuyerContact | null = null;

  private constructor(
    readonly sessionId: string,
    readonly tenantId: string,
    readonly snapshotRef: FunnelSnapshotRef,
    private readonly stepValues: Set<string>,
    readonly attribution: AttributionSnapshot,
    entryStep: StepSlug,
  ) {
    this._currentStep = entryStep;
  }

  static start(props: StartFunnelSessionProps): FunnelSession {
    const values = new Set(props.stepSlugs.map((s) => s.value));
    if (!values.has(props.entryStep.value)) {
      throw new Error('entryStep must be in the pinned snapshot');
    }
    return new FunnelSession(
      props.sessionId,
      props.tenantId,
      props.snapshotRef,
      values,
      props.attribution,
      props.entryStep,
    );
  }

  get currentStep() { return this._currentStep; }
  get contactHandle() { return this._contactHandle; }
  get buyer(): BuyerContact | null { return this._buyer; }
  get linkedSaleId() { return this._linkedSaleId; }
  get stepSlugs(): string[] { return [...this.stepValues]; }

  attachBuyer(buyer: BuyerContact): void {
    this._buyer = buyer; // frozen at main-checkout submit; reused for one-click upsell
  }

  upsellBuyerContact(): BuyerContact {
    if (!this._buyer) throw new Error('Upsell requires the main-checkout buyer to be attached');
    return this._buyer;
  }

  moveTo(step: StepSlug): void {
    if (!this.stepValues.has(step.value)) {
      throw new Error('Target step is not in the pinned snapshot');
    }
    this._currentStep = step;
  }

  addLine(line: OfferLineItem): void {
    this.cart.lines.push(line);
  }

  applyCoupon(coupon: AppliedCoupon): void {
    this.cart.coupon = coupon; // at most one at a time
  }

  removeCoupon(): void {
    this.cart.coupon = null;
  }

  captureContact(handle: ContactHandle): void {
    this._contactHandle = handle; // computed-once upstream
  }

  linkSale(saleId: string): void {
    if (this._linkedSaleId && this._linkedSaleId !== saleId) {
      throw new Error('FunnelSession may spawn at most one in_progress Sale at a time');
    }
    this._linkedSaleId = saleId;
  }
}
