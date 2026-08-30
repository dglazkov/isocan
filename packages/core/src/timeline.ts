import type { LogEntry } from "./ops.ts";

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
    out.push({
      seq: entry.seq,
      ts: entry.envelope.ts,
      actor: entry.envelope.actor.name,
      kind: entry.envelope.op.type,
      weight,
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
    out.push({ fromSeq, toSeq, count: 0, weight: 0, majors: [] });
  }
  const bucketFor = (seq: number) =>
    Math.min(n - 1, Math.max(0, Math.floor((seq - first) / size)));
  for (const entry of entries) {
    const b = out[bucketFor(entry.seq)]!;
    b.count += 1;
    b.weight += weightOf(entry);
  }
  for (const mark of marks) out[bucketFor(mark.seq)]!.majors.push(mark);
  return out;
}

/** One line per major, the same sentence on every surface. */
export function majorLine(major: Major): string {
  const what: Record<string, string> = {
    "item.add": "added something",
    "item.delete": "deleted something",
    "items.delete": "deleted several things",
    "item.restore": "restored something",
    "items.restore": "restored several things",
    "item.addVersion": "made a new version",
    "thread.create": "started a conversation",
    "thread.setMain": "moved the Chat",
    "project.create": "made the canvas",
  };
  return `${major.seq}  ${major.actor} ${what[major.kind] ?? major.kind}`;
}
