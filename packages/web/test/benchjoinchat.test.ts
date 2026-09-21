import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { benchJoinRefusal, benchJoinWords } from "@isocan/core";
import { splitChips } from "../src/lib/chips.ts";
import { withoutComments } from "../../../test/source.ts";

/**
 * **Journey 3, on the surface a person actually types on** (the bench, phase
 * 2). `@Sian join` in the Chat: a chip while it is written, one line in the
 * thread when it lands, and the refusal — which is the security property in
 * this phase, not the copy — when it does not.
 *
 * The wording itself is `packages/core/test/benchjoin.test.ts`'s job, and it
 * is asserted there because it is a fact about a body rather than about a
 * composer. What is checked here is that this surface uses it rather than
 * writing one of its own, and that a refused line is answered to the person
 * who typed it rather than posted where the whole canvas can read it.
 */
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const src = (rel: string) => withoutComments(readFileSync(path.join(repo, rel), "utf8"));

const SIAN = [{ id: "agt_sian", name: "Sian" }];

describe("the line is a chip while it is being typed", () => {
  it("is one chip over the whole line, the way a command is", () => {
    const pieces = splitChips("@Sian join", SIAN, [], [], SIAN);
    expect(pieces.map((piece) => piece.text)).toEqual(["@Sian join"]);
    expect(pieces[0]!.join?.actorId).toBe("agt_sian");
    // Not split into a mention and a loose word: the line is one request.
    expect(pieces[0]!.mention).toBeUndefined();
  });

  it("is plain text when the name is on nobody's bench", () => {
    // `findCommandSpans`' own rule: a chip that offers what will be refused is
    // worse than no chip. The refusal is the composer's job, not the chip's.
    const pieces = splitChips("@Sian join", [], [], [], []);
    expect(pieces.map((piece) => piece.text)).toEqual(["@Sian join"]);
    expect(pieces[0]!.join).toBeUndefined();
  });

  it("never drops or duplicates text, whatever it finds", () => {
    for (const body of ["@Sian join", "@Sian join\nand thanks", "hello @Sian", "", "@Sian joined us"]) {
      expect(splitChips(body, SIAN, [], [], SIAN).map((p) => p.text).join("")).toBe(body);
    }
  });

  it("leaves rendered bodies alone — a bench is read by one person", () => {
    // `rehypeChips` paints what everybody reading this canvas can see. A chip
    // drawn from MY bench would be a chip nobody else's browser agrees with.
    expect(splitChips("@Sian join", SIAN, [], [])[0]!.join).toBeUndefined();
  });
});

/**
 * **What the act does, with the store and the thread mocked out**, so the two
 * things that matter are asserted rather than read: exactly one op, and
 * nothing posted when the line is refused.
 */
const world = vi.hoisted(() => ({
  send: vi.fn(),
  post: vi.fn(),
}));
vi.mock("../src/stores/canvasStore.ts", () => ({ sendEchoedResult: world.send }));
vi.mock("../src/lib/mainthread.ts", () => ({ postToMain: world.post }));
const { joinFromChat } = await import("../src/lib/benchjoin.ts");

const actor = { id: "usr_theo", name: "Theo" };
const ask = (name: string, actorId: string | null) => ({ start: 0, end: 10, name, actorId });
const onBench = (notHereYet: boolean) => ({
  mentions: [{ id: "agt_sian", name: "Sian", notHereYet }],
  canvasId: "prj_bench",
});

beforeEach(() => {
  vi.clearAllMocks();
  world.send.mockResolvedValue({ status: "accepted" });
});

