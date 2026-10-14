import guideText from "../agent-guide.md";
import { existsSync, readFileSync, promises as fs } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import {
  anchorAtFraction,
  anchorOffset,
  moduleAsset,
  moduleSlug,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  type CanvasSnapshotResponse,
  type Item,
} from "@isocan/core";
import { packagePath } from "@isocan/core/packageroot";
import type { CliHost, CliModule, Ctx } from "@isocan/cli/modulehost";
import {
  CRITIC_PROP,
  CRITIC_TEMPLATE,
  DEFAULT_BUDGET,
  NOTE_KINDS,
  canvasClashes,
  doneLine,
  findRequest,
  noteBody,
  readNote,
  requestBody,
  type NoteKind,
  type Critic,
  criticItems,
  criticMarkdown,
  criticProblems,
  draftFromRoster,
  findCritic,
  findInRoster,
  lensPath,
  readCritic,
  readLens,
  refuseJoin,
  roster,
  skeletonDraft,
  critiqueCore,
  type CanvasCritic,
  type CriticDraft,
  type Lens,
  type RosterEntry,
} from "./core.ts";

/**
 * **Critics, from a terminal** — `isocan critic ls|add|new`. The web's
 * Critics panel is critique phase 4; until then these are the doors, and
 * editing a critic is `isocan edit` on its card like any markdown item.
 */

/** A critic card's size on the canvas: a column of questions, not a page. */
const CARD = { width: 360, height: 440 };

/**
 * **A roster entry's lens**, from the module that contributed it.
 *
 * `moduleAsset` answers for a module installed at runtime. A module built in
 * (how design-competition ships) registers no base, so its files are where
 * every built-in module's are in this copy: `packages/modules/<slug>/`. When
 * the file is not there at all, the three questions on the record are the
 * lens, and the two headings are left for a person to write.
 */
function lensOf(entry: RosterEntry): Lens {
  const rel = lensPath(entry.critic);
  const where = moduleAsset(entry.module, rel) ?? packagePath("packages/modules", moduleSlug(entry.module), rel);
  if (existsSync(where)) {
    const lens = readLens(readFileSync(where, "utf8"));
    if (lens.questions.length > 0) return lens;
  }
  return { questions: [...entry.critic.critique], looksFor: "", ranks: "" };
}

/** Every critic on this canvas, read from its card's current bytes. A card
 *  edited into something that is no longer a critic is left out. */
