import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";
import { DEFAULT_DECK_TRANSITION, type DeckTransition } from "@isocan/core";

/** Bare keys that flip the deck (#87). Forward and back each answer to three
 * keys because a presenter's clicker sends Page Up/Down, and because "left/
 * right (and up/down)" is how the ask was written: the deck is LINEAR, in
 * reading order, so both axes flip rather than up/down meaning something
 * spatial that would strand a presenter at the end of a row.
 *
 * Here rather than in `FullScreen`, because `Viewer` held a copy "kept in
 * step with it" by nothing (cleanup DU-1, 27 Sep 2026): the two faces of one
 * deck answer the same keys and rest on the same beat, so they read one. */
export const FLIP_NEXT: ReadonlySet<string> = new Set(["ArrowRight", "ArrowDown", "PageDown"]);
/** Back, the same three ways — see `FLIP_NEXT`. */
export const FLIP_PREV: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);

/** Still for this long and the deck's chrome bows out, on both faces. Long
 *  enough that reading a slide does not dismiss it by accident, short enough
 *  to be gone by the second slide of a talk. */
export const REST_AFTER_MS = 2500;

/** A flip this soon after the last one is a cut, not a push. Somebody
 *  hammering → to reach slide 14 wants slide 14, not seven animations; the
 *  next press seconds later, mid-talk, gets the motion back. This one rule is
 *  what keeps the push from wearing out its welcome. A slow motion (the 3D
 *  ones) holds the window open for as long as it runs, so a second press
 *  mid-turn lands rather than stacking a turn on a turn. */
const CUT_WITHIN_MS = 300;

/**
 * **How long each motion runs**, in one place, because two things must
 * agree on it: the CSS that draws it (styles.css, "the deck flip") and the
 * frame pool that has to keep the outgoing slide on the glass until it has
 * finished leaving (`HtmlView`). The CSS reads it as `--deck-ms`, set from
 * here, so the number is written once.
 *
 * 220ms for the push is the original beat — snappy rather than staged. The
 * 3D ones are deliberately longer: a turn you cannot see is not a turn.
 */
export const DECK_TRANSITION_MS: Readonly<Record<DeckTransition, number>> = {
  push: 220,
  fade: 260,
  zoom: 320,
  morph: 1600,
  depth: 1100,
  cube: 750,
  flip: 700,
  cut: 0,
};

/** Module-level rather than per-surface: there is one keyboard, and a flip is
 *  a flip whichever face of the deck answered it. */
let lastFlip = 0;
let busyFor = CUT_WITHIN_MS;

/**
 * Which sides of a flip are frames. `both` can be animated LIVE — the frame
 * pool holds the two documents at once (`HtmlView`), so the motion moves the
 * real pages rather than photographs of them. `one` cannot be animated at
 * all: the frame side would photograph blank and the other side lives in a
 * different element entirely, so there is nothing to move it against.
 */
export type Framing = "none" | "one" | "both";

/** The framing of a flip from whether the slide being left and the slide
 *  arriving are frames (`isFramedItem`) — the one question both faces of
 *  the deck ask before `flipTo`, so they cannot answer it differently. */
export function framingOf(here: boolean, next: boolean): Framing {
  return here && next ? "both" : here || next ? "one" : "none";
}

/**
 * **A flip between two frames, waiting for the pool to show it.**
 *
 * The frame pool cannot be handed the motion directly — it sits deep inside
 * whichever stage is up, and the slide it is about to show may not have
 * finished loading. So the flip leaves a note here and the pool takes it
 * (`takeLiveFlip`) the moment it promotes the next frame. A note older than
 * `LIVE_FLIP_WAITS_MS` is ignored: a slide that took that long to arrive is
 * better shown plainly than turned into place late, and a stale note must
 * never animate some unrelated promotion (a new version landing) later on.
 */
const LIVE_FLIP_WAITS_MS = 2000;
let liveFlip: { dir: "next" | "prev"; transition: DeckTransition; at: number } | null = null;

