import { actorNameIn, collectCanvasActors } from "@isocan/core";
import type { CanvasSnapshotResponse, CommentThread, Item, WatchedLogEntry } from "@isocan/core";

/**
 * **Pure helpers the room speaks with** (docs/projects/room/design.md): they
 * lived in `packages/cli/src/main.ts` by accident of history and moved here
 * unchanged, except that `summonsPrompt` takes the canvas title it used to
 * capture. `main.ts` imports them back.
 */

/** World center of an item — where narration points the cursor. */
export function itemCenter(item: Item): { x: number; y: number } {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

/** Where a thread sits in world coordinates, anchored or freestanding. */
export function threadLocus(
  snapshot: CanvasSnapshotResponse,
  thread: CommentThread,
): { x: number; y: number } {
  const anchor = thread.anchorItemId ? snapshot.canvas.items[thread.anchorItemId] : undefined;
  return anchor ? { x: anchor.x + thread.x, y: anchor.y + thread.y } : { x: thread.x, y: thread.y };
}

/**
 * An actor id → the name this canvas would show, for `listenWords`. The
 * registry's current name, not the one stamped on an old op — a gate that
 * says who somebody USED to be is a gate nobody can act on.
 *
 * **The registry is asked FIRST, and that is the fix rather than the
 * tidy-up.** `collectCanvasActors` walks canvas state, so it knows the
 * people who have written something here — which is exactly not the person
 * a fresh gate usually names: enrolling an agent and pointing it at
 * yourself is often the first thing you do on a canvas, and it left `who`
 * printing *listens to usr_nico*. An unreadable gate is the silent gate in
 * different clothes, so the map that knows everyone the home knows is the
 * one that answers.
 */
export function actorNamesOn(snapshot: CanvasSnapshotResponse): Map<string, string> {
  const names = new Map<string, string>(Object.entries(snapshot.names ?? {}));
  for (const actor of collectCanvasActors(snapshot.canvas)) {
    if (!names.has(actor.id)) names.set(actor.id, actorNameIn(snapshot.names, actor));
  }
  return names;
}

export function nameResolver(snapshot: CanvasSnapshotResponse): (actorId: string) => string | undefined {
  const names = actorNamesOn(snapshot);
  return (actorId) => names.get(actorId);
}

/** Optional thread, item, and non-owner standing context carried in a summons prompt. */
export interface SummonsContext {
  /** The full thread the summoning comment is in, including earlier comments. */
  thread?: {
    id: string;
    comments: Array<{ id: string; author: string; body: string }>;
  };
  /** The item the thread is anchored on, or the first changed item. */
  item?: {
    id: string;
    kind: string;
    title: string;
  };
  /** Present when the turn was woken by someone other than the machine's owner (#273). */
  wokenBy?: {
    asker: string;
    owner: string;
  };
  /**
   * Present when the ask that woke the turn comes after tries at one item
   * that all missed (core's `stuckOn`, proactive-agent phase 7): the agent
   * asks a question instead of making another take.
   */
  stuck?: {
    itemId: string;
    title: string;
    person: string;
    /** The question's address, `<item> · <ask>`. */
    at: string;
    facts: string[];
  };
}

/** The fixed brief around the wait-shaped payload (phase 4's door):
 * identical for fresh and loaded sessions — delivery differs, content
 * never does — with orientation and the guide pointer carrying the
 * cold-arrival weight instead of 15k inlined tokens, and the thread,
 * anchored item (`id`, `kind`, `title`) and non-owner standing (#273)
 * carried right in the summons so the first command of a turn can be
 * the edit. */
export const summonsPrompt = (
  canvasTitle: string,
  agentName: string,
  payload: { reason: string; entries: WatchedLogEntry[] },
  context?: SummonsContext,
): string => {
  const standing = context?.wokenBy
    ? `You were woken by ${context.wokenBy.asker}, who is not your owner. ` +
      `${context.wokenBy.owner}'s machine is running this turn and paying for it, ` +
      `and ${context.wokenBy.asker}'s grant covers replying on this thread. `
    : "";
  const fullPayload = {
    ...payload,
    ...(context?.item ? { item: context.item } : {}),
    ...(context?.thread ? { thread: context.thread } : {}),
    ...(context?.stuck ? { stuck: context.stuck } : {}),
  };
  const stuck = context?.stuck
    ? `The payload's \`stuck\` says your last tries at "${context.stuck.title}" all missed: do NOT make ` +
      `another take. Say you have been guessing and ask instead — \`isocan stuck ${context.stuck.itemId} --question …\` ` +
      `(\`isocan --agent-help proactive\`, "Stuck"). `
    : "";
  return (
    `You are ${agentName}, an agent enrolled on the isocan canvas "${canvasTitle}". ` +
    `This is a summons: activity addressed to you arrived while nothing was running for you. ` +
    standing +
    `Work from this directory through the \`isocan\` CLI — \`isocan --agent-help\` is the full ` +
    `protocol if you need orientation, and \`isocan comment reply <threadId> "…"\` answers a comment. ` +
    `For a designed screen, HTML node or connected app, run \`isocan design workflow\` for the shared ` +
    `procedure, canvas policy and existing work; precise edits and archive imports do not start a new interview. ` +
    stuck +
    `Address what the payload below carries, reply on its thread, and then simply finish your ` +
    `turn: do NOT run \`isocan wait\` — your session rests when you stop, and new activity ` +
    `summons you again.\n\n` +
    `The payload (the same shape \`isocan wait --json\` returns):\n` +
    JSON.stringify(fullPayload, null, 2)
  );
};

function clipStatus(text: string, max = 64): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const word = cut.lastIndexOf(" ");
  return `${(word >= max * 0.6 ? cut.slice(0, word) : cut).trimEnd()}…`;
}

