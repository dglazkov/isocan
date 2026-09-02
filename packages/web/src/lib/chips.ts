/**
 * How resolved references are drawn. `@isocan/core` finds @-mention and
 * #item-reference spans from candidate rosters; this module turns both into
 * chips in one pass — `splitChips` for the composer's mirrored backdrop,
 * `rehypeChips` for rendered markdown bodies. Item chips carry a
 * `data-item-id` that the thread popover's click delegation turns into a
 * catapult to the item.
 */
import type { Element, ElementContent, Root } from "hast";
import type { ItemRefCandidate, ItemRefSpan, MentionCandidate, MentionSpan } from "@isocan/core";
import { findItemRefSpans, findMentionSpans } from "@isocan/core";
import { actorColor } from "./colors.ts";

/** `[plain text, chip, plain text, …]` — at most one of `mention`/`item`. */
type ChipPiece = { text: string; mention?: MentionSpan; item?: ItemRefSpan };

export function splitChips(
  body: string,
  candidates: MentionCandidate[],
  items: ItemRefCandidate[],
): ChipPiece[] {
  const spans = [
    ...findMentionSpans(body, candidates).map((s) => ({ start: s.start, end: s.end, mention: s })),
    ...findItemRefSpans(body, items).map((s) => ({ start: s.start, end: s.end, item: s })),
  ].sort((a, b) => a.start - b.start);
  const pieces: ChipPiece[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // swallowed by an earlier span
    if (span.start > cursor) pieces.push({ text: body.slice(cursor, span.start) });
    pieces.push({
      text: body.slice(span.start, span.end),
      ...("mention" in span ? { mention: span.mention } : { item: span.item }),
    });
    cursor = span.end;
  }
  if (cursor < body.length) pieces.push({ text: body.slice(cursor) });
  return pieces;
}

/** Inline style carrying the actor's identity color to the chip's CSS. */
export function mentionChipStyle(actorId: string): string {
  return `--mention-color:${actorColor(actorId)}`;
}

const OPAQUE_TAGS = new Set(["code", "pre", "a"]); // literal text, or already a link

/**
 * Rehype plugin: rewrites `@Name` and `#Title` inside rendered comment bodies
 * into chips, using the same spans the composer highlights. Code, code blocks
 * and links are left alone. Returns the attacher unified expects, bound to
 * its rosters.
 */
export function rehypeChips(
  candidates: MentionCandidate[],
  selfId: string,
  items: ItemRefCandidate[],
) {
  return function attacher() {
    return (tree: Root) => chipify(tree, candidates, selfId, items);
  };
}

function chipify(
  node: Root | Element,
  candidates: MentionCandidate[],
  selfId: string,
  items: ItemRefCandidate[],
): void {
  const children: ElementContent[] = [];
  let rewritten = false;
  for (const child of node.children as ElementContent[]) {
    if (child.type === "element") {
      if (!OPAQUE_TAGS.has(child.tagName)) chipify(child, candidates, selfId, items);
      children.push(child);
      continue;
    }
    if (child.type !== "text") {
      children.push(child);
      continue;
    }
    const pieces = splitChips(child.value, candidates, items);
    if (!pieces.some((piece) => piece.mention || piece.item)) {
      children.push(child);
      continue;
    }
    rewritten = true;
    for (const piece of pieces) {
      if (piece.mention) children.push(mentionElement(piece.text, piece.mention.actorId, selfId));
      else if (piece.item) children.push(itemRefElement(piece.text, piece.item.itemId));
      else children.push({ type: "text", value: piece.text });
    }
  }
  if (rewritten) node.children = children as Root["children"];
}

function mentionElement(text: string, actorId: string, selfId: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: actorId === selfId ? ["mention", "mention-me"] : ["mention"],
      style: mentionChipStyle(actorId),
    },
    children: [{ type: "text", value: text }],
  };
}

function itemRefElement(text: string, itemId: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["item-ref"],
      dataItemId: itemId,
      role: "link",
      tabIndex: 0,
      title: "Show me this item",
    },
    children: [{ type: "text", value: text }],
  };
}
