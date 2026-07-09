import { PermissionSet } from './permission-set';

export enum ApiKeyStatus {
  Active = 'active',
  Revoked = 'revoked',
}

interface ApiKeyState {
  id: string;
  name: string | null;
  prefix: string;
  status: ApiKeyStatus;
  scope: PermissionSet;
  writeAccess: boolean;
  expiresAt: Date | null;
  createdAt: Date | null;
}

// Only the hash persists; revoked/expired → empty permission set immediately.
export class ApiClientCredential {
  private constructor(private state: ApiKeyState) {}

  static rehydrate(state: Omit<ApiKeyState, 'name' | 'createdAt'> & { name?: string | null; createdAt?: Date | null }): ApiClientCredential {
    return new ApiClientCredential({ name: null, createdAt: null, ...state });
  }

  get id() { return this.state.id; }
  get name() { return this.state.name; }
  get prefix() { return this.state.prefix; }
  get writeAccess() { return this.state.writeAccess; }
  get status() { return this.state.status; }
  get expiresAt() { return this.state.expiresAt; }
  get createdAt() { return this.state.createdAt; }

  isActive(now: Date): boolean {
    if (this.state.status === ApiKeyStatus.Revoked) return false;
    if (this.state.expiresAt && now > this.state.expiresAt) return false;
    return true;
  }

  setWriteAccess(writeAccess: boolean): void {
    this.state.writeAccess = writeAccess;
  }

  effectivePermissions(now: Date): PermissionSet {
    if (this.state.status === ApiKeyStatus.Revoked) return PermissionSet.empty();
    if (this.state.expiresAt && now > this.state.expiresAt) return PermissionSet.empty();
    return this.state.scope;
  }

  revoke(): void {
    this.state.status = ApiKeyStatus.Revoked;
  }

  snapshot(): Readonly<ApiKeyState> {
    return { ...this.state };
  }
}
