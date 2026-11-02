import type { CanvasContents } from "./model.ts";

/**
 * #item-references — comments pointing at items on the canvas. Like
 * @-mentions, a reference is resolved at AUTHORING time against the items the
 * author can see and stored structurally on the comment as item ids; renderers
 * re-derive spans from the same candidate matching to draw them as chips that
 * fly the reader to the item.
 *
 * Titles are free-form, so matching is candidate-driven like mentions: at
 * each "#" every live item is tried — by full title (case-insensitive) or by
 * exact id, longest first. Unlike names, titles get no first-token shorthand:
 * "#Design" should not swallow half of "Design notes". The "#" must start a
 * word, and a markdown heading's "# " never matches because titles are
 * offered trimmed. An item deleted after being referenced simply stops
 * matching — the text degrades to plain prose, the same way a renamed
 * @-mention does.
 */

/** A referable item. Offer one entry per live item; trashed items are not
 * destinations. */
export interface ItemRefCandidate {
  id: string;
  title: string;
}

/** Where a reference sits in the body — what renderers turn into a chip. */
export interface ItemRefSpan {
  /** Index of the "#". */
  start: number;
  /** Index just past the matched title (or id). */
  end: number;
  /** The referenced item. */
  itemId: string;
  /** The title (or id) as written, without the "#". */
  text: string;
}

/**
 * Every item reference in `body`, in text order, non-overlapping. At each "#"
 * the longest matching candidate wins, so "#Design notes" is one span rather
 * than a bare "#Design" over a shorter-titled item.
 */
export function findItemRefSpans(body: string, candidates: ItemRefCandidate[]): ItemRefSpan[] {
  const names = referableNames(candidates);
  const spans: ItemRefSpan[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "#") continue;
    if (i > 0 && isWordChar(body[i - 1]!)) continue; // URL fragments refer to nothing
    const hit = names.find((candidate) => matchesAt(body, i + 1, candidate.name));
    if (!hit) continue;
    const end = i + 1 + hit.name.length;
    spans.push({ start: i, end, itemId: hit.id, text: body.slice(i + 1, end) });
    i = end - 1;
  }
  return spans;
}

/** Item ids referenced in `body`, in candidate order, deduped. */
export function extractItemRefs(body: string, candidates: ItemRefCandidate[]): string[] {
  const referenced = new Set(findItemRefSpans(body, candidates).map((span) => span.itemId));
  const ids: string[] = [];
  for (const candidate of candidates) {
    if (referenced.has(candidate.id) && !ids.includes(candidate.id)) ids.push(candidate.id);
  }
  return ids;
}

/** One candidate per live item, under its title and its id. */
export function collectItemRefCandidates(canvas: CanvasContents): ItemRefCandidate[] {
  const candidates: ItemRefCandidate[] = [];
  for (const item of Object.values(canvas.items)) {
    const title = item.title.trim();
    if (title) candidates.push({ id: item.id, title });
    candidates.push({ id: item.id, title: item.id });
  }
  return candidates;
}

/**
 * Candidate titles, longest first (ties: input order).
 *
 * Asked for every text run a chip plugin renders and every time a composer
 * draws its draft, so it is kept per candidate LIST: the web hands the same
 * list until an id or a title changes (`useItemRefRoster`), and this answers it
 * once. The duplicate check was `names.some(...)` inside the loop — quadratic,
 * 125,000 comparisons for a canvas of 250 items, on every operation while a
 * collaborator dragged (26 Sep 2026: 8% of the main thread). A set of seen
 * `id`+`name` keeps the first of each, as before, and the stable sort keeps
 * the ties in input order.
 */
const namesMemo = new WeakMap<ItemRefCandidate[], Array<{ id: string; name: string }>>();
function referableNames(candidates: ItemRefCandidate[]): Array<{ id: string; name: string }> {
  const known = namesMemo.get(candidates);
  if (known) return known;
  const names: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const name = candidate.title.trim();
    if (!name) continue;
    const key = `${candidate.id}\u0000${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    names.push({ id: candidate.id, name });
  }
  names.sort((a, b) => b.name.length - a.name.length);
  namesMemo.set(candidates, names);
  return names;
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
