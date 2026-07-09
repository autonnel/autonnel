import { describe, it, expect, beforeEach } from 'vitest';
import { registerPlugins } from '@/integration/register-plugins';
import { IncompatiblePluginError } from '@/lib/plugins/errors';
import { resetUiAndPolicyRegistry } from '@/lib/plugins/registry';
import { setPluginAdsPlatforms } from '@/lib/adapters/ads/platform-registry';
import type { AutonnelPlugin } from '@/lib/plugins/types';
import pkg from '../../../package.json';

const ACTUAL = pkg.version;

function plugin(name: string, engines?: { autonnel?: string }): AutonnelPlugin {
  return { name, version: '1.0.0', engines };
}

describe('registerPlugins — engines compatibility gate', () => {
  beforeEach(() => {
    resetUiAndPolicyRegistry();
    setPluginAdsPlatforms([]);
  });

  it('throws IncompatiblePluginError naming plugin, range, and actual version', () => {
    const incompatible = plugin('needs-future', { autonnel: '>=99.0.0' });
    try {
      registerPlugins([incompatible]);
      throw new Error('expected registerPlugins to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IncompatiblePluginError);
      const e = err as IncompatiblePluginError;
      expect(e.pluginName).toBe('needs-future');
      expect(e.requiredRange).toBe('>=99.0.0');
      expect(e.actualVersion).toBe(ACTUAL);
      expect(e.message).toContain('needs-future');
      expect(e.message).toContain('>=99.0.0');
      expect(e.message).toContain(ACTUAL);
    }
  });

  it('does not throw for a satisfied range', () => {
    expect(() => registerPlugins([plugin('ok', { autonnel: `>=${ACTUAL}` })])).not.toThrow();
  });

  it('does not throw for a wildcard range', () => {
    expect(() => registerPlugins([plugin('star', { autonnel: '*' })])).not.toThrow();
  });

  it('treats a plugin without engines as compatible', () => {
    expect(() => registerPlugins([plugin('no-engines')])).not.toThrow();
  });

  it('zero plugins never throws', () => {
    expect(() => registerPlugins([])).not.toThrow();
  });
});
