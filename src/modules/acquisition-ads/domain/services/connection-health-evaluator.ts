import type { ConnectionStatus } from '../connection/ad-account-connection';

const REFRESH_WINDOW_MS = 5 * 60_000;

export class ConnectionHealthEvaluator {
  needsRefresh(c: { accessTokenExpiresAt: Date; status: ConnectionStatus }): boolean {
    if (c.status === 'REVOKED' || c.status === 'SCOPE_INSUFFICIENT') return false;
    return c.accessTokenExpiresAt.getTime() - Date.now() <= REFRESH_WINDOW_MS;
  }

  isDegraded(c: { status: ConnectionStatus }): boolean {
    return c.status !== 'ACTIVE';
  }
}
