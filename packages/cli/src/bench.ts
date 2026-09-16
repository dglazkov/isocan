import os from "node:os";
import type { Command } from "commander";
import {
  BENCH_ITEM_SIZE,
  benchAgents,
  benchItemOf,
  benchJoinRefusal,
  benchRows,
  benchStandingWords,
  benchWords,
  benchWriteFor,
  newItemId,
  newVersionId,
  type BenchAgent,
  type BenchCanvas,
  type BenchRow,
} from "@isocan/core";
import { resolveCanvas } from "@isocan/api";
import type { Ctx } from "./ctx.ts";
import { printJson, printTable, truncate } from "./output.ts";
import { scanHarnesses } from "./harnesses.ts";
import { readRcAgents } from "./rc.ts";
import { SHEEP_HARNESS, sheepPlaceFor, type SheepPlace } from "./sheep.ts";

/**
 * **`isocan bench` — the agents you have, and whether anything could answer
 * for one right now** (`docs/projects/bench/design.md`, phase 0, journey 1).
 *
 * The registry is your personal canvas, so this file adds no op and no table:
 * a bench row is an `item.add` with `kind=agent` and removing one is an
 * `item.delete`. The three-state reachability is `benchRows()` in
 * `@isocan/core`, which is a fourth caller of `roster()` — the same fold
 * `isocan who`, the agent tray and the workbench read. A second derivation of
 * "is Percy parked?" would disagree with those three within the week.
 *
 * It lives beside `main.ts` rather than in it for the reason
 * `personal-context.ts` does: `main.ts` is the registry of verbs, and the
 * fewer lines of body it carries the more of it a reader can hold.
 */

/** Where this machine runs things, as an opaque label. `runsAt` is not a
 * machine id (journey 4's value is a cell), so this is only ever a default a
 * person can override with `--runs-at`. */
const thisMachine = (): string => os.hostname();

/** Where an agent runs: for a sheep at a remote station, the station's host
 * (journey 4 — "ready (sheep-2)"); otherwise this machine's hostname. */
function runsAtFor(harness: string | null, place: SheepPlace | null | undefined): string {
  if (harness === SHEEP_HARNESS && place && place.home !== "local") {
    try {
      return new URL(place.home).host;
    } catch {
      return place.home;
    }
  }
  return thisMachine();
}

/** The bench's canvas, or null when this person has never made one. Reading
 * must not create: `isocan bench` on a machine with no personal canvas should
 * say so, not quietly mint one. */
async function benchCanvasId(ctx: Ctx): Promise<string | null> {
  const status = await ctx.client.personalStatus(ctx.actor.id);
  return status.source?.state === "live" ? status.source.canvasId : null;
}

/**
 * Every canvas this reader can see, with the live facts reachability is
 * measured from. Snapshot for the enrolments, sessions for who is here, and
 * the daemon's own rc holds for who would answer — the same three `isocan
 * who` asks of the one canvas it is standing on.
 *
 * Best-effort per canvas: a canvas whose home will not answer contributes
 * nothing rather than failing the whole read, which is the under-claim
 * `roster()`'s fourth argument already makes for the same reason.
 */
async function seenCanvases(ctx: Ctx): Promise<BenchCanvas[]> {
  const canvases = await ctx.client.listCanvases().catch(() => []);
  const seen = await Promise.all(
    canvases.map(async (canvas): Promise<BenchCanvas | null> => {
      const snapshot = await ctx.client.snapshot(canvas.id).catch(() => null);
      if (!snapshot) return null;
      const [sessions, answering] = await Promise.all([
        ctx.client.listSessions(canvas.id).catch(() => []),
        ctx.client.rcAnswering(canvas.id).catch(() => null),
      ]);
      return {
        canvasId: canvas.id,
        canvasTitle: canvas.title,
        canvas: snapshot.canvas,
        sessions,
        ...(answering ? { answerable: new Set(answering.actorIds) } : {}),
      };
    }),
  );
  return seen.filter((one): one is BenchCanvas => one !== null);
}

