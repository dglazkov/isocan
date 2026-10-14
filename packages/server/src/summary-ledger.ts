import { promises as fs } from "node:fs";
import path from "node:path";
import type { SummaryDay, SummaryEntry, SummaryStats, SummaryTally } from "@isocan/core/semantic-zoom";

/**
 * **What Semantic Zoom's summaries cost, per canvas per day, and the hour's
 * budget** (`docs/projects/semantic-zoom/design.md` §6; phase 3).
 *
 * The cost record lives at the home beside the cache, outside the oplog like
 * the summaries themselves: `<home>/summaries/<canvasId>.stats.json`, one
 * `SummaryDay` per UTC day, the last `KEEP_DAYS` kept. Every model call is
 * counted with the tokens the provider said it cost, every kept summary as a
 * make, every answer from the cache as a hit — so whoever pays can see what a
 * canvas spends, and whether the cache is earning its keep. Writes are
 * serialised per canvas and land by rename, so a read never sees half a file.
 *
 * The budget is the canvas's, across everyone: at most `perHour` model calls
 * in any rolling hour, beyond `/api/text`'s own rate per badge. It is held in
 * memory, so a restarted home starts the hour afresh — at worst one extra
 * hour's calls, never a call made without the other guards.
 */

/** Days of record kept per canvas: a quarter, enough for a month-on-month look. */
const KEEP_DAYS = 90;
const HOUR_MS = 3_600_000;

type Kind = SummaryEntry["kind"];
type Tokens = { inputTokens: number; outputTokens: number };

const zero = (): SummaryTally => ({ calls: 0, inputTokens: 0, outputTokens: 0, makes: 0, hits: 0 });
const emptyDay = (day: string): SummaryDay => ({ day, ...zero(), stale: 0, overBudget: 0, byKind: {}, byModel: {} });

/** One thing that happened, as the ledger counts it. */
type Happened =
  | { what: "call"; kind: Kind; model: string; tokens?: Tokens; kept: boolean }
  | { what: "hit"; kind: Kind; count?: number }
  | { what: "stale"; count: number }
  | { what: "over-budget" };

function add(into: SummaryTally, from: Partial<SummaryTally>): void {
  for (const field of ["calls", "inputTokens", "outputTokens", "makes", "hits"] as const) into[field] += from[field] ?? 0;
}

/** Fold one day into a running total: every count, and each kind's and each model's. */
function fold(total: Omit<SummaryDay, "day">, day: Omit<SummaryDay, "day">): void {
  add(total, day);
  total.stale += day.stale;
  total.overBudget += day.overBudget;
  for (const [kind, tally] of Object.entries(day.byKind) as Array<[Kind, SummaryTally]>) add((total.byKind[kind] ??= zero()), tally);
  for (const [model, tally] of Object.entries(day.byModel)) {
    const into = (total.byModel[model] ??= { calls: 0, inputTokens: 0, outputTokens: 0 });
    into.calls += tally.calls;
    into.inputTokens += tally.inputTokens;
    into.outputTokens += tally.outputTokens;
  }
}

/**
 * **The cost record and the budget, for every canvas at this home.** One per
 * summaries route; `now` is the route's clock, so a test holds the day and
 * the hour.
 */
export class SummaryLedger {
  /** The load promise, so two first counts at once share one record instead of the later overwriting the earlier. */
  private readonly days = new Map<string, Promise<Record<string, SummaryDay>>>();
  private readonly writing = new Map<string, Promise<void>>();
  private readonly spent = new Map<string, number[]>();

  constructor(private readonly root: string, private readonly perHour: () => number, private readonly now: () => number) {}

  private file(canvasId: string): string {
    return path.join(this.root, `${encodeURIComponent(canvasId)}.stats.json`);
  }

  private load(canvasId: string): Promise<Record<string, SummaryDay>> {
    let held = this.days.get(canvasId);
    if (!held) this.days.set(canvasId, (held = this.read(canvasId)));
    return held;
  }

