import type { LogEntry } from "./ops.ts";
import { opWords } from "./opwords.ts";
import type { CanvasState } from "./model.ts";
import { applyOperation } from "./reducer.ts";

/**
 * **Where the seams are in a canvas's history.**
 *
 * `docs/research/2026-08-26-timeline.md`, and its one firm rule: a
 * significance function belongs in **core, pure**, the way `buildRecap`
 * already is — *"because the CLI must mark the same majors the web does, or
 * the two surfaces disagree about what mattered, which is the one thing this
 * architecture does not permit."*
 *
 * The address of a moment is its `seq`, which both surfaces already speak, so
 * a timeline invents no operation and sends nothing. What it needs is an
 * opinion about which of several thousand entries are worth a tick.
 *
 * **Structural change outranks churn**, which is the whole of the first cut.
 * A birth, a death, a version minted, a conversation started, the Chat moving
 * — those are seams. A run of forty `item.move` entries is one ripple, and
 * drawing it as forty ticks would make the track unreadable exactly where the
 * work was busiest.
 */

/**
 * What each op type is worth. **Absent means zero**, deliberately: a new op
 * type does not become a major by being added, it becomes one by somebody
 * deciding it is. Silence is the safe default for a track that gets noisier
 * the more the vocabulary grows.
 */
const WEIGHT: Record<string, number> = {
  // Births and deaths — the events a person narrates a canvas by.
  "item.add": 5,
  "item.delete": 5,
  "items.delete": 5,
  "item.restore": 4,
  "items.restore": 4,
  // A version is the artifact itself changing, which is what the focused
  // scrubber is for and the strongest single signal on the whole track.
  "item.addVersion": 6,
  // Conversation. The FIRST comment on a thread is a seam; a reply is the
  // conversation continuing, which is not the same event.
  "thread.create": 4,
  "thread.reply": 1,
  // The designated channel moving is rare and always means something.
  "thread.setMain": 5,
  "project.create": 8,
  // Churn. Present with a low weight rather than absent, so a burst of it can
  // still raise a window above the bar without any single one qualifying.
  "item.move": 0.2,
  "items.move": 0.4,
  "item.update": 1,
  "item.resize": 0.2,
};

/** What one entry is worth. */
export function weightOf(entry: LogEntry): number {
  return WEIGHT[entry.envelope.op.type] ?? 0;
}

export interface Major {
  seq: number;
  ts: string;
  /** Who did it — a track is read as a story and a story has people in it. */
  actor: string;
  /** The op type, for a surface that wants to draw by kind. */
  kind: string;
  weight: number;
  /**
   * The item this seam is about, when it is about one.
   *
   * `majorWhat` says "Di added something" and cannot say WHICH something,
   * which is fine in a terminal and thin under a pointer — a surface that
   * wants to show the thing needs a handle on it. Null for the seams that are
   * about the canvas rather than a thing in it (`project.create`), and for
   * ops whose shape carries no item.
   */
  itemId: string | null;
}

/**
 * The entries worth a tick, oldest first.
 *
 * **An undone entry is not a seam.** It happened and then it did not, and a
 * track that ticks for both the doing and the undoing tells a story that did
 * not occur. `undoneBy` is already reconstructed on load, so this costs
 * nothing — and the undo entry itself carries `cause`, which is how the pair
 * is skipped from both ends.
 */
export function majors(entries: readonly LogEntry[], minWeight = 4): Major[] {
  const out: Major[] = [];
  for (const entry of entries) {
    if (entry.undoneBy !== undefined) continue;
    if (entry.cause) continue;
    const weight = weightOf(entry);
    if (weight < minWeight) continue;
    const op = entry.envelope.op as { itemId?: unknown };
    out.push({
      seq: entry.seq,
      ts: entry.envelope.ts,
      actor: entry.envelope.actor.name,
      kind: entry.envelope.op.type,
      weight,
      itemId: typeof op.itemId === "string" ? op.itemId : null,
    });
  }
  return out;
}

/**
 * **The track: every seq bucketed, so a surface can draw density without
 * holding the log.**
 *
 * A scrub track is mostly a picture of *where the work was*, and that is a
 * histogram. Returning buckets rather than entries keeps the caller from
 * needing the whole history to draw a bar — the web can render a track from
 * this alone and fetch detail only where somebody stops.
 *
 * Buckets are over SEQ rather than over time, and that is the choice worth
 * knowing: seq is the address the scrubber moves along, so equal buckets are
 * equal drag distance. Bucketing by wall-clock would make a night of nothing
 * as wide as an afternoon of work, which reads as a bug to the hand.
 */
