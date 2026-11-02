import { ApiError } from "@isocan/api";
import type { CanvasContents, Item } from "@isocan/core";
import {
  summarisableText, summaryKey, summaryMembers, SUMMARY_MIN_WORDS, SUMMARY_OVER_BUDGET, SUMMARY_QUIET, textSummaryKey,
  type SummaryDay, type SummaryEntry, type SummaryStats,
} from "@isocan/core/semantic-zoom";
import type { Ctx } from "./ctx.ts";

/**
 * **Semantic Zoom from the terminal** (`docs/projects/semantic-zoom/`, design
 * §8, phase 4): `isocan summary <item|group|area>` and `isocan ls --summaries`.
 *
 * Imported by `main.ts` statically, and measured that way: a lazy import of
 * this file, or of core's `semantic-zoom` from anywhere in the CLI's graph,
 * makes a new entry that re-cuts core's biggest shared chunk in two, and
 * `isocan --version` loads one module past its budget
 * (`test/cli-bundle.test.ts`, 40 → 41). Statically, `semantic-zoom.ts` rides
 * a chunk `--version` already loads; it costs about 10 KB read and no module.
 * It prints nothing itself: it hands `main.ts` the rows and the lines.
 *
 * Nothing here decides anything the web does not. The content key is core's
 * (`textSummaryKey`, `summaryKey` over `summaryMembers`), computed from the
 * snapshot the CLI already read, so the terminal and the app look up the same
 * entry; "excluded" is core's rule; a summary is read with the same batched
 * `GET …/summaries?keys=…&for=…`, and `--refresh` asks the one make route the
 * web's fetcher asks, so the home's rules — edit capability, the key's spend
 * rules, the badge's rate, the quiet period — are the only rules. `ls` reads
 * and never makes.
 *
 * A summary is approximate and not an act: it is never an op, and an agent
 * reads the words (`isocan get`) before acting on what a summary says.
 */

type Kind = "text" | "group" | "area";

/** Where one thing's summary stands, as both surfaces would say it. */
type State = "current" | "stale" | "short" | "excluded" | "missing";

interface Target {
  item: Item;
  kind: Kind;
  /** Null when the thing is excluded from context: it has no key, because it is never summarised. */
  key: string | null;
}

/**
 * The thing's kind and its current content key, exactly as the web computes
 * them (a text node, else a group, else an area — the web's order) — the key
 * null when it is excluded — or null when it is none of the three, which have
 * no summary. Core's collectors answer null for the wrong kind, so they are
 * the kind test too.
 */
async function targetOf(canvas: CanvasContents, item: Item): Promise<Target | null> {
  const text = summarisableText(canvas, item.id);
  if (text) return { item, kind: "text", key: text === "excluded" ? null : await textSummaryKey(text) };
  for (const kind of ["group", "area"] as const) {
    const held = summaryMembers(canvas, kind, item.id);
    if (held) return { item, kind, key: held === "excluded" ? null : await summaryKey(kind, [held.container, ...held.members]) };
  }
  return null;
}

/** The home's answer for a key, read as a state. A stale entry with no words (an old `short`) says nothing about the current content: missing. */
function stateOf(target: Target, entry: SummaryEntry | undefined): State {
  if (target.key === null) return "excluded";
  if (!entry) return "missing";
  if (entry.stale) return entry.summary ? "stale" : "missing";
  return entry.short ? "short" : "current";
}

/** What `--refresh` came back with: made (or already made), the quiet period's wait, or the canvas's hour spent. */
type Refresh = { made: boolean } | { code: typeof SUMMARY_QUIET; retryAfterMs: number } | { code: typeof SUMMARY_OVER_BUDGET; message: string };

/** At most this many keys per read: the home's own bound (`MAX_KEYS` in the server). */
const PER_READ = 200;

