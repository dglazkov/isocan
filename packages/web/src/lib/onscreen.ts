import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const buckets = new Map<string, [IntersectionObserver, Map<Element, [boolean, Set<(hit: boolean) => void>]>]>();
const vis = new Set<() => void>();
const onVis = () => { for (const fn of vis) fn(); };
const panSettled = new Set<() => void>();
let stopPanSub: (() => void) | undefined;

function watchPanSettled(fn: () => void): () => void {
  if (!panSettled.size) {
    stopPanSub = useUiStore.subscribe((s, prev) => {
      if (!s.panning && prev.panning) {
        for (const cb of panSettled) cb();
      }
    });
  }
  panSettled.add(fn);
  return () => {
    panSettled.delete(fn);
    if (!panSettled.size && stopPanSub) {
      stopPanSub();
      stopPanSub = undefined;
    }
  };
}

function watchVisibility(fn: () => void): () => void {
  if (!vis.size && typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
  vis.add(fn);
  return () => {
    vis.delete(fn);
    if (!vis.size && typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
  };
}

function observeElement(node: Element, margin: string, onHit: (hit: boolean) => void): () => void {
  let bucket = buckets.get(margin);
  if (!bucket) {
    const map = new Map<Element, [boolean, Set<(hit: boolean) => void>]>();
    bucket = [
      new IntersectionObserver((entries) => {
        for (const e of entries) {
          const w = map.get(e.target);
          if (w) { w[0] = e.isIntersecting; for (const fn of w[1]) fn(e.isIntersecting); }
        }
      }, { rootMargin: margin }),
      map,
    ];
    buckets.set(margin, bucket);
  }
  const [obs, map] = bucket;
  const entry = map.get(node);
  if (entry) { entry[1].add(onHit); onHit(entry[0]); }
  else { map.set(node, [false, new Set([onHit])]); obs.observe(node); }
  return () => {
    const b = buckets.get(margin);
    const w = b?.[1].get(node);
    if (!b || !w) return;
    w[1].delete(onHit);
    if (!w[1].size) {
      b[1].delete(node);
      b[0].unobserve(node);
      if (!b[1].size) { b[0].disconnect(); buckets.delete(margin); }
    }
  };
}

/**
 * **Is this element worth holding a live document for right now.**
 *
 * Written for the bug that froze a browser on 6 September 2026, and the
 * measurement is worth keeping because no amount of reading the code found
 * it. A canvas with a long agent thread had **163 live iframes**, 132 of them
 * the same screen: every message card in the Chat panel mounts an
 * `ItemThumb`, and a thumbnail of a `text/html` item is the real document —
 * scripts, animations and all — in a box 61 pixels tall. The tab held 764MB
 * and burned a core, loaded fine, and wedged as the conversation grew.
 *
 * The intent behind a live thumbnail is right and is not what changed:
 * *"a canvas is a visual medium; 'S' tells you nothing about the screen you
 * are trying to find, and the thing itself tells you everything."* What was
 * wrong is that it drew the nine hundred you cannot see as well as the six
 * you can.
 *
 * ## The first version of this was half a fix, and said otherwise
 *
 * It disconnected the observer on the first intersection — *seen once is
 * seen* — to avoid tearing a document down and rebuilding it on every scroll.
 * The comment then claimed the bound "does not depend on how long a thread
 * is, how many versions an item has, or how long a tab has been open."
 *
 * **It depended on all three.** Monotonic means every card ever scrolled PAST
 * stays live: the ceiling is not a screenful, it is everything you have ever
 * looked at. The same canvas froze again the same day — six screens totalling
 * 4.6MB of HTML, one of them a 3.3MB photo gallery whose images decode to far
 * more — and the Task Manager showed isocan subframes holding 713MB, 940MB
 * and 1.3GB. A guard that only ever grows is a slower version of no guard,
 * and writing a bound in a comment does not make it one.
 *
 * ## What bounds it now
 *
 * The element stays live while it is on screen, and for `grace` after it
 * leaves. Scrolling past something and back does not rebuild it; scrolling
 * away and staying away releases it. The ceiling is *a screenful, plus what
 * you looked at in the last few seconds* — which genuinely does not depend on
 * the length of the thread or the age of the tab, and this time the claim is
 * the mechanism rather than an aspiration.
 *
 * ## A hidden tab is off screen
 *
 * `IntersectionObserver` still reports an element in the layout viewport as
 * intersecting when the tab is in the background, so without this a
 * backgrounded canvas holds every document it had — which is exactly what
 * those gigabyte subframes were. The browser pauses our animation frames and
 * throttles our timers for us; nothing but this releases our memory.
 */
export function useOnScreen<T extends Element>(
  /** Grow the box so content is ready just before it is scrolled into view. */
  margin = "200px",
  /**
   * How long a document survives after its element leaves the screen.
   *
   * The number trades churn against memory, and both directions have a real
   * cost: at zero, flicking the Chat panel past a screen rebuilds a 3MB
   * document every time it crosses the edge; unbounded is the bug above. Ten
   * seconds covers scrolling somewhere and coming back, and releases anything
   * you have genuinely left.
   */
  grace = 10_000,
): { ref: React.RefCallback<T>; onScreen: boolean } {
  const [node, setNode] = useState<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    if (node === null) return;
    // No observer (jsdom, an old engine): draw everything, exactly as before.
    // Degrading to the previous behaviour is safer than degrading to blank.
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }

    let live = false;
    let leaving: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (leaving === undefined) return;
      clearTimeout(leaving);
      leaving = undefined;
    };
    /**
     * `want` is "on screen AND the tab is being looked at". Coming back to an
     * already-mounted card is immediate; mounting a brand-new card waits until
     * active camera panning settles so swiping past twenty webviews does not
     * parse and composite twenty transient documents mid-gesture.
     */
    const settle = (want: boolean) => {
      if (want) {
        clear();
        if (!live && useUiStore.getState().panning) return;
        live = true;
        setOnScreen(true);
        return;
      }
      if (leaving !== undefined) return;
      leaving = setTimeout(() => {
        leaving = undefined;
        live = false;
        setOnScreen(false);
      }, grace);
    };

    let intersecting = false;
    const seen = () => settle(intersecting && document.visibilityState !== "hidden");

    const stopObserving = observeElement(node, margin, (nextIntersecting) => {
      intersecting = nextIntersecting;
      seen();
    });
    const stopVisibility = watchVisibility(seen);
    const stopPan = watchPanSettled(seen);

    return () => {
      clear();
      stopObserving();
      stopVisibility();
      stopPan();
    };
  }, [node, margin, grace]);

  return useMemo(() => ({ ref: setNode, onScreen }), [onScreen]);
}
