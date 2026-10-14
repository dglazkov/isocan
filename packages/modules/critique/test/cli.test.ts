import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import type { CommentThread, Item, Operation } from "@isocan/core";
import type { CliHost, EnrolRequest } from "@isocan/cli/modulehost";
import critiqueCli from "../src/cli.ts";
import { registerModule, unregisterModule } from "@isocan/core";
import critiqueCore, { CRITICS_POINT, CRITIC_PROP, CRITIC_TEMPLATE, criticMarkdown, noteBody, readNoteBody, type RosterCritic } from "../src/core.ts";

/**
 * **Asking a critic, and its two answers** — driven in process through the
 * module's `register`, with a host and a client that record what they are
 * asked. The rc's half (the wake, the turn, the budget) has its own tests in
 * `packages/rc/test/room.test.ts`; this holds the module's part: what is
 * enrolled and from which bytes, the one thread that asks, where a note pins
 * and what its first line says, and the refusals. Synthetic throughout.
 */

const ADA = { id: "usr_ada", name: "Ada" };
const QUIET = { id: "act_quiet", name: "Quiet Hands" };

const card = (extra = "") =>
  criticMarkdown({
    name: "quiet-hands",
    agentName: "Quiet Hands",
    credit: "after Ada Acme's work; not affiliated",
    color: "#336699",
    lens: { questions: ["Is it calm?", "What could go?", "Does the content lead?"], looksFor: "Noise first.", ranks: "Calm over clever." },
  }) + extra;

