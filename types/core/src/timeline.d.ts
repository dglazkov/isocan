import type { LogEntry } from "./ops.js";
import type { CanvasState } from "./model.js";
/** What one entry is worth. */
export declare function weightOf(entry: LogEntry): number;
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
export declare function majors(entries: readonly LogEntry[], minWeight?: number): Major[];
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
export declare function track(entries: readonly LogEntry[], buckets?: number): TrackBucket[];
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
export declare function majorWhat(major: Major): string;
export declare function majorLine(major: Major): string;
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
export declare function past(entries: readonly LogEntry[], seq: number): Past;
/** The state alone, for callers with nothing to say about a skip. */
export declare function at(entries: readonly LogEntry[], seq: number): CanvasState | null;
/**
 * The seq range a scrubber can move over: the first and last entries there
 * are. Empty history has no positions, and `null` says so rather than
 * inventing a zero that would render as a track with one end.
 */
export declare function span(entries: readonly LogEntry[]): {
    first: number;
    last: number;
} | null;
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
export type AxisGrain = "hour" | "day" | "month" | "year";
export interface AxisTick {
    /** Where along the rail, 0..1 of the seq span. */
    at: number;
    label: string;
    seq: number;
    ts: string;
}
/** The grain a span of milliseconds deserves. Thresholds are where a reader
 *  stops caring about the finer unit, not round numbers for their own sake. */
export declare function axisGrain(spanMs: number): AxisGrain;
/**
 * Ticks for the rail: one per turn of the chosen unit, plus the ends.
 *
 * `max` is a cap, not a target — a span with three days in it gets three
 * ticks. When the turns outnumber the cap they are thinned evenly rather than
 * truncated, so the axis still spans the whole rail instead of stopping
 * halfway.
 */
export declare function axisTicks(entries: readonly LogEntry[], max?: number): AxisTick[];