async function criticsOn(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<CanvasCritic[]> {
  const out: CanvasCritic[] = [];
  for (const item of criticItems(snapshot.canvas.items)) {
    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
    if (!current) continue;
    const critic = readCritic((await ctx.client.downloadBlob(canvasId, current.blobHash)).toString("utf8"), current.filename);
    if (critic) out.push({ itemId: item.id, critic });
  }
  return out;
}

/** A critic card's current bytes — the card IS the critic, so this is read
 *  every time one is asked, never cached. */
async function cardText(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, itemId: string): Promise<string> {
  const item = snapshot.canvas.items[itemId]!;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
  return (await ctx.client.downloadBlob(canvasId, current.blobHash)).toString("utf8");
}

/** The screen a critique is about: any item but a critic's own card. `#` is
 *  allowed in front, the way the Chat writes it. */
function screenOf(host: CliHost, snapshot: CanvasSnapshotResponse, ref: string): Item {
  const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
  if (item.properties[CRITIC_PROP] !== undefined) throw new Error(`${item.title} is a critic's card — a critique is of a screen`);
  return item;
}

/** The critic this actor is, on this canvas — or the refusal that says the
 *  note verbs are a critic's. */
async function asCritic(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, verb: string): Promise<CanvasCritic> {
  const me = (await criticsOn(ctx, canvasId, snapshot)).find(({ critic }) => critic.agentName.toLowerCase() === ctx.actor.name.toLowerCase());
  if (!me) throw new Error(`\`critique ${verb}\` is a critic's verb, and ${ctx.actor.name} is not a critic on this canvas — \`isocan critic ls\``);
  return me;
}

/**
 * **The critic's ceiling** (critique phase 2): `agent.ceiling note` on its
 * enrolment row, so the home refuses anything it sends that is not a note,
 * a reply or a reaction — the door holding when the prompt does not. Sent
 * by the person asking, never the critic; once per canvas, skipped when the
 * row already carries it. A home that cannot hold a ceiling refuses the op,
 * and then the critic is not left standing uncapped: one enrolled just now
 * is withdrawn again, and nothing is asked.
 */
async function capCritic(host: CliHost, ctx: Ctx, canvasId: string, agentName: string, enrolled: { actorId: string; reused: boolean }): Promise<void> {
  const row = (await ctx.client.snapshot(canvasId)).canvas.agents?.[enrolled.actorId];
  if (row?.ceiling === "note") return;
  try {
    await host.sendOp(ctx, canvasId, { type: "agent.ceiling", actorId: enrolled.actorId, ceiling: "note" });
  } catch (err) {
    if (!enrolled.reused) await host.withdraw(ctx, canvasId, enrolled.actorId).catch(() => {});
    const why = err instanceof Error ? err.message : String(err);
    throw new Error(
      `this canvas's home would not cap ${agentName} at notes (${why}), and a critic that could edit is not one — ` +
        `nothing was asked${enrolled.reused ? "" : `, and ${agentName} was not left enrolled`}`,
    );
  }
}

const hex = (c: string | undefined) => (c && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim() : null);

/** Write one critic card: one blob, one `item.add`, the property beside it. */
async function place(host: CliHost, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, draft: CriticDraft, opts: { at?: string }): Promise<string> {
  const text = criticMarkdown(draft);
  const filename = `${draft.name}.md`;
  const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), "text/markdown", filename);
  const itemId = newItemId();
  await host.sendOp(ctx, canvasId, {
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/markdown", filename, size: upload.size },
    width: CARD.width,
    height: CARD.height,
    placement: host.placementFor(snapshot, opts, CARD),
    title: draft.agentName,
    properties: { [CRITIC_PROP]: draft.name },
  } as never);
  return itemId;
}

