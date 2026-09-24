/**
 * **Does Jev hear simple commands? — the fast path, measured** (voice-agent
 * phase 6, proof 2; `docs/projects/voice-agent/fast-path.md`).
 *
 *   node --env-file=<secrets> --import tsx packages/modules/talk/scripts/fast-path-eval.ts \
 *     [--fixture <commands.json>] [--out <dir>] [--answerer jev|stub] [--budget 0.50] [--concurrency 6]
 *
 *   node --import tsx packages/modules/talk/scripts/fast-path-eval.ts --record <fast-path-shadow.jsonl> [--out <dir>]
 *
 * With `--fixture` (the default is the scripted command set beside the
 * tests): every command is put to the resolver — the SAME `fastPathQuestions`
 * and `readProposal` the talk module runs in the browser — against the
 * fixture's synthetic Acme canvas, and its proposal is compared with the act
 * the command meant. With `--record`: a person's exported shadow record is
 * read instead, and the meant act is what the live model did when nobody took
 * it back. Either way the report is `fastpath-report.ts`'s: agreement per
 * action, escalation precision and recall, the reliability curve and its ECE,
 * the threshold each action reaches (≥95% on ≥30) or "none yet", latency and
 * cost.
 *
 * Nothing is sent before the projected spend is under `--budget`, and the run
 * stops asking the moment measured spend reaches it. The key is read from the
 * environment (`TYPESAFE_API_KEY`) and never printed.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JEV_INPUT_PRICE, jevAnswerer, stubAnswerer, type Answerer } from "@isocan/core/jev";
import { canonicalCall, fastPathQuestions, readProposal, type CanonicalAct, type FastPathCanvas } from "../src/fastpath.ts";
import { report, rowsFromRecord, type EvalRow } from "../src/fastpath-report.ts";
import { parseShadow } from "../src/shadow.ts";
import type { SnapshotItem } from "../src/live.ts";

export interface FixtureCommand {
  id: string;
  say: string;
  /** The act meant, as the live model's tool call — or "escalate". */
  expect: { tool: string; args: Record<string, unknown> } | "escalate";
  complex?: boolean;
  /** Written after a live run had scored the rest — the held-out check on phrasing. */
  hard?: boolean;
  /** Ids the person has selected when they say it. */
  selected?: string[];
  lastAct?: string;
}

