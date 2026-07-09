import { describe, it, expectTypeOf } from 'vitest';
import type { FunnelRepositoryPort, PageExistencePort, DomainEventPort } from './ports';

describe('ports', () => {
  it('FunnelRepositoryPort exposes load/save', () => {
    expectTypeOf<FunnelRepositoryPort['save']>().toBeFunction();
    expectTypeOf<FunnelRepositoryPort['load']>().toBeFunction();
  });
  it('PageExistencePort checks existence', () => {
    expectTypeOf<PageExistencePort['exists']>().toBeFunction();
  });
  it('DomainEventPort publishes events', () => {
    expectTypeOf<DomainEventPort['publish']>().toBeFunction();
  });
});
