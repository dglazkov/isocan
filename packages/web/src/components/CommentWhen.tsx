import type { ReactNode } from "react";
import type { Comment } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";

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
  const toggle = useUiStore((s) => s.toggleComment);
  return (
    <button
      type="button"
      className="when"
      aria-expanded={!collapsed}
      title={collapsed ? "Show this message" : "Fold this message away"}
      onClick={() => toggle(comment.id)}
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
  const toggle = useUiStore((s) => s.toggleComment);
  if (!collapsed) return <>{children}</>;
  return (
    <button type="button" className="comment-folded" onClick={() => toggle(comment.id)}>
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
