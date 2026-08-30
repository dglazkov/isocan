import { ago } from "./elapsed.ts";
import { type CanvasContents, type Item, mainThread } from "./model.ts";
import { designSystem } from "./designsystem.ts";

import { mapsOn } from "./mindmap.ts";
import { excludedItems, pinnedItems } from "./contextmark.ts";

/**
 * **What an agent will actually read when it starts work here.**
 *
 * Nobody can answer that today, including the agents. The answer is scattered
 * — the agent guide, the design system, the Chat, the bound directory, the
 * recap, the items themselves — and an agent assembles it by convention and
 * habit, differently every time, while the person cannot see what it
 * assembled.
 *
 * **This stores nothing.** It is a reading of what already exists, which is
 * why it comes first in the walk and why it is useful before anything else
 * lands. Every number here is counted from the canvas at the moment you ask;
 * there is no context record to keep in step with the thing it describes,
 * and therefore nothing that can go stale about the list itself.
 *
 * What CAN go stale is a piece — a design system older than the work it
 * governs — and saying so is the point. `stale` is a claim with a reason
 * attached, never a bare flag: "older than 6 of the screens it governs" is
 * actionable and "stale: true" is an accusation.
 */
export interface ContextPiece {
  /** What it is called, in the words the product uses. */
  name: string;
  /** Where it comes from — the canvas, this machine, the CLI itself. */
  source: "canvas" | "machine" | "cli";
  /** Present, or absent with a reason. */
  present: boolean;
  /** How much of it there is, in whatever unit suits it. */
  size?: string;
  /** When it last changed, ISO, where the canvas knows. */
  updatedAt?: string;
  /** Why this piece needs attention, in a sentence. Absent when it is fine. */
  stale?: string;
  /** What to do about it, when there is something. */
  fix?: string;
}

/** Facts only the machine running the CLI can know. The web has none of them,
 *  which is why they are passed in rather than read. */
export interface ContextExtras {
  /** The directory bound to this canvas here, if any. */
  directory?: string | null;
  /** How many entries the oplog holds, for the recap's resolution. */
  ops?: number;
  /** The guide this build ships, so an agent can see which one it read. */
  guideVersion?: string;
  /** Findings from `design check`, so the view can say whether it passes. */
  designProblems?: number;
}

/** Items somebody marked — the closest thing the canvas has to "these
 *  matter", and a real signal because a person put it there by hand. */
export function markedItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items).filter(
    (item) => Object.keys(item.reactions ?? {}).length > 0,
  );
}

