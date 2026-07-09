import { describe, it, expect, vi } from 'vitest';
import { runPaymentReconcileSweep } from '../reconcile-cron';

describe('payment.reconcile cron sweep', () => {
  it('invokes ReconcilePendingIntentsService.run and returns the count', async () => {
    const svc = { run: vi.fn(async () => ({ reconciled: 3 })) };
    const out = await runPaymentReconcileSweep(() => svc as any);
    expect(out.reconciled).toBe(3);
    expect(svc.run).toHaveBeenCalledOnce();
  });
});
