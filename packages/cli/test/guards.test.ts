import { describe, expect, it } from "vitest";
import { gateTurn, type GuardState } from "../src/rc.ts";

/**
 * **The dispatch guards, tested as the arithmetic they are** (phase 5).
 * The first version of these proofs was a four-process cascade — real rc,
 * real adapters, real CLI replies — which flaked on every loaded CI box:
 * an end-to-end pretending to be a unit test. The journey scene survives
 * in dispatch.test.ts at its smallest deterministic shape; the COUNTING —
 * chains, windows, announce-once — lives here, where a clock is a number.
 */

const T0 = 1_000_000_000_000;
const LIMITS = { turnsPerHour: 12, agentChain: 3 };
const fresh = (): GuardState => ({ turnTimes: [], agentChain: 0, held: null });

describe("the cycle guard counts conversations, not turns", () => {
  it("agent-only batches climb the chain and stop at the bound", () => {
    const state = fresh();
    // Three agent-to-agent turns pass…
    for (let i = 0; i < 3; i++) {
      expect(gateTurn(state, false, LIMITS, T0 + i).verdict).toBe("dispatch");
    }
    expect(state.agentChain).toBe(3);
    // …and the fourth is held, with no timer: only a person lifts it.
    const held = gateTurn(state, false, LIMITS, T0 + 3);
    expect(held).toEqual({ verdict: "hold-cycle", announce: true });
  });

  it("a person's word resets the chain — agents may talk as long as a human stays in the room", () => {
    const state = fresh();
    for (let i = 0; i < 3; i++) gateTurn(state, false, LIMITS, T0 + i);
    expect(gateTurn(state, true, LIMITS, T0 + 3).verdict).toBe("dispatch");
    expect(state.agentChain).toBe(0);
    // The runway is full again.
    for (let i = 0; i < 3; i++) {
      expect(gateTurn(state, false, LIMITS, T0 + 4 + i).verdict).toBe("dispatch");
    }
    expect(gateTurn(state, false, LIMITS, T0 + 8).verdict).toBe("hold-cycle");
  });

  it("a bound of zero means no agent-to-agent turns at all", () => {
    const state = fresh();
    expect(gateTurn(state, false, { ...LIMITS, agentChain: 0 }, T0).verdict).toBe("hold-cycle");
    expect(gateTurn(state, true, { ...LIMITS, agentChain: 0 }, T0).verdict).toBe("dispatch");
  });

  it("the refusal is announced once per hold, not once per lap", () => {
    const state = fresh();
    state.agentChain = 3;
    expect(gateTurn(state, false, LIMITS, T0)).toEqual({ verdict: "hold-cycle", announce: true });
    expect(gateTurn(state, false, LIMITS, T0 + 1)).toEqual({ verdict: "hold-cycle", announce: false });
    // A person lifts it; the NEXT hold announces again.
    expect(gateTurn(state, true, LIMITS, T0 + 2).verdict).toBe("dispatch");
    state.agentChain = 3;
    expect(gateTurn(state, false, LIMITS, T0 + 3)).toEqual({ verdict: "hold-cycle", announce: true });
  });
});

describe("the ceiling is a sliding hour", () => {
  it("the thirteenth turn in an hour waits for the first to age out", () => {
    const state = fresh();
    for (let i = 0; i < 12; i++) {
      expect(gateTurn(state, true, LIMITS, T0 + i * 1000).verdict).toBe("dispatch");
    }
    const held = gateTurn(state, true, LIMITS, T0 + 12_000);
    expect(held.verdict).toBe("hold-ceiling");
    if (held.verdict === "hold-ceiling") {
      expect(held.announce).toBe(true);
      // The window frees exactly an hour after the OLDEST turn…
      expect(held.freesAt).toBe(T0 + 3_600_000);
      // …and the re-check never waits more than a minute at a time.
      expect(held.retryAfter).toBe(T0 + 12_000 + 60_000);
    }
  });

  it("turns older than the hour fall out of the window", () => {
    const state = fresh();
    for (let i = 0; i < 12; i++) gateTurn(state, true, LIMITS, T0 + i);
    // An hour past the LAST of them, the window is empty again.
    expect(gateTurn(state, true, LIMITS, T0 + 3_600_012).verdict).toBe("dispatch");
    expect(state.turnTimes).toHaveLength(1);
  });

  it("announces once, then quietly holds until the window frees", () => {
    const state = fresh();
    for (let i = 0; i < 12; i++) gateTurn(state, true, LIMITS, T0 + i);
    const first = gateTurn(state, true, LIMITS, T0 + 100);
    const second = gateTurn(state, true, LIMITS, T0 + 200);
    expect(first.verdict === "hold-ceiling" && first.announce).toBe(true);
    expect(second.verdict === "hold-ceiling" && second.announce).toBe(false);
    expect(gateTurn(state, true, LIMITS, T0 + 3_600_005).verdict).toBe("dispatch");
  });

  it("the cycle guard outranks the ceiling — a chain hold never burns window bookkeeping", () => {
    const state = fresh();
    state.agentChain = 3;
    for (let i = 0; i < 12; i++) state.turnTimes.push(T0 + i);
    expect(gateTurn(state, false, LIMITS, T0 + 100).verdict).toBe("hold-cycle");
    expect(state.turnTimes).toHaveLength(12); // untouched by the earlier verdict
  });
});