export interface TrackBucket {
  fromSeq: number;
  toSeq: number;
  /** Entries in this bucket, undone ones included — density is about effort,
   *  not about what survived. */
  count: number;
  /** Summed significance, which is what a surface should draw the bar from. */
  weight: number;
  /** The majors that fall in here, for a surface that draws ticks over bars. */
  majors: Major[];
  /**
   * When this bucket covers — the first and last entry in it, or `null` for a
   * bucket nothing fell into.
   *
   * The track is laid out by SEQ and always has been, which is right: a rail
   * where a quiet fortnight takes the same width as a busy afternoon is a rail
   * you cannot point at. But a person reads a history in dates, and the bucket
   * had no idea when it was — so a surface wanting to say "19 Aug" under the
   * bars had nowhere to get it. Recorded here rather than re-derived, because
   * the fold is already walking every entry.
   */
  fromTs: string | null;
  toTs: string | null;
}

export function track(entries: readonly LogEntry[], buckets = 60): TrackBucket[] {
  if (entries.length === 0) return [];
  const first = entries[0]!.seq;
  const last = entries[entries.length - 1]!.seq;
  const span = Math.max(1, last - first + 1);
  // Never more buckets than entries: a track of 60 slots over 12 ops draws 48
  // empty columns, which reads as a gap in the work rather than as a scale.
  const n = Math.max(1, Math.min(buckets, span));
  const size = span / n;
  const marks = majors(entries);
  const out: TrackBucket[] = [];
  for (let i = 0; i < n; i += 1) {
    const fromSeq = Math.round(first + i * size);
    const toSeq = i === n - 1 ? last : Math.round(first + (i + 1) * size) - 1;
    out.push({ fromSeq, toSeq, count: 0, weight: 0, majors: [], fromTs: null, toTs: null });
  }
  const bucketFor = (seq: number) =>
    Math.min(n - 1, Math.max(0, Math.floor((seq - first) / size)));
  for (const entry of entries) {
    const b = out[bucketFor(entry.seq)]!;
    b.count += 1;
    b.weight += weightOf(entry);
    // Entries arrive oldest-first, so the first one to land sets `fromTs` and
    // every one after it moves `toTs`.
    b.fromTs ??= entry.envelope.ts;
    b.toTs = entry.envelope.ts;
  }
  for (const mark of marks) out[bucketFor(mark.seq)]!.majors.push(mark);
  return out;
}

/** One line per major, the same sentence on every surface. */

/**
 * One seam, said in words — "Di added something".
 *
 * Separate from `majorLine` because the web scrubber wants the sentence
 * WITHOUT the seq in front of it (the playhead is already saying where you
 * are, and saying it twice reads as a stutter). Two surfaces narrating the
 * same seam differently is the small version of the disagreement this whole
 * module exists to prevent, so there is one phrasing and both callers take it
 * from here.
 */
export function majorWhat(major: Major): string {
  return `${major.actor} ${opWords(major.kind) ?? major.kind}`;
}

export function majorLine(major: Major): string {
  return `${major.seq}  ${majorWhat(major)}`;
}

/**
 * **The canvas as it stood at `seq`.**
 *
 * The fold, and nothing else: `applyOperation` over every entry up to and
 * including `seq`, from nothing. This is the whole of "time travel" in a
 * system whose state is already the reduction of its log — the research called
 * that out as the reason a timeline is *pure gain* against isocan's grain
 * rather than across it. It sends nothing, invents no operation, and its
 * position is a `seq` both surfaces already speak.
 *
 * **Undone entries are replayed, not skipped**, and that is the one thing here
 * worth stating twice. `majors` skips both ends of an undo pair because a
 * track that ticks for the doing AND the undoing tells a story that did not
 * happen — but that is a question about what to DRAW. This is a question about
 * what was TRUE, and at a seq before the undo landed, the undone thing was
 * still there. An undo is itself an operation somebody performed at a moment;
 * replaying the log verbatim is what makes the answer the real past rather
 * than a tidied one.
 *
 * Linear from the start rather than stepping backwards through `inverse`.
 * Inverses are how undo moves one entry at a time against live state; a
 * scrubber jumps, and a jump of two hundred entries backwards through inverses
 * is two hundred applications that have to be exactly right in reverse. This
 * is one fold of the same reducer the daemon runs, which is the code most
 * exercised in the entire system. Seeking from a snapshot is the optimisation
 * this leaves room for and does not need yet — measure a long canvas first.
 */
