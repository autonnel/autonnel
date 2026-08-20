import { z } from "zod";
import type { APIContext } from "astro";
import { makeOrderDashboardQuery, buildOrderFulfillmentDeps } from "@/composition/order-fulfillment-deps";
import { makeOrderFulfillment } from "@/composition/make-order-fulfillment";
import { loadStatsData } from "@/composition/analytics/make-stats";
import { convertDateRangeToUtc } from "@/lib/utils";
import { McpRequestError } from "../tool-errors";
import type { OrderListFilters, OrderStatusKey } from "@/modules/order-fulfillment/application/order-dashboard-read-model";
import type { AnyMcpToolDefinition, McpToolContext } from "../tool-definition";

const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

const DAY_MS = 86_400_000;
const DEFAULT_LOOKBACK_DAYS = 30;

// McpToolContext.locals is intentionally `unknown` so the tool table stays free of Astro
// types; both order-fulfillment-deps factories below only use this to type an ignored
// parameter, so the cast at the call site carries no behavioral risk.
type Locals = APIContext["locals"];

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function parseDateOrThrow(value: string, field: string): number {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) throw new McpRequestError(`Invalid date for ${field}: "${value}"`);
  return ts;
}

function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new McpRequestError(`Invalid timezone: "${timezone}"`);
  }
}

export function reportingTools(): AnyMcpToolDefinition[] {
  return [
    {
      name: "list_orders",
      title: "List orders",
      description:
        "List orders including unpaid ones, with pagination. Filter by status, free-text search (order number or customer email) and a created-at date range. Amounts are converted from minor units assuming a 2-decimal currency.",
      requiredFeature: "ORDERS",
      writeAccess: false,
      // .strict() because the read model has no funnelId filter; a silently dropped
      // funnelId would look like it worked and return the whole tenant's orders.
      inputSchema: z
        .object({
          status: z.array(z.enum(ORDER_STATUSES)).optional(),
          search: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).optional(),
        })
        .strict(),
      async handler(input, ctx: McpToolContext) {
        const filters: OrderListFilters = {};
        if (input.status?.length) filters.status = input.status as OrderStatusKey[];
        if (input.search) filters.search = input.search;
        if (input.startDate) filters.dateFrom = input.startDate;
        if (input.endDate) filters.dateTo = input.endDate;

        const result = await makeOrderDashboardQuery(ctx.locals as Locals).list(
          filters,
          input.page ?? 1,
          Math.min(100, input.limit ?? 20),
        );
        return {
          orders: result.items.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            saleRef: o.saleRef,
            total: o.capturedTotalMinor / 100,
            currency: o.currencyCode,
            customerEmail: o.customerEmail,
            customerName: o.customerName,
            trackingNumber: o.trackingNumber,
            createdAt: o.createdAt,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        };
      },
    },
    {
      name: "deliver_order",
      title: "Mark order delivered",
      description:
        "Mark an order DELIVERED and send the delivery email. Use this when your own logistics data is ahead of what the ecommerce platform reports.",
      requiredFeature: "ORDERS",
      writeAccess: true,
      inputSchema: z.object({ orderId: z.string().min(1) }).strict(),
      async handler(input, ctx: McpToolContext) {
        const fulfillment = makeOrderFulfillment(buildOrderFulfillmentDeps(ctx.locals as Locals));
        const out = await fulfillment.markOrderDelivered.execute(input.orderId);
        // execute() never throws for a no-op; changed:false covers NOT_FOUND (order does not
        // exist), PENDING (not yet paid, can't skip straight to delivered), DELIVERED (already
        // there), and PARTIALLY_REFUNDED/REFUNDED (a refund state blocks further fulfillment
        // transitions). All of those must surface as errors, not as a successful "delivered".
        if (out.state === "NOT_FOUND") {
          throw new McpRequestError(`Order not found: ${input.orderId}`);
        }
        if (!out.changed) {
          throw new McpRequestError(
            `Order ${input.orderId} was not marked delivered - its state is ${out.state}.`,
          );
        }
        return out;
      },
    },
    {
      name: "get_stats",
      title: "Get funnel stats",
      description:
        "Per-step funnel conversion counted by UNIQUE USERS, not page views - five visits by one visitor is 1. Do not compare against raw pageview counts from another system. Defaults to the last 30 days.",
      requiredFeature: "ANALYTICS",
      writeAccess: false,
      inputSchema: z
        .object({
          funnelId: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          timezone: z.string().optional(),
        })
        .strict(),
      async handler(input) {
        const now = new Date();
        const endStr = input.endDate ?? isoDate(now);
        const startStr =
          input.startDate ?? isoDate(new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * DAY_MS));

        const startTs = parseDateOrThrow(startStr, "startDate");
        const endTs = parseDateOrThrow(endStr, "endDate");
        if (startTs > endTs) {
          throw new McpRequestError(
            `Invalid date range: endDate "${endStr}" is before startDate "${startStr}".`,
          );
        }
        const timezone = input.timezone ?? "UTC";
        assertValidTimezone(timezone);

        const { startDate, endDate } = convertDateRangeToUtc(startStr, endStr, timezone);
        const stats = await loadStatsData({
          funnelId: input.funnelId,
          fromBucketKey: startDate.toISOString(),
          toBucketKey: endDate.toISOString(),
        });
        return {
          stats,
          query: {
            funnelId: input.funnelId ?? null,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            timezone,
          },
        };
      },
    },
  ];
}
