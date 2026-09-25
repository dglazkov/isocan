import guideText from "../agent-guide.md";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import type { Canvas, LogEntry } from "@isocan/core";
import type { CliHost, CliModule, Ctx } from "@isocan/cli/modulehost";
import { judgeModule } from "./record.ts";
import { countsOf, factsOf, foldCorpus, shapeOf, wireItems, type Counts, type Excluded, type Pair } from "./corpus.ts";
import { readWireFacts, type WireFacts } from "./wire-format.ts";

/**
 * **`isocan judge corpus`** — the calibration corpus, read (judge phase 1).
 *
 * Walks the log of the canvases named (or `--all` this daemon knows),
 * through the CLI's own client and the person's own badge, and folds every
 * row a wireframe flow drew into a labelled pair (`corpus.ts`). It writes to
 * no canvas.
 *
 * **Two outputs, and only one may travel.** The terminal and `--json` carry
 * counts and nothing anybody typed. The pairs themselves — requests, screen
 * titles, which canvas — go only to `--out`, a directory the person names,
 * and the verb refuses one inside a git work tree: the labelled set stays on
 * the machine that read it. `shape.json` beside it is the same pairs with
 * every string taken out, the form a fixture or a page may carry.
 */

const LABELLED_FILE = "labelled.json";
const SHAPE_FILE = "shape.json";