export interface SkippedEntry {
  seq: number;
  /** The op that would not apply, for a surface that wants to name it. */
  kind: string;
  why: string;
}

export interface Past {
  state: CanvasState | null;
  /**
   * Entries the reducer refuses TODAY. Empty on every healthy canvas, and the
   * reason this function exists rather than `at` simply not throwing.
   */
  skipped: SkippedEntry[];
}

/**
 * **The fold, and what it could not replay.**
 *
 * The reducer validates: since `4e70304` an op whose geometry is not a finite
 * number is refused with `bad-op`. That fixed the WRITE side of #76 and left
 * the read side worse than it found it — because a canvas that collected a
 * `"x": null` before the check existed still has it, the oplog is append-only,
 * and replaying from nothing now throws on an entry that was accepted three
 * weeks ago.
 *
 * Measured on this repo's own canvas: opening the history scrubbed to the
 * start and the app went white, with `item.move: x must be a finite number,
 * got null` uncaught. **One bad op made a canvas's whole history
 * unopenable** — a strictly worse outcome than the blank item the validation
 * was added to prevent.
 *
 * So a refused entry is SKIPPED and named, rather than taking the fold down.
 * Skipping is a small lie about the past — the op did apply, back when
 * nothing checked — and it is the honest option available: the alternative is
 * not "show the true past", it is "show nothing at all, forever, and do not
 * say why". The names come back with the state so a surface can say what it
 * could not replay instead of quietly showing a shorter history.
 *
 * The daemon is not exposed to this: it replays only the tail past its
 * snapshot, and a bad op old enough to predate the check is long behind one.
 * Full replays — the scrubber, `isocan at` — are where it bites.
 */
