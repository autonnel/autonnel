import { SealedToken } from '../value-objects/sealed-token';
import { isConversionScopeSatisfied, type PlatformRef } from '../value-objects/platform-ref';
import { IllegalConnectionTransition, StaleTokenVersion } from '../errors';

export type ConnectionStatus = 'ACTIVE' | 'EXPIRING' | 'REVOKED' | 'SCOPE_INSUFFICIENT';
export type DestinationKind = 'PIXEL' | 'CUSTOMER_LIST' | 'EVENT_SET';

export interface ConversionDestination {
  id: string;
  kind: DestinationKind;
  externalId: string;
  isDefault: boolean;
}

interface ConnectProps {
  id: string;
  platform: PlatformRef;
  externalAccountId: string;
  refreshToken: SealedToken;
  accessToken: SealedToken;
  accessTokenExpiresAt: Date;
  grantedScopes: string[];
  requiredConversionScopes: string[];
}

export class AdAccountConnection {
  private constructor(
    readonly id: string,
    readonly platform: PlatformRef,
    readonly externalAccountId: string,
    private _status: ConnectionStatus,
    private _accessToken: SealedToken,
    private _refreshToken: SealedToken,
    private _accessTokenExpiresAt: Date,
    private _grantedScopes: string[],
    private readonly _requiredScopes: string[],
    private _tokenVersion: number,
    private _destinations: ConversionDestination[],
  ) {}

  static connect(p: ConnectProps): AdAccountConnection {
    const status: ConnectionStatus = isConversionScopeSatisfied(p.grantedScopes, p.requiredConversionScopes)
      ? 'ACTIVE'
      : 'SCOPE_INSUFFICIENT';
    return new AdAccountConnection(
      p.id, p.platform, p.externalAccountId, status,
      p.accessToken, p.refreshToken, p.accessTokenExpiresAt,
      p.grantedScopes, p.requiredConversionScopes, p.accessToken.tokenVersion, [],
    );
  }

  static reconstitute(p: ConnectProps & { status: ConnectionStatus; destinations: ConversionDestination[] }): AdAccountConnection {
    return new AdAccountConnection(
      p.id, p.platform, p.externalAccountId, p.status,
      p.accessToken, p.refreshToken, p.accessTokenExpiresAt,
      p.grantedScopes, p.requiredConversionScopes, p.accessToken.tokenVersion, p.destinations,
    );
  }

  get status(): ConnectionStatus { return this._status; }
  get tokenVersion(): number { return this._tokenVersion; }
  get destinations(): readonly ConversionDestination[] { return this._destinations; }
  get accessToken(): SealedToken { return this._accessToken; }
  get refreshToken(): SealedToken { return this._refreshToken; }
  get accessTokenExpiresAt(): Date { return this._accessTokenExpiresAt; }
  get grantedScopes(): string[] { return this._grantedScopes; }
  get requiredConversionScopes(): string[] { return this._requiredScopes; }

  isCapiCapable(): boolean {
    return this._status === 'ACTIVE' && isConversionScopeSatisfied(this._grantedScopes, this._requiredScopes);
  }

  assertCanDispatch(): void {
    if (!this.isCapiCapable()) {
      throw new Error(`Connection ${this.id} is not dispatchable (status=${this._status})`);
    }
  }

  markActive(): void {
    if (this._status === 'REVOKED' || this._status === 'SCOPE_INSUFFICIENT') {
      throw new IllegalConnectionTransition(this._status, 'ACTIVE');
    }
    this._status = 'ACTIVE';
  }

  markExpiring(): void {
    if (this._status === 'REVOKED') throw new IllegalConnectionTransition('REVOKED', 'EXPIRING');
    this._status = 'EXPIRING';
  }

  revoke(_reason: string): void {
    this._status = 'REVOKED';
  }

  rotateTokens(p: {
    expectedTokenVersion: number;
    accessToken: SealedToken;
    refreshToken: SealedToken;
    accessTokenExpiresAt: Date;
  }): void {
    if (p.expectedTokenVersion !== this._tokenVersion) {
      throw new StaleTokenVersion(p.expectedTokenVersion, this._tokenVersion);
    }
    this._accessToken = p.accessToken;
    this._refreshToken = p.refreshToken;
    this._accessTokenExpiresAt = p.accessTokenExpiresAt;
    this._tokenVersion += 1;
    if (this._status === 'EXPIRING') this._status = 'ACTIVE';
  }

  addDestination(d: ConversionDestination): void {
    if (d.isDefault) {
      this._destinations = this._destinations.map((x) =>
        x.kind === d.kind ? { ...x, isDefault: false } : x,
      );
    }
    this._destinations.push(d);
  }

  rotateAccessToken(accessToken: SealedToken, accessTokenExpiresAt: Date): void {
    this._accessToken = accessToken;
    this._accessTokenExpiresAt = accessTokenExpiresAt;
    this._tokenVersion += 1;
    if (this._status === 'EXPIRING') this._status = 'ACTIVE';
  }

  setDefaultDestinationExternalId(externalId: string): void {
    const target =
      this._destinations.find((d) => d.isDefault) ?? this._destinations[0];
    if (!target) return;
    this._destinations = this._destinations.map((d) =>
      d.id === target.id ? { ...d, externalId } : d,
    );
  }
}
