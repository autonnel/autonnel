import type { NotificationPairing } from '@/lib/notifications/routing-types';

export type MaskedPairing = {
  id: string;
  name: string;
  enabled: boolean;
  events: string[];
  channel:
    | { type: 'email'; recipients: string[] }
    | { type: 'slack'; webhookUrl: string; webhookUrlHasStored: boolean }
    | {
        type: 'webhook';
        url: string;
        urlHasStored: boolean;
        secret: string;
        secretHasStored: boolean;
      };
};

export interface NotificationsPanelInitial {
  pairings: MaskedPairing[];
}

export interface NotificationLogRow {
  id: string;
  channel: string;
  purpose: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export const LOGS_REFRESH_MS = 30_000;
export const LOGS_PAGE_SIZE = 20;

export function joinRecipients(list: string[]): string {
  return list.join(', ');
}

export function parseRecipients(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function genId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function newBlankPairing(): NotificationPairing {
  return {
    id: genId(),
    name: 'New pairing',
    enabled: false,
    events: [],
    channel: { type: 'slack', webhookUrl: '' },
  };
}

export function emptyMaskedPairing(): MaskedPairing {
  return {
    id: genId(),
    name: 'New pairing',
    enabled: false,
    events: [],
    channel: { type: 'slack', webhookUrl: '', webhookUrlHasStored: false },
  };
}
