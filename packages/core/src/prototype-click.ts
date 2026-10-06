import type { CanvasContents, Comment } from "./model.ts";
import type { NewComment, Operation } from "./ops.ts";
import { OpValidationError } from "./errors.ts";
import { newCommentId, newThreadId } from "./ids.ts";
import { itemThread } from "./itemthread.ts";
import { anchorOffset } from "./placement.ts";

/**
 * **A prototype click: a person pressed something in an HTML item that has
 * nowhere to go yet.**
 *
 * An agent that publishes a clickable prototype needs to hear which control
 * a person tried, so it can build the screen behind it. The page says so with
 * one `postMessage` to the app; the app turns it into an ordinary comment on
 * the item's own thread, carrying the click as data and mentioning whoever
 * published the version. So the click reaches the agent by the one road a
 * summons already travels — `reasonFor`, `isocan wait`, the inbox — and the
 * person sees in the thread what they asked for.
 */
export interface PrototypeClick {
  itemId: string;
  /** The page's own id for the control — a `data-wf` path, an element id. */
  element: string;
  /** The words on the control, as the person saw them. */
  label: string;
  /** Which screen of a multi-screen prototype was showing. */
  screen?: string;
  /** What the page says pressing it should do, when the page knows. */
  intent?: string;
}

/** The `type` a page posts to its parent window. */
export const CLICK_MESSAGE = "isocan:click";

/**
 * A second press on the same control by the same person inside this window
 * is the same request: people double-click, and a control that does nothing
 * visible invites pressing it again.
 */
export const CLICK_COALESCE_MS = 10_000;

const LIMITS = { element: 200, label: 200, screen: 200, intent: 500 } as const;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * What a frame posted, as a click on `itemId` — or null when the message is
 * anything else. The page is untrusted content, so every field is bounded and
 * a control with neither an id nor a label is not a click anybody can act on.
 */
export function clickFromMessage(data: unknown, itemId: string): PrototypeClick | null {
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;
  if (message.type !== CLICK_MESSAGE) return null;
  const label = text(message.label, LIMITS.label);
  const element = text(message.element, LIMITS.element) ?? label;
  if (!element) return null;
  const screen = text(message.screen, LIMITS.screen);
  const intent = text(message.intent, LIMITS.intent);
  return {
    itemId,
    element,
    label: label ?? element,
    ...(screen ? { screen } : {}),
    ...(intent ? { intent } : {}),
  };
}

/** The reducer's check on a click an op carries: the shape a frame message produces, nothing more. */
export function validateClick(value: unknown): PrototypeClick {
  const raw = value as Record<string, unknown> | null;
  const click =
    typeof raw === "object" && raw !== null && typeof raw.itemId === "string"
      ? clickFromMessage({ ...raw, type: CLICK_MESSAGE }, raw.itemId)
      : null;
  if (!click) throw new OpValidationError("bad-op", "a prototype click needs an item and an element or label");
  return click;
}

/** The words a person reads in the thread; agents read `comment.click`. */
export function clickBody(click: PrototypeClick): string {
  const where = click.screen ? ` on ${click.screen}` : "";
  const id = click.element === click.label ? "" : ` (${click.element})`;
  const intent = click.intent ? ` — ${click.intent}` : "";
  return `Clicked “${click.label}”${id}${where}${intent}`;
}

/** Was this the same person pressing the same control on the same item within `CLICK_COALESCE_MS`? */
export function coalescedClick(
  canvas: CanvasContents,
  click: PrototypeClick,
  actorId: string,
  now: number,
): boolean {
  return Object.values(canvas.threads).some((thread) =>
    thread.comments.some(
      (c: Comment) =>
        c.click?.itemId === click.itemId &&
        c.click.element === click.element &&
        c.author.id === actorId &&
        now - Date.parse(c.createdAt) < CLICK_COALESCE_MS,
    ),
  );
}

/**
 * The op that delivers a click: a reply on the item's thread, or that
 * thread's first message at the item's corner. It mentions the author of the
 * version on screen — the agent that published it — unless that is the
 * person clicking.
 */
export function clickOp(canvas: CanvasContents, click: PrototypeClick, actorId: string): Operation {
  const item = canvas.items[click.itemId];
  const publisher = item?.versions.find((v) => v.id === item.currentVersionId)?.createdBy.id;
  const comment: NewComment = {
    id: newCommentId(),
    body: clickBody(click),
    click,
    ...(publisher && publisher !== actorId ? { mentions: [publisher] } : {}),
  };
  const thread = itemThread(canvas, click.itemId);
  if (thread) return { type: "thread.reply", threadId: thread.id, comment };
  const corner = item ? anchorOffset(item) : { x: 0, y: 0 };
  return { type: "thread.create", threadId: newThreadId(), ...corner, anchorItemId: click.itemId, comment };
}
