import { describe, expect, it } from "vitest";
import { buildStamp, stalenessOf } from "../src/build.ts";

/**
 * The daemon outlives the command that started it, so "which build is holding
 * the port" is a question every upgrade asks. Before the stamp, `/healthz`
 * answered "0.1.0" forever and no build could tell itself from another.
 */
describe("build stamp", () => {
  it("names this copy: a version, a root, and when its code was written", () => {
    const stamp = buildStamp();
    expect(stamp.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(stamp.root).toMatch(/isocan$/);
    expect(Number.isNaN(Date.parse(stamp.codeAt))).toBe(false);
  });

  it("a daemon from another copy is stale, and the message says which", () => {
    const mine = { version: "0.1.0", root: "/opt/new", codeAt: "2026-08-16T00:00:00.000Z" };
    const verdict = stalenessOf(
      { root: "/tmp/_npx/abc/node_modules/isocan", codeAt: mine.codeAt, startedAt: "2026-08-16T01:00:00.000Z" },
      mine,
    );
    expect(verdict.stale).toBe(true);
    expect(verdict.why).toContain("another copy");
  });

  it("the same copy is stale once its code is newer than the daemon", () => {
    const mine = { version: "0.1.0", root: "/opt/isocan", codeAt: "2026-08-16T12:00:00.000Z" };
    // Upgraded in place at noon; the daemon has been up since morning.
    expect(
      stalenessOf({ root: mine.root, codeAt: mine.codeAt, startedAt: "2026-08-16T09:00:00.000Z" }, mine)
        .stale,
    ).toBe(true);
    // Started after the code landed: this is the build it is running.
    expect(
      stalenessOf({ root: mine.root, codeAt: mine.codeAt, startedAt: "2026-08-16T12:30:00.000Z" }, mine)
        .stale,
    ).toBe(false);
  });

  it("a daemon too old to have a stamp is stale by definition", () => {
    const verdict = stalenessOf({ startedAt: "2026-08-16T09:00:00.000Z" });
    expect(verdict.stale).toBe(true);
    expect(verdict.why).toContain("predates");
  });
});
