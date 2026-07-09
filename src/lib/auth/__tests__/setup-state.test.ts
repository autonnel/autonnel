import { describe, it, expect } from 'vitest';
import { deriveSetupState, normalizeCompletedFlag, isSetupExemptPath } from '../setup-state';

describe('normalizeCompletedFlag', () => {
  it('accepts booleans and their string forms', () => {
    expect(normalizeCompletedFlag(true)).toBe(true);
    expect(normalizeCompletedFlag('true')).toBe(true);
    expect(normalizeCompletedFlag(false)).toBe(false);
    expect(normalizeCompletedFlag('false')).toBe(false);
  });

  it('treats anything else as unset', () => {
    expect(normalizeCompletedFlag(undefined)).toBeUndefined();
    expect(normalizeCompletedFlag(null)).toBeUndefined();
    expect(normalizeCompletedFlag(1)).toBeUndefined();
    expect(normalizeCompletedFlag('yes')).toBeUndefined();
  });
});

describe('deriveSetupState', () => {
  it('explicit completed=true never needs setup', () => {
    expect(deriveSetupState({ completed: true, hasMembers: false, isDefaultTenant: true }))
      .toEqual({ needsSetup: false, needsAccount: false });
  });

  it('explicit completed=false with no members runs the full wizard', () => {
    expect(deriveSetupState({ completed: false, hasMembers: false, isDefaultTenant: true }))
      .toEqual({ needsSetup: true, needsAccount: true });
  });

  it('explicit completed=false with members (provisioned SaaS tenant) skips the account step', () => {
    expect(deriveSetupState({ completed: false, hasMembers: true, isDefaultTenant: false }))
      .toEqual({ needsSetup: true, needsAccount: false });
  });

  it('unset flag on a fresh OSS install (default tenant, no members) runs the full wizard', () => {
    expect(deriveSetupState({ completed: undefined, hasMembers: false, isDefaultTenant: true }))
      .toEqual({ needsSetup: true, needsAccount: true });
  });

  it('unset flag with existing members is grandfathered as completed', () => {
    expect(deriveSetupState({ completed: undefined, hasMembers: true, isDefaultTenant: true }))
      .toEqual({ needsSetup: false, needsAccount: false });
    expect(deriveSetupState({ completed: undefined, hasMembers: true, isDefaultTenant: false }))
      .toEqual({ needsSetup: false, needsAccount: false });
  });

  it('unset flag on a non-default tenant without members (SaaS app/cdn sentinel) never gates', () => {
    expect(deriveSetupState({ completed: undefined, hasMembers: false, isDefaultTenant: false }))
      .toEqual({ needsSetup: false, needsAccount: false });
  });
});

describe('isSetupExemptPath', () => {
  it('exempts the wizard, logout, APIs and storefront-served paths', () => {
    expect(isSetupExemptPath('/setup')).toBe(true);
    expect(isSetupExemptPath('/logout')).toBe(true);
    expect(isSetupExemptPath('/api/auth/setup')).toBe(true);
    expect(isSetupExemptPath('/storefront/landing')).toBe(true);
    expect(isSetupExemptPath('/n/abc/checkout')).toBe(true);
    expect(isSetupExemptPath('/_astro/app.css')).toBe(true);
    expect(isSetupExemptPath('/favicon.ico')).toBe(true);
  });

  it('gates admin pages including login and the root', () => {
    expect(isSetupExemptPath('/')).toBe(false);
    expect(isSetupExemptPath('/login')).toBe(false);
    expect(isSetupExemptPath('/register')).toBe(false);
    expect(isSetupExemptPath('/overview')).toBe(false);
    expect(isSetupExemptPath('/settings/branding')).toBe(false);
  });
});
