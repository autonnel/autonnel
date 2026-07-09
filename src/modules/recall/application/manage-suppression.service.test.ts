import { describe, it, expect, vi } from 'vitest';
import { ManageSuppressionService } from './manage-suppression.service';
import { SuppressionEntry } from '../domain/suppression';
import type { SuppressionRepository } from './ports';
import type { ClockPort } from '../domain/ports';

function fakeRepo(overrides?: Partial<SuppressionRepository>): SuppressionRepository {
  return {
    findActiveBySubject: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockImplementation(async (e) => e),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeClock(now?: Date): ClockPort {
  return { now: () => now ?? new Date('2026-06-05T10:00:00Z') };
}

describe('ManageSuppressionService', () => {
  it('list() delegates to repo.list()', async () => {
    const entry = SuppressionEntry.create({
      scope: 'contact',
      subjectKey: 'hash_abc',
      reason: 'manual',
      source: 'manual_admin',
      expiresAt: null,
    });
    const repo = fakeRepo({ list: vi.fn().mockResolvedValue([entry]) });
    const svc = new ManageSuppressionService(repo, fakeClock());

    const result = await svc.list();
    expect(result).toEqual([entry]);
    expect(repo.list).toHaveBeenCalledOnce();
  });

  it('block() upserts suppression with manualAdmin source and null expiresAt', async () => {
    const now = new Date('2026-06-05T12:00:00Z');
    const repo = fakeRepo();
    const svc = new ManageSuppressionService(repo, fakeClock(now));

    const result = await svc.block('contact', 'hash_xyz');

    expect(repo.upsert).toHaveBeenCalledOnce();
    const upserted: SuppressionEntry = (repo.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upserted.scope).toBe('contact');
    expect(upserted.subjectKey).toBe('hash_xyz');
    expect(upserted.reason).toBe('manual');
    expect(upserted.source).toBe('manual_admin');
    expect(upserted.expiresAt).toBeNull();
    expect(upserted.createdAt).toEqual(now);
    expect(result).toBe(upserted);
  });

  it('unblock() calls repo.remove with correct scope and subjectKey', async () => {
    const repo = fakeRepo();
    const svc = new ManageSuppressionService(repo, fakeClock());

    await svc.unblock('checkout', 'chk_ref_1');

    expect(repo.remove).toHaveBeenCalledExactlyOnceWith('checkout', 'chk_ref_1');
  });
});
