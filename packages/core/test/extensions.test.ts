import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMANDS,
  EXTENSION_ICONS,
  LABEL_LIMIT,
  TOOL_ROLE,
  isToolExtension,
  readToolExtension,
  toolCapabilities,
  toolExtensionItems,
  toolProperties,
  type Item,
  type SlashCommand,
} from "../src/index.ts";

/**
 * Stage 1 of `docs/projects/extensions/design.md`, held to the sentence the
 * whole design turns on:
 *
 * > **An extension may only ask for what a person could ask for.**
 *
 * Every refusal below is that sentence applied, and the tests are written
 * against the RULE rather than against the message, so rewording a refusal
 * does not redden the suite and weakening one does.
 */

const commands: SlashCommand[] = DEFAULT_COMMANDS;
const read = (o: unknown) => readToolExtension(JSON.stringify(o), commands);
const tidy = { kind: "tool", label: "Tidy", icon: "broom", does: "/format" };

describe("a declarative tool", () => {
  it("is the design's own example, and it reads", () => {
    // Straight out of the design doc. If this ever stops working the doc is
    // lying to whoever reads it first.
    const { tool, problem } = read(tidy);
    expect(problem).toBeUndefined();
    expect(tool).toEqual({ kind: "tool", label: "Tidy", icon: "broom", does: "/format" });
  });

  it("keeps the words after the command, because a person could type those too", () => {
    const { tool } = read({ ...tidy, does: "/format tighten the rows" });
    expect(tool?.does).toBe("/format tighten the rows");
  });

  it("is an item, found by one property", () => {
    expect(toolProperties()).toEqual({ role: TOOL_ROLE });
    expect(isToolExtension(item("a", { role: "tool" }))).toBe(true);
    expect(isToolExtension(item("b", { role: "design-system" })).valueOf()).toBe(false);
    expect(isToolExtension(item("c", {}))).toBe(false);
  });

  it("lists oldest first, so the rail does not reshuffle when one is edited", () => {
    const canvas = {
      items: {
        b: { ...item("b", { role: "tool" }), createdAt: "2026-09-02T00:00:00Z" },
        a: { ...item("a", { role: "tool" }), createdAt: "2026-09-01T00:00:00Z" },
        plain: item("plain", {}),
      },
    };
    expect(toolExtensionItems(canvas as never).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("what a tool may not be", () => {
  it("refuses a command this canvas does not have — the rule, stated", () => {
    // The sentence itself: a tool naming `/deploy` is asking for something no
    // person on this canvas could ask for either.
    const { tool, problem } = read({ ...tidy, does: "/deploy" });
    expect(tool).toBeUndefined();
    expect(problem).toContain("/deploy");
  });

  it("refuses an icon of its own", () => {
    /**
     * A security rule, not a style one: an icon is a place somebody would
     * otherwise paint anything at all, including a convincing copy of a
     * control that already exists.
     */
    for (const icon of ["<svg/>", "https://example.com/i.png", "data:image/png;base64,AA", "padlock"]) {
      expect(read({ ...tidy, icon }).tool, `icon ${icon} was accepted`).toBeUndefined();
    }
    for (const icon of EXTENSION_ICONS) expect(read({ ...tidy, icon }).tool).toBeDefined();
  });

  it("refuses to wear the app's own name, however it is spelled", () => {
    /**
     * From *it must look like an extension*: a control that looks exactly like
     * isocan is a place to put a convincing "sign in to continue". A check
     * that only catches the exact string is a check that catches nobody who is
     * actually trying, so the comparison ignores case and punctuation.
     */
    for (const label of ["Comment", "comment", "C O M M E N T", "isocan", "Add", "-add-"]) {
      expect(read({ ...tidy, label }).tool, `label "${label}" was accepted`).toBeUndefined();
    }
    // And does not over-reach: a word that merely contains one is fine.
    expect(read({ ...tidy, label: "Commentary" }).tool).toBeDefined();
  });

  it("refuses a label too long for a rail, and one with no words at all", () => {
    expect(read({ ...tidy, label: "x".repeat(LABEL_LIMIT) }).tool).toBeDefined();
    expect(read({ ...tidy, label: "x".repeat(LABEL_LIMIT + 1) }).tool).toBeUndefined();
    expect(read({ ...tidy, label: "   " }).tool).toBeUndefined();
    expect(read({ ...tidy, label: 12 }).tool).toBeUndefined();
  });

  it("refuses a panel, because panels are stage 3 and not built", () => {
    // Named rather than ignored: a manifest that quietly does nothing is worse
    // than one that says which stage it is waiting for.
    const { problem } = read({ ...tidy, kind: "panel" });
    expect(problem).toContain("stage 3");
  });

  it("says which line to fix rather than 'invalid manifest'", () => {
    // A refusal is read by whoever wrote the file, so it names the field.
    expect(readToolExtension("{", commands).problem).toContain("JSON");
    expect(readToolExtension("[]", commands).problem).toContain("list");
    expect(read({ label: "Tidy", icon: "broom", does: "/format" }).problem).toContain("kind");
    expect(read({ kind: "tool", icon: "broom", does: "/format" }).problem).toContain("label");
    expect(read({ kind: "tool", label: "Tidy", icon: "broom" }).problem).toContain("does");
    expect(read({ ...tidy, does: "format" }).problem).toContain("slash command");
  });
});

describe("the capability list, before you keep it", () => {
  /**
   * Stage 2, deliberately built at stage 1 for the reason the design gives:
   * *the habit has to exist before the tier that depends on it.*
   */
  it("is derived, never declared", () => {
    // A manifest that stated its own capabilities could understate them.
    const { tool } = read({ ...tidy, does: "/format tighten the rows" });
    const said = toolCapabilities(tool!, commands).join("\n");
    expect(said).toContain("posts a comment as you");
    expect(said, "the words it always sends are part of what it can do").toContain("tighten the rows");
    expect(said).toContain("undoable per actor");
  });

  it("tells apart a command answered in the app from one an agent carries out", () => {
    const local = commands.find((c) => c.local);
    expect(local, "no local built-in to check against").toBeTruthy();
    const { tool } = read({ ...tidy, does: `/${local!.name}` });
    const said = toolCapabilities(tool!, commands).join("\n");
    expect(said).toContain("answers in the app");
    expect(said).not.toContain("posts a comment as you");
  });

  it("says a tool is unavailable rather than pretending it works", () => {
    /**
     * The design's own open question — *what happens to a canvas whose
     * extension is gone?* — in miniature: a tool read while its home command
     * existed, asked about after it went away.
     */
    const { tool } = read(tidy);
    const said = toolCapabilities(tool!, []).join("\n");
    expect(said).toContain("does not have");
  });
});

function item(id: string, properties: Record<string, string>): Item {
  return {
    id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    title: `${id}.json`,
    description: "",
    properties,
    createdAt: "2026-09-06T00:00:00Z",
    updatedAt: "2026-09-06T00:00:00Z",
  } as Item;
}
