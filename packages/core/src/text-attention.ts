import type { CanvasContents } from "./model.ts";

/** A range in the deterministic rendered text of one immutable representation.
 * Offsets count Unicode code points, never pixels or Markdown source bytes. */
export interface TextAttention {
  itemId: string;
  versionId: string;
  blobHash: string;
  textSpace: "markdown-hast-v1";
  flavor: "document" | "text-node" | "plain";
  start: number;
  end: number;
  expiresAt: number;
}

/** Selection freshness is independent of the session's ordinary heartbeat. */
export const TEXT_ATTENTION_MS = 15_000;

/** Refuse malformed, expired or unrelated ranges before relaying presence.
 * A future expiry is bounded at this hop; clients cannot create immortal attention. */
export function textAttention(value: unknown, now = Date.now(), canvas?: CanvasContents): TextAttention | null {
  if (!value || typeof value !== "object") return null;
  const v = value as TextAttention;
  if (v.textSpace !== "markdown-hast-v1" || !["document", "text-node", "plain"].includes(v.flavor)) return null;
  if (![v.itemId, v.versionId, v.blobHash].every(s => typeof s === "string" && s.length > 0 && s.length <= 128)) return null;
  if (!Number.isSafeInteger(v.start) || !Number.isSafeInteger(v.end) || v.start < 0 || v.end <= v.start || v.end > 10_000_000) return null;
  if (!Number.isFinite(v.expiresAt) || v.expiresAt <= now) return null;
  if (canvas) {
    const version = canvas.items[v.itemId]?.versions.find(one => one.id === v.versionId);
    if (!version || version.blobHash !== v.blobHash || !["text/markdown", "text/plain"].includes(version.mimeType)) return null;
  }
  return { itemId: v.itemId, versionId: v.versionId, blobHash: v.blobHash, textSpace: v.textSpace,
    flavor: v.flavor, start: v.start, end: v.end, expiresAt: Math.min(v.expiresAt, now + TEXT_ATTENTION_MS) };
}

/** Resolve an exact quote in canonical text; repeated words require an explicit
 * occurrence. Never turn ambiguity into an agent pointing at the wrong passage. */
export function quoteRange(text: string, quote: string, occurrence?: number): { start: number; end: number } {
  if (!quote) throw new Error("The quote must contain text");
  const matches: number[] = [];
  for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) matches.push(at);
  if (!matches.length) throw new Error("Quote not found in the rendered text");
  if (occurrence === undefined && matches.length !== 1) throw new Error(`Quote matches ${matches.length} passages; pass --occurrence`);
  const chosen = occurrence ?? 1;
  if (!Number.isSafeInteger(chosen) || chosen < 1 || chosen > matches.length) throw new Error("Occurrence is outside the matching passages");
  const start = Array.from(text.slice(0, matches[chosen - 1]!)).length;
  return { start, end: start + Array.from(quote).length };
}
