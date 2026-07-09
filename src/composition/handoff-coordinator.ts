import { createLogger } from '@/lib/logger';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { makeSubmitHandoffService } from './make-commerce-gateway';
import type { FulfillmentMode } from '@/contracts/settings';
import type { SubmitHandoffCommand, HandoffResult } from '@/modules/commerce-gateway/application/ports/inbound';

const logger = createLogger('HandoffCoordinator');

export const PARENT_TAG_PREFIX = 'autonnel:parent:';

export interface IndependentUpsellLine {
  variantExternalId: string;
  quantity: number;
  unitPriceMinor: number;
  currencyCode: string;
}

export interface IndependentUpsellArgs {
  saleRef: string;
  upsellIndex: number;
  parentOrderNumber: string;
  line: IndependentUpsellLine;
  customer: Record<string, unknown>;
}

export interface HandoffSubmitPort {
  execute(command: SubmitHandoffCommand): Promise<HandoffResult>;
}

// One upsell line → one standalone external order, tagged to the parent autonnel order. A per-upsell
// idempotency key keeps a retry from creating a second sale-wide order.
export function buildIndependentUpsellCommand(tenantId: string, args: IndependentUpsellArgs): SubmitHandoffCommand {
  const { line } = args;
  return {
    saleRef: args.saleRef,
    idempotencyKey: `${tenantId}:${args.saleRef}:upsell:${args.upsellIndex}`,
    capturedTotalMinor: line.unitPriceMinor * line.quantity,
    currencyCode: line.currencyCode,
    lines: [{ variantRef: line.variantExternalId, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor, currencyCode: line.currencyCode }],
    customer: args.customer,
    tags: [`${PARENT_TAG_PREFIX}${args.parentOrderNumber}`],
  };
}

export async function pushIndependentUpsellHandoff(
  service: HandoffSubmitPort,
  tenantId: string,
  args: IndependentUpsellArgs,
): Promise<HandoffResult> {
  const result = await service.execute(buildIndependentUpsellCommand(tenantId, args));
  if (result.status !== 'succeeded') {
    throw new Error(`independent upsell handoff ${result.status} for sale ${args.saleRef} upsell ${args.upsellIndex}`);
  }
  logger.info('Independent upsell order pushed', {
    saleRef: args.saleRef, upsellIndex: args.upsellIndex, parentOrderNumber: args.parentOrderNumber, backendOrderRef: result.backendOrderRef,
  });
  return result;
}

// Wired entry used by the upsell endpoint and the split fan-out. Loads the active backend lazily.
export async function submitIndependentUpsell(args: IndependentUpsellArgs): Promise<void> {
  const service = await makeSubmitHandoffService();
  await pushIndependentUpsellHandoff(service, getCurrentTenantId(), args);
}

export interface SplitUpsell {
  upsellIndex: number;
  line: IndependentUpsellLine;
}

export interface SplitContext {
  orderNumber: string;
  customer: Record<string, unknown>;
  upsellLines: SplitUpsell[];
}

export interface HandoffForSaleDeps {
  getFulfillmentMode(): Promise<FulfillmentMode>;
  // Pushes ALL snapshot lines as a single external order (base + accepted upsells).
  runMergedHandoff(saleRef: string): Promise<void>;
  // Pushes only the base (non-upsell) snapshot lines as the main external order.
  runBaseOnlyHandoff(saleRef: string): Promise<void>;
  loadSplitContext(saleRef: string): Promise<SplitContext | null>;
  pushIndependentUpsell(args: IndependentUpsellArgs): Promise<void>;
}

// Single decision point for the commerce.handoff job. merged → one external order. split → a base-only
// main order plus one independent order per accepted upsell (tagged to the parent). A sale with no
// upsells is identical to merged regardless of mode, so it short-circuits there.
export async function executeHandoffForSale(saleRef: string, deps: HandoffForSaleDeps): Promise<void> {
  const mode = await deps.getFulfillmentMode();
  if (mode !== 'split') {
    await deps.runMergedHandoff(saleRef);
    return;
  }
  const ctx = await deps.loadSplitContext(saleRef);
  if (!ctx || ctx.upsellLines.length === 0) {
    await deps.runMergedHandoff(saleRef);
    return;
  }
  await deps.runBaseOnlyHandoff(saleRef);
  // Best-effort per upsell: a failed sub-order is logged but never blocks the others or the main order.
  for (const u of ctx.upsellLines) {
    try {
      await deps.pushIndependentUpsell({
        saleRef, upsellIndex: u.upsellIndex, parentOrderNumber: ctx.orderNumber, line: u.line, customer: ctx.customer,
      });
    } catch (err) {
      logger.error('split upsell push failed', { error: err, saleRef, upsellIndex: u.upsellIndex });
    }
  }
}