/** Every target's entry, in batches, by key. A read never makes one. */
async function readEntries(ctx: Ctx, canvasId: string, targets: Target[]): Promise<Map<string, SummaryEntry>> {
  const keyed = targets.filter((t): t is Target & { key: string } => t.key !== null);
  const found = new Map<string, SummaryEntry>();
  for (let i = 0; i < keyed.length; i += PER_READ) {
    const batch = keyed.slice(i, i + PER_READ);
    const { summaries } = await ctx.client.summaries(canvasId, batch.map((t) => t.key), batch.map((t) => t.item.id));
    for (const t of batch) if (summaries[t.key]) found.set(t.key, summaries[t.key]!);
  }
  return found;
}

/** One state as a JSON row: the words, the state, and when the content it describes was summarised. */
function row(target: Target, entry: SummaryEntry | undefined, now: number) {
  const state = stateOf(target, entry);
  const shows = state === "current" || state === "stale";
  return {
    itemId: target.item.id,
    kind: target.kind,
    title: target.item.title,
    key: target.key,
    state,
    summary: shows ? entry!.summary : null,
    ...(shows ? { madeAt: entry!.madeAt, ageMs: Math.max(0, now - Date.parse(entry!.madeAt)), model: entry!.model } : {}),
  };
}

/** What one state says in words, after the summary itself. */
function stateLine(target: Target, entry: SummaryEntry | undefined, ago: (iso: string) => string): string {
  const what = `${target.kind} ${target.item.id} "${target.item.title}"`;
  // A note's words are its file; a group's or an area's are its members'.
  const words = target.kind === "text" ? `isocan get ${target.item.id}` : `isocan ls --in ${target.item.id}`;
  switch (stateOf(target, entry)) {
    case "current":
      return `current — a summary of ${what}, made ${ago(entry!.madeAt)}${entry!.model ? ` by ${entry!.model}` : ""}. Approximate: read the words (${words}) before acting on it.`;
    case "stale":
      return `stale — describes ${what} as it was ${ago(entry!.madeAt)}; it has changed since and the new content has no summary yet.`;
    case "short":
      return `short — ${what} is ${SUMMARY_MIN_WORDS} words or fewer, so its words are the summary: isocan get ${target.item.id}`;
    case "excluded":
      return `excluded — ${what} is excluded from context, so it is never sent to a model and has no summary.`;
    case "missing":
      return `missing — ${what} has no summary yet. isocan summary ${target.item.id} --refresh asks the home for one.`;
  }
}

/**
 * **`isocan summary <item|group|area> [--refresh]`.** Reads the cached
 * summary for the thing's current content key; with `--refresh`, then asks
 * the home to make one through the web's own make route. A 202 (the content
 * changed moments ago) is an answer, not an error: it says when to ask again,
 * and the verb exits 0; so is a 429 over the canvas's hourly budget, which
 * spent nothing. A refusal (view-only, owner-only key, no key, the badge's
 * rate, excluded) is the home's own words, thrown, so `run` prints it and
 * exits 1.
 * Returns the JSON row and the human lines; `main.ts` prints one of them.
 * `ago` says how long ago a time was, in the CLI's words ("5m ago").
 */
export async function summaryReport(ctx: Ctx, canvasId: string, canvas: CanvasContents, item: Item, opts: { refresh?: boolean; ago: (iso: string) => string }): Promise<{ json: object; lines: string[] }> {
  const target = await targetOf(canvas, item);
  if (!target) throw new Error(`${item.id} is not a text node, a group or an area — only those have a summary`);
  const now = Date.now();
  let entry = (await readEntries(ctx, canvasId, [target])).get(target.key ?? "");
  let refresh: Refresh | null = null;
  if (opts.refresh) {
    const before = stateOf(target, entry);
    try {
      const answer = await ctx.client.makeSummary(canvasId, { kind: target.kind, sourceId: item.id });
      if ("code" in answer && answer.code === SUMMARY_QUIET) {
        refresh = { code: answer.code, retryAfterMs: answer.retryAfterMs };
      } else {
        entry = answer as SummaryEntry;
        refresh = { made: before !== "current" && before !== "short" };
      }
    } catch (error) {
      // Over the canvas's hour: an answer, like the quiet period, not a fault — nothing was spent and what is cached keeps showing.
      if (!(error instanceof ApiError && error.code === SUMMARY_OVER_BUDGET)) throw error;
      refresh = { code: SUMMARY_OVER_BUDGET, message: error.message };
    }
  }
  const shown = row(target, entry, now);
  const lines = [...(shown.summary ? [`≈ ${shown.summary}`] : []), stateLine(target, entry, opts.ago)];
  if (refresh && "retryAfterMs" in refresh) {
    const seconds = Math.max(1, Math.ceil(refresh.retryAfterMs / 1000));
    lines.push(`waiting — it changed moments ago, so the home waits for it to go quiet before summarising it. Ask again in ${seconds} s: isocan summary ${item.id} --refresh`);
  } else if (refresh && "message" in refresh) {
    lines.push(`over budget — ${refresh.message}. Nothing was spent; isocan summary --stats says when the hour resets.`);
  } else if (refresh && !refresh.made) {
    lines.push("refresh — the summary was already current; nothing was spent.");
  }
  return { json: { ...shown, ...(refresh ? { refresh } : {}) }, lines };
}

