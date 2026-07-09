import { describe, it, expect } from 'vitest';
import { BounceClassifier, ReceiptKind } from './bounce-classifier';
import { DispatchStatus, SuppressionReason } from '../value-objects';

describe('BounceClassifier', () => {
  const c = new BounceClassifier();

  it('hard bounce → Bounced transition + HardBounce suppression', () => {
    const out = c.classify(ReceiptKind.HARD_BOUNCE);
    expect(out.transition).toBe(DispatchStatus.BOUNCED);
    expect(out.suppress).toBe(SuppressionReason.HardBounce);
  });

  it('complaint → Complained transition + Complaint suppression', () => {
    const out = c.classify(ReceiptKind.COMPLAINT);
    expect(out.transition).toBe(DispatchStatus.COMPLAINED);
    expect(out.suppress).toBe(SuppressionReason.Complaint);
  });

  it('delivered → Delivered transition, no suppression', () => {
    const out = c.classify(ReceiptKind.DELIVERED);
    expect(out.transition).toBe(DispatchStatus.DELIVERED);
    expect(out.suppress).toBeUndefined();
  });

  it('soft bounce → no terminal transition, no suppression (treated as transient)', () => {
    const out = c.classify(ReceiptKind.SOFT_BOUNCE);
    expect(out.transition).toBeUndefined();
    expect(out.suppress).toBeUndefined();
  });

  it('open/click → engaged, no transition', () => {
    expect(c.classify(ReceiptKind.OPENED).engaged).toBe(true);
    expect(c.classify(ReceiptKind.CLICKED).engaged).toBe(true);
  });
});
