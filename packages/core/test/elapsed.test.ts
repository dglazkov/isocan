import { describe, expect, it } from "vitest";
import { elapsedLabel, workedFor } from "../src/index.ts";

const at = (seconds: number) => new Date(Date.UTC(2026, 7, 19, 12, 0, 0) + seconds * 1000).toISOString();

describe("elapsedLabel", () => {
  it("counts seconds under a minute", () => {
    expect(elapsedLabel(at(0), at(4))).toBe("4s");
    expect(elapsedLabel(at(0), at(59))).toBe("59s");
  });

  it("rounds to minutes past that — nobody needs 4m 13.2s", () => {
    expect(elapsedLabel(at(0), at(90))).toBe("2m");
    expect(elapsedLabel(at(0), at(60 * 12))).toBe("12m");
  });

  it("says hours and minutes for a long haul", () => {
    expect(elapsedLabel(at(0), at(3600))).toBe("1h");
    expect(elapsedLabel(at(0), at(3600 + 60 * 12))).toBe("1h 12m");
  });

  it("never counts backwards", () => {
    expect(elapsedLabel(at(60), at(0))).toBe("0s");
  });
});

describe("workedFor", () => {
  it("is null for a note nobody rewrote — no work was measured", () => {
    expect(workedFor({ createdAt: at(0) })).toBeNull();
  });

  it("measures from posting to the last rewrite", () => {
    expect(workedFor({ createdAt: at(0), editedAt: at(300) })).toBe("5m");
  });
});
