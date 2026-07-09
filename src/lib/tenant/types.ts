export interface TenantContext {
  id: string;
  metadata?: Record<string, unknown>;
}

export type TenantResolver = (request: Request) => Promise<TenantContext> | TenantContext;