/**
 * **`ls --summaries`' column**: for each listed text node, group and area
 * that has a summary, its row and the column's words (current, or stale
 * marked so), untruncated — `main.ts` fits them to the column. Nothing for
 * the rest. One batched read; nothing is ever made.
 */
export async function summaryColumn(ctx: Ctx, canvasId: string, canvas: CanvasContents, items: Item[]): Promise<Map<string, { text: string; json: ReturnType<typeof row> }>> {
  const targets = (await Promise.all(items.map((item) => targetOf(canvas, item)))).filter((t): t is Target => t !== null);
  const entries = await readEntries(ctx, canvasId, targets);
  const now = Date.now();
  const column = new Map<string, { text: string; json: ReturnType<typeof row> }>();
  for (const target of targets) {
    const json = row(target, target.key ? entries.get(target.key) : undefined, now);
    if (!json.summary) continue;
    column.set(target.item.id, { text: `≈ ${json.state === "stale" ? "(stale) " : ""}${json.summary}`, json });
  }
  return column;
}

const TALLY = ["calls", "inputTokens", "outputTokens", "makes", "hits"] as const;
/** One row's numbers, in the table's column order; a day with nothing is zeros. */
const tallyCells = (t: Partial<Omit<SummaryDay, "day">>) =>
  [...TALLY.map((field) => String(t[field] ?? 0)), String(t.stale ?? 0), String(t.overBudget ?? 0)];

/**
 * **`isocan summary --stats [--days N]`** — what this canvas's summaries cost
 * (phase 3's `GET …/summaries/stats`; editors only, a viewer is refused by
 * the home). The human form is today's row, the span's total, the hour's
 * budget and the cache; `--json` is the home's answer untouched.
 */
export async function summaryStatsReport(ctx: Ctx, canvasId: string, days: number | undefined): Promise<{ json: SummaryStats; lines: string[] }> {
  const stats = await ctx.client.summaryStats(canvasId, days);
  const today = new Date().toISOString().slice(0, 10);
  const head = ["", "calls", "tokens in", "tokens out", "makes", "hits", "stale", "over budget"];
  const rows = [
    head,
    [`today (${today})`, ...tallyCells(stats.days.find((d) => d.day === today) ?? {})],
    [`last ${stats.days.length} day${stats.days.length === 1 ? "" : "s"} with any`, ...tallyCells(stats.total)],
  ];
  const widths = head.map((_, col) => Math.max(...rows.map((r) => r[col]!.length)));
  const { perHour, usedThisHour, resetsInMs, visionPerHour, visionUsedThisHour } = stats.budget;
  const lines = [
    `summaries on ${stats.canvasId}`,
    ...rows.map((r) => r.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]!) : cell.padStart(widths[col]!))).join("  ").trimEnd()),
    `budget — ${usedThisHour} of ${perHour} made this hour${resetsInMs ? `; it resets in ${Math.ceil(resetsInMs / 60_000)} min` : ""}${visionPerHour ? `; ${visionUsedThisHour ?? 0} of ${visionPerHour} looked at pictures` : ""}`,
    `cache — ${stats.entries.held} of ${stats.entries.max} entries held`,
  ];
  return { json: stats, lines };
}
