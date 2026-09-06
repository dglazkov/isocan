import { useEffect, useState } from "react";

/**
 * **Is this element actually on screen right now.**
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
 * So: the thing itself, for whatever is in front of you, and nothing at all
 * for the rest. One observer per element, `rootMargin` so a thumb is warm
 * slightly before it is scrolled to, and **once true it stays true** — a
 * thumb that has been seen keeps its document rather than tearing it down
 * and rebuilding it every time it crosses the edge, which would trade a
 * memory problem for a churn one.
 *
 * The bound this gives is the honest one: a screenful. It does not depend on
 * how long a thread is, how many versions an item has, or how long a tab has
 * been open — which is what every previous bound here failed to do.
 */
export function useOnScreen<T extends Element>(
  /** Grow the box so content is ready just before it is scrolled into view. */
  margin = "200px",
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
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setOnScreen(true);
          // Seen once is seen: stop watching rather than thrash on scroll.
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, margin]);

  return { ref: setNode, onScreen };
}
