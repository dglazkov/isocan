/**
 * **Copying a command, and what to do when the browser says no.**
 *
 * The clipboard is the one thing on the front page that can fail without
 * failing: `writeText` is a permissioned API and a refusal arrives as a
 * rejected promise, indistinguishable at the call site from a browser that has
 * no `navigator.clipboard` at all (an insecure origin has none). Either way
 * the reader is standing in front of a command they still need, so both land
 * on the same answer — `"select-it"`, which is the page saying "the text is
 * right there, take it by hand" rather than a button that quietly did nothing.
 *
 * The measured reason this is not decorative is in `docs/projects/multiuser/phases.md`'s standing
 * lessons: **Chrome blocks the clipboard while `visibilityState` is
 * `hidden`** — phase 8/10's finding, and exactly the state a backgrounded or
 * automated tab is in. Nothing else here asserts anything about a browser;
 * what a browser does is measured elsewhere, and this module only has to
 * survive both answers.
 */
export type CopyState =
  /** Nothing pressed yet. */
  | "idle"
  /** The clipboard took it. */
  | "copied"
  /** It did not, for any reason — so the reader copies it themselves. */
  | "select-it";

/**
 * Ask the clipboard, and never throw.
 *
 * The clipboard is a PARAMETER rather than a reach for `navigator`, so a test
 * can hand over one that resolves, one that rejects, and nothing at all —
 * which is the whole of what this function has to get right.
 */
export async function copyToClipboard(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | null | undefined,
): Promise<CopyState> {
  if (!clipboard || typeof clipboard.writeText !== "function") return "select-it";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "select-it";
  }
}

/** The clipboard this browser has, or nothing — `navigator` is absent when the
 *  app is rendered anywhere that is not a browser. */
export function browserClipboard(): Pick<Clipboard, "writeText"> | null {
  if (typeof navigator === "undefined") return null;
  return navigator.clipboard ?? null;
}

/**
 * What the control says in each state. Here rather than in the JSX because
 * "did pressing it do anything" is the only question this control answers, and
 * a test that reads the answer off a pure function reads it in every state,
 * including the two nobody thinks to look at.
 */
export function copyLabel(state: CopyState): string {
  if (state === "copied") return "Copied";
  if (state === "select-it") return "Select it and copy";
  return "Copy";
}

/**
 * And what it says out loud — the sentence in the live region beside it.
 *
 * Empty before anything is pressed, because an assertive-by-nature region that
 * ships with words in it announces them to a screen reader on arrival, saying
 * something happened when nothing has.
 */
export function copySaid(state: CopyState): string {
  if (state === "copied") return "Copied to your clipboard.";
  if (state === "select-it") {
    return "This browser would not hand it over — select the line above and copy it.";
  }
  return "";
}
