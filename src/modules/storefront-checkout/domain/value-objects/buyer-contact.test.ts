import { describe, it, expect } from 'vitest';
import { ContactHandle } from './contact-handle';
import { Address, BuyerContact } from './buyer-contact';

const hash = (n: string) => `h:${n}`;

describe('BuyerContact', () => {
  const address = Address.create({
    line1: '1 Market St',
    city: 'San Francisco',
    countryCode: 'US',
    postalCode: '94105',
  });

  it('carries the frozen ContactHandle (H2) and an address', () => {
    const handle = ContactHandle.fromEmail('Buyer@Example.com', hash);
    const c = BuyerContact.create({ fullName: 'Ada', handle, address });
    expect(c.handle.hashedIdentity).toBe('h:buyer@example.com');
    expect(c.address.countryCode).toBe('US');
    expect(c.fullName).toBe('Ada');
  });

  it('rejects an address missing a country code', () => {
    expect(() =>
      Address.create({ line1: 'x', city: 'y', countryCode: '', postalCode: 'z' }),
    ).toThrow(/countryCode/i);
  });

  it('requires a contact handle', () => {
    expect(() =>
      // @ts-expect-error intentionally missing handle
      BuyerContact.create({ fullName: 'Ada', address }),
    ).toThrow(/handle/i);
  });
});
