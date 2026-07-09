export type HandoffStrategy = "orderCreate" | "draftOrderComplete";

export interface CapabilityFlags {
  supportsPresentmentPricing: boolean;
  supportsRealtimeInventory: boolean;
  supportsExternalPaidOrder: boolean;
  supportsWebhooks: boolean;
  handoffStrategy: HandoffStrategy;
}

// Upstream contexts (Authoring/Checkout) only see small normalized flags;
// handoffStrategy stays Gateway-internal (secondary decision).
export interface UpstreamCapabilityFlags {
  supportsMultiCurrency: boolean;
}

export class CapabilityProfile {
  private constructor(private readonly flags: CapabilityFlags) {}
  static of(flags: CapabilityFlags): CapabilityProfile {
    return new CapabilityProfile(flags);
  }
  get handoffStrategy(): HandoffStrategy {
    return this.flags.handoffStrategy;
  }
  get supportsExternalPaidOrder(): boolean {
    return this.flags.supportsExternalPaidOrder;
  }
  get supportsWebhooks(): boolean {
    return this.flags.supportsWebhooks;
  }
  upstreamFlags(): UpstreamCapabilityFlags {
    return { supportsMultiCurrency: this.flags.supportsPresentmentPricing };
  }
}
