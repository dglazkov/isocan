import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DEFAULT_COMMANDS } from "@isocan/core";
import { ACTIONS, availableActions } from "../src/lib/actions.ts";
import { rules, withoutComments } from "./cssrules.ts";

/**
 * **⌘K reaches everything, and the two vocabularies stay apart.**
 *
 * An ACTION is something the app does the moment you choose it — fit the
 * screen, arm the Pen, open the Chat. A SLASH COMMAND is a MESSAGE: `/format`
 * posts a comment and an agent carries it out, which is exactly why the same
 * words work from a terminal.
 *
 * Folding either into the other breaks something true. `/fit-to-screen` would
 * be a message asking somebody else to move your own viewport. An "action"
 * that quietly posted a comment would be a menu item that answers in four
 * minutes. So they are two lists, shown in that order, and the second says out
 * loud that it posts.
 */
const src = readFileSync(
  fileURLToPath(new URL("../src/components/CommandPalette.tsx", import.meta.url)),
  "utf8",
);
const bare = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\/.*$/gm, "");

const ctx = (over: Partial<Parameters<typeof availableActions>[0]> = {}) => ({
  canvasId: "prj_1",
  actor: { id: "usr_1", name: "Di" },
  navigate: (() => {}) as never,
  selection: [] as string[],
  ...over,
});

describe("the actions the app does itself", () => {
  it("are not slash commands, and do not pretend to be", () => {
    /* The names must not collide: two things called "format" that do
       different things (one now, one in four minutes) is the confusion this
       separation exists to prevent. Actions may REFERENCE a command's work —
       "Format: grid" runs the same core function — but they are not entries
       in the message vocabulary. */
    const slashNames = new Set(DEFAULT_COMMANDS.map((c) => c.name));
    for (const action of ACTIONS) {
      expect(slashNames.has(action.id), action.id).toBe(false);
    }
  });

  it("each say what they are for", () => {
    for (const action of ACTIONS) {
      expect(action.name.length, action.id).toBeGreaterThan(2);
      expect(action.group, action.id).toBeTruthy();
    }
  });

  it("offer nothing that cannot be done right now", () => {
    /* A menu that lies is worse than a short menu. Zooming to a selection
       with nothing selected does nothing, and offering it teaches somebody
       that the palette does not work. */
    const empty = availableActions(ctx());
    expect(empty.some((a) => a.id === "zoom-selection")).toBe(false);
    const chosen = availableActions(ctx({ selection: ["itm_1"] }));
    expect(chosen.some((a) => a.id === "zoom-selection")).toBe(true);
  });

  it("offer nothing canvas-shaped when there is no canvas", () => {
    const home = availableActions(ctx({ canvasId: null }));
    expect(home.some((a) => a.id === "fit")).toBe(false);
    // But the ones that still mean something are there.
    expect(home.some((a) => a.id === "open-lens")).toBe(true);
  });

  it("show the keystroke rather than binding a second one", () => {
    /* Teaching the shortcut is most of what a launcher is for, and a binding
       here would be a second answer to one key. */
    expect(ACTIONS.some((a) => a.keys)).toBe(true);
    expect(bare).not.toMatch(/addEventListener\("keydown"/);
  });
});

describe("the launcher", () => {
  it("reads the commands everything else reads", () => {
    /* `useCommands` is what `/help` and every composer use, including the
       commands a canvas defines for itself. A private list here would be a
       palette that drifts from what typing `/` offers. */
    expect(bare).toContain("useCommands()");
    expect(bare).not.toMatch(/DEFAULT_COMMANDS/);
  });

  it("hands a command over instead of posting it", () => {
    /* Most take an argument — `/variation 3 layouts` is a different request
       from `/variation` — so sending the bare word would guess at the half
       nobody has typed. */
    expect(bare).toContain("setPendingChat");
    expect(bare).not.toMatch(/postToMain|sendEchoed/);
  });

  it("matches every term, in any order", () => {
    /* "op ch" finds "Open Chat". A fuzzy matcher that scores letters anywhere
       is how a palette starts offering "Delete everything" for "de". */
    expect(bare).toMatch(/terms\.every/);
  });

  it("says which rows post a message", () => {
    expect(bare).toContain("posts a message");
  });

  it("keeps one highlight, moved by the keyboard", () => {
    /* Two highlights on one list is a list that cannot say which row Enter
       will take, so the pointer sets the keyboard's index rather than
       painting its own. */
    expect(bare).toContain("onPointerEnter");
    const sheet = rules(withoutComments());
    expect(sheet.some((r) => r.selector === ".palette-row.at")).toBe(true);
    expect(sheet.some((r) => r.selector.includes(".palette-row:hover"))).toBe(false);
  });
});
