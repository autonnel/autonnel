import { describe, it, expect, vi } from 'vitest';
import { AttributionSnapshot } from '../domain/value-objects/attribution-snapshot';
import { FunnelSnapshotRef, StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { ContactHandle } from '../domain/value-objects/contact-handle';
import { FunnelSession } from '../domain/funnel-session';
import { AbandonmentDetectionService } from './abandonment-detection-service';

const ref = FunnelSnapshotRef.of('fn_1', 3);
const steps = [StepSlug.of('landing'), StepSlug.of('checkout')];

function session() {
  return FunnelSession.start({
    sessionId: 'sess_1',
    tenantId: 'default',
    snapshotRef: ref,
    stepSlugs: steps,
    attribution: AttributionSnapshot.empty('sess_1'),
    entryStep: StepSlug.of('landing'),
  });
}

function deps(isLinkedSalePaid: (saleId: string) => Promise<boolean>) {
  const published: any[] = [];
  return {
    publisher: { publish: vi.fn(async (e: any[]) => published.push(...e)) },
    isLinkedSalePaid: vi.fn(isLinkedSalePaid),
    _published: published,
  };
}

describe('AbandonmentDetectionService', () => {
  it('emits FunnelSessionAbandoned with the captured contact hash', async () => {
    const s = session();
    s.captureContact(ContactHandle.fromEmail('ada@example.com', (n) => `h:${n}`));
    const d = deps(async () => false);
    const svc = new AbandonmentDetectionService(d as any);
    const abandoned = await svc.detect(s);
    expect(abandoned).toBe(true);
    expect(d._published.some((e: any) => e.type === 'FunnelSessionAbandoned' && e.payload.hashedIdentity === 'h:ada@example.com')).toBe(true);
  });

  it('emits FunnelSessionAbandoned with null hash when no contact was captured', async () => {
    const d = deps(async () => false);
    const svc = new AbandonmentDetectionService(d as any);
    const abandoned = await svc.detect(session());
    expect(abandoned).toBe(true);
    expect(d._published.some((e: any) => e.type === 'FunnelSessionAbandoned' && e.payload.hashedIdentity === null)).toBe(true);
  });

  it('emits nothing when the linked Sale is paid', async () => {
    const s = session();
    s.linkSale('sale_1');
    s.captureContact(ContactHandle.fromEmail('ada@example.com', (n) => `h:${n}`));
    const d = deps(async () => true);
    const svc = new AbandonmentDetectionService(d as any);
    const abandoned = await svc.detect(s);
    expect(abandoned).toBe(false);
    expect(d._published).toHaveLength(0);
  });
});
