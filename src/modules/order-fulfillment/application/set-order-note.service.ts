import type { OrderRepositoryPort } from "./ports";

export interface SetOrderNoteResult {
  state: "OK" | "NOT_FOUND";
  note: string | null;
}

export class SetOrderNoteService {
  constructor(private readonly repo: OrderRepositoryPort) {}

  async execute(orderId: string, note: string | null): Promise<SetOrderNoteResult> {
    const order = await this.repo.findById(orderId);
    if (!order) return { state: "NOT_FOUND", note: null };
    order.setNote(note);
    await this.repo.save(order);
    return { state: "OK", note: order.note };
  }
}
