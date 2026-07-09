import { describe, it, expect, afterEach } from 'vitest';
import { isAdminHost, isPublicStorefrontPath } from '@/lib/runtime/admin-host';

const original = process.env.ADMIN_DOMAIN;

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_DOMAIN;
  else process.env.ADMIN_DOMAIN = original;
});

describe('isAdminHost', () => {
  it('treats every host as storefront (non-admin) when ADMIN_DOMAIN is unset', () => {
    delete process.env.ADMIN_DOMAIN;
    expect(isAdminHost('shop.example.com')).toBe(false);
    expect(isAdminHost('admin.example.com')).toBe(false);
    expect(isAdminHost(null)).toBe(false);
  });

  it('gates by configured admin host', () => {
    process.env.ADMIN_DOMAIN = 'admin.example.com';
    expect(isAdminHost('admin.example.com')).toBe(true);
    expect(isAdminHost('admin.example.com:443')).toBe(true);
    expect(isAdminHost('shop.example.com')).toBe(false);
    expect(isAdminHost(null)).toBe(false);
  });

  it('accepts a comma-separated list of hosts', () => {
    process.env.ADMIN_DOMAIN = 'admin.example.com, admin.other.com';
    expect(isAdminHost('admin.example.com')).toBe(true);
    expect(isAdminHost('admin.other.com')).toBe(true);
    expect(isAdminHost('admin.other.com:8080')).toBe(true);
    expect(isAdminHost('shop.example.com')).toBe(false);
  });

  it('supports single-label wildcard patterns', () => {
    process.env.ADMIN_DOMAIN = '*.example.com';
    expect(isAdminHost('admin.example.com')).toBe(true);
    expect(isAdminHost('shop.example.com')).toBe(true);
    expect(isAdminHost('example.com')).toBe(false);
    expect(isAdminHost('a.b.example.com')).toBe(false);
    expect(isAdminHost('admin.evil.com')).toBe(false);
  });

  it('supports wildcards inside a label and mixes them with exact hosts', () => {
    process.env.ADMIN_DOMAIN = 'tenant-*.example.com, admin.other.com';
    expect(isAdminHost('tenant-acme.example.com')).toBe(true);
    expect(isAdminHost('tenant-.example.com')).toBe(true);
    expect(isAdminHost('admin.other.com')).toBe(true);
    expect(isAdminHost('other.example.com')).toBe(false);
  });
});

describe('isPublicStorefrontPath', () => {
  it('allows storefront and public paths', () => {
    expect(isPublicStorefrontPath('/storefront/x')).toBe(true);
    expect(isPublicStorefrontPath('/n/abc/step')).toBe(true);
    expect(isPublicStorefrontPath('/api/shop/track')).toBe(true);
    expect(isPublicStorefrontPath('/api/marketing/beacon')).toBe(true);
    expect(isPublicStorefrontPath('/_astro/app.js')).toBe(true);
    expect(isPublicStorefrontPath('/foo.css')).toBe(true);
  });

  it('blocks admin paths', () => {
    expect(isPublicStorefrontPath('/')).toBe(false);
    expect(isPublicStorefrontPath('/overview')).toBe(false);
    expect(isPublicStorefrontPath('/login')).toBe(false);
    expect(isPublicStorefrontPath('/settings/branding')).toBe(false);
    expect(isPublicStorefrontPath('/api/funnels')).toBe(false);
  });
});