/** The bench, measured. The `runsHere` set is this machine's running half —
 * `~/.isocan/rc-agents.json` — and nothing else may stand in for it: a row on
 * the canvas confers no reach, which is the project's third rule. */
async function readBench(ctx: Ctx, canvasId: string): Promise<BenchRow[]> {
  const [snapshot, canvases, rcRows] = await Promise.all([
    ctx.client.snapshot(canvasId),
    seenCanvases(ctx),
    readRcAgents(ctx.home),
  ]);
  return benchRows(
    benchAgents(snapshot.canvas),
    canvases,
    new Set(rcRows.map((row) => row.actorId)),
    Date.now(),
  );
}

/**
 * The one bench row this name means, or a refusal that says why not.
 *
 * Three spellings, the same three everywhere: what you call it, the actor it
 * speaks as, or the item it is. `bench rm` and `bench join` share it because
 * a person naming an agent to remove and a person naming one to bring along
 * are naming the same thing, and two matchers would drift into accepting
 * different names for the same row.
 */
function oneRow<T extends { name: string; actorId: string; itemId: string }>(
  rows: readonly T[],
  name: string,
): T {
  const wanted = name.toLowerCase();
  const matches = rows.filter(
    (row) => row.name.toLowerCase() === wanted || row.actorId === name || row.itemId === name,
  );
  // One refusal, spelled in core, because the terminal's is the same refusal
  // the Chat's `@Name join` gives and the wording is the security property
  // rather than the copy: it must not say "unknown name", and it must not
  // read differently for a name that happens to exist on somebody else's
  // private bench. `benchJoinRefusal` is given the name and nothing else.
  if (matches.length === 0) throw new Error(benchJoinRefusal(name));
  if (matches.length > 1) {
    throw new Error(
      `"${name}" is on your bench ${matches.length} times (${matches.map((row) => row.itemId).join(", ")}). Name one by its item id.`,
    );
  }
  return matches[0]!;
}

/**
 * **Which harness a row records**, when the thing that knows says nothing.
 *
 * A null harness — on an rc row, or on an enrolment made without `--harness`
 * — means "this machine's default", and `isocan who` resolves it the same
 * way. A bench row that said nothing would be a registry that cannot answer
 * the one question a person has about a list of agents: which of these is
 * which. So it is resolved as this machine would run it, and recorded as what
 * the row says rather than re-read as a live fact every time somebody looks.
 *
 * One function because `bench add` and every enrolment now write rows, and
 * two spellings of "what is Percy" would put two answers on the same bench.
 */
async function recordedHarness(ctx: Ctx, harness: string | null | undefined): Promise<string | null> {
  return harness ?? (await scanHarnesses(ctx.home)).default?.name ?? null;
}

/** What this machine already knows about an agent by this name: the rc rows
 * and the enrolments they name. `bench add` takes the agent from here so that
 * adding to the bench never mints an actor and never needs an rc handshake. */
async function knownAgent(ctx: Ctx, name: string): Promise<BenchAgent | null> {
  const rows = await readRcAgents(ctx.home);
  const wanted = name.toLowerCase();
  const matches = rows.filter(
    (row) => row.name.toLowerCase() === wanted || row.actorId === name,
  );
  if (matches.length === 0) return null;
  const actors = new Set(matches.map((row) => row.actorId));
  if (actors.size > 1) {
    throw new Error(
      `"${name}" names ${actors.size} different agents on this machine (${[...actors].join(", ")}). Pass --actor to say which.`,
    );
  }
  const row = matches[0]!;
  const harness = await recordedHarness(ctx, row.harness);
  const place = row.sheep ?? (harness === SHEEP_HARNESS ? sheepPlaceFor(row.cwd) : null);
  return {
    itemId: "",
    name: row.name,
    actorId: row.actorId,
    harness,
    runsAt: runsAtFor(harness, place),
  };
}