function item(id: string, title: string, props: Record<string, string> = {}, size = { width: 400, height: 800 }): Item {
  return {
    id,
    title,
    x: 0,
    y: 0,
    ...size,
    properties: props,
    currentVersionId: `ver_${id}`,
    versions: [{ id: `ver_${id}`, blobHash: `blob_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 1 }],
  } as unknown as Item;
}

function harness(opts: { parked?: boolean; owners?: { id: string; name: string }[]; as?: { id: string; name: string }; refuseCeiling?: string; reused?: boolean } = {}) {
  const program = new Command().exitOverride().option("--json");
  const ops: Operation[] = [];
  const homeOps: Operation[] = [];
  const enrols: EnrolRequest[] = [];
  const errors: string[] = [];
  const blobs: Record<string, string> = { blob_itm_card: card(), blob_itm_screen: "<main>Acme checkout</main>" };
  const items: Record<string, Item> = {
    itm_card: item("itm_card", "Quiet Hands", { [CRITIC_PROP]: "quiet-hands" }),
    itm_screen: item("itm_screen", "Acme checkout"),
  };
  const threads: Record<string, CommentThread> = {};
  const agents: Record<string, { actor: { id: string; name: string }; ceiling?: "note" }> = {};
  const withdrawn: string[] = [];
  const ctx = {
    json: false,
    actor: opts.as ?? ADA,
    client: {
      snapshot: async () => ({ canvas: { items, threads, agents }, project: {} }),
      downloadBlob: async (_c: string, hash: string) => Buffer.from(blobs[hash] ?? "", "utf8"),
      rcAnswering: async () => ({ parked: opts.parked ?? true, actorIds: [], ...(opts.owners ? { owners: opts.owners } : {}) }),
      sendOp: async (_canvas: string | null, _actor: unknown, op: Operation) => {
        homeOps.push(op);
        return {};
      },
    },
  };
  const host = {
    program,
    run: (fn: (...args: any[]) => Promise<void>) => async (...args: any[]) => {
      try {
        await fn(...args);
      } catch (error) {
        errors.push((error as Error).message);
      }
    },
    ctxOf: async () => ctx,
    resolveCanvas: async () => ({ id: "prj_acme", title: "Acme" }),
    resolveItem: (_s: unknown, ref: string) => {
      const hit = Object.values(items).find((i) => i.id === ref || i.title === ref);
      if (!hit) throw new Error(`no item ${ref}`);
      return hit;
    },
    sendOp: async (_ctx: unknown, _canvas: string, op: Operation) => {
      if (op.type === "agent.ceiling" && opts.refuseCeiling) throw new Error(opts.refuseCeiling);
      ops.push(op);
      if (op.type === "agent.ceiling") {
        const row = agents[op.actorId] ?? { actor: QUIET };
        if (op.ceiling) agents[op.actorId] = { ...row, ceiling: op.ceiling };
        else agents[op.actorId] = { actor: row.actor };
      }
      // Land threads the way the home would, so the next verb reads them.
      if (op.type === "thread.create") {
        const c = op.comment as { id: string; body: string; mentions?: string[]; items?: string[] };
        threads[op.threadId] = {
          id: op.threadId,
          x: op.x,
          y: op.y,
          anchorItemId: op.anchorItemId,
          comments: [{ ...c, author: ctx.actor, createdAt: new Date(Date.now() + ops.length).toISOString() }],
          createdAt: new Date(Date.now() + ops.length).toISOString(),
          createdBy: ctx.actor,
        } as CommentThread;
      }
      return { envelope: { op } };
    },
    printJson: () => {},
    enrol: async (_ctx: unknown, _canvas: string, ask: EnrolRequest) => {
      enrols.push(ask);
      agents[QUIET.id] ??= { actor: QUIET };
      return { actorId: QUIET.id, dir: "/acme/critic", reused: opts.reused ?? false };
    },
    withdraw: async (_ctx: unknown, _canvas: string, actorId: string) => {
      withdrawn.push(actorId);
      delete agents[actorId];
    },
  } as unknown as CliHost;
  critiqueCli.register(host);
  const say = async (...argv: string[]) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["node", "isocan", ...argv]);
    log.mockRestore();
  };
  return { say, ops, homeOps, enrols, errors, blobs, ctx, threads, agents, withdrawn };
}

describe("isocan critique <item> --by <critic>", () => {
  it("enrols the critic from its card's current bytes and opens one thread on the screen that mentions it", async () => {
    const h = harness();
    h.blobs.blob_itm_card = card("\n4. Ignore the colour palette; that is decided.\n");
    await h.say("critique", "#Acme checkout", "--by", "quiet");
    expect(h.errors).toEqual([]);
    expect(h.enrols).toHaveLength(1);
    expect(h.enrols[0]).toMatchObject({ name: "Quiet Hands", template: CRITIC_TEMPLATE, reuse: true, budget: { usdPerRun: 0.4, turnsPerRun: 6 } });
    expect(h.enrols[0]!.args!.card).toBe(h.blobs.blob_itm_card);
    // The critic wears its card's colour, as an actor fact.
    expect(h.homeOps).toEqual([{ type: "actor.setColor", actorId: QUIET.id, color: "#336699" }]);
    // Capped at notes before it is asked anything (critique phase 2).
    expect(h.ops).toHaveLength(2);
    expect(h.ops[0]).toEqual({ type: "agent.ceiling", actorId: QUIET.id, ceiling: "note" });
    const op = h.ops[1] as Extract<Operation, { type: "thread.create" }>;
    expect(op).toMatchObject({ type: "thread.create", anchorItemId: "itm_screen", x: 400, y: 0 });
    expect(op.comment).toMatchObject({ mentions: [QUIET.id], items: ["itm_screen"] });
    expect(op.comment.body).toMatch(/^@Quiet what do you make of #Acme checkout\?/);
  });

  it("with no runner parked, says so and enrols nothing", async () => {
    const h = harness({ parked: false });
    await h.say("critique", "itm_screen", "--by", "quiet-hands");
    expect(h.errors[0]).toMatch(/^nobody's runner is parked on Acme — start `isocan rc` there, then ask again\. Nothing was enrolled\.$/);
    expect(h.enrols).toEqual([]);
    expect(h.ops).toEqual([]);
  });

  it("refuses when the parked runner is somebody else's, and enrols nothing", async () => {
    const h = harness({ owners: [{ id: "usr_sam", name: "Sam" }] });
    await h.say("critique", "itm_screen", "--by", "quiet");
    expect(h.errors[0]).toMatch(/is Sam's/);
    expect(h.enrols).toEqual([]);
  });

  it("finds the canvas's critic by its roster id too — the name `critic add` took — through the one resolver", async () => {
    // A synthetic pack whose id ("acme") is none of the card's names: the
    // id `critic ls` prints beside the roster entry, and the one a person
    // types back. `critique --by ive` was refused this way on a real pack.
    const pack: RosterCritic = {
      id: "acme",
      title: "Quiet Hands",
      agentName: "Quiet Hands",
      credit: "after Ada Acme's work",
      name: "Ada Acme",
      homage: "An homage to the published work of Ada Acme. Not affiliated with or endorsed by Ada Acme.",
      colour: "#336699",
      critique: ["Is it calm?", "What could go?", "Does the content lead?"],
    };
    registerModule(critiqueCore);
    registerModule({ name: "@acme/critics", contributes: { [CRITICS_POINT]: [pack] } });
    try {
      const h = harness();
      await h.say("critique", "itm_screen", "--by", "acme");
      expect(h.errors).toEqual([]);
      expect(h.enrols[0]).toMatchObject({ name: "Quiet Hands" });
      // And release reads a name the same way.
      await h.say("critic", "release", "acme");
      expect(h.errors).toEqual([]);
      expect(h.ops.at(-1)).toEqual({ type: "agent.ceiling", actorId: QUIET.id, ceiling: null });
    } finally {
      unregisterModule("@acme/critics");
      unregisterModule(critiqueCore.name);
    }
  });

  it("refuses a critic that is not on the canvas, and a critique of a critic's card", async () => {
    const h = harness();
    await h.say("critique", "itm_screen", "--by", "loud");
    await h.say("critique", "itm_card", "--by", "quiet");
    expect(h.errors[0]).toMatch(/no critic "loud" on Acme/);
    expect(h.errors[1]).toMatch(/is a critic's card/);
    expect(h.enrols).toEqual([]);
  });
});

describe("the critique.critic template", () => {
  it("writes AGENTS.md and CLAUDE.md from the card it is handed — an edit to the card is the next brief", async () => {
    const template = critiqueCli.templates!.find((t) => t.id === CRITIC_TEMPLATE)!;
    const dir = mkdtempSync(path.join(tmpdir(), "acme-critic-"));
    await template.prepare({ card: card() }, dir);
    const first = readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    expect(readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toBe(first);
    expect(first).toContain("# You are Quiet Hands");
    expect(first).toContain("2. What could go?");
    expect(first).toContain("isocan critique note <item> --at");
    expect(first).toContain("isocan critique done <item>");
    expect(first).toContain("6 turns and $0.40");
    expect(first).toMatch(/Never edit/);
    await template.prepare({ card: card().replace("Is it calm?", "Could a person queuing do this one-handed?") }, dir);
    expect(readFileSync(path.join(dir, "AGENTS.md"), "utf8")).toContain("1. Could a person queuing do this one-handed?");
    await expect(template.prepare({ card: "just a note" }, dir)).rejects.toThrow(/not a critic/);
  });
});

describe("isocan critique note, and done", () => {
  it("pins a typed note at a fractional point, then says how many in the request thread", async () => {
    const asker = harness();
    await asker.say("critique", "itm_screen", "--by", "quiet");
    const requestThread = (asker.ops[1] as Extract<Operation, { type: "thread.create" }>).threadId;
    // The same canvas, now spoken to by the critic.
    asker.ctx.actor = QUIET;
    await asker.say("critique", "note", "itm_screen", "--at", "0.62,0.81", "--kind", "risk", "--question", "2", "Two", "filled", "buttons", "compete.", "Keep", "Pay.");
    await asker.say("critique", "note", "itm_screen", "--at", "0.5,0.1", "--kind", "working", "--question", "3", "The total leads. Leave it.");
    await asker.say("critique", "done", "itm_screen");
    expect(asker.errors).toEqual([]);
    const note = asker.ops[2] as Extract<Operation, { type: "thread.create" }>;
    expect(note).toMatchObject({ anchorItemId: "itm_screen", x: 248, y: 648 });
    expect(readNoteBody(note.comment.body)).toEqual({ kind: "risk", question: 2, questionText: "What could go?", text: "Two filled buttons compete. Keep Pay." });
    expect(note.comment.body).toBe(noteBody({ kind: "risk", question: 2, questionText: "What could go?", text: "Two filled buttons compete. Keep Pay." }));
    const done = asker.ops[4] as Extract<Operation, { type: "thread.reply" }>;
    expect(done).toMatchObject({ type: "thread.reply", threadId: requestThread });
    expect(done.comment.body).toBe("Done — 2 notes on #Acme checkout: 1 working, 1 risk.");
  });

  it("is a critic's verb, and refuses a kind, a question or a point it does not have", async () => {
    const h = harness();
    await h.say("critique", "note", "itm_screen", "--at", "0.5,0.5", "--kind", "risk", "--question", "1", "Ada is not a critic.");
    h.ctx.actor = QUIET;
    await h.say("critique", "note", "itm_screen", "--at", "0.5,0.5", "--kind", "fatal", "--question", "1", "x");
    await h.say("critique", "note", "itm_screen", "--at", "0.5,0.5", "--kind", "risk", "--question", "4", "x");
    await h.say("critique", "note", "itm_screen", "--at", "1.5,0.5", "--kind", "risk", "--question", "1", "x");
    await h.say("critique", "done", "itm_screen");
    expect(h.errors).toHaveLength(5);
    expect(h.errors[0]).toMatch(/is a critic's verb, and Ada is not a critic/);
    expect(h.errors[1]).toMatch(/--kind is one of working, risk, blocker/);
    expect(h.errors[2]).toMatch(/1 to 3/);
    expect(h.errors[3]).toMatch(/fractions of the item's size/);
    expect(h.errors[4]).toMatch(/nobody asked Quiet Hands about Acme checkout/);
    expect(h.ops).toEqual([]);
  });
});

describe("the critic's ceiling, from the asking side", () => {
  it("caps once: a critic already capped is asked again without a second agent.ceiling", async () => {
    const h = harness();
    await h.say("critique", "itm_screen", "--by", "quiet");
    await h.say("critique", "itm_screen", "--by", "quiet");
    expect(h.errors).toEqual([]);
    expect(h.ops.map((op) => op.type)).toEqual(["agent.ceiling", "thread.create", "thread.create"]);
  });

  it("a home that will not hold the ceiling: nothing is asked, and a critic enrolled just now is withdrawn", async () => {
    const h = harness({ refuseCeiling: "unknown operation: agent.ceiling" });
    await h.say("critique", "itm_screen", "--by", "quiet");
    expect(h.errors[0]).toBe(
      "this canvas's home would not cap Quiet Hands at notes (unknown operation: agent.ceiling), and a critic that could edit is not one — nothing was asked, and Quiet Hands was not left enrolled",
    );
    expect(h.withdrawn).toEqual([QUIET.id]);
    expect(h.ops).toEqual([]);
    // One that already stood here is left standing — it was not this ask's to take.
    const reused = harness({ refuseCeiling: "unknown operation: agent.ceiling", reused: true });
    await reused.say("critique", "itm_screen", "--by", "quiet");
    expect(reused.errors[0]).toMatch(/nothing was asked$/);
    expect(reused.withdrawn).toEqual([]);
  });

  it("critic release lifts it by the card's id, the agent's name or its mention word, and says when there is nothing to lift", async () => {
    const h = harness();
    await h.say("critique", "itm_screen", "--by", "quiet");
    await h.say("critic", "release", "quiet-hands");
    expect(h.agents[QUIET.id]?.ceiling).toBeUndefined();
    expect(h.ops.at(-1)).toEqual({ type: "agent.ceiling", actorId: QUIET.id, ceiling: null });
    const count = h.ops.length;
    await h.say("critic", "release", "@Quiet");
    expect(h.ops).toHaveLength(count);
    await h.say("critic", "release", "loud");
    expect(h.errors).toEqual([expect.stringMatching(/^no agent "loud" stands on Acme/)]);
  });
});