/**
 * Turn a streaming thought buffer from ACP (`agent_thought_chunk`) into a
 * short, readable line for the live cursor chip (`💭 …`). Returns null until
 * there is a meaningful clause to show.
 */
export function formatThoughtStatus(buffer: string): string | null {
  const tail = buffer.slice(-500);
  const stripped = tail
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_~]/g, "")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "");
  const parts = stripped
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 12 && line.split(" ").length >= 3);
  const chosen = parts.at(-1);
  if (!chosen) return null;
  const bare = chosen.replace(/[.!?:;,]+$/, "").trim();
  if (!bare) return null;
  return `💭 ${clipStatus(bare, 64)}${bare.endsWith("…") ? "" : "…"}`;
}

/**
 * Turn a raw ACP tool title (`File .agents/skills/isocan-collab/SKILL.md`,
 * `Terminal isocan edit itm_abc …`) into a readable cursor status and any
 * referenced canvas item id.
 */
export function humanizeToolStatus(
  rawTitle: string,
  canvasItems?: Record<string, Item>,
): { status: string; itemId?: string } | null {
  const raw = rawTitle.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  let itemId: string | undefined;
  let item: Item | undefined;
  if (canvasItems) {
    for (const match of raw.matchAll(/\bitm_[a-zA-Z0-9_-]+\b/g)) {
      const candidate = match[0];
      if (canvasItems[candidate]) {
        itemId = candidate;
        item = canvasItems[candidate];
        break;
      }
    }
  }
  const itemLabel = item ? clipStatus(item.title || item.id, 28) : null;

  if (/(?:SKILL\.md|--agent-help|agent-guide\.md)/i.test(raw)) {
    return { status: "checking canvas guide…", ...(itemId ? { itemId } : {}) };
  }

  const cliMatch = raw.match(/\bisocan\s+(?:--[a-z-]+\s+)*([a-z-]+)/i);
  if (cliMatch) {
    const verb = cliMatch[1]!.toLowerCase();
    if (verb === "show" || verb === "get" || verb === "words") {
      return {
        status: itemLabel ? `looking at "${itemLabel}"…` : "reading canvas item…",
        ...(itemId ? { itemId } : {}),
      };
    }
    if (verb === "edit" || verb === "set" || verb === "mv" || verb === "resize" || verb === "face") {
      return {
        status: itemLabel ? `updating "${itemLabel}"…` : "updating canvas item…",
        ...(itemId ? { itemId } : {}),
      };
    }
    if (verb === "add" || verb === "new" || verb === "text" || verb === "draw") {
      return { status: "adding to the canvas…", ...(itemId ? { itemId } : {}) };
    }
    if (verb === "comment") {
      return { status: "writing a reply…", ...(itemId ? { itemId } : {}) };
    }
    if (verb === "ls" || verb === "list" || verb === "status" || verb === "summary") {
      return { status: "surveying the canvas…", ...(itemId ? { itemId } : {}) };
    }
  }

  const fileRead = raw.match(/^(?:File|Read|View|Cat)\s+(.+)$/i);
  if (fileRead) {
    const base = fileRead[1]!.trim().replace(/['"]/g, "").split(/[\\/]/).pop() ?? fileRead[1]!.trim();
    return { status: `reading ${clipStatus(base, 36)}…`, ...(itemId ? { itemId } : {}) };
  }

  const fileWrite = raw.match(/^(?:Write|Edit|Update|Patch)\s+(.+)$/i);
  if (fileWrite) {
    const base = fileWrite[1]!.trim().replace(/['"]/g, "").split(/[\\/]/).pop() ?? fileWrite[1]!.trim();
    return { status: `editing ${clipStatus(base, 36)}…`, ...(itemId ? { itemId } : {}) };
  }

  if (/^(?:Search|Grep|Find|Glob)\b/i.test(raw)) {
    return { status: "searching workspace…", ...(itemId ? { itemId } : {}) };
  }

  const cleaned = raw.replace(/^(?:Terminal|Bash|Run|Command):?\s*/i, "").trim();
  if (!cleaned) return null;
  if (itemLabel && itemId) {
    return { status: `working on "${itemLabel}"…`, itemId };
  }
  return { status: clipStatus(cleaned, 64) };
}