/** The git work tree a path would land in, or null. Walks up from the nearest directory that exists. */
export function gitRootOf(dir: string): string | null {
  let at = path.resolve(dir);
  for (;;) {
    if (existsSync(path.join(at, ".git"))) return at;
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

/** Every log entry a canvas has — archived first, then live, one per seq (`buildRecap`'s contract). */
async function logOf(ctx: Ctx, canvasId: string): Promise<LogEntry[]> {
  const [archived, live] = await Promise.all([ctx.client.getArchivedLog(canvasId), ctx.client.getLog(canvasId, 0)]);
  return [...new Map([...archived, ...live].map((entry) => [entry.seq, entry])).values()].sort((a, b) => a.seq - b.seq);
}

interface CanvasReading {
  canvas: Pick<Canvas, "id" | "title">;
  pairs: Pair[];
  counts: Counts;
  excluded: Excluded;
  /** Wire items none of whose files could be read as a wire. */
  unreadable: number;
}

async function readCanvas(ctx: Ctx, canvas: Pick<Canvas, "id" | "title">, me: string): Promise<CanvasReading> {
  const entries = await logOf(ctx, canvas.id);
  const items = wireItems(entries);
  const cache = new Map<string, Promise<WireFacts | null>>();
  const read = (hash: string) => {
    let hit = cache.get(hash);
    if (!hit) {
      hit = ctx.client.downloadBlob(canvas.id, hash).then((bytes) => readWireFacts(Buffer.from(bytes).toString("utf8")), () => null);
      cache.set(hash, hit);
    }
    return hit;
  };
  const facts = new Map<string, WireFacts>();
  let unreadable = 0;
  for (const item of items) {
    const found = await factsOf(item, read);
    if (found) facts.set(item.itemId, found);
    else unreadable++;
  }
  const { pairs, excluded } = foldCorpus({ canvasId: canvas.id, entries, facts, me });
  return { canvas, pairs, counts: countsOf(pairs), excluded, unreadable };
}

function sum(readings: readonly CanvasReading[]): { counts: Counts; excluded: Excluded; unreadable: number } {
  const counts: Counts = { rows: 0, labelled: 0, kept: 0, takenOut: 0, none: 0, heldOut: 0 };
  const excluded: Excluded = { noNeed: 0, notDrawnHere: 0, withdrawn: 0 };
  let unreadable = 0;
  for (const r of readings) {
    for (const key of Object.keys(counts) as Array<keyof Counts>) counts[key] += r.counts[key];
    for (const key of Object.keys(excluded) as Array<keyof Excluded>) excluded[key] += r.excluded[key];
    unreadable += r.unreadable;
  }
  return { counts, excluded, unreadable };
}

function countLine(c: Counts): string {
  return `${c.rows} row${c.rows === 1 ? "" : "s"} drawn · ${c.labelled} labelled (${c.kept} kept, ${c.takenOut} taken out) · ${c.none} none · ${c.heldOut} held out`;
}

function excludedLine(e: Excluded, unreadable: number): string {
  const parts = [
    e.noNeed ? `${e.noNeed} without need (drawn before 24 Sep 2026, or by hand)` : "",
    e.notDrawnHere ? `${e.notDrawnHere} not drawn by a flow on that canvas` : "",
    e.withdrawn ? `${e.withdrawn} in flows that were undone` : "",
    unreadable ? `${unreadable} whose file could not be read` : "",
  ].filter(Boolean);
  return parts.length ? `not in the corpus: ${parts.join(", ")}` : "";
}

async function corpus(host: CliHost, refs: string[], opts: { all?: boolean; out?: string }, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  // Whose verdicts: the person running this, and only them (design.md, "Whose decisions count").
  if (ctx.harness) {
    throw new Error(
      `judge corpus reads a PERSON's own keeps, and this shell speaks as an agent session (${ctx.harness}) — ` +
        "run it as yourself, outside the agent's session, so the labels are yours",
    );
  }
  const me = ctx.actor;
  const out = opts.out === undefined ? undefined : path.resolve(opts.out);
  if (out !== undefined) {
    const repo = gitRootOf(out);
    if (repo) {
      throw new Error(
        `--out ${out} is inside a git work tree (${repo}) — the labelled set carries requests, screen titles and canvas names, ` +
          "and it stays on this machine, outside any repository. Name a directory outside it.",
      );
    }
  }
  if (opts.all && refs.length > 0) throw new Error("--all reads every canvas here — give it no canvas names as well");

  let canvases: Array<Pick<Canvas, "id" | "title">>;
  if (opts.all) canvases = await ctx.client.listCanvases();
  else if (refs.length === 0) canvases = [await host.resolveCanvas(ctx)];
  else {
    // Each name resolved exactly as `--canvas` would be: the CLI's own resolution, one ref at a time.
    canvases = [];
    for (const ref of refs) canvases.push(await host.resolveCanvas(Object.assign(Object.create(ctx) as Ctx, { canvasRef: ref })));
  }
  canvases = [...new Map(canvases.map((c) => [c.id, c])).values()];

  const readings: CanvasReading[] = [];
  const failed: Array<{ canvas: Pick<Canvas, "id" | "title">; error: string }> = [];
  for (const canvas of canvases) {
    try {
      readings.push(await readCanvas(ctx, canvas, me.id));
    } catch (error) {
      failed.push({ canvas, error: (error as Error).message });
    }
  }
  const total = sum(readings);
  const pairs = readings.flatMap((r) => r.pairs);
  const on = new Date().toISOString();

  let wrote: { labelled: string; shape: string } | undefined;
  if (out !== undefined) {
    await mkdir(out, { recursive: true });
    const titleOf = new Map(canvases.map((c) => [c.id, c.title]));
    const labelled = path.join(out, LABELLED_FILE);
    const shape = path.join(out, SHAPE_FILE);
    await writeFile(labelled, `${JSON.stringify({ v: 1, readAt: on, by: { id: me.id, name: me.name }, counts: total.counts, pairs: pairs.map((p) => ({ ...p, canvasTitle: titleOf.get(p.canvasId) ?? "" })) }, null, 2)}\n`);
    await writeFile(shape, `${JSON.stringify(shapeOf(pairs), null, 2)}\n`);
    wrote = { labelled, shape };
  }

  if (ctx.json) {
    // Counts and ids only: the strings anybody typed never reach stdout.
    return host.printJson({
      readAt: on,
      canvases: readings.map((r) => ({ id: r.canvas.id, counts: r.counts, excluded: r.excluded, unreadable: r.unreadable })),
      failed: failed.map((f) => ({ id: f.canvas.id, error: f.error })),
      counts: total.counts,
      excluded: total.excluded,
      unreadable: total.unreadable,
      ...(wrote ? { wrote } : {}),
    });
  }
  console.log(`${on.slice(0, 10)} — ${readings.length} canvas${readings.length === 1 ? "" : "es"} read as ${me.name}: ${countLine(total.counts)}`);
  const why = excludedLine(total.excluded, total.unreadable);
  if (why) console.log(why);
  for (const r of readings) if (r.counts.rows > 0) console.log(`  ${host.truncate(r.canvas.title, 40)} (${r.canvas.id}): ${countLine(r.counts)}`);
  for (const f of failed) console.log(`  could not read ${host.truncate(f.canvas.title, 40)} (${f.canvas.id}): ${f.error}`);
  if (wrote) {
    console.log(`wrote ${wrote.labelled} — ${pairs.length} pairs with their requests and titles; it stays on this machine`);
    console.log(`wrote ${wrote.shape} — the same pairs with every string taken out`);
  } else if (total.counts.rows > 0) {
    console.log("nothing written — `--out <dir>` (outside any repository) writes the pairs");
  }
}

function register(host: CliHost): void {
  const judge = host.program
    .command("judge")
    .description("The judge's calibration corpus — read from what wireframe flows already recorded; writes to no canvas");
  judge
    .command("corpus [canvases...]")
    .description("Fold every row a wireframe flow drew into a pair — round 1's P(yes) and what YOU then did with it (kept, taken out, or none); counts here, the pairs only into --out")
    .option("--all", "every canvas this daemon knows")
    .option("--out <dir>", `write ${LABELLED_FILE} (requests and titles included — never commit it) and ${SHAPE_FILE} there; refused inside a git work tree`)
    .action(host.run((refs: string[], opts: { all?: boolean; out?: string }, cmd: Command) => corpus(host, refs, opts, cmd)));
}

export const judgeCli: CliModule = {
  core: judgeModule,
  register,
  guide: guideText,
};

export default judgeCli;
