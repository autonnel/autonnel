import { describe, it, expect } from 'vitest';
import { Domain, DomainSet, normalizeHost } from './domain';

describe('Domain', () => {
  it('normalizes host to lowercase and trims', () => {
    expect(normalizeHost('  Example.COM ')).toBe('example.com');
  });

  it('rejects invalid host format', () => {
    expect(() => normalizeHost('not a host')).toThrow(/Invalid domain/);
    expect(() => normalizeHost('localhost')).toThrow(/Invalid domain/);
  });

  it('creates a non-primary domain by default', () => {
    const d = Domain.create({ tenantId: 't1', host: 'shop.example.com' });
    expect(d.isPrimary).toBe(false);
    expect(d.host).toBe('shop.example.com');
  });
});

describe('DomainSet invariant', () => {
  it('forces the first domain to be primary', () => {
    const set = new DomainSet([]);
    expect(set.resolveNewPrimary(false)).toBe(true);
  });

  it('honors the requested primary flag once a domain exists', () => {
    const existing = Domain.rehydrate({ id: '1', tenantId: 't1', host: 'a.com', isPrimary: true });
    const set = new DomainSet([existing]);
    expect(set.resolveNewPrimary(false)).toBe(false);
    expect(set.hasPrimary()).toBe(true);
    expect(set.primary()).toBe(existing);
  });
});