/**
 * **The one write a bench takes** — a new card, or the gaps filled in the row
 * that is already there. What to do is `benchWriteFor` in core, so the verb
 * and every enrolment path decide it the same way; this is only the sending.
 *
 * No new op either way: adding is an `item.add` and filling a silence is an
 * `item.update` whose patch merges properties, so both are one undo and both
 * replicate like anything else on the canvas.
 */
async function writeBenchRow(
  ctx: Ctx,
  canvasId: string,
  name: string,
  agent: { actorId: string; harness?: string | null; runsAt?: string | null },
  explicit?: { harness?: boolean; runsAt?: boolean },
): Promise<{ itemId: string; wrote: "add" | "fill" | "already" }> {
  const snapshot = await ctx.client.snapshot(canvasId);
  const write = benchWriteFor(snapshot.canvas, agent, explicit);
  if (write.kind === "already") return { itemId: write.itemId, wrote: "already" };
  if (write.kind === "fill") {
    await ctx.client.sendOp(canvasId, ctx.actor, {
      type: "item.update",
      itemId: write.itemId,
      patch: { properties: write.properties },
    });
    return { itemId: write.itemId, wrote: "fill" };
  }
  const card = benchItemOf(name, agent);
  const upload = await ctx.client.uploadBlob(
    canvasId,
    Buffer.from(card.blob),
    card.mimeType,
    card.filename,
  );
  const itemId = newItemId();
  await ctx.client.sendOp(canvasId, ctx.actor, {
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: card.mimeType, filename: card.filename, size: upload.size },
    width: BENCH_ITEM_SIZE.width,
    height: BENCH_ITEM_SIZE.height,
    placement: { x: write.x, y: write.y, chosen: true },
    title: name,
    properties: card.properties,
  });
  return { itemId, wrote: "add" };
}

/**
 * **The bench row an enrolment writes for itself** (the bench, phase 3 —
 * journey 1's residue: a registry kept by hand is a registry that goes stale).
 *
 * Every enrolment this machine makes lands here — `isocan agent add`, `isocan
 * rc add`, and the rc answering a web ask all funnel through `mintAndEnrol` —
 * so the bench fills itself and nobody has to curate it. A join needs no call:
 * `agent.invite` can only name a row that is already on the bench it carries.
 *
 * **It is best-effort, by construction, because the registry must never be
 * able to break the act it records.** Enrolment is the real act; the row is a
 * convenience. So:
 *
 * - It reads the binding with `personalStatus` and NEVER `ensurePersonal`. A
 *   personal canvas is private and creating one is the person's own gesture,
 *   not a side effect of enrolling an agent. Somebody who has never made one
 *   enrols exactly as they did before.
 * - Nothing it does can throw into the caller, and nothing is retried: a home
 *   that refuses costs one request and then the enrolment carries on.
 * - It is not silent. A missing row must never read as a missing agent, so
 *   every path that does not write one says which it was, on the narration
 *   channel the enrolment already uses — stderr for a verb, the rc's own
 *   lines for a handshake — leaving `--json` on stdout untouched.
 */
export async function noteOnBench(
  ctx: Ctx,
  name: string,
  agent: { actorId: string; harness?: string | null; cwd?: string },
  say: (line: string) => void,
): Promise<void> {
  let canvasId: string | null;
  try {
    canvasId = await benchCanvasId(ctx);
  } catch (error) {
    return say(
      `${name} is enrolled. Its bench could not be read (${error instanceof Error ? error.message : String(error)}), so no row was written — \`isocan bench add ${name}\` puts one on.`,
    );
  }
  if (!canvasId) {
    return say(
      `${name} is enrolled, and on no bench: there is no personal canvas here to keep one on, and enrolling does not make one. \`isocan context personal\` creates it privately.`,
    );
  }
  try {
    // Where it runs, as far as anybody can honestly say at this moment: this
    // machine holds the rc row and will dispatch for it — unless the harness
    // is sheep at a remote station (journey 4), where the cell runs there.
    const harness = await recordedHarness(ctx, agent.harness);
    const place = harness === SHEEP_HARNESS ? sheepPlaceFor(agent.cwd ?? process.cwd()) : null;
    await writeBenchRow(ctx, canvasId, name, {
      actorId: agent.actorId,
      harness,
      runsAt: runsAtFor(harness, place),
    });
  } catch (error) {
    say(
      `${name} is enrolled. Its bench row was not written (${error instanceof Error ? error.message : String(error)}) — \`isocan bench add ${name}\` puts one on.`,
    );
  }
}

