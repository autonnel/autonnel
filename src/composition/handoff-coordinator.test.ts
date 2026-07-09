import { describe, it, expect, vi } from 'vitest';

// The coordinator module imports the wired backend factory + tenant context only for the
// submitIndependentUpsell convenience; stub them so importing the pure orchestration is side-effect free.
vi.mock('@/composition/make-commerce-gateway', () => ({ makeSubmitHandoffService: vi.fn() }));
vi.mock('@/lib/tenant/context', () => ({ getCurrentTenantId: () => 'default' }));

import {
  buildIndependentUpsellCommand,
  pushIndependentUpsellHandoff,
  executeHandoffForSale,
  PARENT_TAG_PREFIX,
  type HandoffForSaleDeps,
  type SplitContext,
} from './handoff-coordinator';
import type { SubmitHandoffCommand } from '@/modules/commerce-gateway/application/ports/inbound';
import type { FulfillmentMode } from '@/contracts/settings';

const upsellArgs = {
  saleRef: 'sale_1',
  upsellIndex: 2,
  parentOrderNumber: 'A100',
  line: { variantExternalId: 'v9', quantity: 3, unitPriceMinor: 1500, currencyCode: 'USD' },
  customer: { fullName: 'Ada', email: 'ada@example.com' },
};

describe('buildIndependentUpsellCommand', () => {
  it('produces a single-line command tagged to the parent with a per-upsell idempotency key', () => {
    const cmd = buildIndependentUpsellCommand('default', upsellArgs);
    expect(cmd.tags).toEqual([`${PARENT_TAG_PREFIX}A100`]);
    expect(cmd.idempotencyKey).toBe('default:sale_1:upsell:2');
    expect(cmd.lines).toEqual([{ variantRef: 'v9', quantity: 3, unitPriceMinor: 1500, currencyCode: 'USD' }]);
    expect(cmd.capturedTotalMinor).toBe(4500); // 1500 * 3
    expect(cmd.currencyCode).toBe('USD');
    expect(cmd.customer).toEqual({ fullName: 'Ada', email: 'ada@example.com' });
  });
});

describe('pushIndependentUpsellHandoff', () => {
  it('submits the tagged command and returns the result on success', async () => {
    const service = { execute: vi.fn(async (_cmd: SubmitHandoffCommand) => ({ status: 'succeeded' as const, backendOrderRef: 'ext_up' })) };
    const result = await pushIndependentUpsellHandoff(service, 'default', upsellArgs);
    expect(result.backendOrderRef).toBe('ext_up');
    const cmd = service.execute.mock.calls[0]![0];
    expect(cmd.tags).toEqual([`${PARENT_TAG_PREFIX}A100`]);
  });

  it('throws when the backend handoff does not succeed (so the job retries)', async () => {
    const service = { execute: vi.fn(async (_cmd: SubmitHandoffCommand) => ({ status: 'failed' as const })) };
    await expect(pushIndependentUpsellHandoff(service, 'default', upsellArgs)).rejects.toThrow(/independent upsell handoff failed/);
  });
});

function makeDeps(overrides: Partial<HandoffForSaleDeps>): {
  deps: HandoffForSaleDeps;
  calls: { merged: string[]; baseOnly: string[]; independent: unknown[] };
} {
  const calls = { merged: [] as string[], baseOnly: [] as string[], independent: [] as unknown[] };
  const deps: HandoffForSaleDeps = {
    getFulfillmentMode: vi.fn(async (): Promise<FulfillmentMode> => 'merged'),
    runMergedHandoff: vi.fn(async (saleRef: string) => { calls.merged.push(saleRef); }),
    runBaseOnlyHandoff: vi.fn(async (saleRef: string) => { calls.baseOnly.push(saleRef); }),
    loadSplitContext: vi.fn(async () => null),
    pushIndependentUpsell: vi.fn(async (args) => { calls.independent.push(args); }),
    ...overrides,
  };
  return { deps, calls };
}

const splitCtx: SplitContext = {
  orderNumber: 'A100',
  customer: { fullName: 'Ada' },
  upsellLines: [
    { upsellIndex: 0, line: { variantExternalId: 'u0', quantity: 1, unitPriceMinor: 1000, currencyCode: 'USD' } },
    { upsellIndex: 1, line: { variantExternalId: 'u1', quantity: 2, unitPriceMinor: 500, currencyCode: 'USD' } },
  ],
};

describe('executeHandoffForSale', () => {
  it('merged mode: pushes ONE combined order (no base-only, no independent pushes)', async () => {
    const { deps, calls } = makeDeps({ getFulfillmentMode: vi.fn(async (): Promise<FulfillmentMode> => 'merged') });
    await executeHandoffForSale('sale_1', deps);
    expect(calls.merged).toEqual(['sale_1']);
    expect(calls.baseOnly).toEqual([]);
    expect(calls.independent).toEqual([]);
  });

  it('split mode: pushes a base-only main order + one independent upsell order per upsell, tagged to the parent', async () => {
    const { deps, calls } = makeDeps({
      getFulfillmentMode: vi.fn(async (): Promise<FulfillmentMode> => 'split'),
      loadSplitContext: vi.fn(async () => splitCtx),
    });
    await executeHandoffForSale('sale_1', deps);
    expect(calls.baseOnly).toEqual(['sale_1']);
    expect(calls.merged).toEqual([]);
    expect(calls.independent).toHaveLength(2);
    expect(calls.independent).toEqual([
      { saleRef: 'sale_1', upsellIndex: 0, parentOrderNumber: 'A100', line: splitCtx.upsellLines[0].line, customer: splitCtx.customer },
      { saleRef: 'sale_1', upsellIndex: 1, parentOrderNumber: 'A100', line: splitCtx.upsellLines[1].line, customer: splitCtx.customer },
    ]);
  });

  it('split mode with no accepted upsells: falls back to a single merged push', async () => {
    const { deps, calls } = makeDeps({
      getFulfillmentMode: vi.fn(async (): Promise<FulfillmentMode> => 'split'),
      loadSplitContext: vi.fn(async () => ({ ...splitCtx, upsellLines: [] })),
    });
    await executeHandoffForSale('sale_1', deps);
    expect(calls.merged).toEqual(['sale_1']);
    expect(calls.baseOnly).toEqual([]);
    expect(calls.independent).toEqual([]);
  });

  it('split mode: a failing upsell push does not block the remaining upsells', async () => {
    const { deps, calls } = makeDeps({
      getFulfillmentMode: vi.fn(async (): Promise<FulfillmentMode> => 'split'),
      loadSplitContext: vi.fn(async () => splitCtx),
      pushIndependentUpsell: vi.fn(async (args: { upsellIndex: number }) => {
        if (args.upsellIndex === 0) throw new Error('backend down');
        calls.independent.push(args);
      }),
    });
    await executeHandoffForSale('sale_1', deps);
    expect(calls.baseOnly).toEqual(['sale_1']);
    expect(calls.independent).toHaveLength(1); // upsell 1 still pushed despite upsell 0 failing
  });
});
