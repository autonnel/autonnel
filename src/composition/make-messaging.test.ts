import { describe, it, expect } from 'vitest';
import { makeMessaging, makeSendNotificationPort } from './make-messaging';
import { makePlatform } from './make-platform';

describe('makeMessaging', () => {
  it('returns a SendNotificationPort and the dashboard/template services', () => {
    const m = makeMessaging();
    expect(typeof m.sendNotification.send).toBe('function');
    expect(typeof m.processSendJob.processSend).toBe('function');
    expect(typeof m.processDeliveryReceipt.ingest).toBe('function');
    expect(typeof m.retrySweep.sweep).toBe('function');
  });

  it('exposes a stable SendNotificationPort entry point for other contexts', () => {
    const port = makeSendNotificationPort();
    expect(typeof port.send).toBe('function');
  });

  it('registers the messaging.send job handler with the platform registry at module load', () => {
    const { handlerRegistry } = makePlatform();
    expect(handlerRegistry.has('messaging.send')).toBe(true);
    const handler = handlerRegistry.resolve('messaging.send');
    expect(typeof handler).toBe('function');
  });

  it('runMessagingRetrySweep delegates to RetrySweepService.sweep', async () => {
    const { runMessagingRetrySweep } = await import('./make-messaging');
    expect(typeof runMessagingRetrySweep).toBe('function');
  });
});
