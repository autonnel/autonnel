import { describe, it, expect, vi } from 'vitest';
import { PrismaDispatchRepository } from './dispatch.repository';

describe('PrismaDispatchRepository.recordTerminal', () => {
  it('creates a terminal Dispatch row with external sender/version placeholders', async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd1', ...data }));
    const repo = new PrismaDispatchRepository({ dispatch: { create } });

    const out = await repo.recordTerminal({
      idempotencyKey: 'notify:e1:p1:SLACK',
      channel: 'SLACK',
      recipient: 'https://hooks.slack.com/x',
      templateKey: 'notification.event',
      sourceContext: 'notifications',
      sourceEventId: 'order.paid',
      subject: '[Acme] Order paid',
      status: 'SENT',
    });

    expect(out).toEqual({ id: 'd1', deduped: false });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: 'notify:e1:p1:SLACK',
        channel: 'SLACK',
        recipient: 'https://hooks.slack.com/x',
        templateKey: 'notification.event',
        templateVersionId: 'external',
        senderIdentityId: 'external',
        status: 'SENT',
        attemptCount: 1,
        sourceContext: 'notifications',
        sourceEventId: 'order.paid',
        renderedSubject: '[Acme] Order paid',
        lastError: null,
      }),
    });
  });

  it('records the error message for a FAILED delivery', async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd2', ...data }));
    const repo = new PrismaDispatchRepository({ dispatch: { create } });

    await repo.recordTerminal({
      idempotencyKey: 'notify:e1:p1:WEBHOOK',
      channel: 'WEBHOOK',
      recipient: 'https://example.com/x',
      templateKey: 'notification.event',
      sourceContext: 'notifications',
      status: 'FAILED',
      error: 'HTTP 500',
    });

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'FAILED', lastError: 'HTTP 500' }) });
  });

  it('dedupes on the (tenant, idempotencyKey) unique violation without throwing', async () => {
    const create = vi.fn(async () => { throw { code: 'P2002' }; });
    const findFirst = vi.fn(async () => ({ id: 'existing' }));
    const repo = new PrismaDispatchRepository({ dispatch: { create, findFirst } });

    const out = await repo.recordTerminal({
      idempotencyKey: 'notify:e1:p1:SLACK',
      channel: 'SLACK',
      recipient: 'https://hooks.slack.com/x',
      templateKey: 'notification.event',
      sourceContext: 'notifications',
      status: 'SENT',
    });

    expect(out).toEqual({ id: 'existing', deduped: true });
    expect(findFirst).toHaveBeenCalledWith({ where: { idempotencyKey: 'notify:e1:p1:SLACK' } });
  });

  it('rethrows non-unique-violation errors', async () => {
    const create = vi.fn(async () => { throw new Error('connection refused'); });
    const repo = new PrismaDispatchRepository({ dispatch: { create } });

    await expect(
      repo.recordTerminal({
        idempotencyKey: 'k',
        channel: 'SLACK',
        recipient: 'https://hooks.slack.com/x',
        templateKey: 'notification.event',
        sourceContext: 'notifications',
        status: 'SENT',
      }),
    ).rejects.toThrow('connection refused');
  });
});