function register(host: CliHost): void {
  const { program, run, ctxOf, resolveCanvas, printJson } = host;
  const family = program
    .command("critic")
    .description("Critics on the canvas — personas that point and explain, and never edit")
    .addHelpText(
      "after",
      `
A critic is a markdown card in the persona format (critic: true). Add one from
the roster, or write your own; edit it with \`isocan edit <card> file.md\`.`,
    );

  family
    .command("ls")
    .alias("list")
    .description("The roster, and the critics on this canvas")
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const on = await criticsOn(ctx, canvas.id, snapshot);
        const clashes = new Map(canvasClashes(on).map((c) => [c.id, c.problem]));
        const rows = on.map(({ itemId, critic }) => ({
          itemId,
          name: critic.name,
          agentName: critic.agentName,
          credit: critic.credit,
          ...(critic.color ? { color: critic.color } : {}),
          questions: critic.questions,
          budget: critic.budget ?? null,
          problems: [...criticProblems(critic), ...(clashes.has(critic.name) ? [clashes.get(critic.name)!] : [])],
        }));
        const offered = roster().map(({ module, critic }) => ({ id: critic.id, agentName: critic.agentName, title: critic.title, credit: critic.credit, module }));
        if (ctx.json) return printJson({ roster: offered, critics: rows });
        console.log(offered.length ? "Roster (isocan critic add <id>):" : "Roster: none — no module contributes critics here; `isocan critic new \"<name>\"` writes one");
        for (const r of offered) console.log(`  ${r.id.padEnd(8)} ${r.agentName.padEnd(24)} ${r.credit}`);
        console.log(rows.length ? `On ${canvas.title}:` : `On ${canvas.title}: no critics yet`);
        for (const r of rows) {
          const budget = r.budget ? ` · ${r.budget.turnsPerRun ?? "?"} turns, $${r.budget.usdPerRun?.toFixed(2) ?? "?"}` : " · no budget";
          console.log(`  ${r.itemId}  ${r.agentName} — ${r.credit}${budget}`);
          r.questions.forEach((q, i) => console.log(`      ${i + 1}. ${q || "(unwritten)"}`));
          for (const p of r.problems) console.log(`      ! ${p}`);
        }
      }),
    );

  family
    .command("add <critic>")
    .description("Add a critic from the roster — its questions, what it looks for first, how it ranks")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "where to put the card")
    .action(
      run(async (ref: string, opts: { at?: string }, cmd: Command) => {
        const list = roster();
        const entry = findInRoster(list, ref);
        if (!entry) {
          throw new Error(list.length
            ? `no critic "${ref}" in the roster — try one of ${list.map((e) => e.critic.id).join(", ")}, or \`isocan critic new "<name>"\``
            : `no roster here — no module contributes critics; \`isocan critic new "<name>"\` writes one`);
        }
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const draft = draftFromRoster(entry.critic, lensOf(entry));
        const refused = refuseJoin(await criticsOn(ctx, canvas.id, snapshot), draft);
        if (refused) throw new Error(refused);
        const itemId = await place(host, ctx, canvas.id, snapshot, draft, opts);
        if (ctx.json) return printJson({ itemId, name: draft.name, agentName: draft.agentName, credit: draft.credit, questions: draft.lens.questions });
        console.log(`${draft.agentName} is on ${canvas.title} (${itemId}) — ${draft.credit}`);
      }),
    );

  family
    .command("new <name>")
    .description("Write a critic of your own: three empty questions and the two headings, to fill in")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "where to put the card")
    .option("--after <person>", "who it is an homage to — its name may not carry theirs")
    .option("--self", "you made it of yourself, so it may carry your own name")
    .action(
      run(async (name: string, opts: { at?: string; after?: string; self?: boolean }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const draft = skeletonDraft(name, { ...(opts.after ? { after: opts.after } : {}), ...(opts.self ? { self: true } : {}) });
        const refused = refuseJoin(await criticsOn(ctx, canvas.id, snapshot), draft);
        if (refused) throw new Error(refused);
        const itemId = await place(host, ctx, canvas.id, snapshot, draft, opts);
        if (ctx.json) return printJson({ itemId, name: draft.name, agentName: draft.agentName, credit: draft.credit });
        console.log(`${draft.agentName} is on ${canvas.title} (${itemId}) — three questions to write: \`isocan edit ${itemId} ${draft.name}.md\``);
      }),
    );

  family
    .command("release <critic>")
    .description("Lift a critic's ceiling on this canvas, so the same agent may edit again — yours to lift, never the critic's")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        // The one resolver `critique --by` uses, over the cards AND the
        // enrolment rows: a card edited away or removed must not leave an
        // agent capped with no door out, so a row answers to its own name
        // (and id) as a card would.
        const rows = Object.values(snapshot.canvas.agents ?? {});
        const cards = criticItems(snapshot.canvas.items).map((item) => ({ critic: { name: String(item.properties[CRITIC_PROP]), agentName: item.title } }));
        const bare = rows.map((a) => ({ critic: { name: a.actor.id, agentName: a.actor.name } }));
        const named = findCritic([...cards, ...bare], ref)?.critic.agentName.toLowerCase();
        const hit = named === undefined ? undefined : rows.find((a) => a.actor.name.toLowerCase() === named);
        if (!hit) throw new Error(`no agent "${ref}" stands on ${canvas.title} — \`isocan critic ls\` lists the critics here`);
        if (hit.ceiling !== "note") {
          if (ctx.json) return printJson({ actorId: hit.actor.id, ceiling: null, changed: false });
          return console.log(`${hit.actor.name} has no ceiling on ${canvas.title} — nothing to lift`);
        }
        await host.sendOp(ctx, canvas.id, { type: "agent.ceiling", actorId: hit.actor.id, ceiling: null });
        if (ctx.json) return printJson({ actorId: hit.actor.id, ceiling: null, changed: true });
        console.log(`${hit.actor.name} may edit ${canvas.title} again — \`isocan critique\` caps it at notes the next time it is asked`);
      }),
    );

  registerCritique(host);
}

/**
 * **`isocan critique`** — asking a critic, and the two verbs a critic answers
 * with. Asking is the ordinary path end to end: the critic is enrolled on the
 * person's runner once per canvas (`host.enrol`, the template below writing
 * its directory from its card), and a thread on the screen mentions it, so
 * the rc's ordinary wake (`dispatchReason`) is what starts it. Nothing here
 * runs a model.
 */
