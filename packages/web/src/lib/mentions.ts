/**
 * The web side of @-mentions: who can be mentioned, and how mentions are
 * drawn. Resolution itself lives in `@isocan/core` — this module only feeds it
 * a roster and turns its spans into chips.
 */
import { useMemo } from "react";
import type { Element, ElementContent, Root } from "hast";
import type {
  CanvasState,
  MentionCandidate,
  MentionSpan,
  PresenceSession,
} from "@isocan/core";
import { collectCanvasActors, findMentionSpans } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { actorColor } from "./colors.ts";

/** One mentionable person, as offered by the "@" menu. */
export interface MentionPeer {
  id: string;
  name: string;
  /** Has a live session right now — they'll see the comment immediately. */
  online: boolean;
}

export interface MentionRoster {
  /** One entry per name an actor answers to; feeds core's resolution. */
  candidates: MentionCandidate[];
  /** One entry per actor, live label preferred; feeds the "@" menu. */
  peers: MentionPeer[];
}

/**
 * Everyone visible on this canvas: actors in the state plus the live presence
 * roster (whose labels are mentionable names too). `selfId` is dropped from
 * the menu — you don't mention yourself — but kept as a candidate, so a body
 * that names you still resolves.
 */
export function mentionRoster(
  canvas: CanvasState | null,
  sessions: PresenceSession[],
  selfId?: string,
): MentionRoster {
  const candidates: MentionCandidate[] = canvas ? collectCanvasActors(canvas) : [];
  const peers = new Map<string, MentionPeer>();
  for (const candidate of candidates) {
    if (!peers.has(candidate.id)) {
      peers.set(candidate.id, { id: candidate.id, name: candidate.name, online: false });
    }
  }
  for (const session of sessions) {
    const name = session.label ?? session.actor.name;
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
    // A live session speaks for the actor: its label wins over a stale name.
    peers.set(session.actor.id, { id: session.actor.id, name, online: true });
  }
  const ordered = [...peers.values()]
    .filter((peer) => peer.id !== selfId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return { candidates, peers: ordered };
}

/** `mentionRoster` over the live store. */
export function useMentionRoster(selfId?: string): MentionRoster {
  const canvas = useCanvasStore((s) => s.canvas);
  const sessions = useCanvasStore((s) => s.sessions);
  return useMemo(() => mentionRoster(canvas, sessions, selfId), [canvas, sessions, selfId]);
}

/** `[plain text, mention, plain text, …]` — what the composer paints behind
 * its text and what the chip renderer splits markdown text nodes into. */
export type MentionPiece = { text: string; span?: MentionSpan };

export function splitMentions(body: string, candidates: MentionCandidate[]): MentionPiece[] {
  const pieces: MentionPiece[] = [];
  let cursor = 0;
  for (const span of findMentionSpans(body, candidates)) {
    if (span.start > cursor) pieces.push({ text: body.slice(cursor, span.start) });
    pieces.push({ text: body.slice(span.start, span.end), span });
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
 * Rehype plugin: rewrites `@Name` inside rendered comment bodies into chips,
 * using the same spans the composer highlights. Code, code blocks and links
 * are left alone. Returns the attacher unified expects, bound to a roster.
 */
export function rehypeMentions(candidates: MentionCandidate[], selfId: string) {
  return function attacher() {
    return (tree: Root) => chipify(tree, candidates, selfId);
  };
}

function chipify(node: Root | Element, candidates: MentionCandidate[], selfId: string): void {
  const children: ElementContent[] = [];
  let rewritten = false;
  for (const child of node.children as ElementContent[]) {
    if (child.type === "element") {
      if (!OPAQUE_TAGS.has(child.tagName)) chipify(child, candidates, selfId);
      children.push(child);
      continue;
    }
    if (child.type !== "text") {
      children.push(child);
      continue;
    }
    const pieces = splitMentions(child.value, candidates);
    if (!pieces.some((piece) => piece.span)) {
      children.push(child);
      continue;
    }
    rewritten = true;
    for (const piece of pieces) {
      children.push(
        piece.span
          ? chipElement(piece.text, piece.span.actorId, selfId)
          : { type: "text", value: piece.text },
      );
    }
  }
  if (rewritten) node.children = children as Root["children"];
}

function chipElement(text: string, actorId: string, selfId: string): Element {
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
