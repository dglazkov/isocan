import { describe, expect, it } from "vitest";
import { ROLL_AWAY_MS } from "@isocan/core";
import { agentsPresent, ARRIVAL_SETTLE_MS, arrivalsFor, NO_ARRIVALS, type ArrivalMemory } from "../src/lib/arrivals.ts";

/**
 * **The arrival toast's rules, without a browser** (`lib/arrivals.ts`): a
 * canvas opening is quiet, a first sighting says "joined", a flap says
 * nothing, and a return after the rc's own away window says "back".
 */
const ACME = "prj_acme";
const T0 = 1_000_000;

/** Reads presence in order; each step is [ms since T0, ids present]. */
function walk(steps: [number, string[]][], ready = true) {
  let memory: ArrivalMemory = NO_ARRIVALS;
  const said: string[] = [];
  for (const [at, ids] of steps) {
    const read = arrivalsFor(memory, ACME, new Set(ids), ready, T0 + at);
    memory = read.memory;
    for (const a of read.arrived) said.push(`${at}:${a.id} ${a.kind}`);
  }
  return said;
}

describe("who just showed up", () => {
  it("is quiet on opening a canvas: whoever is already here did not just join", () => {
    expect(walk([[0, ["act_wren", "act_finch"]], [1_000, ["act_wren", "act_finch"]], [20_000, ["act_wren", "act_finch"]]])).toEqual([]);
    // …including what lands while the page is still learning presence.
    expect(walk([[0, []], [ARRIVAL_SETTLE_MS - 1, ["act_wren"]], [20_000, ["act_wren"]]])).toEqual([]);
  });

  it("learns nothing before presence is readable at all", () => {
    expect(walk([[0, ["act_wren"]], [60_000, ["act_wren"]]], false)).toEqual([]);
  });

  it("says joined when an agent shows up after the canvas is open", () => {
    expect(walk([[0, []], [30_000, ["act_wren"]], [40_000, ["act_wren"]]])).toEqual(["30000:act_wren joined"]);
  });

  it("says nothing for a quick flap — gone for one poll, or a minute", () => {
    expect(
      walk([
        [0, ["act_wren"]],
        [30_000, []],
        [40_000, ["act_wren"]],
        [100_000, []],
        [160_000, ["act_wren"]],
      ]),
    ).toEqual([]);
  });

  it("says back after the rc's own away window, measured from when it left", () => {
    const left = 3_600_000; // here for an hour first: the gap starts at leaving
    expect(
      walk([
        [0, ["act_wren"]],
        [left, []],
        [left + ROLL_AWAY_MS - 1_000, ["act_wren"]],
        [left + ROLL_AWAY_MS, []],
        [left + 2 * ROLL_AWAY_MS + 1_001, ["act_wren"]],
      ]),
    ).toEqual([`${left + 2 * ROLL_AWAY_MS + 1_001}:act_wren back`]);
  });

  it("starts over on another canvas", () => {
    let memory: ArrivalMemory = NO_ARRIVALS;
    memory = arrivalsFor(memory, ACME, new Set(), true, T0).memory;
    memory = arrivalsFor(memory, ACME, new Set(), true, T0 + 10_000).memory;
    const other = arrivalsFor(memory, "prj_board", new Set(["act_wren"]), true, T0 + 20_000);
    expect(other.arrived).toEqual([]);
  });
});

describe("who counts", () => {
  const me = { id: "usr_ada", name: "Ada" };
  const session = (id: string, name: string, extra: { kind?: "web" | "cli" | "rc"; harness?: string } = {}) => ({
    actor: { id, name },
    kind: extra.kind ?? "cli",
    ...(extra.harness ? { harness: extra.harness } : {}),
  });

  it("agents a live rc answers for and agent sessions, never people and never you", () => {
    const ids = agentsPresent(
      new Set(["act_wren"]),
      [
        session("act_finch", "Finch", { harness: "claude-code" }),
        session("usr_bea", "Bea", { kind: "web" }),
        session("usr_ada", "Ada", { kind: "rc" }),
        session("act_quill", "Quill"),
        session("usr_ada", "Ada", { harness: "claude-code" }),
      ],
      { act_quill: {} },
      {},
      me.id,
    );
    expect([...ids].sort()).toEqual(["act_finch", "act_quill", "act_wren"]);
  });

  it("you under another of your names is still you", () => {
    const ids = agentsPresent(new Set(["usr_ada_2"]), [], undefined, {}, me.id, {
      usr_ada_2: "usr_ada",
    });
    expect([...ids]).toEqual([]);
  });

  it("so your own agent session showing up is quiet end to end", () => {
    let memory: ArrivalMemory = NO_ARRIVALS;
    memory = arrivalsFor(memory, ACME, agentsPresent(new Set(), [], undefined, {}, me.id), true, T0).memory;
    const mine = agentsPresent(new Set(), [session("usr_ada", "Ada", { harness: "codex" })], undefined, {}, me.id);
    expect(arrivalsFor(memory, ACME, mine, true, T0 + 60_000).arrived).toEqual([]);
  });
});
