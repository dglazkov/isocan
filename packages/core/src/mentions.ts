import type { Actor, CanvasState } from "./model.ts";

/**
 * @-mentions. A mention is resolved at AUTHORING time against the actors the
 * author can see (comment authors, item creators, live presence sessions) and
 * stored structurally on the comment as actor ids — readers filter on ids and
 * never re-parse text.
 *
 * Names are free-form (spaces, emoji), so matching is candidate-driven rather
 * than grammar-driven: for each candidate, the full name is tried first, then
 * its first whitespace-separated token ("@Dimitri" matches "Dimitri Glazkov").
 * Matching is case-insensitive. The "@" must start a word — a preceding
 * letter/digit disqualifies it, so email addresses mention nobody.
 */

/** A resolvable name. Pass one entry per name an actor answers to — their
 * Actor.name plus any presence label — duplicated ids are deduped. */
export interface MentionCandidate {
  id: string;
  name: string;
}

/** Actor ids mentioned in `body`, in candidate order, deduped. */
export function extractMentions(body: string, candidates: MentionCandidate[]): string[] {
  const ids: string[] = [];
  for (const candidate of candidates) {
    if (ids.includes(candidate.id)) continue;
    if (mentionsName(body, candidate.name)) ids.push(candidate.id);
  }
  return ids;
}

function mentionsName(body: string, name: string): boolean {
  const full = name.trim();
  if (!full) return false;
  const firstToken = full.split(/\s+/)[0]!;
  return matchesAt(body, full) || matchesAt(body, firstToken);
}

function matchesAt(body: string, name: string): boolean {
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`,
    "iu",
  );
  return pattern.test(body);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every actor visible in a canvas: item creators/editors (live and trashed)
 * and comment authors. Combine with the live presence roster for candidates. */
export function collectCanvasActors(canvas: CanvasState): Actor[] {
  const seen = new Map<string, Actor>();
  const add = (actor: Actor) => {
    if (!seen.has(actor.id)) seen.set(actor.id, actor);
  };
  for (const item of Object.values(canvas.items)) {
    add(item.createdBy);
    add(item.updatedBy);
  }
  for (const entry of canvas.trash) {
    add(entry.item.createdBy);
    add(entry.item.updatedBy);
  }
  for (const thread of Object.values(canvas.threads)) {
    add(thread.createdBy);
    for (const comment of thread.comments) add(comment.author);
  }
  return [...seen.values()];
}
