#!/usr/bin/env node
/**
 * **The real asks, exported for the route comparison** (local-judge phase 1).
 *
 *   node scripts/local-judge/export.mjs [--homes daemon,https://isocan.io] [--out <dir>]
 *
 * Every HUMAN ask the person can read, across every canvas of each home
 * named — the local daemon (`daemon`) and any home spoken to directly by its
 * address — read through the evals corpus reader (`buildCorpus`, the same
 * one `isocan evals corpus` prints) and the person's own badge. Human only:
 * the evals note's author rule — an actor the registry knows as an agent
 * (`GET /api/kinds`) or the canvas's roster enrolled is not a person, and
 * neither is a row the corpus would not call an ask.
 *
 * **Read-only.** It writes to no canvas and to no home; the one file it
 * writes is `<isocan home>/local-judge/asks.json` (or `--out`), refused
 * inside a git work tree. Re-running keeps every draft and every review
 * already in the file, matched by ask id: an export never undoes a person's
 * labelling.
 *
 * Prints counts only — never a word anybody typed.
 */
import os from "node:os";
import path from "node:path";
import { register } from "tsx/esm/api";
import { ASKS_FILE, argOf, asPerson, judgeDir, readJson, refuseInRepo, writeJsonAtomic } from "./lib.mjs";

const arg = argOf(process.argv.slice(2));
const out = path.resolve(arg("--out", judgeDir()));
refuseInRepo(out);
const homes = arg("--homes", "daemon,https://isocan.io").split(",").map((h) => h.trim()).filter(Boolean);

asPerson();
// Resolve from a directory no `.isocan/project.json` binds, so no repository's canvas is assumed.
process.chdir(os.homedir());
register();
const { resolveCtx } = await import("@isocan/api");
const { buildCorpus, parseSlashCommand } = await import("@isocan/core");
const { baselineRoute, scenarioOf } = await import("@isocan/core/intent-route");

async function readHome(home) {
  if (home === "daemon") delete process.env.ISOCAN_DIRECT;
  else process.env.ISOCAN_DIRECT = home;
  const ctx = await resolveCtx({ interactive: false });
  const kinds = await ctx.client.actorKinds().catch(() => ({}));
  const canvases = await ctx.client.listCanvases();
  const read = [];
  for (const canvas of canvases) {
    try {
      const [archived, live, snap] = await Promise.all([ctx.client.getArchivedLog(canvas.id), ctx.client.getLog(canvas.id, 0), ctx.client.snapshot(canvas.id)]);
      const log = [...new Map([...archived, ...live].map((e) => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq);
      const corpus = buildCorpus(snap.canvas, log, Object.keys(kinds));
      const agents = new Set([...Object.keys(snap.canvas.agents ?? {}), ...Object.keys(kinds)]);
      const human = corpus.asks.filter((a) => !agents.has(a.askedBy.id));
      const rows = human.map((a) => {
        const comment = snap.canvas.threads[a.threadId]?.comments.find((c) => c.id === a.commentId);
        return {
          id: `${canvas.id}:${a.commentId}`,
          canvasId: canvas.id,
          home,
          threadId: a.threadId,
          main: a.main,
          at: a.at,
          body: a.body,
          selected: comment?.items?.length ?? 0,
          command: parseSlashCommand(a.body)?.name ?? null,
          category: a.category,
          baseline: baselineRoute(a.body),
          scenario: scenarioOf(a.body),
        };
      });
      read.push({ canvas: { id: canvas.id, title: canvas.title }, asks: corpus.asks.length, human: rows.length, rows });
    } catch (error) {
      read.push({ canvas: { id: canvas.id, title: canvas.title }, error: String(error?.message ?? error) });
    }
  }
  return { home, canvases: read };
}

const byHome = [];
for (const home of homes) {
  try {
    byHome.push(await readHome(home));
  } catch (error) {
    byHome.push({ home, error: String(error?.message ?? error), canvases: [] });
  }
}

// One canvas, one reading: a replica and its home hold the same asks.
const seen = new Set();
const rows = [];
const canvases = [];
for (const h of byHome) {
  for (const c of h.canvases) {
    if (c.error || seen.has(c.canvas.id)) {
      canvases.push({ id: c.canvas.id, home: h.home, ...(c.error ? { error: c.error } : { duplicateOf: "an earlier home" }) });
      continue;
    }
    seen.add(c.canvas.id);
    canvases.push({ id: c.canvas.id, title: c.canvas.title, home: h.home, asks: c.asks, human: c.human });
    rows.push(...c.rows);
  }
}

// Keep what a person (or an earlier draft) already wrote.
const file = path.join(out, ASKS_FILE);
const before = readJson(file, { rows: [] });
const kept = new Map(before.rows.map((r) => [r.id, r]));
const merged = rows.map((r) => {
  const old = kept.get(r.id);
  return old ? { ...r, draft: old.draft ?? null, label: old.label ?? null, reviewedBy: old.reviewedBy ?? null, reviewedAt: old.reviewedAt ?? null } : { ...r, draft: null, label: null, reviewedBy: null, reviewedAt: null };
});
writeJsonAtomic(file, { v: 1, exportedAt: new Date().toISOString(), homes: byHome.map((h) => ({ home: h.home, ...(h.error ? { error: h.error } : {}) })), canvases, rows: merged });

// Counts only.
const count = (xs, f) => xs.reduce((acc, x) => ((acc[f(x)] = (acc[f(x)] ?? 0) + 1), acc), {});
console.log(JSON.stringify({
  wrote: file,
  homes: byHome.map((h) => ({ home: h.home, canvases: h.canvases.length, ...(h.error ? { error: h.error } : {}) })),
  canvases: canvases.map((c) => ({ id: c.id, home: c.home, ...(c.error ? { error: c.error } : c.duplicateOf ? { duplicate: true } : { asks: c.asks, human: c.human }) })),
  humanAsks: merged.length,
  scenarios: new Set(merged.map((r) => r.scenario)).size,
  byBaseline: count(merged, (r) => r.baseline),
  kept: { drafted: merged.filter((r) => r.draft).length, reviewed: merged.filter((r) => r.reviewedBy).length },
}, null, 2));
