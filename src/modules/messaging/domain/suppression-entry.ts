import { Address, ChannelType, SuppressionReason } from './value-objects';

export interface CreateSuppressionInput {
  tenantId: string;
  address: Address;
  reason: SuppressionReason;
  source: string;
}

export class SuppressionEntry {
  private constructor(
    readonly tenantId: string,
    readonly channel: ChannelType,
    readonly normalizedAddress: string,
    readonly reason: SuppressionReason,
    readonly source: string,
    private _active: boolean,
    private _unsuppressedBy?: string,
    public id?: string,
  ) {}

  static create(input: CreateSuppressionInput): SuppressionEntry {
    return new SuppressionEntry(input.tenantId, input.address.channel, input.address.normalized, input.reason, input.source, true);
  }

  static rehydrate(s: {
    id?: string;
    tenantId: string;
    channel: ChannelType;
    normalizedAddress: string;
    reason: SuppressionReason;
    source: string;
    active: boolean;
    unsuppressedBy?: string;
  }): SuppressionEntry {
    return new SuppressionEntry(s.tenantId, s.channel, s.normalizedAddress, s.reason, s.source, s.active, s.unsuppressedBy, s.id);
  }

  get key(): string { return `${this.tenantId}|${this.channel}|${this.normalizedAddress}`; }
  get active(): boolean { return this._active; }
  get unsuppressedBy(): string | undefined { return this._unsuppressedBy; }

  unsuppress(actor: string): void {
    if (!actor.trim()) throw new Error('unsuppress requires an audit actor');
    this._active = false;
    this._unsuppressedBy = actor;
  }
}
