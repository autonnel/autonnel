import { describe, it, expect } from 'vitest';
import { ProviderRouter } from './provider-router';
import { ChannelType } from '../value-objects';

describe('ProviderRouter', () => {
  const router = new ProviderRouter();

  it('returns primary then fallback for the channel from tenant config', () => {
    const order = router.route(ChannelType.EMAIL, { primary: 'resend', fallback: 'postmark' });
    expect(order).toEqual(['resend', 'postmark']);
  });

  it('returns only the primary when no fallback configured', () => {
    expect(router.route(ChannelType.EMAIL, { primary: 'ses' })).toEqual(['ses']);
  });

  it('throws when the channel has no configured provider', () => {
    expect(() => router.route(ChannelType.EMAIL, {} as never)).toThrow(/no provider/i);
  });
});
