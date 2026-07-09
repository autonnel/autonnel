import type { Transition } from '../value-objects/routing-rule';

export interface ReachabilityInput {
  entryStepSlug: string;
  steps: string[];
  transitions: Transition[];
}

export interface ReachabilityResult {
  ok: boolean;
  unreachable: string[];
  issues: string[];
}

export class FunnelReachabilityService {
  analyze(input: ReachabilityInput): ReachabilityResult {
    const issues: string[] = [];
    const stepSet = new Set(input.steps);

    if (!stepSet.has(input.entryStepSlug)) {
      issues.push(`Entry step "${input.entryStepSlug}" is not a declared step`);
    }
    for (const t of input.transitions) {
      if (!stepSet.has(t.fromStepSlug)) issues.push(`Transition from unknown step "${t.fromStepSlug}"`);
      if (!stepSet.has(t.toStepSlug)) issues.push(`Transition to unknown step "${t.toStepSlug}"`);
    }

    const adjacency = new Map<string, string[]>();
    for (const t of input.transitions) {
      if (stepSet.has(t.fromStepSlug) && stepSet.has(t.toStepSlug)) {
        (adjacency.get(t.fromStepSlug) ?? adjacency.set(t.fromStepSlug, []).get(t.fromStepSlug)!).push(t.toStepSlug);
      }
    }

    const reachable = new Set<string>();
    if (stepSet.has(input.entryStepSlug)) {
      const stack = [input.entryStepSlug];
      while (stack.length) {
        const node = stack.pop()!;
        if (reachable.has(node)) continue;
        reachable.add(node);
        for (const next of adjacency.get(node) ?? []) stack.push(next);
      }
    }

    const unreachable = input.steps.filter((s) => !reachable.has(s));
    if (unreachable.length > 0) issues.push(`Unreachable steps: ${unreachable.join(', ')}`);

    return { ok: issues.length === 0, unreachable, issues };
  }
}
