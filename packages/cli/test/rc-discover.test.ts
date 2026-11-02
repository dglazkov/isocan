import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ActorBindingRecord, Canvas, EnrolledAgent } from "@isocan/core";
import { RC_DISCOVER_MS, decide, discoverEvery, heldAgents, survey } from "../src/rc-discover.ts";
import type { RcAgentRow } from "../src/rc.ts";

/**
 * **The rc hears invites — the decision** (pets phase 1). The walk with a
 * real daemon is `rc.test.ts`'s "the rc hears invites"; this holds the pure
 * half: who counts as held, when a look reads a roster, and what it opens
 * and closes.
 */

const actor = (id: string, name = id) => ({ id, name });
const binding = (key: string, id: string): ActorBindingRecord => ({ key, actor: actor(id), boundAt: "2026-10-01T00:00:00Z" });
const row = (canvasId: string, actorId: string): RcAgentRow => ({ canvasId, actorId, name: actorId, harness: null, cwd: "/tmp", sessionId: null });
const canvas = (id: string, updatedAt = "t1"): Canvas => ({
  id,
  title: `Acme ${id}`,
  description: "",
  properties: {},
  createdAt: "t0",
  createdBy: actor("usr_a"),
  updatedAt,
  updatedBy: actor("usr_a"),
});
const roster = (...ids: string[]): Record<string, EnrolledAgent> =>
  Object.fromEntries(ids.map((id) => [id, { actor: actor(id) } as EnrolledAgent]));

describe("heldAgents", () => {
  it("is the agent-keyed claims and the rows, never the person or their harness sessions", () => {
    const held = heldAgents(
      [binding("agent:mac", "act_scout"), binding("claude:abc", "act_session"), binding("agent:mac2", "usr_owner")],
      [row("prj_1", "act_percy")],
      "usr_owner",
    );
    expect([...held].sort()).toEqual(["act_percy", "act_scout"]);
  });
});

describe("survey and decide", () => {
  it("reads a roster only when the stamp moved, opens where held agents stand, closes where none do — never the bound canvas", async () => {
    const reads: string[] = [];
    const rosters: Record<string, Record<string, EnrolledAgent>> = {
      prj_a: roster("act_scout"),
      prj_b: roster("act_stranger"),
      prj_c: roster(),
    };
    const rosterOf = async (id: string) => {
      reads.push(id);
      return rosters[id] ?? null;
    };
    const memory = { stamps: new Map<string, string>(), held: "" };
    const held = new Set(["act_scout"]);
    const first = await survey([canvas("prj_a"), canvas("prj_b"), canvas("prj_c")], held, memory, rosterOf);
    expect(reads).toEqual(["prj_a", "prj_b", "prj_c"]);
    expect(decide(first, new Set(), null).open.map((c) => c.id)).toEqual(["prj_a"]);

    // A quiet home: nothing read.
    reads.length = 0;
    expect((await survey([canvas("prj_a"), canvas("prj_b"), canvas("prj_c")], held, memory, rosterOf)).size).toBe(0);
    expect(reads).toEqual([]);

    // An invite on prj_c moves its stamp: only it is read, and it opens.
    rosters.prj_c = roster("act_scout");
    const invited = await survey([canvas("prj_a"), canvas("prj_b"), canvas("prj_c", "t2")], held, memory, rosterOf);
    expect(reads).toEqual(["prj_c"]);
    expect(decide(invited, new Set(["prj_a"]), null)).toEqual({ open: [canvas("prj_c", "t2")], close: [] });

    // Withdrawn from prj_a: the room there closes — unless prj_a is bound.
    rosters.prj_a = roster();
    const withdrawn = await survey([canvas("prj_a", "t3"), canvas("prj_b"), canvas("prj_c", "t2")], held, memory, rosterOf);
    expect(decide(withdrawn, new Set(["prj_a", "prj_c"]), null).close).toEqual(["prj_a"]);
    expect(decide(withdrawn, new Set(["prj_a", "prj_c"]), "prj_a").close).toEqual([]);

    // A newly held agent is a reason to read everything once more.
    reads.length = 0;
    await survey([canvas("prj_a", "t3"), canvas("prj_b"), canvas("prj_c", "t2")], new Set(["act_scout", "act_stranger"]), memory, rosterOf);
    expect(reads.sort()).toEqual(["prj_a", "prj_b", "prj_c"]);
  });

  it("a canvas that could not be read is tried again next look", async () => {
    const memory = { stamps: new Map<string, string>(), held: "" };
    let answer: Record<string, EnrolledAgent> | null = null;
    const rosterOf = async () => answer;
    expect((await survey([canvas("prj_a")], new Set(["act_scout"]), memory, rosterOf)).size).toBe(0);
    answer = roster("act_scout");
    expect((await survey([canvas("prj_a")], new Set(["act_scout"]), memory, rosterOf)).get("prj_a")?.holds).toBe(true);
  });
});

describe("the interval", () => {
  it("is thirty seconds unless the environment shortens it, and the guide says the same number", () => {
    expect(RC_DISCOVER_MS).toBe(30_000);
    expect(discoverEvery({})).toBe(30_000);
    expect(discoverEvery({ ISOCAN_RC_DISCOVER_MS: "250" })).toBe(250);
    expect(discoverEvery({ ISOCAN_RC_DISCOVER_MS: "nonsense" })).toBe(30_000);
    const guide = readFileSync(fileURLToPath(new URL("../src/agent-guide.md", import.meta.url)), "utf8");
    expect(guide).toContain(`within ${RC_DISCOVER_MS / 1000}\nseconds`);
    expect(guide).toContain(`\`isocan rc --all\` does within ${RC_DISCOVER_MS / 1000} seconds`);
  });
});