/**
 * **Who plays a morph, when one is asked for.** The morph cannot be drawn by
 * the pool or by a view transition: it takes the slides apart, which needs a
 * twin of each slide prepared ahead of time (`MorphStage`). The stage that
 * holds those twins registers here while it is up; `flipTo` asks it before
 * navigating, and it answers whether it is ready to play this flip. Not
 * ready — the twins still loading, or a slide that is not a screen — and the
 * flip fades instead, because a presenter's arrow must never wait.
 *
 * A stage that says yes takes the navigation too (`go`): it moves to the
 * next slide only once its twins have painted their first frame, so the
 * live slide underneath never changes before something is covering it.
 */
type MorphPlayer = (path: string, dir: "next" | "prev", go: () => void) => boolean;
let morphPlayer: MorphPlayer | null = null;

/** Register the stage that plays morphs, or `null` when it leaves. */
export function setMorphPlayer(player: MorphPlayer | null): void {
  morphPlayer = player;
}

/** The live flip the pool should play now, once — or null. */
export function takeLiveFlip(): { dir: "next" | "prev"; transition: DeckTransition; ms: number } | null {
  const note = liveFlip;
  liveFlip = null;
  if (!note || Date.now() - note.at > LIVE_FLIP_WAITS_MS) return null;
  return { dir: note.dir, transition: note.transition, ms: DECK_TRANSITION_MS[note.transition] };
}

/**
 * Navigate to the next slide with the deck's TRANSITION rather than a cut:
 * by default a directional push, so the motion itself answers "which way did
 * I go", and otherwise whatever the canvas chose (`deckTransitionOf` — a
 * canvas property, so the presenter and every viewer see the same motion).
 * Shared by `FullScreen` and `Viewer` — the two faces of the same deck (#87,
 * #88) must flip the same way.
 *
 * Two ways to move a slide, and which one is decided by what the slides ARE.
 *
 * **Images and text: a view transition.** The outgoing slide leaves as a
 * snapshot — a painted image. `data-flip` and `data-transition` on the root
 * tell the CSS which way and which motion (styles.css, "the deck flip"), and
 * are removed when the transition settles.
 *
 * **Screens and sites: the frames themselves.** A frame cannot be
 * photographed: a screen and a site are sandboxed cross-origin iframes, and
 * what a view transition captures THERE is a blank rectangle — pushing that
 * across the screen was a white flash on every flip, reported from a
 * presentation. So a frame never rides a view transition. But between two
 * frames there is no need to photograph anything: the pool already holds
 * both documents, mounted and laid out, so the flip leaves a note
 * (`takeLiveFlip`) and the pool animates the two LIVE pages. A flip between
 * a frame and anything else cuts — there is nothing to move it against.
 *
 * It also cuts when the browser has no view transitions (the flip still
 * works, minus the motion), when the person asked for reduced motion, when
 * the canvas chose no motion, or within CUT_WITHIN_MS of the previous flip —
 * see that constant.
 */
export function flipTo(
  navigate: NavigateFunction,
  path: string,
  dir: "next" | "prev",
  framed: Framing = "none",
  transition: DeckTransition = DEFAULT_DECK_TRANSITION,
): void {
  const rapid = Date.now() - lastFlip < busyFor;
  lastFlip = Date.now();
  busyFor = CUT_WITHIN_MS;
  liveFlip = null;
  if (
    framed === "one" ||
    rapid ||
    transition === "cut" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigate(path);
    return;
  }
  if (transition === "morph") {
    if (framed === "both" && morphPlayer?.(path, dir, () => navigate(path))) {
      busyFor = DECK_TRANSITION_MS.morph;
      return;
    }
    transition = "fade";
  }
  busyFor = Math.max(CUT_WITHIN_MS, DECK_TRANSITION_MS[transition]);
  if (framed === "both") {
    liveFlip = { dir, transition, at: Date.now() };
    navigate(path);
    return;
  }
  if (typeof document.startViewTransition !== "function") {
    navigate(path);
    return;
  }
  const root = document.documentElement;
  root.dataset.flip = dir;
  root.dataset.transition = transition;
  root.style.setProperty("--deck-ms", `${DECK_TRANSITION_MS[transition]}ms`);
  const push = document.startViewTransition(() => {
    // Synchronously, so the browser's before/after pair is old slide → new
    // slide rather than old slide → old slide.
    flushSync(() => navigate(path));
  });
  void push.finished.finally(() => {
    delete root.dataset.flip;
    delete root.dataset.transition;
    root.style.removeProperty("--deck-ms");
  });
}
