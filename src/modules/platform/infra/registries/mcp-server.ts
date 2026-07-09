// Authorization (requiredFeature -> the Identity AuthorizationPort) is enforced by InvokeMcpToolService; this registry only holds the descriptor table + invoker map.
export interface McpToolDescriptor {
  name: string;
  description: string;
  requiredFeature: string;
}

type ToolInvoker = (input: unknown) => Promise<unknown>;

export class InProcessMcpServer {
  private readonly tools = new Map<string, { descriptor: McpToolDescriptor; invoke: ToolInvoker }>();

  registerTool(descriptor: McpToolDescriptor, invoke: ToolInvoker): void {
    if (this.tools.has(descriptor.name)) throw new Error(`mcp tool "${descriptor.name}" already registered`);
    this.tools.set(descriptor.name, { descriptor, invoke });
  }

  listTools(): McpToolDescriptor[] {
    return [...this.tools.values()].map((t) => t.descriptor);
  }

  resolve(name: string): ToolInvoker | undefined {
    return this.tools.get(name)?.invoke;
  }
}
