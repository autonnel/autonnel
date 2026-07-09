import { createLogger } from "@/lib/logger";

const logger = createLogger("WooRestClient");

export interface WooRestClientConfig {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  apiVersion?: string;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_API_VERSION = "wc/v3";

function toBase64(value: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf-8").toString("base64");
  if (typeof btoa !== "undefined") return btoa(value);
  throw new Error("No base64 encoder available in this runtime");
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export class WooRestClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(
    config: WooRestClientConfig,
    // Arrow, not bare `fetch`: called as `this.fetchFn(...)` a bare reference rebinds `this` and
    // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {
    if (!config.siteUrl) throw new Error("WooCommerce siteUrl is required");
    if (!config.consumerKey) throw new Error("WooCommerce consumerKey is required");
    if (!config.consumerSecret) throw new Error("WooCommerce consumerSecret is required");
    const apiVersion = config.apiVersion || DEFAULT_API_VERSION;
    this.baseUrl = `${trimSlash(config.siteUrl)}/wp-json/${apiVersion}`;
    this.authHeader = `Basic ${toBase64(`${config.consumerKey}:${config.consumerSecret}`)}`;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const init: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);

    const response = await this.fetchFn(url, init);
    const text = await response.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!response.ok) {
      const message =
        parsed?.message ||
        (typeof parsed === "string" ? parsed : `WooCommerce API error ${response.status}`);
      logger.error("WooCommerce REST error", { method, path, status: response.status, message });
      throw new Error(message);
    }
    return parsed as T;
  }
}
