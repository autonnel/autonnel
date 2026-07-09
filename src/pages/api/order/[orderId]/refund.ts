import { defineRoute, ApiError } from "@/lib/api/define-route";
import { Money } from "@/modules/shared-kernel/money";
import type { RefundKind } from "@/modules/payments/domain/value-objects";
import { makePaymentsRefund } from "@/composition/make-payments";

export const POST = defineRoute(
  "POST /api/order/:orderId/refund",
  { feature: "ORDERS_REFUND" },
  async ({ params, input }) => {
    if (!input?.intentId || !input?.kind) throw new ApiError(400, "intentId and kind are required");
    const chargePart = input.chargeRef ?? "base";
    const idempotencyKey =
      input.idempotencyKey ??
      `refund:${params.orderId}:${chargePart}:${input.kind}:${input.fixedAmountMinor ?? input.percentage ?? "full"}`;
    return makePaymentsRefund().refund({
      intentId: input.intentId,
      kind: input.kind as RefundKind,
      fixedAmount:
        input.fixedAmountMinor != null
          ? Money.of(input.fixedAmountMinor, input.currencyCode ?? "USD")
          : undefined,
      percentage: input.percentage,
      reason: input.reason,
      idempotencyKey,
      chargeRef: input.chargeRef,
    });
  },
);
