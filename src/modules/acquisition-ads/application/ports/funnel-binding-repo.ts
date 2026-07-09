export interface FunnelBindingRepo {
  bind(funnelId: string, connectionId: string): Promise<void>;
  unbind(funnelId: string, connectionId: string): Promise<void>;
  listByFunnel(funnelId: string): Promise<{ connectionId: string }[]>;
}
