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

/**
 * Enter sends; Shift+Enter makes a newline.
 *
 * An <input> in a form submits on Enter for free. A <textarea> does not — it
 * types a newline — so a field that grows has to say this out loud or sending
 * a message quietly stops working the day it learns to wrap.
 *
 * Skips a key somebody already claimed: the mention menu preventDefaults Enter
 * to complete a name, and preventDefault does not stop the event bubbling to
 * the form. Without this check, picking "@Fable" from the menu would also post
 * the half-written message.
 */
export function submitOnEnter(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.defaultPrevented) return;
  const form = e.currentTarget.closest("form");
  if (!form) return;
  e.preventDefault();
  form.requestSubmit();
}
