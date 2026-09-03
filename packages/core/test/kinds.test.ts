import { describe, expect, it } from "vitest";
import { actorKinds, bindName, emptyActorRegistry, isAgentHarness, PERSON_HARNESSES } from "../src/claims.ts";
import { buildCorpus } from "../src/evals.ts";
import type { CanvasContents } from "../src/model.ts";

/**
 * **The canvas knows who is an agent** — recorded at claim time from the
 * session key's harness, read back by `actorKinds`. Until this the only
 * mark was `agent.enroll`, which almost nobody ran, and the request corpus
 * counted agents' receipts as asks (73% of it, 3 Sep 2026).
 */
const T = "2026-09-03T10:00:00.000Z";

describe("a claim records its harness, and the harness says who is an agent", () => {
  it("writes the harness beside the name, and leaves it alone when the claim has no key", () => {
    let registry = emptyActorRegistry();
    registry = bindName(registry, { actor: { id: "usr_c", name: "Canny" }, ts: T, sessionKey: "claude-code:s-1" });
    registry = bindName(registry, { actor: { id: "usr_d", name: "Di" }, ts: T, sessionKey: "web:per-1" });
    registry = bindName(registry, { actor: { id: "usr_b", name: "Board" }, ts: T, sessionKey: "board:isocan-board" });
    registry = bindName(registry, { actor: { id: "usr_e", name: "Sian" }, ts: T, sessionKey: "agent:Sian" });
    registry = bindName(registry, { actor: { id: "usr_legacy", name: "Old" }, ts: T });
    expect(registry.harnesses).toEqual({ usr_c: "claude-code", usr_d: "web", usr_b: "board", usr_e: "agent" });
    expect(actorKinds(registry)).toEqual({ usr_c: "agent", usr_b: "agent", usr_e: "agent" });
  });

  it("is a list of people, so a harness nobody has heard of is an agent by default", () => {
    for (const person of PERSON_HARNESSES) expect(isAgentHarness(person)).toBe(false);
    expect(isAgentHarness("Web")).toBe(false);
    expect(isAgentHarness("codex")).toBe(true);
    expect(isAgentHarness("some-new-harness")).toBe(true);
    expect(isAgentHarness(null)).toBe(false);
    expect(isAgentHarness("")).toBe(false);
  });

  it("keeps the newest harness when an actor is claimed again from somewhere else", () => {
    let registry = emptyActorRegistry();
    registry = bindName(registry, { actor: { id: "usr_c", name: "Canny" }, ts: T, sessionKey: "claude-code:s-1" });
    registry = bindName(registry, { actor: { id: "usr_c", name: "Canny" }, ts: "2026-09-04T10:00:00.000Z", sessionKey: "codex:s-2" });
    expect(registry.harnesses?.usr_c).toBe("codex");
  });

  it("follows a join, so a folded agent's id still reads as an agent", () => {
    let registry = emptyActorRegistry();
    registry = bindName(registry, { actor: { id: "usr_old", name: "Canny" }, ts: T, sessionKey: "claude-code:s-1" });
    registry = { ...registry, joined: { usr_old: "usr_new" } };
    expect(actorKinds(registry)).toEqual({ usr_new: "agent" });
  });
});

describe("the corpus reads known agents beside the roster", () => {
  const canvas = (): CanvasContents => ({
    items: {},
    threads: {
      main: {
        id: "main",
        x: 0,
        y: 0,
        anchorItemId: null,
        main: true,
        createdAt: T,
        createdBy: { id: "usr_d", name: "Di" },
        comments: [
          { id: "c1", body: "build the tracker", author: { id: "usr_d", name: "Di" }, createdAt: T },
          { id: "c2", body: "Done — #Tracker is up.", author: { id: "usr_c", name: "Canny" }, createdAt: "2026-09-03T10:05:00.000Z" },
        ],
      },
    },
    trash: [],
  });

  it("counts an unenrolled agent's Chat receipt as a reply, not an ask, once the registry knows it", () => {
    const blind = buildCorpus(canvas(), []);
    expect(blind.summary).toMatchObject({ asks: 2, broadcastUnfiltered: true });
    const sighted = buildCorpus(canvas(), [], ["usr_c"]);
    expect(sighted.summary).toMatchObject({ asks: 1, answered: 1, broadcastUnfiltered: false });
    expect(sighted.asks[0]!.answeredBy).toBe("Canny");
  });
});
