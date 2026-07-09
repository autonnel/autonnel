import { describe, it, expect } from "vitest";
import {
  PriceUnavailableError,
  IllegalHandoffTransitionError,
  HandoffTotalMismatchError,
} from "./errors";

describe("commerce-gateway domain errors", () => {
  it("PriceUnavailableError carries the variant ref", () => {
    const e = new PriceUnavailableError("gid://v/1");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PriceUnavailableError");
    expect(e.message).toContain("gid://v/1");
  });
  it("IllegalHandoffTransitionError names from/to", () => {
    const e = new IllegalHandoffTransitionError("succeeded", "submitting");
    expect(e.message).toContain("succeeded");
    expect(e.message).toContain("submitting");
  });
  it("HandoffTotalMismatchError reports both totals", () => {
    const e = new HandoffTotalMismatchError(1999, 2099);
    expect(e.message).toContain("1999");
    expect(e.message).toContain("2099");
  });
});