export function registerBench(program: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const bench = program
    .command("bench")
    .description("The agents on your bench, and whether anything could answer for one now")
    .addHelpText(
      "after",
      `
Your bench is your own private canvas: a row is an item on it, so it is
yours, it follows you between machines, and undo works on it. Adding a row
grants nothing — it does not enrol an agent, give it reach, or let anybody
summon it. Reachability is measured every time you look:

  ready         something parked would answer for it now
  elsewhere     it stands somewhere, but nothing is parked
  unreachable   nothing present can run it at all

It fills itself: enrolling an agent anywhere writes its row, so you rarely
need \`bench add\`. Withdrawing one does not take it off — the bench is the
agents you HAVE, so a row that stands nowhere stays, reading unreachable.
\`bench rm\` is the only way one leaves.`,
    );

  const act = (work: (ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try {
      await work(await contextOf(args.at(-1) as Command), args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };

  bench.action(
    act(async (ctx) => {
      const canvasId = await benchCanvasId(ctx);
      if (!canvasId) {
        if (ctx.json) return printJson({ bench: [] });
        return console.log("No bench yet. `isocan bench add <name>` makes one on your own canvas.");
      }
      const rows = await readBench(ctx, canvasId);
      if (ctx.json) return printJson({ canvasId, bench: rows });
      if (rows.length === 0) return console.log("Nobody on your bench yet.");
      printTable(
        rows.map((row) => ({
          name: truncate(row.name, 20),
          harness: row.harness ?? "—",
          standing: benchStandingWords(row),
          reach: benchWords(row),
        })),
      );
    }),
  );

  bench
    .command("add <name>")
    .description("Put an agent on your bench, from what this machine already knows")
    .option("--actor <id>", "the actor it speaks as — required for an agent this machine has no rc row for")
    .option("--harness <name>", "which agent it is: claude-code, codex, sheep, …")
    .option("--runs-at <label>", "an opaque label for where it runs (default: this machine)")
    .action(
      act(async (ctx, args) => {
        const name = args[0] as string;
        const opts = args[1] as { actor?: string; harness?: string; runsAt?: string };
        const matched = await knownAgent(ctx, name);
        // What the machine knows is only inherited when it is about the SAME
        // actor. `--actor` naming somebody else means the row is for an agent
        // this machine has never run, and inheriting a harness or a `runsAt`
        // from a namesake would be the bench asserting a fact nobody gave it.
        const known = matched && (!opts.actor || opts.actor === matched.actorId) ? matched : null;
        const actorId = opts.actor ?? known?.actorId;
        if (!actorId) {
          throw new Error(
            `this machine holds no rc row for "${name}". Pass --actor <id> to bench an agent it cannot run — the row is a record, and a record may name an agent that lives elsewhere.`,
          );
        }
        const agent = {
          actorId,
          harness: opts.harness ?? known?.harness ?? null,
          runsAt: opts.runsAt ?? known?.runsAt ?? null,
        };
        // `bench add` is the ONE bench write that may create the canvas: it is
        // the person's own gesture, said in those words. Every other path
        // (phase 3's enrolments) reads with `personalStatus` and writes
        // nothing when there is nothing there.
        const ensured = await ctx.client.ensurePersonal(ctx.actor.id);
        const canvasId = ensured.source?.canvasId;
        if (!canvasId) throw new Error("your personal canvas is not live here, so there is nowhere to keep a bench");
        const { itemId, wrote } = await writeBenchRow(ctx, canvasId, name, agent, {
          harness: Boolean(opts.harness),
          runsAt: Boolean(opts.runsAt),
        });
        if (wrote !== "add") {
          const row = benchAgents((await ctx.client.snapshot(canvasId)).canvas).find(
            (one) => one.actorId === actorId,
          );
          if (ctx.json) return printJson({ canvasId, itemId, added: false, agent: row });
          return console.log(
            wrote === "fill"
              ? `${row?.name ?? name} was already on your bench (${itemId}); its row learned what this machine knows.`
              : `${row?.name ?? name} is already on your bench (${itemId}).`,
          );
        }
        if (ctx.json) return printJson({ canvasId, itemId, added: true, agent: { itemId, name, ...agent } });
        console.log(`${name} is on your bench as ${itemId}. A row grants nothing: it does not enrol ${name} anywhere.`);
      }),
    );

  /**
   * **`isocan bench join <name>`** — journey 2 from the terminal, and the
   * half that makes the panel's **Join** the same act rather than a web-only
   * gesture.
   *
   * It sends `agent.invite` to the canvas this command is ABOUT (`--canvas`,
   * the directory's binding, the usual walk), carrying the bench it read the
   * row from. Nothing is asked of any machine: the actor already exists —
   * that is what being on your bench means — so there is no rc handshake to
   * make, which is precisely what separates naming an agent you have from
   * introducing a stranger. That is why this needs no parked `isocan rc` on
   * the target canvas and `isocan agent add` does.
   *
   * **And it confers nothing beyond standing here.** No turn is started, no
   * `listen` rule is written, and no other canvas is touched. What it prints
   * is the reachability it just measured, in journey 1's words, because an
   * enrolment that cannot answer yet is legitimate and an enrolment that
   * pretends it can answer is the bug.
   */
  bench
    .command("join <name>")
    .description("Bring an agent from your bench to this canvas — it answers here, and nothing else changes")
    .action(
      act(async (ctx, args) => {
        const name = args[0] as string;
        const benchId = await benchCanvasId(ctx);
        if (!benchId) {
          throw new Error(
            "you have no bench here — `isocan bench add <name>` puts an agent on one first",
          );
        }
        const row = oneRow(benchAgents((await ctx.client.snapshot(benchId)).canvas), name);
        const target = await resolveCanvas(ctx);
        const standing = (await ctx.client.snapshot(target.id)).canvas.agents?.[row.actorId];
        if (standing) {
          if (ctx.json) {
            return printJson({ canvasId: target.id, from: benchId, joined: false, agent: row });
          }
          return console.log(
            `${standing.actor.name} already answers on ${target.title} (${target.id}).`,
          );
        }
        await ctx.client.sendOp(target.id, ctx.actor, {
          type: "agent.invite",
          agent: { id: row.actorId, name: row.name },
          from: benchId,
        });
        // Measured AFTER, and by core: the row now stands on one more canvas,
        // so a word read before the send would be a word about a bench that
        // no longer exists. `ready` is still the only thing a parked rc can
        // make true, which is the point — joining did not move it.
        const joined = oneRow(await readBench(ctx, benchId), name);
        if (ctx.json) {
          return printJson({ canvasId: target.id, from: benchId, joined: true, agent: joined });
        }
        console.log(
          `${joined.name} answers on ${target.title} — ${benchWords(joined)}, ${benchStandingWords(joined)}. Nothing else moved: no turn was started, no summons rule was written, and no other canvas changed.`,
        );
      }),
    );

  bench
    .command("rm <name>")
    .description("Take an agent off your bench — its enrolments and its rc rows are untouched")
    .action(
      act(async (ctx, args) => {
        const name = args[0] as string;
        const canvasId = await benchCanvasId(ctx);
        if (!canvasId) throw new Error("you have no bench here");
        const snapshot = await ctx.client.snapshot(canvasId);
        const row = oneRow(benchAgents(snapshot.canvas), name);
        await ctx.client.sendOp(canvasId, ctx.actor, { type: "item.delete", itemId: row.itemId });
        if (ctx.json) return printJson({ canvasId, itemId: row.itemId, removed: row });
        console.log(`${row.name} is off your bench. Its standing and its rc rows are exactly as they were.`);
      }),
    );
}
