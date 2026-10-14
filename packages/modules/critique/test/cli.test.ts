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
const WARM = { id: "act_warm", name: "Warm Light" };
const LEAD = { id: "act_lead", name: "Lead Hand" };

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

const warmCard = () =>
  criticMarkdown({
    name: "warm-light",
    agentName: "Warm Light",
    credit: "after Bo Acme's work; not affiliated",
    color: "#cc6633",
    lens: { questions: ["Does it feel like someone made it?", "Where is the warmth?", "Would you miss it?"], looksFor: "Feeling first.", ranks: "Warm over neat." },
  });

function harness(opts: { parked?: boolean; owners?: { id: string; name: string }[]; as?: { id: string; name: string }; refuseCeiling?: string; reused?: boolean; agents?: Record<string, { actor: { id: string; name: string }; writtenBy?: { id: string; name: string } }> } = {}) {
  const program = new Command().exitOverride().option("--json");
  const ops: Operation[] = [];
  const homeOps: Operation[] = [];
  const enrols: EnrolRequest[] = [];
  const errors: string[] = [];
  const blobs: Record<string, string> = { blob_itm_card: card(), blob_itm_warm: warmCard(), blob_itm_screen: "<main>Acme checkout</main>" };
  const items: Record<string, Item> = {
    itm_card: item("itm_card", "Quiet Hands", { [CRITIC_PROP]: "quiet-hands" }),
    itm_warm: item("itm_warm", "Warm Light", { [CRITIC_PROP]: "warm-light" }),
    itm_screen: item("itm_screen", "Acme checkout"),
  };
  const threads: Record<string, CommentThread> = {};
  const agents: Record<string, { actor: { id: string; name: string }; ceiling?: "note"; writtenBy?: { id: string; name: string } }> = { ...(opts.agents ?? {}) };
  const withdrawn: string[] = [];
  const printed: unknown[] = [];
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
          comments: [{ ...c, author: { ...ctx.actor }, createdAt: new Date(Date.now() + ops.length).toISOString() }],
          createdAt: new Date(Date.now() + ops.length).toISOString(),
          createdBy: ctx.actor,
        } as CommentThread;
      }
      if (op.type === "thread.reply") {
        const c = op.comment as { id: string; body: string; mentions?: string[]; record?: true };
        threads[op.threadId]!.comments.push({ ...c, author: { ...ctx.actor }, createdAt: new Date(Date.now() + ops.length).toISOString() } as never);
      }
      return { envelope: { op } };
    },
    printJson: (v: unknown) => {
      printed.push(v);
    },
    enrol: async (_ctx: unknown, _canvas: string, ask: EnrolRequest) => {
      enrols.push(ask);
      const actor = ask.name === WARM.name ? WARM : QUIET;
      agents[actor.id] ??= { actor };
      return { actorId: actor.id, dir: "/acme/critic", reused: opts.reused ?? false };
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
  return { say, ops, homeOps, enrols, errors, blobs, ctx, threads, agents, withdrawn, printed };
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

describe("two critics, and the read (critique phase 3)", () => {
  /** Ask both, then let each critic answer in turn as itself. */
  async function critique(h: ReturnType<typeof harness>) {
    await h.say("critique", "#Acme checkout", "--by", "quiet,warm");
    const ask = h.ops.find((op) => op.type === "thread.create") as Extract<Operation, { type: "thread.create" }>;
    return ask.threadId;
  }
  const as = async (h: ReturnType<typeof harness>, who: { id: string; name: string }, ...argv: string[]) => {
    const before = h.ctx.actor;
    h.ctx.actor = who;
    await h.say(...argv);
    h.ctx.actor = before;
  };

  it("enrols and caps both, and opens ONE thread on the screen mentioning both", async () => {
    const h = harness();
    await critique(h);
    expect(h.errors).toEqual([]);
    expect(h.enrols.map((e) => e.name)).toEqual(["Quiet Hands", "Warm Light"]);
    expect(h.enrols[1]!.args!.card).toBe(h.blobs.blob_itm_warm);
    expect(h.ops.map((op) => op.type)).toEqual(["agent.ceiling", "agent.ceiling", "thread.create"]);
    expect(h.ops.slice(0, 2)).toEqual([
      { type: "agent.ceiling", actorId: QUIET.id, ceiling: "note" },
      { type: "agent.ceiling", actorId: WARM.id, ceiling: "note" },
    ]);
    const ask = h.ops[2] as Extract<Operation, { type: "thread.create" }>;
    expect(ask.comment).toMatchObject({ mentions: [QUIET.id, WARM.id], items: ["itm_screen"] });
    expect(ask.comment.body).toBe("@Quiet and @Warm — what do you make of #Acme checkout? Each of you on your own: pin your notes on it; change nothing.");
    expect(h.homeOps.map((op) => (op as { color?: string }).color)).toEqual(["#336699", "#cc6633"]);
  });

  it("refuses the whole ask, enrolling nobody, when one named critic is not here", async () => {
    const h = harness();
    await h.say("critique", "itm_screen", "--by", "quiet,loud");
    expect(h.errors[0]).toMatch(/no critic "loud" on Acme/);
    expect(h.enrols).toEqual([]);
    expect(h.ops).toEqual([]);
  });

  it("lets a lead agent ask on its owner's runner — the person whose enrolment of it stands", async () => {
    const h = harness({ as: LEAD, owners: [ADA], agents: { [LEAD.id]: { actor: LEAD, writtenBy: ADA } } });
    await h.say("critique", "itm_screen", "--by", "quiet,warm");
    expect(h.errors).toEqual([]);
    const stranger = harness({ as: LEAD, owners: [{ id: "usr_sam", name: "Sam" }], agents: { [LEAD.id]: { actor: LEAD, writtenBy: ADA } } });
    await stranger.say("critique", "itm_screen", "--by", "quiet,warm");
    expect(stranger.errors[0]).toMatch(/is Sam's/);
  });

  it("the first done is a record; the last mentions the asker and says where the read is", async () => {
    const h = harness({ as: LEAD, agents: { [LEAD.id]: { actor: LEAD, writtenBy: ADA } } });
    const threadId = await critique(h);
    await as(h, QUIET, "critique", "note", "itm_screen", "--at", "0.45,0.2", "--kind", "risk", "--question", "2", "The photo pushes the order below the fold. Cut it.");
    // Still working: the read refuses to post, and a critic may not read it.
    await h.say("critique", "read", threadId, "--post");
    expect(h.errors.pop()).toMatch(/^still waiting on Quiet Hands and Warm Light/);
    await as(h, WARM, "critique", "read", threadId);
    expect(h.errors.pop()).toMatch(/Warm Light, you are one of the critics asked here and not done/);
    await as(h, QUIET, "critique", "done", "itm_screen");
    await as(h, WARM, "critique", "note", "itm_screen", "--at", "0.5,0.15", "--kind", "working", "--question", "2", "The photo carries the warmth. Leave it.");
    await as(h, WARM, "critique", "done", "itm_screen");
    expect(h.errors).toEqual([]);
    const replies = h.ops.filter((op) => op.type === "thread.reply") as Extract<Operation, { type: "thread.reply" }>[];
    expect(replies).toHaveLength(2);
    expect(replies[0]!.comment).toEqual({ id: expect.any(String), body: "Done — 1 note on #Acme checkout: 1 risk.", record: true });
    expect(replies[1]!.comment).toEqual({
      id: expect.any(String),
      body: `Done — 1 note on #Acme checkout: 1 working.\n@Lead every critic asked here is done — the read: \`isocan critique read ${threadId}\``,
      mentions: [LEAD.id],
    });
  });

  it("critique read folds the notes; --post replies once, a record, the lead's words above the fold", async () => {
    const h = harness({ as: LEAD, agents: { [LEAD.id]: { actor: LEAD, writtenBy: ADA } } });
    const threadId = await critique(h);
    await as(h, QUIET, "critique", "note", "itm_screen", "--at", "0.45,0.2", "--kind", "risk", "--question", "2", "The photo pushes the order below the fold. Cut it.");
    await as(h, QUIET, "critique", "note", "itm_screen", "--at", "0.7,0.3", "--kind", "risk", "--question", "1", "The price is too quiet. Set it larger.");
    await as(h, WARM, "critique", "note", "itm_screen", "--at", "0.5,0.15", "--kind", "working", "--question", "2", "The photo carries the warmth. Leave it.");
    await as(h, WARM, "critique", "note", "itm_screen", "--at", "0.72,0.34", "--kind", "risk", "--question", "3", "The total is a footnote. Give it weight.");
    await as(h, QUIET, "critique", "done", "itm_screen");
    await as(h, WARM, "critique", "done", "itm_screen");
    h.ctx.json = true;
    await h.say("critique", "read", "itm_screen");
    const out = h.printed.at(-1) as { threadId: string; pending: string[]; read: { agree: unknown[]; split: { ref: string }[]; blocker: unknown[] } };
    expect(out.threadId).toBe(threadId);
    expect(out.pending).toEqual([]);
    expect(out.read.agree).toHaveLength(1);
    expect(out.read.split).toHaveLength(1);
    expect(out.read.blocker).toEqual([]);
    h.ctx.json = false;
    await h.say("critique", "read", threadId, "--post", "--say", "Reduction against warmth: one would cut the photo, one keeps it for the feeling.");
    expect(h.errors).toEqual([]);
    const posted = h.ops.at(-1) as Extract<Operation, { type: "thread.reply" }>;
    expect(posted).toMatchObject({ type: "thread.reply", threadId, comment: { record: true, items: ["itm_screen"] } });
    const [words, , ...fold] = posted.comment.body.split("\n");
    expect(words).toBe("Reduction against warmth: one would cut the photo, one keeps it for the feeling.");
    expect(fold[0]).toMatch(/^\*\*They agree\*\* \(2 risk notes/);
    expect(fold[1]).toContain(`isocan critique both ${out.read.split[0]!.ref}`);
    expect(fold[2]).toBe("**Blocker:** none.");
  });

  it("critique both asks an agent that may edit for two variations, each citing its note; never a critic", async () => {
    const h = harness({ as: LEAD, agents: { [LEAD.id]: { actor: LEAD, writtenBy: ADA } } });
    const threadId = await critique(h);
    await as(h, QUIET, "critique", "note", "itm_screen", "--at", "0.45,0.2", "--kind", "risk", "--question", "2", "The photo pushes the order below the fold. Cut it.");
    await as(h, WARM, "critique", "note", "itm_screen", "--at", "0.5,0.15", "--kind", "working", "--question", "2", "The photo carries the warmth. Leave it.");
    await as(h, QUIET, "critique", "done", "itm_screen");
    await as(h, WARM, "critique", "done", "itm_screen");
    const notes = h.ops.filter((op) => op.type === "thread.create" && op.threadId !== threadId) as Extract<Operation, { type: "thread.create" }>[];
    const [cut, keep] = notes.map((n) => n.threadId);
    await h.say("critique", "both", `${cut}+${cut}`);
    expect(h.errors.pop()).toMatch(/both notes are Quiet Hands's/);
    await h.say("critique", "both", `${keep}+${cut}`, "--to", "quiet");
    expect(h.errors.pop()).toMatch(/Quiet Hands is a critic, capped at notes/);
    await h.say("critique", "both", `${keep}+${cut}`);
    expect(h.errors).toEqual([]);
    const ask = h.ops.at(-1) as Extract<Operation, { type: "thread.reply" }>;
    expect(ask).toMatchObject({ type: "thread.reply", threadId, comment: { mentions: [LEAD.id], items: ["itm_screen"] } });
    expect(ask.comment.body).toMatch(/^@Lead build both sides of this split/);
    expect(ask.comment.body).toContain(`--prop parent=itm_screen --prop critique.answers=${keep}`);
    expect(ask.comment.body).toContain(`--prop parent=itm_screen --prop critique.answers=${cut}`);
    // A person asked, so there is no lead to default to: name one.
    const person = harness();
    const t2 = await critique(person);
    expect(t2).toBeTruthy();
    await as(person, QUIET, "critique", "note", "itm_screen", "--at", "0.45,0.2", "--kind", "risk", "--question", "2", "Cut it.");
    await as(person, WARM, "critique", "note", "itm_screen", "--at", "0.5,0.15", "--kind", "working", "--question", "2", "Leave it.");
    const pn = person.ops.filter((op) => op.type === "thread.create" && op.threadId !== t2) as Extract<Operation, { type: "thread.create" }>[];
    await person.say("critique", "both", `${pn[1]!.threadId}+${pn[0]!.threadId}`);
    expect(person.errors.pop()).toMatch(/Ada asked, and is not an agent here — name who builds them/);
  });
});
