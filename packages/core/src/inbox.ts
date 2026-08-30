import type { Actor, CanvasContents, Comment, CommentThread } from "./model.ts";
import type { NewComment } from "./ops.ts";
import type { MentionCandidate } from "./mentions.ts";
import { extractMentions } from "./mentions.ts";

/**
 * **What is addressed to you, wherever it landed.**
 *
 * `docs/research/2026-08-29-the-inbox.md`, and the finding that shaped this
 * file: **`isocan wait` was already this rule.** It has decided "is this
 * comment for me" for weeks, across several canvases, and the app had no
 * equivalent — so a person could be @-mentioned on a canvas they were not
 * looking at and find out by chance.
 *
 * The rule lives here now rather than in the CLI, for the reason `itemThread`
 * moved: a rule one surface enforces and the other does not know is a habit,
 * not a rule. A second definition written for the person would be a second
 * answer to a question that has one, and the two would disagree silently —
 * which shows up as somebody not being told something.
 *
 * **No read state.** Version one is a LIST, not a count. Seen-marks live in
 * `localStorage` per canvas per actor, so a count would mean "in this browser"
 * and could not see a mention on a canvas this browser has never opened —
 * which is exactly the case an inbox is for. The research recommends a
 * per-canvas high-water mark as an operation when a count is wanted; until
 * then this reports what exists and lets the reader decide what is new.
 */

/** Why a comment is yours. Kept because the reasons are not equally urgent —
 *  a direct mention is somebody asking you; the Chat is the room being loud. */
export type InboxReason = "mentioned" | "main-thread" | "in-your-thread";

export interface InboxEntry {
  canvasId: string;
  /** For saying where, without a second lookup. */
  canvasTitle?: string;
  threadId: string;
  comment: Comment;
  reason: InboxReason;
}

/**
 * The names you answer to. Your identity name, plus any session label you are
 * wearing — an agent called "Percy" this run is @Percy to everybody on the
 * canvas, and `wait` has always looked for both.
 */
export function namesFor(actor: Actor, label?: string | null): MentionCandidate[] {
  const names: MentionCandidate[] = [actor];
  if (label && label !== actor.name) names.push({ id: actor.id, name: label });
  return names;
}

/**
 * Does this comment address you?
 *
 * Two ways, and both matter. `comment.mentions` is resolved at authoring time
 * against the actors the author could see — the durable, exact answer. The
 * body is re-read as well because older comments predate that field, and
 * because a name you answer to NOW (a session label) may not have been
 * resolvable when the comment was written.
 */
export function addressesActor(
  comment: NewComment | Comment,
  names: readonly MentionCandidate[],
): boolean {
  const self = names[0]?.id;
  if (self && (comment.mentions ?? []).includes(self)) return true;
  return extractMentions(comment.body, names as MentionCandidate[]).length > 0;
}

/** Are you already in this conversation — did you write in it, or were you
 *  named in it? A reply to a thread you are part of is for you even when it
 *  does not repeat your name. */
function inYourThread(thread: CommentThread, actorId: string, names: readonly MentionCandidate[]): boolean {
  return thread.comments.some((c) => c.author.id === actorId || addressesActor(c, names));
}

/**
 * Everything on one canvas that is addressed to this actor, oldest first.
 *
 * **Your own words are never in your inbox.** Obvious once said, and the kind
 * of thing a filter forgets: you are in every thread you wrote in, so without
 * this every comment you ever left would come back to you.
 */
/**
 * Why one comment is yours, or null when it is ether. THE routing rule,
 * stated once: named — by id or a name you answer to — or the main thread,
 * or a conversation you are already in. `inboxOn` folds a canvas with it and
 * `isocan wait` decides a summons with it, so a parked agent and the inbox
 * can never disagree about what is for you — and a daemon that summons
 * agents (`docs/projects/on-demand/design.md`) asks this same function
 * rather than growing a third copy.
 *
 * The comment may be a `NewComment` (an op still in flight, no author yet);
 * skipping your own words is the caller's job, since only the caller knows
 * whose they are. A missing thread (an op racing its own snapshot) can still
 * mention you; it cannot be main or already yours.
 */
export function reasonFor(
  comment: NewComment | Comment,
  thread: CommentThread | undefined,
  actorId: string,
  names: readonly MentionCandidate[],
): InboxReason | null {
  if (addressesActor(comment, names)) return "mentioned";
  if (thread?.main) return "main-thread";
  if (thread && inYourThread(thread, actorId, names)) return "in-your-thread";
  return null;
}

export function inboxOn(
  canvas: CanvasContents,
  actor: Actor,
  names: readonly MentionCandidate[],
  canvasId: string,
  canvasTitle?: string,
): InboxEntry[] {
  const out: InboxEntry[] = [];
  for (const thread of Object.values(canvas.threads ?? {})) {
    for (const comment of thread.comments) {
      if (comment.author.id === actor.id) continue;
      const reason = reasonFor(comment, thread, actor.id, names);
      if (!reason) continue;
      out.push({
        canvasId,
        ...(canvasTitle ? { canvasTitle } : {}),
        threadId: thread.id,
        comment,
        reason,
      });
    }
  }
  return out.sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));
}

/**
 * Newest first, across canvases — the order an inbox is read in.
 *
 * Sorted here rather than by each caller, because "newest" is the one thing
 * every surface must agree on and it is exactly the sort somebody reimplements
 * slightly differently.
 */
export function inboxNewestFirst(entries: readonly InboxEntry[]): InboxEntry[] {
  return [...entries].sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
}

/** How many, by why — so a surface can say "2 mentions" without counting the
 *  room being loud as somebody asking you. */
export function inboxTally(entries: readonly InboxEntry[]): Record<InboxReason, number> {
  const tally: Record<InboxReason, number> = {
    mentioned: 0,
    "main-thread": 0,
    "in-your-thread": 0,
  };
  for (const entry of entries) tally[entry.reason] += 1;
  return tally;
}

/** One line, the same on every surface. */
export function inboxLine(entry: InboxEntry): string {
  const where = entry.canvasTitle ?? entry.canvasId;
  const first = entry.comment.body.split("\n").find((l) => l.trim() !== "") ?? "";
  return `${entry.comment.author.name} · ${where} — ${first.slice(0, 90)}`;
}
