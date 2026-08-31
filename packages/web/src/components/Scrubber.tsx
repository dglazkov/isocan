import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, Major } from "@isocan/core";
import { at, majors, majorWhat, span, track } from "@isocan/core";
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
  useEffect(() => {
    if (!entries || seq === null || !range) return leavePast();
    if (seq >= range.last) return leavePast();
    const state = at(entries, seq);
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
              className={`scrub-bar${b.majors.length > 0 ? " seam" : ""}`}
              style={{ height: `${Math.max(6, (b.weight / peak) * 100)}%` }}
            />
          ))}
        </div>
        <div className="scrub-head-line" style={{ left: `${fraction * 100}%` }} aria-hidden />
      </div>
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
