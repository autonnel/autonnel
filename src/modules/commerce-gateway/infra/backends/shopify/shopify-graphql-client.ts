import { ErrorClassifier } from "../../../domain/services/error-classifier";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ShopifyGraphqlClient");

export interface ShopifyClientConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class ShopifyGraphqlClient {
  private readonly classifier = new ErrorClassifier();

  constructor(
    private readonly config: ShopifyClientConfig,
    // Wrap rather than default to bare `fetch`: stored as an instance field and called as
    // `this.fetchFn(...)`, a bare reference rebinds `this` to the client, which the Workers
    // runtime rejects with "Illegal invocation". The arrow always calls global fetch unbound.
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {}

  async query<T>(query: string, variables: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const url = `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`;
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": this.config.accessToken,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (cause) {
      logger.error("Shopify request failed", { error: cause });
      throw this.classifier.fromNetwork(cause);
    }

    if (!response.ok) {
      const raw = await safeJson(response);
      throw this.classifier.fromHttp(response.status, raw);
    }

    const body = (await response.json()) as { data?: T; errors?: unknown };
    if (body.errors) {
      throw this.classifier.fromUserErrors(
        Array.isArray(body.errors) ? (body.errors as never[]) : [],
      );
    }
    return body.data as T;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
