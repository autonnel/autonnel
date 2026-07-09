import type { BackendOrderPort, BackendCatalogPort } from "./ports/outbound";
import { HandoffTranslator } from "../domain/services/handoff-translator";
import type { CommerceHandoffPort, SubmitHandoffCommand, HandoffResult } from "./ports/inbound";
import { Money } from "../../shared-kernel/money";
import { createLogger } from "../../../lib/logger";

const logger = createLogger("SubmitHandoff");

// idempotencyKey derivation stays per-context: hash(tenantId+saleId).
function deriveKey(tenantId: string, saleRef: string): string {
  return `${tenantId}:${saleRef}`;
}

export class SubmitHandoffService implements Pick<CommerceHandoffPort, "submitHandoff"> {
  constructor(
    private readonly backendOrder: BackendOrderPort,
    private readonly backendCatalog: BackendCatalogPort,
    private readonly translator: HandoffTranslator,
    private readonly events: { publish: (e: { type: string; payload: unknown }) => Promise<void> },
    private readonly currentTenantId: () => string,
  ) {}

  async submitHandoff(command: SubmitHandoffCommand): Promise<HandoffResult> {
    return this.execute(command);
  }

  async execute(command: SubmitHandoffCommand): Promise<HandoffResult> {
    const tenantId = this.currentTenantId();
    const idempotencyKey = command.idempotencyKey ?? deriveKey(tenantId, command.saleRef);
    const profile = this.backendCatalog.describeCapabilities();

    const input = this.translator.toBackendInput({
      profile,
      lines: command.lines,
      capturedTotal: Money.of(command.capturedTotalMinor, command.currencyCode),
      customer: command.customer,
      appliedDiscount: command.appliedDiscount,
      tags: command.tags,
    });

    try {
      const result = await this.backendOrder.createPaidOrder(input, idempotencyKey);
      const backendOrderRef = result.backendOrderRef.toString();
      await this.events.publish({ type: "HandoffSucceeded", payload: { saleRef: command.saleRef, backendOrderRef } });
      return { status: "succeeded", backendOrderRef };
    } catch (err) {
      logger.error("Backend order create failed", { error: err, saleRef: command.saleRef });
      await this.events.publish({ type: "HandoffFailed", payload: { saleRef: command.saleRef } });
      return { status: "failed" };
    }
  }
}
