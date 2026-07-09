import type { OrderRepositoryPort, DomainEventPublisherPort } from "./ports";
import type { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

export class MarkOrderDeliveredService {
  constructor(
    private readonly repo: OrderRepositoryPort,
    private readonly publisher: DomainEventPublisherPort,
    private readonly email: EmitLifecycleEmailService,
  ) {}

  async execute(orderId: string): Promise<{ changed: boolean; state: string }> {
    const order = await this.repo.findById(orderId);
    if (!order) return { changed: false, state: "NOT_FOUND" };
    const changed = order.markDeliveredExternally();
    if (!changed) return { changed: false, state: order.state };
    await this.repo.save(order);
    await this.publisher.publishAll(order.pullEvents());
    await this.email.emit(order, "order.delivered");
    return { changed: true, state: order.state };
  }
}
