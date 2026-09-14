import type { ActorJoins, ActorNames } from "./identity.ts";
import type { Actor, CanvasContents } from "./model.ts";
import { resolveActor } from "./identity.ts";
import { isSystemActor } from "./model.ts";

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

/** Where a slash command sits in the body — the same shape a mention has, so
 *  one chip renderer draws both. */
export interface CommandSpan {
  /** Index of the "/". */
  start: number;
  /** Index just past the verb. */
  end: number;
  /** The verb as written, without the "/". */
  name: string;
}

/**
 * **Every slash command in `body`, so a message that RAN something says so.**
 *
 * A message whose whole content is `/anatomy` and a path reads as plain text —
 * the one word that says work was asked for looks like any other word, and
 * there is nothing to click on to find out what it does. A mention is already
 * a chip; a command is the same kind of thing and was not.
 *
 * Here rather than in the web app because the rule is a fact about a body, and
 * both surfaces read bodies. It is the third span kind `splitChips` composes,
 * which is why this is a dozen lines rather than new machinery.
 *
 * **Only commands this canvas actually has.** `known` is the verbs the palette
 * would offer, so `/anatomy` lights up where the module is loaded and stays
 * plain text where it is not — a chip that offers to open something absent is
 * worse than no chip. And only at the start of a line: `and/or` is not a
 * command, `http://x/y` is not a command, and a person writing about a path
 * mid-sentence is not asking for one.
 */
export function findCommandSpans(body: string, known: readonly string[]): CommandSpan[] {
  const verbs = [...known].sort((a, b) => b.length - a.length); // longest first: `/rc end` before `/rc`
  const spans: CommandSpan[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "/") continue;
    const startOfLine = i === 0 || body[i - 1] === "\n";
    if (!startOfLine) continue;
    const hit = verbs.find((verb) => {
      if (body.slice(i + 1, i + 1 + verb.length) !== verb) return false;
      const after = body[i + 1 + verb.length];
      return after === undefined || after === " " || after === "\n";
    });
    if (!hit) continue;
    const end = i + 1 + hit.length;
    spans.push({ start: i, end, name: hit });
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

/**
 * The names an actor answers to: what the canvas remembers PLUS what they go
 * by now.
 *
 * A rename reaches everything a person reads (lib/names.ts, actorNames) — and
 * for a while it did not reach the thing that matters most, because mentions
 * were matched against the name stamped on old ops. Rename "Dion 2" to "Di"
 * and `@Di` resolved to nobody: no chip in the web app, and worse, no id on
 * the comment, so the summons never woke her. A name you answer to has to
 * work in the one place names are for.
 *
 * The old names stay: text written months ago still says "@Dion 2", and that
 * should keep pointing at the same person.
 */
export function actorsAnswerTo(
  actors: MentionCandidate[],
  names: ActorNames | undefined,
  /** The registry's joins (multi-identity phase 5): every candidate's id is
   * resolved first, so a new "@Dimitri 2" is stored as a mention of Dimitri —
   * the person who answers to it now — rather than of an actor nobody is any
   * more. */
  joined?: ActorJoins,
): MentionCandidate[] {
  const out: MentionCandidate[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string) => {
    const key = `${id}\u0000${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, name });
  };
  for (const actor of actors) add(resolveActor(joined, actor.id), actor.name);
  for (const actor of actors) {
    // The name the stamped id goes by now — for a folded actor that is the
    // person's name, because `actorNames` already resolves it.
    const now = names?.[actor.id];
    if (now) add(resolveActor(joined, actor.id), now);
  }
  return out;
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

/** Everyone stamped anywhere in a canvas, in the order they turn up: item
 * creators/editors and version authors (live and trashed), thread starters
 * and comment authors. */
function* canvasActors(canvas: CanvasContents): Generator<Actor> {
  // Standing agents first: an enrolled agent that has never spoken must
  // still be mentionable — `@Sian` resolving is what makes a summons
  // possible at all — and first means the enrolment's name wins the
  // first-name-used rule below over any older stamp.
  for (const enrolled of Object.values(canvas.agents ?? {})) yield enrolled.actor;
  const items = [
    ...Object.values(canvas.items),
    ...canvas.trash.map((entry) => entry.item),
  ];
  // The system voice is a voice, not a participant: its comments must not
  // make "@isocan" resolvable or put a machinery face in any roster.
  const person = function* (actor: Actor) {
    if (!isSystemActor(actor.id)) yield actor;
  };
  for (const item of items) {
    yield* person(item.createdBy);
    yield* person(item.updatedBy);
    for (const version of item.versions) yield* person(version.createdBy);
  }
  for (const thread of Object.values(canvas.threads)) {
    yield* person(thread.createdBy);
    for (const comment of thread.comments) yield* person(comment.author);
  }
}

/** One entry per actor visible in a canvas, under the first name they used.
 * Combine with the live presence roster for mention candidates. */
export function collectCanvasActors(canvas: CanvasContents): Actor[] {
  const seen = new Map<string, Actor>();
  for (const actor of canvasActors(canvas)) {
    if (!seen.has(actor.id)) seen.set(actor.id, actor);
  }
  return [...seen.values()];
}

/** One entry per (actor, name) pair the canvas has recorded — the same person
 * can have worked under more than one name, and it is NAMES that `@mentions`
 * and "is this name taken?" key on. */
export function collectCanvasNames(canvas: CanvasContents): MentionCandidate[] {
  const seen = new Map<string, MentionCandidate>();
  for (const actor of canvasActors(canvas)) {
    const key = `${actor.id} ${actor.name}`;
    if (!seen.has(key)) seen.set(key, { id: actor.id, name: actor.name });
  }
  return [...seen.values()];
}
