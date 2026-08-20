import type { InProcessMcpServer } from "../infra/registries/mcp-server";

export class McpToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = "McpToolNotFoundError";
  }
}

export interface McpToolIssue {
  path: string;
  message: string;
}

export class McpToolInputError extends Error {
  constructor(
    message: string,
    readonly issues: McpToolIssue[],
  ) {
    super(message);
    this.name = "McpToolInputError";
  }
}

export interface McpAuthorizationPort {
  requireFeature(key: string): void;
  requireWriteAccess(): void;
}

export class InvokeMcpToolService {
  constructor(
    private readonly server: InProcessMcpServer,
    private readonly authz: McpAuthorizationPort,
  ) {}

  // Authorization runs before validation so an unauthorized caller cannot probe
  // a tool's schema through the error messages.
  async execute(name: string, rawInput: unknown): Promise<unknown> {
    const found = this.server.find(name);
    if (!found) throw new McpToolNotFoundError(name);

    this.authz.requireFeature(found.descriptor.requiredFeature);
    if (found.descriptor.writeAccess) this.authz.requireWriteAccess();

    const parsed = found.descriptor.inputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      const summary = issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ");
      throw new McpToolInputError(`Invalid arguments for ${name} - ${summary}`, issues);
    }

    return found.invoke(parsed.data);
  }
}
