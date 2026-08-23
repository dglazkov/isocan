import { describe, expect, it } from "vitest";
import { healthPath } from "../src/protocol.ts";

/**
 * Which health path to ask a daemon at this address for.
 *
 * The measurement behind it is phase 5's, made against the live dev home and
 * not reproducible here: Google's frontend claims the exact path `/healthz`
 * and answers its own branded 404, with the request never reaching the
 * container's log at all. Nothing local can imitate a frontend we do not run,
 * so what these pin is the half we own — that the choice is a function of the
 * ADDRESS, that loopback still gets today's path, and that anything else gets
 * the path Google forwards.
 */
describe("healthPath", () => {
  it("keeps /healthz for a daemon on this machine", () => {
    // The CLI's whole daemon lifecycle lives here — daemonPidOn, ensureDaemon's
    // startup poll, warnIfStale, stopDaemons, `isocan status`. This is the
    // assertion that makes phase 6 an addition rather than a rename.
    expect(healthPath("http://127.0.0.1:4441")).toBe("/healthz");
    expect(healthPath("http://localhost:4441")).toBe("/healthz");
    expect(healthPath("http://[::1]:4441")).toBe("/healthz");
    // The rest of 127/8 is loopback too, and a daemon reached at one is as
    // unproxied as one reached at .1.
    expect(healthPath("http://127.0.0.2:4441")).toBe("/healthz");
  });

  it("asks a hosted home for /api/healthz, because Google eats the other one", () => {
    expect(healthPath("https://dev.isocan.io")).toBe("/api/healthz");
    expect(healthPath("https://isocan.io")).toBe("/api/healthz");
    expect(healthPath("http://192.168.1.20:4441")).toBe("/api/healthz");
    // A hostname that merely CONTAINS the loopback name is a stranger.
    expect(healthPath("https://localhost.example.com")).toBe("/api/healthz");
  });

  it("reads an address that was written without a scheme", () => {
    expect(healthPath("127.0.0.1:4441")).toBe("/healthz");
    expect(healthPath("dev.isocan.io")).toBe("/api/healthz");
  });

  it("treats what it cannot read as remote, because that is the safe way to be wrong", () => {
    // Both paths are answered on loopback, so guessing "remote" costs nothing.
    // Guessing "loopback" about an address nobody could parse would resurrect
    // exactly the failure this function exists to prevent.
    expect(healthPath("")).toBe("/api/healthz");
    expect(healthPath("http://")).toBe("/api/healthz");
  });
});
