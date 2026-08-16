import type { Actor, CanvasState } from "./model.ts";

/**
 * @-mentions. A mention is resolved at AUTHORING time against the actors the
 * author can see (comment authors, item creators, live presence sessions) and
 * stored structurally on the comment as actor ids — readers filter on ids and
 * never re-parse text.
 *
 * Names are free-form (spaces, emoji), so matching is candidate-driven rather
 * than grammar-driven: at each "@" every candidate name is tried — the full
 * name and its first whitespace-separated token ("@Dimitri" matches "Dimitri
 * Glazkov") — longest first. Matching is case-insensitive. The "@" must start
 * a word — a preceding letter/digit disqualifies it, so email addresses
 * mention nobody.
 *
 * `findMentionSpans` exposes WHERE each mention sits, which is what the web
 * app's chips (in the composer and in rendered bodies) are drawn from.
 */

/** A resolvable name. Pass one entry per name an actor answers to — their
 * Actor.name plus any presence label — duplicated ids are deduped. */
export interface MentionCandidate {
  id: string;
  name: string;
}

/** Where a mention sits in the body — what renderers underline as a chip. */
export interface MentionSpan {
  /** Index of the "@". */
  start: number;
  /** Index just past the matched name. */
  end: number;
  /** The mentioned actor. */
  actorId: string;
  /** The name as written, without the "@". */
  name: string;
}

/**
 * Every mention in `body`, in text order, non-overlapping. At each "@" the
 * longest matching candidate name wins, so "@Dimitri Glazkov" is one span
 * rather than a bare "@Dimitri" followed by loose text.
 */
export function findMentionSpans(body: string, candidates: MentionCandidate[]): MentionSpan[] {
  const names = resolvableNames(candidates);
  const spans: MentionSpan[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "@") continue;
    if (i > 0 && isWordChar(body[i - 1]!)) continue; // email addresses mention nobody
    const hit = names.find((candidate) => matchesAt(body, i + 1, candidate.name));
    if (!hit) continue;
    const end = i + 1 + hit.name.length;
    spans.push({ start: i, end, actorId: hit.id, name: body.slice(i + 1, end) });
    i = end - 1;
  }
  return spans;
}

/** Actor ids mentioned in `body`, in candidate order, deduped. */
export function extractMentions(body: string, candidates: MentionCandidate[]): string[] {
  const mentioned = new Set(findMentionSpans(body, candidates).map((span) => span.actorId));
  const ids: string[] = [];
  for (const candidate of candidates) {
    if (mentioned.has(candidate.id) && !ids.includes(candidate.id)) ids.push(candidate.id);
  }
  return ids;
}

/** Candidate names plus their first tokens, longest first (ties: input order). */
function resolvableNames(candidates: MentionCandidate[]): MentionCandidate[] {
  const names: MentionCandidate[] = [];
  for (const candidate of candidates) {
    const full = candidate.name.trim();
    if (!full) continue;
    for (const name of new Set([full, full.split(/\s+/)[0]!])) {
      if (!names.some((n) => n.id === candidate.id && n.name === name)) {
        names.push({ id: candidate.id, name });
      }
    }
  }
  return names.sort((a, b) => b.name.length - a.name.length);
}

/** Does `name` sit at `index`, case-insensitively, ending on a word boundary? */
function matchesAt(body: string, index: number, name: string): boolean {
  const slice = body.slice(index, index + name.length);
  if (slice.toLowerCase() !== name.toLowerCase()) return false;
  const after = body[index + name.length];
  return after === undefined || !isWordChar(after);
}

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch);
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
