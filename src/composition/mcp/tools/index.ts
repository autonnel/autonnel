import type { AnyMcpToolDefinition } from "../tool-definition";
import { pageTools } from "./pages";
import { pageTemplateTools } from "./templates";
import { funnelTools } from "./funnels";
import { funnelStepTools } from "./funnel-steps";
import { catalogTools } from "./catalog";
import { reportingTools } from "./reporting";

// Deliberately SDK-free: the REST bridge imports this table, and pulling
// @modelcontextprotocol/server in here would drag the SDK into every /api/v1.1 route bundle.
export function allToolDefinitions(): AnyMcpToolDefinition[] {
  return [
    ...funnelTools(),
    ...funnelStepTools(),
    ...pageTools(),
    ...pageTemplateTools(),
    ...catalogTools(),
    ...reportingTools(),
  ];
}
