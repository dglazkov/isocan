import type { MouseEvent, ReactNode } from "react";
import type { Comment } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Fold a long message and the whole thread can lurch — so say where it went.**
 *
 * Dion, 7 Sep 2026: *"sometimes it jumps and hard to know what just happened.
 * What if the item gets a background fade for a second IF the location
 * jumps... so you know where the item is?"*
 *
 * **Measured before it was believed**, and it is worse than a jump. Folding a
 * long agent report in a panel scrolled 1,015px down: the panel's content went
 * 1,728px to 713px, `scrollTop` was clamped from 1,015 to 0 because there was
 * no longer that much to scroll, and **every message in the thread moved 1,205
 * screen pixels at once**.
 *
 * ## Why this is not fixed by anchoring the scroll
 *
 * The obvious answer — hold the folded message still and let the rest move — is
 * what already happens, and it is not what broke. Content above the message
 * does not change height when it folds, so its offset inside the scroller is
 * untouched; leave `scrollTop` alone and the message stays exactly where it
 * was. **The browser is what moves it**: fold away more content than the
 * scroller had slack for and `scrollTop` is clamped, because that much scroll
 * no longer exists. No anchoring can prevent that; there is nowhere to stand.
 *
 * So the jump is unavoidable in exactly the case that hurts, which makes
 * Dion's answer the right one: when it moves, mark where it went.
 *
 * ## Only when it actually moved, and the test is the CAUSE
 *
 * The condition is in his sentence — *IF the location jumps* — and it matters,
 * because a flash on every fold is a light going off for nothing, which is how
 * people learn to stop reading a signal.
 *
 * Two wrong answers were measured before this one, and both are worth keeping
 * because they are the obvious ones.
 *
 * **A pixel threshold** fired on a fold that shifted the thread 18px — a
 * message that never left anybody's eye — because the Chat's list settles
 * against the bottom, so almost every fold moves everything a little.
 *
 * **"Does it still overlap where it was"** sounds principled and is wrong for
 * exactly the message this exists for: a report taller than the panel has an
 * old rectangle so large it covers wherever the new one lands, so the one fold
 * that threw the thread a thousand pixels was the one that reported no
 * movement.
 *
 * So the test is neither the message nor a distance: **it is whether the fold
 * forced the SCROLLER to move.** That is the cause of the whole problem — fold
 * away more than the panel had slack for and the browser clamps `scrollTop`,
 * because that much scroll no longer exists. It has no constant to tune, it is
 * zero in the ordinary case, and it is nonzero in precisely the case a person
 * loses their place.
 */
const FLASH_MS = 900;

/** The box this message scrolls inside, or null when nothing here scrolls —
 *  a pin popover holds one short comment and never lurches. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    if (e.scrollHeight > e.clientHeight + 1) return e;
  }
  return null;
}

/**
 * Toggle the fold, and flash the message if that moved it.
 *
 * The class is written straight onto the DOM node rather than rendered from
 * state, and that is a deliberate exception worth its lines. The alternative is
 * a store field for a 900ms animation, re-rendering both panels that draw a
 * comment; and the node is safe to write to because `.comment`'s `className`
 * depends only on the author, so it never changes between renders and React
 * never diffs it back. `packages/web/test/fold.test.ts` holds that.
 *
 * Two frames, because the measurement has to happen after React has committed
 * the fold AND after the browser has re-laid the scroller out — one frame gets
 * the first and not the second.
 */
function useFoldToggle(commentId: string): (e: MouseEvent<HTMLElement>) => void {
  const toggle = useUiStore((s) => s.toggleComment);
  return (e) => {
    const message = e.currentTarget.closest<HTMLElement>(".comment");
    const scroller = message && scrollerOf(message);
    const was = scroller?.scrollTop;
    toggle(commentId);
    if (!message || was === undefined || !scroller) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // The scroller stayed where it was, so everything is where you left it.
        if (scroller.scrollTop === was) return;
        // Removed and re-added with a reflow between, so a second fold while
        // the first is still fading starts the animation again rather than
        // doing nothing.
        message.classList.remove("moved");
        void message.offsetWidth;
        message.classList.add("moved");
        setTimeout(() => message.classList.remove("moved"), FLASH_MS);
      }),
    );
  };
}

/**
 * **The timestamp on a message, which is also how you fold it away.**
 *
 * Asked for on 7 Sep 2026: *"can we add the ability to collapse a section in
 * chat... maybe by clicking on the date for the message?"* — after a thread
 * where a single agent's report ran longer than the screen and everything said
 * before it was somewhere above.
 *
 * The date is the right target and it is worth saying why, because "make it
 * clickable" is usually the wrong answer. It is on every message, it is inert
 * today, and it is the one part of the header that is not already an identity
 * or an action — clicking a NAME should go to that person, and clicking the
 * body should select text. So the date is the only surface here that was
 * saying nothing.
 *
 * A button rather than a span with a handler: this is a control now, and it
 * needs to be reachable by keyboard and to announce that it expands something.
 * `aria-expanded` is the whole difference between a date and a disclosure.
 */
export function CommentWhen({ comment }: { comment: Comment }) {
  const collapsed = useUiStore((s) => s.collapsedComments.includes(comment.id));
  const fold = useFoldToggle(comment.id);
  return (
    <button
      type="button"
      className="when"
      aria-expanded={!collapsed}
      title={collapsed ? "Show this message" : "Fold this message away"}
      onClick={fold}
    >
      {new Date(comment.createdAt).toLocaleString()}
    </button>
  );
}

/**
 * **Everything under the header, or the one line that stands in for it.**
 *
 * A wrapper rather than a flag each caller checks, because both the Chat panel
 * and the pin popover render a comment and neither owns the other — and the
 * decision about WHAT a fold keeps is the whole design, so it belongs in one
 * place rather than twice.
 */
export function CommentFold({ comment, children }: { comment: Comment; children: ReactNode }) {
  const collapsed = useUiStore((s) => s.collapsedComments.includes(comment.id));
  // The same toggle, because it is the same question. It will usually be
  // quiet on the way back: unfolding GROWS the content, and growing never
  // forces the scroller anywhere — it is only losing height that clamps.
  const fold = useFoldToggle(comment.id);
  if (!collapsed) return <>{children}</>;
  return (
    <button type="button" className="comment-folded" onClick={fold}>
      {firstLine(comment.body) || "…"}
    </button>
  );
}

/**
 * **What a folded message still shows.**
 *
 * Not nothing. A thread of folded messages that showed only names and dates
 * would be a list you cannot navigate — you would open each one to find the
 * one you meant, which is worse than scrolling past them. So a fold keeps the
 * first line, which for a message written by anybody is the sentence that says
 * what it is about.
 *
 * Markdown syntax is stripped rather than rendered: a heading's `##` and a
 * bullet's `-` are noise in a one-line summary, and rendering markdown inside
 * a preview would let a bold run or a link change the line's height, which is
 * the one thing a folded row must not do.
 */
export function firstLine(body: string): string {
  const line = body
    .split("\n")
    .map((one) => one.trim())
    .find((one) => one.length > 0);
  if (line === undefined) return "";
  const plain = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
  return plain.length > 120 ? `${plain.slice(0, 119)}…` : plain;
}