function registerCritique(host: CliHost): void {
  const { program, run, ctxOf, resolveCanvas, printJson, sendOp } = host;
  const family = program
    .command("critique")
    .description("Ask a critic about a screen — it pins notes on it and changes nothing")
    .argument("[item]", "the screen (an item; `#Title` works)")
    .option("--by <critic>", "the critic on this canvas — its name, or the word you would @mention")
    .option("--canvas <canvas>")
    .addHelpText(
      "after",
      `
  isocan critique "#Checkout" --by inevitable
Needs your \`isocan rc\` parked on the canvas: the critic runs there, on your key,
bounded by the budget on its card. It answers with \`critique note\` and
\`critique done\`, which are its verbs, not yours.`,
    )
    .action(
      run(async (ref: string | undefined, opts: { by?: string }, cmd: Command) => {
        if (!ref || !opts.by) throw new Error("pass the screen and the critic: `isocan critique <item> --by <critic>`");
        if (opts.by.includes(",")) throw new Error("one critic per critique for now — two at once, and one voice for them, is critique phase 3");
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = screenOf(host, snapshot, ref);
        const on = await criticsOn(ctx, canvas.id, snapshot);
        const hit = findCritic(on, opts.by);
        if (!hit) throw new Error(`no critic "${opts.by}" on ${canvas.title} — \`isocan critic ls\` lists them; \`isocan critic add ${opts.by}\` adds one from the roster`);
        const clash = canvasClashes(on).find((c) => c.id === hit.critic.name);
        const problems = [...criticProblems(hit.critic), ...(clash ? [clash.problem] : [])];
        if (problems.length) throw new Error(`${hit.critic.agentName}'s card needs fixing first — ${problems.join("; ")}`);
        // No runner, no critique — and nothing enrolled, so a refusal leaves
        // the canvas as it found it.
        const answering = await ctx.client.rcAnswering(canvas.id).catch(() => null);
        if (!answering?.parked) {
          throw new Error(`nobody's runner is parked on ${canvas.title} — start \`isocan rc\` there, then ask again. Nothing was enrolled.`);
        }
        const owners = answering.owners ?? [];
        if (owners.length > 0 && !owners.some((o) => o.id === ctx.actor.id)) {
          throw new Error(`the runner parked on ${canvas.title} is ${owners.map((o) => o.name).join(", ")}'s, and a critic runs on the machine that asks — start your own \`isocan rc\`. Nothing was enrolled.`);
        }
        const { critic } = hit;
        const enrolled = await host.enrol(ctx, canvas.id, {
          name: critic.agentName,
          template: CRITIC_TEMPLATE,
          args: { card: await cardText(ctx, canvas.id, snapshot, hit.itemId), canvas: canvas.id, cardItem: hit.itemId },
          budget: { ...DEFAULT_BUDGET, ...(critic.budget ?? {}) },
          reuse: true,
        });
        await capCritic(host, ctx, canvas.id, critic.agentName, enrolled);
        // Its pins and its cursor wear its colour: a colour is an actor fact
        // (`actor.setColor`), which every surface already paints a pin's
        // face with, and this badge holds the critic's actor.
        const colour = hex(critic.color);
        if (colour) await ctx.client.sendOp(null, ctx.actor, { type: "actor.setColor", actorId: enrolled.actorId, color: colour }).catch(() => {});
        const threadId = newThreadId();
        const comment = { id: newCommentId(), body: requestBody(critic.agentName, item.title), mentions: [enrolled.actorId], items: [item.id] };
        await sendOp(ctx, canvas.id, { type: "thread.create", threadId, ...anchorOffset(item), anchorItemId: item.id, comment } as never);
        const budget = { ...DEFAULT_BUDGET, ...(critic.budget ?? {}) };
        if (ctx.json) return printJson({ threadId, critic: critic.name, actorId: enrolled.actorId, enrolled: !enrolled.reused, dir: enrolled.dir, item: item.id, budget });
        console.log(
          `asked ${critic.agentName} about ${item.title} (thread ${threadId}) — ${enrolled.reused ? "already enrolled; its card re-read" : "enrolled on your runner"}, ` +
            `at most ${budget.turnsPerRun} turns and $${budget.usdPerRun.toFixed(2)}. Its notes pin to the screen: \`isocan critique notes ${item.id}\``,
        );
      }),
    );

  family
    .command("note <item> <text...>")
    .description("A critic's note: pinned at a point on the screen, typed, one move")
    .requiredOption("--at <fx,fy>", "where on the screen, as fractions of its size (0,0 top-left; 1,1 bottom-right)")
    .requiredOption("--kind <kind>", "working, risk or blocker")
    .requiredOption("--question <n>", "which of your questions it answers")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, words: string[], opts: { at: string; kind: string; question: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = screenOf(host, snapshot, ref);
        const me = await asCritic(ctx, canvas.id, snapshot, "note");
        const kind = opts.kind.trim().toLowerCase() as NoteKind;
        if (!NOTE_KINDS.includes(kind)) throw new Error(`--kind is one of ${NOTE_KINDS.join(", ")} — not "${opts.kind}"`);
        const question = Number(opts.question);
        const asked = me.critic.questions;
        if (!Number.isInteger(question) || question < 1 || question > asked.length) {
          throw new Error(`--question is the number of one of your ${asked.length} questions, 1 to ${asked.length} — not "${opts.question}"`);
        }
        const text = words.join(" ").trim();
        if (!text) throw new Error("a note says what you see and one move — the text is empty");
        const [fx, fy] = opts.at.split(",").map((v) => Number(v.trim()));
        const offset = anchorAtFraction(item, { x: fx ?? Number.NaN, y: fy ?? Number.NaN });
        const threadId = newThreadId();
        const body = noteBody({ kind, question, questionText: asked[question - 1] ?? "", text });
        await sendOp(ctx, canvas.id, { type: "thread.create", threadId, ...offset, anchorItemId: item.id, comment: { id: newCommentId(), body } } as never);
        if (ctx.json) return printJson({ threadId, item: item.id, kind, question, at: { x: fx, y: fy } });
        console.log(`noted ${kind} on ${item.title} at ${fx},${fy} (thread ${threadId})`);
      }),
    );

  family
    .command("done <item>")
    .description("A critic's last word: says in the request thread how many notes it left")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = screenOf(host, snapshot, ref);
        await asCritic(ctx, canvas.id, snapshot, "done");
        const asked = findRequest(snapshot.canvas, ctx.actor.id, item.id);
        if (!asked) throw new Error(`nobody asked ${ctx.actor.name} about ${item.title} — a critique starts with a thread that mentions you`);
        const notes = Object.values(snapshot.canvas.threads)
          .map((t) => readNote(t, snapshot.canvas.items))
          .filter((n): n is NonNullable<typeof n> => n !== null && n.criticId === ctx.actor.id && n.item === item.id && n.createdAt >= asked.createdAt);
        const line = doneLine(notes, item.title);
        await sendOp(ctx, canvas.id, { type: "thread.reply", threadId: asked.threadId, comment: { id: newCommentId(), body: line } } as never);
        if (ctx.json) return printJson({ threadId: asked.threadId, notes: notes.length });
        console.log(line);
      }),
    );

  family
    .command("notes <item>")
    .description("The critics' notes on a screen, read back: who, kind, question, where, and the move")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = screenOf(host, snapshot, ref);
        const notes = Object.values(snapshot.canvas.threads)
          .map((t) => readNote(t, snapshot.canvas.items))
          .filter((n): n is NonNullable<typeof n> => n !== null && n.item === item.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (ctx.json) return printJson(notes);
        if (notes.length === 0) return console.log(`no critics' notes on ${item.title}`);
        for (const n of notes) {
          console.log(`${n.critic} · ${n.kind} · question ${n.question} · at ${n.at.x},${n.at.y}  (${n.threadId})`);
          console.log(`  ${n.text.replace(/\n/g, "\n  ")}`);
        }
      }),
    );
}

