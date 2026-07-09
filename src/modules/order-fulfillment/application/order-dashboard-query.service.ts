import type {
  OrderReadPort,
  OrderVisitReadPort,
  OrderEmailReadPort,
  OrderListFilters,
  OrderListPage,
  OrderDetailView,
  OrderListItem,
  OrderVisitView,
  OrderEmailView,
} from "./order-dashboard-read-model";

export interface OrderDetailBundle {
  order: OrderDetailView;
  emails: OrderEmailView[];
  visits: OrderVisitView[];
  visitsTotal: number;
}

export class OrderDashboardQueryService {
  constructor(
    private readonly orders: OrderReadPort,
    private readonly visits: OrderVisitReadPort,
    private readonly emails: OrderEmailReadPort,
  ) {}

  list(filters: OrderListFilters, page: number, limit: number): Promise<OrderListPage> {
    return this.orders.list({ filters, page: Math.max(1, page), limit: clampLimit(limit) });
  }

  forExport(filters: OrderListFilters): Promise<OrderListItem[]> {
    return this.orders.forExport(filters);
  }

  async detail(orderId: string, visitLimit = 50): Promise<OrderDetailBundle | null> {
    const order = await this.orders.detail(orderId);
    if (!order) return null;

    const sessionId = order.attribution?.sessionId;
    const [emails, visitResult] = await Promise.all([
      this.emails.byOrder(order.id),
      sessionId
        ? this.visits.bySession(sessionId, visitLimit)
        : Promise.resolve({ visits: [] as OrderVisitView[], total: 0 }),
    ]);

    return { order, emails, visits: visitResult.visits, visitsTotal: visitResult.total };
  }

  async visitsForOrder(
    orderId: string,
    limit = 100,
  ): Promise<{ visits: OrderVisitView[]; total: number }> {
    const order = await this.orders.detail(orderId);
    const sessionId = order?.attribution?.sessionId;
    if (!sessionId) return { visits: [], total: 0 };
    return this.visits.bySession(sessionId, limit);
  }

  async emailsForOrder(orderId: string): Promise<OrderEmailView[]> {
    const order = await this.orders.detail(orderId);
    if (!order) return [];
    return this.emails.byOrder(order.id);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 30;
  return Math.min(500, Math.floor(limit));
}
