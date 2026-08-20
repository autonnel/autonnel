// Thrown by tool handlers for caller-fixable failures (unknown key, bad input, upstream
// refusal) so they need not borrow a status-code carrier from an unrelated module.
//
// Deliberately SDK-free: tool files import this directly (not errors.ts) so the tool table
// (src/composition/mcp/tools/index.ts) never transitively reaches @modelcontextprotocol/server -
// errors.ts also imports the SDK's ProtocolError for toMcpError, and that import would otherwise
// leak into every /api/v1.1 route bundle through the tool table.
export class McpRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpRequestError";
  }
}