export function past(entries: readonly LogEntry[], seq: number): Past {
  let state: CanvasState | null = null;
  const skipped: SkippedEntry[] = [];
  for (const entry of entries) {
    if (entry.seq > seq) break;
    try {
      state = applyOperation(state, entry.envelope);
    } catch (err) {
      skipped.push({
        seq: entry.seq,
        kind: entry.envelope.op.type,
        why: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { state, skipped };
}

/** The state alone, for callers with nothing to say about a skip. */
export function at(entries: readonly LogEntry[], seq: number): CanvasState | null {
  return past(entries, seq).state;
}

/**
 * The seq range a scrubber can move over: the first and last entries there
 * are. Empty history has no positions, and `null` says so rather than
 * inventing a zero that would render as a track with one end.
 */
export function span(entries: readonly LogEntry[]): { first: number; last: number } | null {
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (!first || !last) return null;
  return { first: first.seq, last: last.seq };
}

/**
 * **A date under the bars, at whatever grain the span deserves.**
 *
 * A rail with no dates on it says how much happened and never when. The
 * obvious fix — a label per bucket — is unreadable at sixty columns, and a
 * fixed grain is wrong at both ends: "19 Aug 14:00" repeated forty times
 * across an afternoon, or "Aug" alone across three years.
 *
 * So the grain is chosen from the span, the way an axis on any chart is:
 * hours within a day, days within a season, months within a few years, years
 * beyond that. The labels are the CHANGES — a tick appears where the day (or
 * month, or year) turns over — which is why they are unevenly spaced and
 * should be. A canvas worked on for three days in March and once in August
 * has an axis that says so.
 *
 * **Positioned by seq, not by time.** The rail is laid out by sequence and
 * must stay that way, so a tick sits where its moment actually falls among
 * the entries. That means a long quiet gap is one tick's width apart from its
 * neighbour rather than a season of empty rail — the honest reading, since
 * the rail's whole job is to be pointed at.
 */
type AxisGrain = "hour" | "day" | "month" | "year";

interface AxisTick {
  /** Where along the rail, 0..1 of the seq span. */
  at: number;
  label: string;
  seq: number;
  ts: string;
}

/** How close two ticks may sit, as a fraction of the rail. Roughly a short
 *  date label's width at the rail's usual size. */
const MIN_TICK_GAP = 0.09;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The grain a span of milliseconds deserves. Thresholds are where a reader
 *  stops caring about the finer unit, not round numbers for their own sake. */
export function axisGrain(spanMs: number): AxisGrain {
  if (spanMs <= 2 * DAY) return "hour";
  if (spanMs <= 120 * DAY) return "day";
  if (spanMs <= 3 * 365 * DAY) return "month";
  return "year";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** The bucket a moment belongs to at this grain — two moments share a key
 *  exactly when they should share a tick. */
function grainKey(d: Date, grain: AxisGrain): string {
  const y = d.getFullYear();
  if (grain === "year") return `${y}`;
  if (grain === "month") return `${y}-${d.getMonth()}`;
  if (grain === "day") return `${y}-${d.getMonth()}-${d.getDate()}`;
  return `${y}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

function grainLabel(d: Date, grain: AxisGrain, showYear: boolean): string {
  const month = MONTHS[d.getMonth()]!;
  if (grain === "year") return `${d.getFullYear()}`;
  if (grain === "month") return showYear ? `${month} ${d.getFullYear()}` : month;
  if (grain === "day") return `${d.getDate()} ${month}`;
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/**
 * Ticks for the rail: one per turn of the chosen unit, plus the ends.
 *
 * `max` is a cap, not a target — a span with three days in it gets three
 * ticks. When the turns outnumber the cap they are thinned evenly rather than
 * truncated, so the axis still spans the whole rail instead of stopping
 * halfway.
 */
export function axisTicks(entries: readonly LogEntry[], max = 8): AxisTick[] {
  if (entries.length === 0) return [];
  const first = entries[0]!;
  const last = entries[entries.length - 1]!;
  const span = Math.max(1, last.seq - first.seq);
  const spanMs = Math.max(0, Date.parse(last.envelope.ts) - Date.parse(first.envelope.ts));
  const grain = axisGrain(spanMs);
  // A month axis that never says which year is a lie on any canvas older than
  // one — so the year rides along exactly when the span crosses one.
  const crossesYear =
    new Date(first.envelope.ts).getFullYear() !== new Date(last.envelope.ts).getFullYear();

  const turns: AxisTick[] = [];
  let seen: string | null = null;
  for (const entry of entries) {
    const d = new Date(entry.envelope.ts);
    const key = grainKey(d, grain);
    if (key === seen) continue;
    seen = key;
    turns.push({
      at: (entry.seq - first.seq) / span,
      label: grainLabel(d, grain, crossesYear),
      seq: entry.seq,
      ts: entry.envelope.ts,
    });
  }
  /**
   * **The right-hand end is the END, not the last time the day changed.**
   *
   * Turns alone leave the axis stopping wherever the final day happened to
   * begin — on a canvas whose last burst ran all afternoon, the rightmost
   * label sat two thirds along and the reader had no idea what the rail
   * reached. The first turn is always the first entry, so the left end comes
   * out right on its own; the right one has to be said.
   *
   * A turn carrying the same label is dropped rather than the end tick: they
   * are the same day, and the one that belongs at the edge is the edge.
   */
  const endLabel = grainLabel(new Date(last.envelope.ts), grain, crossesYear);
  const withEnd =
    turns.at(-1)?.seq === last.seq
      ? turns
      : [
          ...turns.filter((t) => t.label !== endLabel),
          { at: 1, label: endLabel, seq: last.seq, ts: last.envelope.ts },
        ];

  /**
   * **Ticks are placed by seq, so two turns can land on top of each other.**
   *
   * Thinning by COUNT alone does not prevent it: four ticks across a rail is
   * comfortable unless three of them share the same busy afternoon, which is
   * exactly what a canvas worked on in bursts produces. Measured on a real
   * 13-day history, "24 Aug" and "30 Aug" overprinted into "24 A30 Aug".
   *
   * So a minimum separation, as a fraction of the rail. The ends are kept
   * whatever happens — they are the reason the axis exists — and a middle
   * tick that cannot fit is dropped rather than moved, because a date nudged
   * along the rail is pointing at the wrong entries.
   */
  const kept: AxisTick[] = [];
  for (const t of withEnd) {
    const previous = kept.at(-1);
    const isEnd = t.at === 1;
    if (previous && !isEnd && t.at - previous.at < MIN_TICK_GAP) continue;
    // The end always goes in; if it crowds its neighbour, the NEIGHBOUR gives
    // way, since the edge label is the one carrying the extent.
    if (isEnd && previous && t.at - previous.at < MIN_TICK_GAP && kept.length > 1) kept.pop();
    kept.push(t);
  }

  if (kept.length <= max) return kept;
  const withEnd2 = kept;
  // Thin evenly, and always keep the first and last: an axis whose ends are
  // missing gives no sense of the whole, which is the reason for having one.
  const step = (withEnd2.length - 1) / (max - 1);
  const thinned: AxisTick[] = [];
  for (let i = 0; i < max; i += 1) thinned.push(withEnd2[Math.round(i * step)]!);
  return thinned.filter((t, i, all) => i === 0 || t.seq !== all[i - 1]!.seq);
}