export function contextPieces(
  canvas: CanvasContents,
  extras: ContextExtras = {},
  nowMs: number = Date.now(),
): ContextPiece[] {
  const pieces: ContextPiece[] = [];
  const items = Object.values(canvas.items);

  const design = designSystem(canvas);
  if (design) {
    /**
     * **Stale means older than the work it governs**, and that is a fact
     * about the canvas rather than about the clock. A design system written
     * last year and untouched since is perfectly current if nothing has been
     * designed since; one written this morning is out of date if six screens
     * landed after it.
     */
    const newer = items.filter(
      (item) => item.id !== design.id && item.updatedAt > design.updatedAt,
    ).length;
    pieces.push({
      name: "Design system",
      source: "canvas",
      present: true,
      size: `v${design.versions.length}`,
      updatedAt: design.updatedAt,
      ...(newer >= 3
        ? {
            stale: `${newer} items have changed since it was last written`,
            fix: "`isocan design set` after a look, or `/design-system` to derive one",
          }
        : {}),
      ...(extras.designProblems
        ? {
            stale: `${extras.designProblems} finding${extras.designProblems === 1 ? "" : "s"} from \`design check\``,
            fix: "`isocan design check` lists them",
          }
        : {}),
    });
  } else {
    pieces.push({
      name: "Design system",
      source: "canvas",
      present: false,
      stale: items.length >= 2 ? "screens here, and nothing says what they should look like" : undefined,
      fix: "`/design-system` derives one from what these screens already do",
    } as ContextPiece);
  }

  const chat = mainThread(canvas);
  pieces.push({
    name: "The Chat",
    source: "canvas",
    present: chat !== null,
    ...(chat
      ? {
          size: `${chat.comments.length} message${chat.comments.length === 1 ? "" : "s"}`,
          updatedAt: chat.comments[chat.comments.length - 1]?.createdAt ?? chat.createdAt,
        }
      : {}),
  });

  /**
   * **Pinned and marked are different acts, and are listed separately.**
   *
   * A reaction is a response to a thing; a pin is a decision about what an
   * agent should read. Stage 1 used reactions as the stand-in for pins because
   * nothing else existed — collapsing them now that both do would lose exactly
   * the distinction stage 2 was asked for.
   */
  const pinned = pinnedItems(canvas);
  pieces.push({
    name: "Pinned items",
    source: "canvas",
    present: pinned.length > 0,
    ...(pinned.length > 0
      ? { size: pinned.map((item) => item.title).join(", ") }
      : { fix: "`isocan context pin <item>` to say what an agent should read first" }),
  });

  const marked = markedItems(canvas);
  pieces.push({
    name: "Marked items",
    source: "canvas",
    present: marked.length > 0,
    ...(marked.length > 0 ? { size: `${marked.length}` } : {}),
  });

  /**
   * Only when there are any. An "Excluded items: 0" row on every canvas is a
   * line that has never once been news, and this view is read every session.
   */
  const excluded = excludedItems(canvas);
  if (excluded.length > 0) {
    pieces.push({
      name: "Excluded items",
      source: "canvas",
      present: true,
      size: excluded.map((item) => item.title).join(", "),
    });
  }

  const maps = mapsOn(canvas);
  if (maps.length > 0) {
    pieces.push({
      name: "Mind maps",
      source: "canvas",
      present: true,
      size: maps.map((m) => `${m.title} (${m.nodes})`).join(", "),
    });
  }

  pieces.push({
    name: "The canvas",
    source: "canvas",
    present: items.length > 0,
    size: `${items.length} item${items.length === 1 ? "" : "s"}`,
    ...(items.length > 0
      ? {
          updatedAt: items.reduce((latest, item) =>
            item.updatedAt > latest ? item.updatedAt : latest, items[0]!.updatedAt),
        }
      : {}),
  });

  if (extras.directory !== undefined) {
    pieces.push({
      name: "Bound directory",
      source: "machine",
      present: extras.directory !== null,
      ...(extras.directory ? { size: extras.directory } : {}),
      ...(extras.directory === null
        ? { fix: "`isocan use <canvas>` binds this canvas to the directory you are in" }
        : {}),
    });
  }

  if (extras.ops !== undefined) {
    pieces.push({
      name: "History",
      source: "canvas",
      present: extras.ops > 0,
      size: `${extras.ops} operation${extras.ops === 1 ? "" : "s"}`,
    });
  }

  if (extras.guideVersion !== undefined) {
    pieces.push({
      name: "Agent guide",
      source: "cli",
      present: true,
      size: extras.guideVersion,
    });
  }

  return pieces;
}

/** The list as a terminal prints it — one line a piece, and the reasons under
 *  the pieces that have them. */
export function contextReport(pieces: ContextPiece[], nowMs: number = Date.now()): string {
  const lines: string[] = [];
  const width = Math.max(...pieces.map((p) => p.name.length)) + 2;
  for (const piece of pieces) {
    const mark = piece.present ? (piece.stale ? "!" : " ") : "·";
    const when = piece.updatedAt ? ` · ${ago(piece.updatedAt, nowMs)}` : "";
    const size = piece.present ? (piece.size ?? "yes") : "not here";
    lines.push(`${mark} ${piece.name.padEnd(width)}${size}${when}`);
    if (piece.stale) lines.push(`  ${" ".repeat(width)}${piece.stale}`);
    if (piece.fix && (piece.stale || !piece.present)) {
      lines.push(`  ${" ".repeat(width)}→ ${piece.fix}`);
    }
  }
  return lines.join("\n");
}
