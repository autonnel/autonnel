import { describe, it, expect } from 'vitest';
import {
  ChannelType,
  Address,
  TemplateKey,
  SenderIdentity,
  DispatchStatus,
  isTerminalStatus,
  SuppressionReason,
} from './value-objects';

describe('Address', () => {
  it('validates and normalizes an email (lowercase + trim)', () => {
    const a = Address.of(ChannelType.EMAIL, '  Buyer@Example.COM ');
    expect(a.channel).toBe(ChannelType.EMAIL);
    expect(a.normalized).toBe('buyer@example.com');
  });

  it('rejects a malformed email', () => {
    expect(() => Address.of(ChannelType.EMAIL, 'not-an-email')).toThrow(/invalid email/i);
  });

  it('two addresses with different casing are equal after normalization', () => {
    expect(Address.of(ChannelType.EMAIL, 'A@b.com').equals(Address.of(ChannelType.EMAIL, 'a@B.com'))).toBe(true);
  });
});

describe('TemplateKey', () => {
  it('accepts dotted lifecycle keys', () => {
    expect(TemplateKey.of('order.receipt').value).toBe('order.receipt');
    expect(TemplateKey.of('recall.abandoned_checkout').value).toBe('recall.abandoned_checkout');
  });
  it('rejects empty or whitespace keys', () => {
    expect(() => TemplateKey.of('  ')).toThrow();
  });
});

describe('SenderIdentity', () => {
  it('requires a verified from-address', () => {
    const s = SenderIdentity.of({ fromAddress: 'hello@shop.com', fromName: 'Shop', verified: true });
    expect(s.fromAddress).toBe('hello@shop.com');
  });
  it('rejects an unverified sender', () => {
    expect(() => SenderIdentity.of({ fromAddress: 'x@y.com', verified: false })).toThrow(/verified/i);
  });
});

describe('DispatchStatus', () => {
  it('classifies terminal states', () => {
    expect(isTerminalStatus(DispatchStatus.DELIVERED)).toBe(true);
    expect(isTerminalStatus(DispatchStatus.BOUNCED)).toBe(true);
    expect(isTerminalStatus(DispatchStatus.COMPLAINED)).toBe(true);
    expect(isTerminalStatus(DispatchStatus.SUPPRESSED)).toBe(true);
    expect(isTerminalStatus(DispatchStatus.CANCELED)).toBe(true);
    expect(isTerminalStatus(DispatchStatus.QUEUED)).toBe(false);
    expect(isTerminalStatus(DispatchStatus.SENT)).toBe(false);
  });
});

describe('SuppressionReason', () => {
  it('exposes the four reasons', () => {
    expect(Object.values(SuppressionReason)).toEqual(['HardBounce', 'Complaint', 'Unsubscribe', 'ManualBlock']);
  });
});