export interface Fixture {
  canvas: { items: SnapshotItem[] };
  commands: FixtureCommand[];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FIXTURE = path.join(HERE, "..", "test", "fixtures", "fast-path-commands.json");

/** The canvas one command is said on: the fixture's, with its selection marked. */
export function canvasFor(fixture: Fixture, c: FixtureCommand): FastPathCanvas {
  const picked = new Set(c.selected ?? []);
  return {
    items: fixture.canvas.items.map((i) => ({ ...i, ...(picked.has(i.id) ? { selected: true } : {}) })),
    ...(c.lastAct ? { lastAct: c.lastAct } : {}),
  };
}

/** A command's meant act, canonical — through the same `canonicalCall` a model's call goes through. */
export function truthOf(fixture: Fixture, c: FixtureCommand): CanonicalAct {
  if (c.expect === "escalate") return { act: "escalate" };
  const act = canonicalCall(c.expect.tool, c.expect.args, fixture.canvas.items);
  if (!act) throw new Error(`${c.id}: "${c.expect.tool}" only looks — a command must mean an act`);
  if (act.act === "escalate") throw new Error(`${c.id}: the meant call ${JSON.stringify(c.expect)} is not a fast-path act — write "escalate"`);
  return act;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string, dflt?: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const out = flag("--out", path.join(process.cwd(), "fast-path-eval"))!;
  mkdirSync(out, { recursive: true });

  const recordFile = flag("--record");
  if (recordFile) {
    const { rows, titles } = rowsFromRecord(parseShadow(readFileSync(recordFile, "utf8")));
    const md = report(rows, { title: "The fast path in shadow — a person's record", answerer: "recorded", titles });
    writeFileSync(path.join(out, "report.record.md"), md);
    console.log(md);
    return;
  }

  const which = flag("--answerer", "jev")!;
  const budget = Number(flag("--budget", "0.50"));
  const concurrency = Number(flag("--concurrency", "6"));
  const fixture = JSON.parse(readFileSync(flag("--fixture", DEFAULT_FIXTURE)!, "utf8")) as Fixture;
  const answerer: Answerer = which === "stub" ? stubAnswerer(1) : jevAnswerer({ key: process.env.TYPESAFE_API_KEY, backoff: [500, 1000, 2000, 4000, 8000] });
  const titles = Object.fromEntries(fixture.canvas.items.map((i) => [i.id, i.title ?? i.id]));

  const answersFile = path.join(out, `answers.${which}.jsonl`);
  const done = new Map<string, EvalRow>();
  if (existsSync(answersFile)) {
    for (const line of readFileSync(answersFile, "utf8").split("\n")) if (line.trim()) {
      const r = JSON.parse(line) as EvalRow;
      if (!r.error) done.set(r.id, r);
    }
  }
  const todo = fixture.commands.map((c) => ({ c, truth: truthOf(fixture, c), gen: fastPathQuestions(c.say, canvasFor(fixture, c)) }));
  const pending = todo.filter((t) => !done.has(t.c.id));
  // A token is taken as 2.5 characters of the request as sent — calibrate.ts's measured ~2.4, erring high.
  const projected = pending.reduce((s, t) => s + (t.gen.ok ? JSON.stringify(t.gen.ask.request).length / 2.5 : 0), 0) * JEV_INPUT_PRICE;
  console.error(`${todo.length} commands, ${done.size} already answered, ${pending.length} to ask; projected $${projected.toFixed(4)} (budget $${budget.toFixed(2)})`);
  if (which === "jev" && projected > budget) {
    console.error("projection exceeds the budget — nothing sent");
    process.exit(3);
  }

  const t0 = Date.now();
  let spent = [...done.values()].reduce((s, r) => s + r.tokens, 0) * JEV_INPUT_PRICE;
  let next = 0;
  let failed = 0;
  let stopped = false;
  let lastStart = 0;
  const gate = async () => {
    if (which !== "jev") return;
    const wait = lastStart + 67 - Date.now();
    lastStart = Math.max(Date.now(), lastStart + 67);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
  const worker = async () => {
    while (!stopped && next < pending.length) {
      const { c, truth, gen } = pending[next++]!;
      const base = { id: c.id, utterance: c.say, truth, complex: c.complex === true, ...(c.hard ? { hard: true } : {}) };
      let row: EvalRow;
      if (!gen.ok) {
        row = { ...base, proposed: { act: "escalate" }, action: "none", p: null, reasons: [gen.reason], ms: 0, tokens: 0, by: "" };
      } else {
        await gate();
        try {
          const a = await answerer.answer(gen.ask.request);
          const proposal = readProposal(gen.ask, a.response);
          row = { ...base, proposed: proposal.act, action: proposal.action, p: proposal.p, reasons: proposal.reasons, ms: a.ms, tokens: a.response.usage?.input_tokens ?? 0, by: a.by };
          spent += row.tokens * JEV_INPUT_PRICE;
        } catch (e) {
          failed++;
          row = { ...base, proposed: { act: "escalate" }, action: "none", p: null, reasons: [], ms: 0, tokens: 0, by: "", error: (e as Error).message };
          console.error(`${c.id}: ${(e as Error).message}`);
        }
      }
      appendFileSync(answersFile, `${JSON.stringify(row)}\n`);
      done.set(c.id, row);
      if (spent >= budget) {
        stopped = true;
        console.error(`measured spend $${spent.toFixed(4)} reached the budget — stopping`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const wallMs = Date.now() - t0;
  const rows = todo.map((t) => done.get(t.c.id)).filter((r): r is EvalRow => !!r);
  const md = report(rows, { title: "The fast path, measured — the scripted command set", answerer: which, titles, wallMs });
  writeFileSync(path.join(out, `report.${which}.md`), md);
  console.log(md);
  console.error(`calls this run: ${pending.length - failed} answered, ${failed} failed; wall ${(wallMs / 1000).toFixed(1)}s; total spend $${spent.toFixed(4)}`);
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
