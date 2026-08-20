import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import {
  McpToolInputError,
  McpToolNotFoundError,
} from "@/modules/platform/application/invoke-mcp-tool.service";
import { WriteAccessDeniedError } from "@/composition/external-auth";
import { ForbiddenError } from "@/modules/identity/published/principal";
import { PageDashboardError } from "@/modules/authoring/application/page-dashboard-service";
import { FunnelStepError } from "@/modules/authoring/domain/funnel";
import { FunnelNotFoundError } from "@/modules/funnel-dashboard/application/manage-funnels.service";
import { CommerceNotConfiguredError } from "@/composition/make-commerce-gateway";
import { UnsafeUrlError, ResponseTooLargeError } from "@/lib/utils/safe-url";
import { StorageNotConfiguredError } from "@/lib/s3";
import { createLogger } from "@/lib/logger";
import { McpRequestError } from "./tool-errors";

const logger = createLogger("McpErrors");

// Re-exported so existing importers (errors.test.ts, and any future ones) keep resolving
// McpRequestError from here; the class itself lives in ./tool-errors, which tool files import
// directly to keep @modelcontextprotocol/server out of the tool table's import graph.
export { McpRequestError };

// This is the only file allowed to import @modelcontextprotocol/server outside the transport
// layer itself - it keeps the domain modules ignorant of the MCP wire format.
export function toMcpError(err: unknown): Error {
  if (err instanceof McpToolInputError) return new ProtocolError(ProtocolErrorCode.InvalidParams, err.message);
  if (err instanceof McpToolNotFoundError) return new ProtocolError(ProtocolErrorCode.MethodNotFound, err.message);
  if (err instanceof WriteAccessDeniedError) {
    return new ProtocolError(ProtocolErrorCode.InvalidRequest, "Write access is not enabled for this API key. Enable it in API Settings.");
  }
  if (err instanceof ForbiddenError) {
    return new ProtocolError(ProtocolErrorCode.InvalidRequest, "This API key is not granted the feature this tool requires.");
  }
  if (err instanceof McpRequestError) return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);
  if (err instanceof PageDashboardError) return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);
  if (err instanceof FunnelNotFoundError) return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);
  if (err instanceof FunnelStepError) return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);
  if (err instanceof CommerceNotConfiguredError) {
    return new ProtocolError(
      ProtocolErrorCode.InvalidRequest,
      "No ecommerce backend is connected. Configure one in Settings -> Ecommerce before reading the catalog.",
    );
  }

  // Actionable by whoever runs the instance, so the "Settings -> Storage" wording has to reach
  // the caller instead of collapsing into the generic internal-error string below.
  if (err instanceof StorageNotConfiguredError) {
    return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);
  }

  // A rejected or oversized outbound URL is the caller's input, not a server fault; without
  // these the SSRF guard reports "check the server logs" and the caller cannot self-correct.
  if (err instanceof UnsafeUrlError) return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);
  if (err instanceof ResponseTooLargeError) return new ProtocolError(ProtocolErrorCode.InvalidRequest, err.message);

  // Unrecognized failures may carry connection strings or provider payloads, so the
  // client gets a fixed string and the detail stays in the server log.
  logger.error("Unmapped MCP tool failure", { error: err });
  return new ProtocolError(ProtocolErrorCode.InternalError, "The tool failed. Check the server logs for details.");
}
