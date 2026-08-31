import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item, LogEntry, Major, SkippedEntry, TrackBucket } from "@isocan/core";
import { ago, axisTicks, majors, majorWhat, past, span, track } from "@isocan/core";
import { ItemThumb } from "./ItemThumb.tsx";
import { getArchivedOplog, getOplog } from "../lib/api.ts";
import { enterPast, leavePast, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **The canvas's history, as something you can stand in.**
 *
 * `docs/research/2026-08-26-timeline.md`, recommendation D: a scrub track with
 * marked majors, driving reduce-to-seq. Everything hard about it was already
 * in the tree for another reason — the fold is the reducer, the position is a
 * `seq` both surfaces speak, and the significance function is `core/timeline`,
 * shared, so this marks exactly the seams `isocan timeline` marks. Nothing
 * here sends anything or invents an operation.
 *
 * **The bar is drawn from significance, not from count.** Forty moves and one
 * birth are not the same afternoon, and a histogram of raw entries would say
 * they were. A tick under a bucket means a seam is in it, so a tall bar with
 * no tick is a stretch of pure churn — that discrimination is the reason to
 * draw a track at all rather than a scrollbar.
 *
 * **Buckets are over seq, not over time**, so equal buckets are equal drag.
 * Bucketing by wall-clock would make a night of nothing as wide as an
 * afternoon of work, which reads to the hand as a bug.
 */
const BUCKETS = 120;

export function Scrubber({ canvasId, onClose }: { canvasId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [seq, setSeq] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  /**
   * The whole history, archive first — the same contract `isocan timeline`
   * and `buildRecap` hold. On a canvas old enough to have been compacted the
   * story predates the live log, and folding from the live log alone would
   * replay a history missing its own beginning.
   */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [archived, recent] = await Promise.all([
          getArchivedOplog(canvasId),
          getOplog(canvasId),
        ]);
        if (live) setEntries([...archived, ...recent]);
      } catch (err) {
        if (live) setFailed(err instanceof Error ? err.message : "the history could not be read");
      }
    })();
    return () => {
      live = false;
    };
  }, [canvasId]);

  const range = useMemo(() => (entries ? span(entries) : null), [entries]);
  const buckets = useMemo(
    () => (entries && entries.length > 0 ? track(entries, BUCKETS) : []),
    [entries],
  );
  const seams = useMemo(() => (entries ? majors(entries) : []), [entries]);
  const peak = useMemo(() => Math.max(...buckets.map((b) => b.weight), 1), [buckets]);
  const ticks = useMemo(() => (entries ? axisTicks(entries) : []), [entries]);
  /* Which bar the pointer is over, by index. Cleared when the pointer leaves
     the rail rather than each bar, so moving along the bars does not flicker
     the card off and on between them. */
  const [peek, setPeek] = useState<number | null>(null);
  const peeked = peek === null ? null : (buckets[peek] ?? null);
  /* The canvas as it is NOW, for thumbnails — see `BucketPeek` on why this is
     not the canvas as it was. */
  const items = useCanvasStore((st) => st.canvas?.items);

  /**
   * **Standing at a seq is a fold, and the fold is core's.** The same `at` the
   * CLI's `isocan at` calls, over the same log — so the two surfaces land on
   * the same past by construction rather than by two implementations staying
   * in step.
   *
   * The right edge is `null` rather than the last seq, and it means "now": the
   * live replica keeps streaming, so releasing the handle at the end leaves
   * you watching the canvas rather than pinned to a snapshot of this instant
   * that would go stale as soon as somebody else moved something.
   */
  /**
   * What the fold could not replay, so the rail can say so.
   *
   * A canvas that collected non-finite geometry before the reducer checked
   * for it still carries those entries — the oplog is append-only — and
   * `past` skips them rather than throwing, which is what used to take this
   * whole surface white. A shorter history with no explanation would be the
   * instrument reporting healthy while blind, so it is said out loud.
   */
  const [skipped, setSkipped] = useState<SkippedEntry[]>([]);
  useEffect(() => {
    if (!entries || seq === null || !range) return leavePast();
    if (seq >= range.last) return leavePast();
    const { state, skipped: refused } = past(entries, seq);
    setSkipped(refused);
    if (state) enterPast(seq, state.canvas);
  }, [entries, seq, range]);

  // Leaving takes the canvas with it — a past that outlived its scrubber would
  // be a read-only canvas with nothing on screen explaining why.
  useEffect(() => () => leavePast(), []);

  const seqAt = useCallback(
    (clientX: number): number | null => {
      const rail = railRef.current;
      if (!rail || !range) return null;
      const box = rail.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      return Math.round(range.first + t * (range.last - range.first));
    },
    [range],
  );

  const drag = useCallback(
    (e: React.PointerEvent) => {
      const next = seqAt(e.clientX);
      if (next === null) return;
      setPlaying(false);
      setSeq(next);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [seqAt],
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      const next = seqAt(e.clientX);
      if (next !== null) setSeq(next);
    },
    [seqAt],
  );

  /**
   * **Playback is the same playhead, driven by a clock.** The research asked
   * for the track to be built so a timer could drive it as easily as a drag,
   * and this is the whole of the difference: one `setSeq` per tick.
   *
   * It advances by a share of the SPAN rather than one entry per tick, so a
   * two-thousand-entry canvas does not take four minutes to watch — a story
   * that cannot be sat through is not a story. Reduced motion is honoured by
   * not offering the button at all; a canvas redrawing itself thirty times is
   * exactly the animation that setting refuses.
   */
  useEffect(() => {
    if (!playing || !range) return;
    const step = Math.max(1, Math.round((range.last - range.first) / 120));
    const timer = setInterval(() => {
      setSeq((current) => {
        const from = current ?? range.first;
        const next = from + step;
        if (next >= range.last) {
          setPlaying(false);
          return null; // arriving at the end is arriving at NOW
        }
        return next;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [playing, range]);

  const still = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  if (failed) {
    return (
      <div className="scrubber" role="group" aria-label="History">
        <p className="scrub-note bad">{failed}</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  if (!entries) return <div className="scrubber quiet">reading the history…</div>;
  if (!range || buckets.length === 0) {
    return (
      <div className="scrubber" role="group" aria-label="History">
        <p className="scrub-note">nothing has happened here yet</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  const here = seq ?? range.last;
  /**
   * **At the end IS now**, and the label has to agree with the canvas.
   *
   * Dropping the handle on the right edge sets `seq` to the last entry, and
   * the fold effect above correctly returns the canvas to live — but the
   * readout went on saying "#205 · 0 ago" over a canvas that was streaming.
   * A control describing itself differently from the thing it controls is how
   * a person learns not to trust it, and "0 ago" is a strange way to write
   * "now" in any case.
   */
  const atNow = seq === null || seq >= range.last;
  const fraction = (here - range.first) / Math.max(1, range.last - range.first);
  const nearest = nearestMajor(seams, here);

  return (
    <div className="scrubber" role="group" aria-label="History">
      <div className="scrub-head">
        <span className="scrub-where">
          {atNow ? "now" : `#${here}`}
          {!atNow && <span className="scrub-ago"> · {range.last - here} ago</span>}
        </span>
        {nearest && <span className="scrub-major">{majorWhat(nearest)}</span>}
        {skipped.length > 0 && (
          <span
            className="scrub-refused"
            title={skipped.map((s2) => `#${s2.seq} ${s2.kind}: ${s2.why}`).join("\n")}
          >
            {skipped.length} entr{skipped.length === 1 ? "y" : "ies"} would not replay
          </span>
        )}
        <span className="spacer" />
        {!still && (
          <button
            className="btn quiet"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Pause" : "Play the history"}
          >
            {playing ? "Pause" : "Play"}
          </button>
        )}
        <button className="btn quiet" onClick={() => setSeq(null)} disabled={atNow}>
          Now
        </button>
        <button className="btn quiet" onClick={onClose} aria-label="Close the history">
          Done
        </button>
      </div>
      {/* The track. A slider in role and in keyboard behaviour, because it IS
          one — a person who reaches for arrow keys must find them working, and
          a screen reader must be told a number rather than "graphic". */}
      <div
        className="scrub-rail"
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label="Point in this canvas's history"
        aria-valuemin={range.first}
        aria-valuemax={range.last}
        aria-valuenow={here}
        aria-valuetext={atNow ? "now" : `entry ${here} of ${range.last}`}
        onPointerDown={drag}
        onPointerMove={move}
        onPointerLeave={() => setPeek(null)}
        onKeyDown={(e) => {
          const jump = e.key === "PageDown" || e.key === "PageUp" ? 25 : 1;
          if (e.key === "ArrowLeft" || e.key === "PageUp") {
            setPlaying(false);
            setSeq(Math.max(range.first, here - jump));
          } else if (e.key === "ArrowRight" || e.key === "PageDown") {
            setPlaying(false);
            const next = here + jump;
            setSeq(next >= range.last ? null : next);
          } else if (e.key === "Home") {
            setPlaying(false);
            setSeq(range.first);
          } else if (e.key === "End") {
            setPlaying(false);
            setSeq(null);
          } else return;
          e.preventDefault();
        }}
      >
        <div className="scrub-bars" aria-hidden>
          {buckets.map((b, i) => (
            <span
              key={i}
              className={`scrub-bar${b.majors.length > 0 ? " seam" : ""}${peek === i ? " peeked" : ""}`}
              style={{ height: `${Math.max(6, (b.weight / peak) * 100)}%` }}
              /* Per-bar rather than one handler on the rail: the rail already
                 owns pointer-down for scrubbing, and a bar knows which bucket
                 it is without arithmetic that would have to agree with the
                 layout. */
              onPointerEnter={() => setPeek(i)}
            />
          ))}
        </div>
        {/**
         * **The axis.** Ticks land where their day (or month, or year) turns
         * over, positioned by seq because the rail is — so a quiet fortnight
         * is one tick's width from its neighbour rather than a season of
         * empty rail. The ends are labelled outright: an axis you cannot read
         * the extent of is decoration.
         */}
        {ticks.length > 0 && (
          <div className="scrub-axis" aria-hidden>
            {ticks.map((t) => (
              <span
                key={t.seq}
                className="scrub-tick"
                style={{ left: `${t.at * 100}%` }}
                data-edge={t.at === 0 ? "first" : t.at === 1 ? "last" : undefined}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}
        <div className="scrub-head-line" style={{ left: `${fraction * 100}%` }} aria-hidden />
      </div>
      {peeked && peek !== null && (
        <BucketPeek
          bucket={peeked}
          items={items}
          canvasId={canvasId}
          /* Over the bar it describes. Clamped away from the ends because the
             card is centred on that point and a card centred at 0% hangs half
             off the panel — the numbers are half the card's max width over the
             rail's, which is fixed by the stylesheet. */
          at={Math.min(82, Math.max(18, ((peek + 0.5) / Math.max(1, buckets.length)) * 100))}
        />
      )}
    </div>
  );
}

/**
 * **What a bar is made of, when you point at it.**
 *
 * A histogram says how much and never what. The bar is already the answer to
 * "was anything happening here"; the card is the answer to the question that
 * immediately follows, and it was previously only obtainable by scrubbing
 * onto the bar and reading the header.
 *
 * **Thumbnails only for what still exists.** A seam that added something
 * shows the thing, taken from the canvas as it is NOW — which means work that
 * was later deleted shows its words and no picture. That is the honest
 * asymmetry rather than a gap: reconstructing the item as it stood would mean
 * folding the log to that seq for every bar the pointer crosses, which is a
 * fold per hover on a history of any size.
 */
function BucketPeek({
  bucket,
  items,
  canvasId,
  at,
}: {
  bucket: TrackBucket;
  items: Record<string, Item> | undefined;
  canvasId: string;
  at: number;
}) {
  /* One clock for the whole card: `ago` takes the moment to measure from, and
     reading Date.now() per row would let two rows in one card disagree. */
  const now = Date.now();
  const when = bucket.fromTs ? new Date(bucket.fromTs) : null;
  const shown = bucket.majors.slice(0, 4);
  return (
    <div className="scrub-peek" style={{ left: `${at}%` }}>
      <div className="scrub-peek-when">
        {when
          ? when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
          : "nothing here"}
        <span className="scrub-peek-count">
          {bucket.count} {bucket.count === 1 ? "change" : "changes"}
        </span>
      </div>
      {shown.map((m) => {
        const item = m.itemId ? items?.[m.itemId] : undefined;
        return (
          <div className="scrub-peek-row" key={m.seq}>
            {item && (
              <ItemThumb
                canvasId={canvasId}
                itemId={item.id}
                item={item}
                width={38}
                height={28}
              />
            )}
            <span className="scrub-peek-what">{majorWhat(m)}</span>
            <span className="scrub-peek-when-row">{ago(m.ts, now)}</span>
          </div>
        );
      })}
      {bucket.majors.length > shown.length && (
        <div className="scrub-peek-more">and {bucket.majors.length - shown.length} more</div>
      )}
    </div>
  );
}

/** The seam at or before here — what you are standing just after. */
function nearestMajor(seams: readonly Major[], here: number): Major | null {
  let found: Major | null = null;
  for (const m of seams) {
    if (m.seq > here) break;
    found = m;
  }
  return found;
}
