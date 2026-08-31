/**
 * What the browser tab says.
 *
 * It said "isocan" on every page of every canvas, which is the least useful
 * thing a tab can say when somebody has six of them open — the state a person
 * actually has, since a canvas, its workbench and a screen full-size are three
 * addresses you keep at once.
 *
 * **The specific part goes FIRST**, which is the one place this departs from
 * how it was asked for ("isocan: $project canvas"). A tab strip gives each tab
 * a dozen characters before it truncates, so a title that opens with the
 * product name renders every tab identically — "isocan: Ac…", "isocan: Ac…" —
 * and the thing the title was added to fix is exactly the thing that gets cut.
 * The name still rides at the end, where it costs nothing and reads fine in a
 * bookmark or a history list.
 */
/** What the tab's title is assembled from. The shape of `pageTitle`'s only
 *  argument, and not a type anything else needs to name. */
interface TitleParts {
  /** The canvas's title, when a canvas is open. */
  canvas?: string | null;
  /** Which cover is up, if any. */
  cover?: "workbench" | "item" | null;
  /** The staged item's title, for the full-screen cover. */
  item?: string | null;
  /** Threads with something unread in them. */
  unread?: number;
}

const APP = "isocan";

/** The tab's title: the most specific thing you are looking at, then where
 *  it lives, with any unread count in front so it survives truncation. */
export function pageTitle({ canvas, cover, item, unread = 0 }: TitleParts): string {
  const parts: string[] = [];
  // A screen you are looking at full size is the most specific thing on
  // screen, so it leads — and its canvas still follows, because "View · Start"
  // means nothing on its own across three projects.
  if (cover === "item" && item) parts.push(item);
  if (canvas) parts.push(canvas);
  if (cover === "workbench") parts.push("workbench");
  parts.push(APP);
  // The count leads everything: an unread badge that scrolls off the left of
  // a truncated tab is not a badge.
  return `${unread > 0 ? `(${unread}) ` : ""}${parts.join(" · ")}`;
}
