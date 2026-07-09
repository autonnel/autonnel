// Funnel steps are stored in insertion order, but the customer flow must follow the canonical
// workflow: landing → checkout → upsell(s) → thankyou → error. Resolving "next step" by raw array
// order sends checkout straight to thankyou when an upsell is appended after it. Order by rank here
// instead. Page types are stored uppercase (CUSTOM acts as LANDING); unknown/orphaned types sort
// last, and ties keep their original array order (so upsell1 stays before upsell2).

const WORKFLOW_RANK: Record<string, number> = {
  CUSTOM: 1,
  LANDING: 1,
  CHECKOUT: 2,
  UPSELL: 3,
  THANKYOU: 4,
  ERROR: 5,
};

const UNRANKED = 99;

export interface OrderableStep {
  stepSlug?: string;
  pageId?: string;
}

export function workflowRankForType(type: string | null | undefined): number {
  if (!type) return UNRANKED;
  return WORKFLOW_RANK[type.toUpperCase()] ?? UNRANKED;
}

export function orderStepsByWorkflow<T extends OrderableStep>(
  steps: T[],
  typeByPageId: Map<string, string | null | undefined>,
): T[] {
  return steps
    .map((step, index) => ({ step, index, rank: workflowRankForType(typeByPageId.get(step.pageId ?? '')) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.step);
}

export function nextStepInWorkflow<T extends OrderableStep>(
  steps: T[],
  typeByPageId: Map<string, string | null | undefined>,
  currentPageId: string,
): { next: T | null; position: number } {
  const ordered = orderStepsByWorkflow(steps, typeByPageId);
  const position = ordered.findIndex((s) => s.pageId === currentPageId);
  const next = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;
  return { next, position };
}
