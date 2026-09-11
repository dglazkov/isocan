import type { TextAttention } from "./text-attention.ts";
import type { Item } from "./model.ts";
import { OpValidationError } from "./errors.ts";

/** A saved quote with immutable provenance. Resolution against newer text is
 * derived, never written back over the words the commenter actually saw. */
export interface TextAnchor {
  versionId: string;
  blobHash: string;
  textSpace: "markdown-hast-v1";
  flavor: TextAttention["flavor"];
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
}

/** The current document can resolve, lose, or ambiguously repeat a saved quote. */
export type TextAnchorResolution = { status: "resolved"; start: number; end: number } | { status: "missing" | "ambiguous" | "unavailable" };

/** Build the same quote selector from a browser range or a terminal quote. */
export function makeTextAnchor(text: string, identity: Pick<TextAnchor, "versionId" | "blobHash" | "flavor">, range: { start: number; end: number }): TextAnchor {
  const chars = Array.from(text);
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > chars.length || range.end - range.start > 65536) {
    throw new Error("Select between 1 and 65536 characters in the rendered document");
  }
  return { ...identity, textSpace: "markdown-hast-v1", ...range,
    quote: chars.slice(range.start, range.end).join(""), prefix: chars.slice(Math.max(0, range.start - 32), range.start).join(""), suffix: chars.slice(range.end, range.end + 32).join("") };
}

/** Refuse malformed selectors and anchors to a representation the item never held. */
export function validateTextAnchor(value: unknown, item: Item | undefined): TextAnchor | null {
  if (value === undefined || value === null) return null;
  const a = value as TextAnchor;
  const version = item?.versions.find(v => v.id === a.versionId);
  if (!version || ![version, version.visual].some(face => face?.blobHash === a.blobHash && ["text/markdown", "text/plain"].includes(face.mimeType)) || a.textSpace !== "markdown-hast-v1" || !["document", "text-node", "plain"].includes(a.flavor) ||
    typeof a.quote !== "string" || !a.quote.length || a.quote.length > 131072 || Array.from(a.quote).length > 65536 || typeof a.prefix !== "string" || a.prefix.length > 64 || Array.from(a.prefix).length > 32 || typeof a.suffix !== "string" || a.suffix.length > 64 || Array.from(a.suffix).length > 32 ||
    !Number.isSafeInteger(a.start) || !Number.isSafeInteger(a.end) || a.start < 0 || a.end > 10_000_000 || a.end - a.start !== Array.from(a.quote).length) {
    throw new OpValidationError("bad-op", "Text anchors need a valid quote and saved Markdown/plain-text representation on the anchored item");
  }
  return { versionId: a.versionId, blobHash: a.blobHash, textSpace: a.textSpace, flavor: a.flavor, quote: a.quote, prefix: a.prefix, suffix: a.suffix, start: a.start, end: a.end };
}

/** Never guess using stale coordinates in a changed version. Unique text can
 * move; repeated text needs matching context, otherwise the item pin survives. */
export function resolveTextAnchor(anchor: TextAnchor, text: string, identity: { blobHash: string; flavor: TextAnchor["flavor"] }): TextAnchorResolution {
  if (!anchor.quote || identity.flavor !== anchor.flavor) return { status: "unavailable" };
  const chars = Array.from(text);
  if (identity.blobHash === anchor.blobHash && chars.slice(anchor.start, anchor.end).join("") === anchor.quote) return { status: "resolved", start: anchor.start, end: anchor.end };
  const matches: number[] = [];
  for (let at = text.indexOf(anchor.quote); at >= 0; at = text.indexOf(anchor.quote, at + 1)) matches.push(at);
  if (!matches.length) return { status: "missing" };
  const contextual = matches.length === 1 ? matches : matches.filter(at => text.slice(Math.max(0, at - anchor.prefix.length), at) === anchor.prefix && text.slice(at + anchor.quote.length, at + anchor.quote.length + anchor.suffix.length) === anchor.suffix);
  if (contextual.length !== 1) return { status: "ambiguous" };
  const start = Array.from(text.slice(0, contextual[0]!)).length;
  return { status: "resolved", start, end: start + Array.from(anchor.quote).length };
}
