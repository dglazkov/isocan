/** Board authoring templates. Reading the sprint clock does not need the setup copy. */
import type { CanvasContents, Item } from "./model.ts";
import { boardAreaFor, type BoardArea, type BoardKey } from "./sprint.ts";

/** Between sheets, in world units. */
export const BOARD_GAP = 200;

/** The board, sheet by sheet, in the order the week walks it — left to right. */
export const SPRINT_BOARD: readonly BoardArea[] = [
  {
    key: "brief",
    title: "Brief",
    tint: "grey",
    width: 1200,
    height: 900,
    card: "**What we are designing, and who decides.**\n\nThe goal in a sentence, the two or three questions the week has to answer, the Decider, the sketchers, the cut. Done before the first bell — react ✅ on the brief when it is right.",
  },
  {
    key: "map",
    title: "Map",
    tint: "blue",
    width: 2400,
    height: 1400,
    card: "**Monday · Map · 45 min.**\n\nThe customer's path in 5–15 steps, actors on the left, the ending on the right. Say the steps; the facilitator draws them. Drag a node and the arrows follow.",
  },
  {
    key: "experts",
    title: "Experts & HMW",
    tint: "yellow",
    width: 2000,
    height: 1400,
    card: "**Monday · Ask the Experts, then How Might We · 10 min.**\n\nInterviews pin here, one thread each. While listening, write *How might we…* on yellow notes — one idea per note, silently. **New note** on the clock chip puts one here.",
  },
  {
    key: "target",
    title: "Target",
    tint: "pink",
    width: 1200,
    height: 900,
    card: "**Monday · Pick a target.**\n\nTwo ⭐ each on the HMW notes, silently. Then the Decider's 🎯 on one step of the map — that step and its notes come here. One thing on this sheet.",
  },
  {
    key: "demos",
    title: "Demos",
    tint: "blue",
    width: 1600,
    height: 1000,
    card: "**Tuesday · Lightning Demos · 3 min each.**\n\nA site worth stealing from, as an item, with one pink note under it saying what to steal.",
  },
  {
    key: "sketches",
    title: "Sketches",
    tint: "yellow",
    width: 2400,
    height: 1400,
    card: "**Tuesday · Notes, Ideas, Crazy 8s, Solution sketch.**\n\nWork alone, on your desk — nothing lands here until the bell. Then **Hand in**: one solution sketch each, three panels, a title that says the idea. The wall arrives together.",
  },
  {
    key: "vote",
    title: "Vote",
    tint: "pink",
    width: 2400,
    height: 1400,
    card: "**Wednesday · Museum, Heat Map, Critique, Straw Poll, Supervote.**\n\nWalk the wall in silence. 🔴 on the parts you like, as many as you want. Three minutes of critique per sketch, the author last. One ⭐ each. The Decider's 🏆 decides. Votes are hidden until the bell.",
  },
  {
    key: "storyboard",
    title: "Storyboard",
    tint: "grey",
    width: 3200,
    height: 900,
    card: "**Wednesday · Storyboard · 60 min.**\n\nFifteen frames in a row. Move the winning sketches in; a missing frame is a yellow note saying what goes there. The row is the deck.",
  },
  {
    key: "prototype",
    title: "Prototype",
    tint: "green",
    width: 2400,
    height: 1400,
    card: "**Thursday · Prototype.**\n\nA façade, frame by frame: one maker per stretch of frames, named in the Chat first; a Stitcher owns consistency. Each frame lands here as a screen. The trial run is the deck full screen.",
  },
  {
    key: "test",
    title: "Test",
    tint: "blue",
    width: 3200,
    height: 1400,
    card: "**Friday · Test · five people.**\n\nRows are people, columns are frames. One note per cell, from what was said — never invented. A pattern needs three of five.",
  },
  {
    key: "wrap",
    title: "Wrap",
    tint: "grey",
    width: 1200,
    height: 900,
    card: "**Friday · Wrap-up · 30 min.**\n\nQuote Monday's questions and answer each with a # to the thing that answers it. `isocan recap` writes the page. The board stays: it is the record.",
  },
];

/** One sheet's template by key. Every `BoardKey` has one, so this never misses. */
export function boardArea(key: BoardKey): BoardArea {
  return SPRINT_BOARD.find((one) => one.key === key)!;
}

/**
 * Where each sheet goes: one row from `origin`, top-aligned, a gap between.
 * Pure, so the CLI's `sprint board` and a test agree to the pixel.
 */
export function boardLayout(origin: { x: number; y: number }): (BoardArea & { x: number; y: number })[] {
  let x = origin.x;
  return SPRINT_BOARD.map((one) => {
    const placed = { ...one, x, y: origin.y };
    x += one.width + BOARD_GAP;
    return placed;
  });
}

/** Every sheet of the board that exists here, in board order. */
export function boardOf(canvas: CanvasContents): Item[] {
  return SPRINT_BOARD.map((one) => boardAreaFor(canvas, one.key)).filter((one): one is Item => one !== null);
}



/**
 * **The brief, as a card.** What the setup round answered, written once as
 * markdown the Brief sheet holds — a text node wearing `brief=1` so the
 * facilitator can find it again and write the next version rather than a
 * second card. Empty fields are left out, not written as "TBD": a brief
 * that says less is honest, and the next version fills it.
 */
export const BRIEF_PROP = "brief";

/** What a brief says. Every field optional: a brief that says less is honest. */
export interface Brief {
  goal?: string;
  questions?: string[];
  decider?: string;
  sketchers?: string[];
  cut?: string;
}

/**
 * The brief as the markdown its card shows — empty fields left out rather than written as TBD.
 */
export function briefCard(brief: Brief): string {
  const lines: string[] = ["# Brief", ""];
  if (brief.goal) lines.push(`**Goal.** ${brief.goal}`, "");
  if (brief.questions && brief.questions.length > 0) {
    lines.push("**Sprint questions.**");
    for (const q of brief.questions) lines.push(`- ${q}`);
    lines.push("");
  }
  if (brief.decider) lines.push(`**Decider.** ${brief.decider}`, "");
  if (brief.sketchers && brief.sketchers.length > 0) lines.push(`**Sketching.** ${brief.sketchers.join(", ")}`, "");
  if (brief.cut) lines.push(`**Cut.** ${brief.cut}`, "");
  return lines.join("\n").trimEnd() + "\n";
}

/** The brief card on this canvas, or null. */
export function briefItem(canvas: CanvasContents): Item | null {
  return Object.values(canvas.items).find((item) => item.properties[BRIEF_PROP] === "1") ?? null;
}

/** What a desk is called: the sketcher's name, possessive. */
export function deskTitle(name: string): string {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}' desk` : `${trimmed}'s desk`;
}
