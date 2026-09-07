/**
 * **A poll that stops when nobody is looking, and catches up when they are.**
 *
 * Every repeating fetch in this app was a bare `setInterval`: presence, the
 * rc's answering list, a canvas card's pull, the sprint desk. A background tab
 * went on asking the daemon the same questions for as long as it stayed open.
 * Chrome throttles a hidden tab's timers to roughly once a minute, so this was
 * never the memory that froze a browser — but "the browser mostly stops us"
 * is not the same as stopping, and the daemon is answering either way.
 *
 * The shape is borrowed from what Stitch does (`waitForDocumentVisible`),
 * with one addition that matters more than the saving: **coming back reads
 * immediately.** A poll that merely resumes its interval leaves a tab you have
 * just returned to showing an answer up to a full period old — and the answers
 * here are things like "is anybody listening right now", where stale is worse
 * than absent. So visible-again fires a read, then restarts the clock.
 *
 * A plain function rather than a hook, because the callers are not all
 * components: `useAnswerable` keeps ONE timer shared across every row on
 * screen, which is a module-level singleton, and a hook could not be used
 * there without breaking that.
 *
 * ## What this deliberately does not do
 *
 * It does not pause on `blur`. A canvas beside a terminal is unfocused and
 * fully visible, and a person watching an agent work on the other half of the
 * screen is exactly who needs presence to keep moving.
 */
export function everyWhileVisible(fn: () => void, everyMs: number): () => void {
  // No document (a test, SSR): behave like the plain interval this replaces.
  if (typeof document === "undefined") {
    const timer = setInterval(fn, everyMs);
    return () => clearInterval(timer);
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (timer !== null) return;
    timer = setInterval(fn, everyMs);
  };
  const stop = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      stop();
      return;
    }
    if (timer !== null) return;
    // Read first, then restart: the gap since the last read is already at
    // least as long as the period, so waiting another one shows a stale answer
    // to somebody who is looking at it now.
    fn();
    start();
  };

  if (document.visibilityState !== "hidden") {
    fn();
    start();
  }
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
