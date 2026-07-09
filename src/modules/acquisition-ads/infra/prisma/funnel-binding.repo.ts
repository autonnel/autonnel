import type { FunnelBindingRepo } from '../../application/ports/funnel-binding-repo';

interface Delegate {
  create(args: { data: { id: string; funnelId: string; connectionId: string } }): Promise<unknown>;
  delete(args: { where: { tenantId_funnelId_connectionId: { tenantId: string; funnelId: string; connectionId: string } } }): Promise<unknown>;
  findMany(args: { where: Record<string, unknown>; select: Record<string, boolean> }): Promise<any[]>;
}

export class PrismaFunnelBindingRepo implements FunnelBindingRepo {
  constructor(private readonly delegate: Delegate) {}

  async bind(funnelId: string, connectionId: string): Promise<void> {
    await this.delegate.create({
      data: { id: crypto.randomUUID(), funnelId, connectionId },
    });
  }

  async unbind(funnelId: string, connectionId: string): Promise<void> {
    await this.delegate.delete({
      where: { tenantId_funnelId_connectionId: { tenantId: 'default', funnelId, connectionId } },
    });
  }

  async listByFunnel(funnelId: string): Promise<{ connectionId: string }[]> {
    return this.delegate.findMany({
      where: { funnelId },
      select: { connectionId: true },
    });
  }
}
