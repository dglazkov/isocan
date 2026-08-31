import type { Actor, CanvasContents, Comment, CommentThread } from "./model.ts";
import type { NewComment, Operation } from "./ops.ts";
import type { MentionCandidate } from "./mentions.ts";
import { extractMentions } from "./mentions.ts";
import { isSystemActor } from "./model.ts";
import { opMatchesFilters } from "./touches.ts";

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

/**
 * **What a rule may say** (agents-on-demand phase 4, decided 2026-08-30):
 * today's filters, exactly — the items it names, the op types (or families,
 * `item.*`) it wants. This is the whole grammar, defined HERE so `wait`, the
 * inbox and the rc read one vocabulary; richer predicates ("the items Sian
 * owns") join this type in this file when something can actually write them,
 * never as a dialect one reader grows alone. Unknown keys in a stored rules
 * object are ignored, not errors: the record has carried rules opaquely
 * since phase 2, and a rule written by a newer build must not break an
 * older reader's routing.
 */
export interface AgentRules {
  /** Only changes touching these item ids. Empty/absent: any item. */
  items?: string[];
  /** Only these op types, `item.*` families allowed. Empty/absent with
   * `items` also empty: comments only — the enrolled default. `["*"]` is
   * everything, `wait --all-ops`'s spelling. */
  ops?: string[];
}

/** The stored rules field, read tolerantly — it has been opaque since
 * phase 2, and a malformed hand-me-down must cost the filter, not the
 * summons. */
export function rulesOf(raw: unknown): AgentRules {
  if (raw === null || typeof raw !== "object") return {};
  const strings = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
  const items = strings((raw as { items?: unknown }).items);
  const ops = strings((raw as { ops?: unknown }).ops);
  return { ...(items ? { items } : {}), ...(ops ? { ops } : {}) };
}

/**
 * **THE routing composition, stated once** (agents-on-demand phase 4).
 * `reasonFor` is the is-this-for-me predicate; this is the whole rule a
 * park or a dispatcher applies to one op:
 *
 * - your own ops never wake you — otherwise an agent that writes what it
 *   watches for wakes itself, forever;
 * - a comment for you (`reasonFor`) is a SUMMONS, and it comes through any
 *   filter — the human reaching you is never the noise you asked to be
 *   spared;
 * - everything else is a CHANGE, taken only when the rules ask for it:
 *   filters narrow, an empty rule set means comments-only.
 *
 * It lived as loose composition in `wait`'s loop (`main.ts` checked the
 * summons before the filters ever ran); it lives here so the rc importing
 * the rule and the park applying it cannot drift — the piercing that must
 * never differ between them is one function's control flow.
 */
export function dispatchReason(
  op: Operation,
  authorId: string,
  agent: { actorId: string; names: readonly MentionCandidate[]; rules?: AgentRules | null | undefined },
  canvas: CanvasContents | null | undefined,
): InboxReason | "change" | null {
  if (authorId === agent.actorId) return null;
  // The system voice reports outcomes; it never summons. Without this,
  // "Sian couldn't answer" landing in Sian's own thread would re-summon
  // Sian — the failure message waking the failure, forever (phase 5).
  if (isSystemActor(authorId)) return null;
  if (op.type === "thread.create" || op.type === "thread.reply") {
    const thread = canvas?.threads[op.threadId];
    const reason = reasonFor(op.comment, thread, agent.actorId, agent.names);
    if (reason) return reason;
  }
  const rules = agent.rules;
  if (!rules) return null;
  const items = rules.items ?? [];
  const ops = rules.ops ?? [];
  if (items.length === 0 && ops.length === 0) return null; // comments only
  return opMatchesFilters(op, { items, types: ops }, canvas ?? null) ? "change" : null;
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
