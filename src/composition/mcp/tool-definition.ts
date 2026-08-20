import type { ZodType } from "zod";
import type { McpToolDescriptor } from "@/modules/platform/infra/registries/mcp-server";

export interface McpToolContext {
  locals: unknown;
}

export interface McpToolDefinition<I = unknown> extends Omit<McpToolDescriptor, "inputSchema"> {
  inputSchema: ZodType<I>;
  handler(input: I, ctx: McpToolContext): Promise<unknown>;
}

// Tool handlers are heterogeneous by construction, so the collection type erases the
// input parameter. InvokeMcpToolService validates against inputSchema before dispatch.
export type AnyMcpToolDefinition = McpToolDefinition<any>;
