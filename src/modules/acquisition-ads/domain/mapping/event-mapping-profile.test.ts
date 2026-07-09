import { describe, it, expect } from 'vitest';
import { EventMappingProfile, INTERNAL_TRIGGERS } from './event-mapping-profile';
import { MappingActivationError } from '../errors';

const rule = (over = {}) => ({
  trigger: 'Purchase' as const,
  platformEventName: 'Purchase',
  destinationId: 'd1',
  enabled: true,
  ...over,
});

describe('EventMappingProfile', () => {
  it('exposes the closed internal trigger vocabulary', () => {
    expect(INTERNAL_TRIGGERS).toContain('PageView');
    expect(INTERNAL_TRIGGERS).toContain('Purchase');
  });

  it('activates with valid rules and bumps version on copy-on-write edit', () => {
    const p = EventMappingProfile.draft({ id: 'm1', rules: [rule()] });
    const activated = p.activate();
    expect(activated.version).toBe(1);
    expect(activated.isActive).toBe(true);
    const edited = activated.withRules([rule(), rule({ destinationId: 'd2' })]);
    expect(edited.version).toBe(2);
  });

  it('rejects two enabled rules mapping the same (trigger, destination)', () => {
    const p = EventMappingProfile.draft({ id: 'm1', rules: [rule(), rule()] });
    expect(() => p.activate()).toThrow(MappingActivationError);
  });

  it('resolves enabled rules that match an internal trigger', () => {
    const p = EventMappingProfile.draft({
      id: 'm1',
      rules: [rule(), rule({ trigger: 'PageView', enabled: false })],
    }).activate();
    expect(p.rulesForTrigger('Purchase')).toHaveLength(1);
    expect(p.rulesForTrigger('PageView')).toHaveLength(0);
  });
});
