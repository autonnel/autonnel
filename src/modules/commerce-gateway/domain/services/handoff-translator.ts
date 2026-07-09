import { Money } from "../../../shared-kernel/money";
import { CapabilityProfile } from "../value-objects/capability-profile";
import type { HandoffLineSnapshot } from "../handoff";
import { HandoffTotalMismatchError } from "../errors";

export interface AppliedDiscountInput {
  amountMinor: number;
  currencyCode: string;
  code: string;
}

export interface TranslateInput {
  profile: CapabilityProfile;
  lines: HandoffLineSnapshot[];
  capturedTotal: Money;
  customer: Record<string, unknown>;
  appliedDiscount?: AppliedDiscountInput;
  tags?: string[];
}

export interface BackendDiscount {
  scope: "order" | "line_item";
  amountMinor: number;
  currencyCode: string;
  code: string;
}

export interface HandoffOrderInput {
  alreadyPaid: true;
  reauthorize: false;
  financialStatus: "paid";
  lines: HandoffLineSnapshot[];
  discount?: BackendDiscount;
  grandTotal: Money;
  customer: Record<string, unknown>;
  tags?: string[];
}

export class HandoffTranslator {
  toBackendInput(input: TranslateInput): HandoffOrderInput {
    const lineSubtotal = input.lines.reduce(
      (sum, l) => sum + l.unitPriceMinor * l.quantity,
      0,
    );
    const discountMinor = input.appliedDiscount?.amountMinor ?? 0;
    const expectedGrandTotal = lineSubtotal - discountMinor;

    // Invariant: captured total must reconcile with line subtotal minus discount.
    if (expectedGrandTotal !== input.capturedTotal.amountMinor) {
      throw new HandoffTotalMismatchError(input.capturedTotal.amountMinor, expectedGrandTotal);
    }

    const discount = input.appliedDiscount
      ? this.representDiscount(input.profile, input.appliedDiscount)
      : undefined;

    return {
      alreadyPaid: true,
      reauthorize: false,
      financialStatus: "paid",
      lines: input.lines,
      discount,
      grandTotal: input.capturedTotal,
      customer: input.customer,
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
    };
  }

  private representDiscount(
    profile: CapabilityProfile,
    discount: AppliedDiscountInput,
  ): BackendDiscount {
    const scope: BackendDiscount["scope"] =
      profile.handoffStrategy === "orderCreate" ? "order" : "line_item";
    return {
      scope,
      amountMinor: discount.amountMinor,
      currencyCode: discount.currencyCode,
      code: discount.code,
    };
  }
}