/**
 * **The critic template** (`critique.critic`) — the working directory the rc
 * starts a critic's harness in: an `AGENTS.md` (and a `CLAUDE.md` saying the
 * same, for the harness that reads that name) written from the critic's CARD,
 * whose bytes `isocan critique` reads afresh and passes in, so an edit to the
 * card changes the next critique. The brief is the thread; this is who the
 * critic is and the one way it may answer.
 */
async function prepareCritic(args: Readonly<Record<string, string>>, into: string): Promise<void> {
  const critic: Critic | null = args.card ? readCritic(args.card) : null;
  if (!critic) throw new Error("the critic's card is not a critic any more — its front matter needs `critic: true`");
  await fs.writeFile(path.join(into, "AGENTS.md"), criticBrief(critic));
  await fs.writeFile(path.join(into, "CLAUDE.md"), criticBrief(critic));
}

/** The brief itself, from the card's current text. */
function criticBrief(critic: Critic): string {
  const budget = { ...DEFAULT_BUDGET, ...(critic.budget ?? {}) };
  const qs = critic.questions.map((q, i) => `${i + 1}. ${q || "(unwritten — skip it)"}`);
  return [
    `# You are ${critic.agentName}`,
    "",
    `A critic on an isocan canvas — ${critic.credit}. You are an homage to published principles, **not a person**: never sign as anyone, never claim their words, never say what they would think.`,
    "",
    "**You point and explain; you never touch.** Someone has asked what you make of one screen. You look at it, you pin notes where you see something, and you change nothing.",
    "",
    "## Your questions",
    "",
    ...qs,
    "",
    "## What you look for first",
    "",
    critic.looksFor || "(not written — your questions are the lens)",
    "",
    "## How you rank",
    "",
    critic.ranks || "(not written)",
    "",
    "## How a critique goes",
    "",
    "The summons names the thread you were asked in and the screen: the item that thread is pinned to, or the one it names with `#Title`. That screen is the whole job.",
    "",
    "1. **Read the screen**, not the threads. `isocan show <item>` gives its size; `isocan get <item>` prints its HTML. Read that. Do not read other threads or other critics' notes, and do not answer them — your judgement is your own.",
    "2. **Write notes, and nothing else** — three to five of them, each with one verb:",
    "",
    "   ```sh",
    "   isocan critique note <item> --at 0.62,0.81 --kind risk --question 2 \\",
    '     "Two filled buttons compete for the one action. Keep Pay; make Save a text link."',
    "   ```",
    "",
    "   - `--at`: where you are looking, as fractions of the screen's width and height (0,0 its top-left, 1,1 its bottom-right), estimated from the HTML's layout. The pin goes there.",
    "   - `--kind`: `working` (it is right — a finding as much as a risk), `risk` (it hurts the screen), `blocker` (it stops the screen doing its job). Use blocker rarely.",
    "   - `--question`: the number of the question above that the note answers.",
    "   - The text: what you see, in a sentence or two, then **one move** — one concrete change, or for working, \"Leave it.\" Do not write a kind or a question number in the text: the verb writes that line itself.",
    "3. **Finish**: `isocan critique done <item>`, then end your turn. Do not run `isocan wait`.",
    "",
    "## Never",
    "",
    "- Never edit, add, move, restyle or delete anything — no `isocan edit`, `add`, `move`, `rm`, `design`, no files written to the canvas. A note that says what to change is the whole of your power.",
    "- Never reply in a thread other than with `critique done`, and never mention another agent.",
    "",
    `## Your budget: ${budget.turnsPerRun} turns and $${budget.usdPerRun.toFixed(2)} for this critique`,
    "",
    "The runner stops you at either cap. Be brief: read the screen in one command, write your notes in one command (`&&` between them), then `critique done`.",
    "",
  ].join("\n");
}

/** The CLI half. */
export const critiqueCli: CliModule = {
  core: critiqueCore,
  register,
  guide: guideText,
  templates: [
    {
      id: CRITIC_TEMPLATE,
      describe: "a critic's working directory: AGENTS.md written from its card — its questions, what it looks for, the note verb, and the rule that it writes notes and nothing else",
      prepare: prepareCritic,
    },
  ],
};

export default critiqueCli;
