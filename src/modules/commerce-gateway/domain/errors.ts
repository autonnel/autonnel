export class PriceUnavailableError extends Error {
  constructor(variantRef: string) {
    super(`Price unavailable for variant ${variantRef}`);
    this.name = "PriceUnavailableError";
  }
}

export class IllegalHandoffTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal handoff transition ${from} -> ${to}`);
    this.name = "IllegalHandoffTransitionError";
  }
}

export class HandoffTotalMismatchError extends Error {
  constructor(capturedTotalMinor: number, handoffGrandTotalMinor: number) {
    super(
      `Handoff total mismatch: captured ${capturedTotalMinor} != handoff ${handoffGrandTotalMinor}`,
    );
    this.name = "HandoffTotalMismatchError";
  }
}
