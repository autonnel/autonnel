import type { OrderRepositoryPort } from "./ports";
import type { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";

export interface ResendReceiptResult {
  state: "OK" | "NOT_FOUND";
}

export class ResendReceiptEmailService {
  constructor(
    private readonly repo: OrderRepositoryPort,
    private readonly email: EmitLifecycleEmailService,
  ) {}

  async execute(orderId: string): Promise<ResendReceiptResult> {
    const order = await this.repo.findById(orderId);
    if (!order) return { state: "NOT_FOUND" };
    await this.email.emit(order, "order.receipt");
    return { state: "OK" };
  }
}
