import { useEffect, useState } from "react";

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

    let leaving: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (leaving === undefined) return;
      clearTimeout(leaving);
      leaving = undefined;
    };
    /**
     * `want` is "on screen AND the tab is being looked at". Coming back is
     * immediate; going away is on a timer, so a scroll that overshoots and
     * corrects costs nothing.
     */
    const settle = (want: boolean) => {
      if (want) {
        clear();
        setOnScreen(true);
        return;
      }
      if (leaving !== undefined) return;
      leaving = setTimeout(() => {
        leaving = undefined;
        setOnScreen(false);
      }, grace);
    };

    let intersecting = false;
    const seen = () => settle(intersecting && document.visibilityState !== "hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) intersecting = entry.isIntersecting;
        seen();
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", seen);

    return () => {
      clear();
      observer.disconnect();
      document.removeEventListener("visibilitychange", seen);
    };
  }, [node, margin, grace]);

  return { ref: setNode, onScreen };
}
