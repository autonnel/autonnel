import { describe, it, expect } from "vitest";
import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import {
  McpToolInputError,
  McpToolNotFoundError,
} from "@/modules/platform/application/invoke-mcp-tool.service";
import { WriteAccessDeniedError } from "@/composition/external-auth";
import { ForbiddenError } from "@/modules/identity/published/principal";
import { toFeatureKey } from "@/modules/identity/domain/feature-key";
import { PageDashboardError } from "@/modules/authoring/application/page-dashboard-service";
import { FunnelNotFoundError } from "@/modules/funnel-dashboard/application/manage-funnels.service";
import { FunnelStepError } from "@/modules/authoring/domain/funnel";
import { CommerceNotConfiguredError } from "@/composition/make-commerce-gateway";
import { UnsafeUrlError, ResponseTooLargeError } from "@/lib/utils/safe-url";
import { toMcpError, McpRequestError } from "./errors";

// `InvalidParamsError` / `InvalidRequestError` / `MethodNotFoundError` / `InternalError` exported
// by @modelcontextprotocol/server are type-only JSON-RPC error-object shapes, not constructable
// classes (see node_modules/@modelcontextprotocol/server/dist/index.d.mts). The real wire error is
// the single `ProtocolError` class carrying a `ProtocolErrorCode`.

describe("toMcpError", () => {
  it("maps an input error to InvalidParams and keeps the field path", () => {
    const mapped = toMcpError(new McpToolInputError("Invalid arguments for x - pageId: required", [
      { path: "pageId", message: "required" },
    ]));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidParams);
    expect(mapped.message).toContain("pageId");
  });

  it("maps an unknown tool to MethodNotFound", () => {
    const mapped = toMcpError(new McpToolNotFoundError("nope"));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.MethodNotFound);
  });

  it("maps a write-access denial to InvalidRequest", () => {
    const mapped = toMcpError(new WriteAccessDeniedError());
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toMatch(/write access/i);
  });

  it("maps a feature denial to InvalidRequest", () => {
    const mapped = toMcpError(new ForbiddenError(toFeatureKey("PAGES")));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
  });

  it("maps a page-domain error to InvalidRequest preserving its message", () => {
    const mapped = toMcpError(new PageDashboardError(404, "Page not found"));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toBe("Page not found");
  });

  it("maps a missing funnel to InvalidRequest", () => {
    const mapped = toMcpError(new FunnelNotFoundError("f1"));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
  });

  it("maps a funnel step invariant violation to InvalidRequest preserving its message", () => {
    const mapped = toMcpError(new FunnelStepError('stepSlug must be unique within funnel: "lp"'));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toBe('stepSlug must be unique within funnel: "lp"');
  });

  it("maps an unconfigured commerce backend to InvalidRequest with an actionable message", () => {
    const mapped = toMcpError(new CommerceNotConfiguredError());
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toBe(
      "No ecommerce backend is connected. Configure one in Settings -> Ecommerce before reading the catalog.",
    );
  });

  it("maps a generic tool-request error to InvalidRequest preserving its message", () => {
    const mapped = toMcpError(new McpRequestError("Unknown template key: NOPE"));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toBe("Unknown template key: NOPE");
  });

  it("maps unconfigured storage to InvalidRequest so the caller is told where to configure it", async () => {
    const { StorageNotConfiguredError } = await import("@/lib/s3");
    const mapped = toMcpError(new StorageNotConfiguredError()) as ProtocolError;
    expect(mapped.code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toMatch(/Settings/);
  });

  it("maps anything unrecognized to InternalError without leaking the message", () => {
    const mapped = toMcpError(new Error("connection string postgres://user:pw@host/db"));
    expect(mapped).toBeInstanceOf(ProtocolError);
    expect((mapped as ProtocolError).code).toBe(ProtocolErrorCode.InternalError);
    expect(mapped.message).not.toContain("postgres://");
  });

  it("maps a rejected outbound URL to InvalidRequest so the caller learns why", () => {
    const mapped = toMcpError(new UnsafeUrlError("resolves to a private address")) as ProtocolError;
    expect(mapped.code).toBe(ProtocolErrorCode.InvalidRequest);
    expect(mapped.message).toMatch(/private address/);
  });

  it("maps an oversized response to InvalidRequest", () => {
    const mapped = toMcpError(new ResponseTooLargeError(1024)) as ProtocolError;
    expect(mapped.code).toBe(ProtocolErrorCode.InvalidRequest);
  });
});