  private async read(canvasId: string): Promise<Record<string, SummaryDay>> {
    let read: Record<string, SummaryDay> = {};
    try {
      const raw = JSON.parse(await fs.readFile(this.file(canvasId), "utf8")) as { days?: Record<string, SummaryDay> };
      if (raw && typeof raw.days === "object" && raw.days) read = raw.days;
    } catch {
      // No record yet, or one that cannot be read: start counting from here.
    }
    return read;
  }

  /** The calls this canvas has made in the last hour, oldest first. */
  private hour(canvasId: string): number[] {
    const now = this.now();
    const recent = (this.spent.get(canvasId) ?? []).filter((at) => now - at < HOUR_MS);
    this.spent.set(canvasId, recent);
    return recent;
  }

  /** How long until this canvas may call a model again: 0 when it may now. */
  overBudget(canvasId: string): number {
    const recent = this.hour(canvasId);
    return recent.length < this.perHour() ? 0 : Math.max(1, recent[recent.length - this.perHour()]! + HOUR_MS - this.now());
  }

  /** Spend one of the canvas's calls for the hour. Asked only after `overBudget` said 0 and every other guard passed. */
  spend(canvasId: string): void {
    this.hour(canvasId).push(this.now());
  }

  /** Count what happened, in today's row, and write the record. */
  async record(canvasId: string, happened: Happened): Promise<void> {
    const days = await this.load(canvasId);
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const day = (days[today] ??= emptyDay(today));
    if (happened.what === "call") {
      const tokens = { inputTokens: happened.tokens?.inputTokens ?? 0, outputTokens: happened.tokens?.outputTokens ?? 0 };
      const tally = { calls: 1, ...tokens, makes: happened.kept ? 1 : 0 };
      add(day, tally);
      add((day.byKind[happened.kind] ??= zero()), tally);
      const model = (day.byModel[happened.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0 });
      model.calls += 1;
      model.inputTokens += tokens.inputTokens;
      model.outputTokens += tokens.outputTokens;
    } else if (happened.what === "hit") {
      add(day, { hits: happened.count ?? 1 });
      add((day.byKind[happened.kind] ??= zero()), { hits: happened.count ?? 1 });
    } else if (happened.what === "stale") day.stale += happened.count;
    else day.overBudget += 1;
    for (const old of Object.keys(days).sort().slice(0, -KEEP_DAYS)) delete days[old];
    await this.write(canvasId, days);
  }

  /** One write at a time per canvas, each of the whole record as it now stands, by rename. */
  private write(canvasId: string, days: Record<string, SummaryDay>): Promise<void> {
    const before = this.writing.get(canvasId) ?? Promise.resolve();
    const next = before.then(async () => {
      await fs.mkdir(this.root, { recursive: true });
      const full = this.file(canvasId);
      const temp = `${full}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temp, JSON.stringify({ canvasId, days }));
      await fs.rename(temp, full);
    });
    this.writing.set(canvasId, next.catch(() => undefined));
    return next;
  }

  /** The record as `GET …/summaries/stats` answers it: the last `span` days that had any, newest first, and their total. */
  async stats(canvasId: string, span: number, entries: SummaryStats["entries"]): Promise<SummaryStats> {
    const days = await this.load(canvasId);
    const since = new Date(this.now() - (span - 1) * 86_400_000).toISOString().slice(0, 10);
    const shown = Object.values(days).filter((day) => day.day >= since).sort((a, b) => (a.day < b.day ? 1 : -1));
    const { day: _day, ...total } = emptyDay("");
    for (const day of shown) fold(total, day);
    const recent = this.hour(canvasId);
    return {
      canvasId,
      days: shown,
      total,
      budget: { perHour: this.perHour(), usedThisHour: recent.length, resetsInMs: recent.length ? recent[0]! + HOUR_MS - this.now() : null },
      entries,
    };
  }
}
