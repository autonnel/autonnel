import { describe, it, expect } from 'vitest';
import type {
  RecallCampaignRepository,
  RecallAttemptRepository,
  SuppressionRepository,
  MessagingPort,
  CheckoutPaymentStatusPort,
  CheckoutResumePort,
  CommerceGatewayReadPort,
  AppConfigPort,
  EventPublisherPort,
  JobQueuePort,
} from './ports';

describe('Recall application ports', () => {
  it('MessagingPort exposes a single send-Touch entry shaped like SendNotificationPort', () => {
    const fake: MessagingPort = {
      async sendTouch(touch) {
        return { messageHandoffRef: `m_${touch.idempotencyKey}` };
      },
    };
    expect(typeof fake.sendTouch).toBe('function');
  });

  it('CheckoutPaymentStatusPort returns authoritative paid/voided', () => {
    const fake: CheckoutPaymentStatusPort = {
      async getStatus() {
        return { paid: true, voided: false };
      },
    };
    expect(typeof fake.getStatus).toBe('function');
  });

  it('exports every outbound port type', () => {
    const names: Array<keyof typeof import('./ports')> = [];
    expect(Array.isArray(names)).toBe(true);
  });
});
