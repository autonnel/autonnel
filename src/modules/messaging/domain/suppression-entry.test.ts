import { describe, it, expect } from 'vitest';
import { SuppressionEntry } from './suppression-entry';
import { Address, ChannelType, SuppressionReason } from './value-objects';

const addr = Address.of(ChannelType.EMAIL, 'Buyer@Example.com');

describe('SuppressionEntry', () => {
  it('keys on (tenantId, channel, normalizedAddress)', () => {
    const e = SuppressionEntry.create({ tenantId: 'default', address: addr, reason: SuppressionReason.HardBounce, source: 'provider:resend' });
    expect(e.key).toBe('default|EMAIL|buyer@example.com');
    expect(e.active).toBe(true);
    expect(e.reason).toBe(SuppressionReason.HardBounce);
  });

  it('unsuppress requires an audit actor and reactivates (deactivates the entry)', () => {
    const e = SuppressionEntry.create({ tenantId: 'default', address: addr, reason: SuppressionReason.ManualBlock, source: 'admin' });
    e.unsuppress('admin:user-1');
    expect(e.active).toBe(false);
    expect(e.unsuppressedBy).toBe('admin:user-1');
  });

  it('unsuppress without an actor is rejected', () => {
    const e = SuppressionEntry.create({ tenantId: 'default', address: addr, reason: SuppressionReason.Complaint, source: 'provider:postmark' });
    expect(() => e.unsuppress('')).toThrow(/actor/i);
  });
});
