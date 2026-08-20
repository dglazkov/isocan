import type { KeyboardEvent } from "react";

/**
 * ⌘/Ctrl + Enter sends.
 *
 * A composer that takes more than a line has to keep Enter for newlines, which
 * leaves reaching for the mouse as the only way to post — so it gets the
 * shortcut every chat box has trained people to try.
 */
export function submitOnCmdEnter(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
  const form = e.currentTarget.closest("form");
  if (!form) return;
  e.preventDefault();
  form.requestSubmit();
}