describe("carrying out @Name join", () => {
  it("sends one agent.invite, carrying the bench that vouched", async () => {
    expect(await joinFromChat("prj_1", actor, ask("Sian", "agt_sian"), onBench(true))).toBeNull();
    expect(world.send).toHaveBeenCalledTimes(1);
    expect(world.send.mock.calls[0]![2]).toEqual({
      type: "agent.invite",
      agent: { id: "agt_sian", name: "Sian" },
      from: "prj_bench",
    });
  });

  it("gives the thread one line, and it is core's", async () => {
    await joinFromChat("prj_1", actor, ask("Sian", "agt_sian"), onBench(true));
    expect(world.post).toHaveBeenCalledTimes(1);
    expect(world.post.mock.calls[0]![2]).toBe(benchJoinWords("Sian"));
  });

  it("posts nothing and sends nothing when the name is on nobody's bench", async () => {
    const refused = await joinFromChat("prj_1", actor, ask("Sian", null), {
      mentions: [],
      canvasId: null,
    });
    expect(refused).toBe(benchJoinRefusal("Sian"));
    // The refusal is for the person who typed it. Posting it would tell the
    // whole canvas which names somebody tried, which is the probe again by
    // another route.
    expect(world.post).not.toHaveBeenCalled();
    expect(world.send).not.toHaveBeenCalled();
  });

  it("gives the same refusal for a name that is on somebody else's bench", async () => {
    // Theo's roster is empty in both cases, because it is HIS bench — the two
    // worlds are indistinguishable here by construction, and that is the
    // point being pinned rather than a shortcut in the test.
    const nowhere = await joinFromChat("prj_1", actor, ask("Sian", null), { mentions: [], canvasId: null });
    const elsewhere = await joinFromChat("prj_1", actor, ask("Sian", null), { mentions: [], canvasId: "prj_bench" });
    expect(elsewhere).toBe(nowhere);
  });

  it("does not send a second invite to an agent that already answers here", async () => {
    const said = await joinFromChat("prj_1", actor, ask("Sian", "agt_sian"), onBench(false));
    expect(said).toBe("Sian already answers here");
    expect(world.send).not.toHaveBeenCalled();
    expect(world.post).not.toHaveBeenCalled();
  });

  it("writes no line for an invite the home did not accept", async () => {
    world.send.mockResolvedValue({ status: "refused", message: "the canvas is read-only for you" });
    expect(await joinFromChat("prj_1", actor, ask("Sian", "agt_sian"), onBench(true))).toBe(
      "the canvas is read-only for you",
    );
    expect(world.post).not.toHaveBeenCalled();
  });
});

describe("the composer is wired to it", () => {
  const panel = src("packages/web/src/components/MainThreadPanel.tsx");
  const act = src("packages/web/src/lib/benchjoin.ts");

  it("offers the asker's bench, and only the asker's", () => {
    expect(panel).toContain("useBenchMentions(actor.id)");
    expect(panel).toContain("bench={bench.mentions}");
    // One actor id in, one personal canvas read. There is no argument
    // anywhere on this path that could name a second bench.
    expect(src("packages/web/src/lib/benchmentions.ts")).toContain("readBenchAgents(actorId");
  });

  it("marks a bench row so nobody thinks the agent is already here", () => {
    expect(panel).toContain('const NOT_HERE_YET = "not here yet"');
    expect(panel).toContain("note: NOT_HERE_YET");
    expect(src("packages/web/src/components/MentionField.tsx")).toContain(
      '<span className="mention-note">',
    );
    expect(
      src("packages/web/src/components/command-chip.css"),
      "a stylesheet nothing imports is a stylesheet that does nothing",
    ).toContain(".mention-note");
    expect(panel).toContain('import "./command-chip.css"');
  });

  it("carries the line out instead of posting it, and shows the refusal to the asker", () => {
    expect(panel).toContain("benchJoinAsk(body, bench.mentions)");
    expect(panel).toContain("joinFromChat(canvasId, actor, ask, bench)");
    // Conditioned on the composer being the shell's own since the composer
    // slot landed (20 Sep): while a module holds the row there is no composer
    // to show a refusal under, and `refused` is still set when it comes back.
    expect(panel).toContain("refused && <p role=\"alert\">{refused}</p>");
  });

  it("adds no op — joining from a sentence is joining", () => {
    expect(act).toContain('type: "agent.invite"');
    expect(act).not.toContain("agent.enroll");
    expect(act).not.toMatch(/\brules\b/);
    expect(act).not.toMatch(/\blisten\b/);
  });

  it("spells no refusal of its own", () => {
    expect(act).toContain("benchJoinRefusal(ask.name)");
    expect(act).not.toContain("is not on your bench");
    expect(act).not.toMatch(/unknown/i);
    // And the terminal says the same sentence, from the same function.
    const cli = src("packages/cli/src/bench.ts");
    expect(cli).toContain("benchJoinRefusal(name)");
    expect(cli).not.toContain("nobody called");
  });
});
