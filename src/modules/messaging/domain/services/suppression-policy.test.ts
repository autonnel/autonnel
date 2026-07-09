import { describe, it, expect } from 'vitest';
import { SuppressionPolicy } from './suppression-policy';
import { SuppressionEntry } from '../suppression-entry';
import { Address, ChannelType, SuppressionReason } from '../value-objects';

const addr = Address.of(ChannelType.EMAIL, 'buyer@example.com');

describe('SuppressionPolicy', () => {
  const policy = new SuppressionPolicy();

  it('reports suppressed when an active entry matches the channel+address', () => {
    const e = SuppressionEntry.create({ tenantId: 'default', address: addr, reason: SuppressionReason.HardBounce, source: 'p' });
    expect(policy.isSuppressed(addr, [e])).toBe(true);
  });

  it('ignores an inactive (unsuppressed) entry', () => {
    const e = SuppressionEntry.create({ tenantId: 'default', address: addr, reason: SuppressionReason.ManualBlock, source: 'p' });
    e.unsuppress('admin');
    expect(policy.isSuppressed(addr, [e])).toBe(false);
  });

  it('does not match a different address', () => {
    const other = SuppressionEntry.create({
      tenantId: 'default',
      address: Address.of(ChannelType.EMAIL, 'someone@else.com'),
      reason: SuppressionReason.Complaint,
      source: 'p',
    });
    expect(policy.isSuppressed(addr, [other])).toBe(false);
  });
});
