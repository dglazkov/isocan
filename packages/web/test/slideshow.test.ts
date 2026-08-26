import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@isocan/core";
import { crossesCover } from "../src/lib/keys.ts";

/**
 * ⌘-arrows in full screen walk to the next screen, still full screen — a
 * slideshow steered by the same spatial rule the canvas walk uses.
 *
 * Two things can silently break it. The cover gate could start letting
 * ⌘-arrows through, so the canvas underneath ALSO jumps its selection and the
 * two walks fight over who is right. Or FullScreen could stop asking
 * findNextItem and grow its own idea of "next", which would drift from the
 * canvas walk until ⌘→ on the canvas and ⌘→ full screen disagree about the
 * same two items. So: the gate stays closed, and the wiring goes through the
 * one home.
 */

const source = readFileSync(
  fileURLToPath(new URL("../src/components/FullScreen.tsx", import.meta.url)),
  "utf8",
);

describe("the cover keeps ⌘-arrows for itself", () => {
  it("they do not cross to the canvas underneath", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      expect(crossesCover({ key, metaKey: true }), key).toBe(false);
      expect(crossesCover({ key, ctrlKey: true }), key).toBe(false);
    }
  });
});

describe("full screen answers them", () => {
  it("uses THE findNextItem, from its one home, not a restatement", () => {
    expect(source).toMatch(
      /import \{[^}]*\bfindNextItem\b[^}]*\} from "\.\.\/lib\/spatialnav\.ts"/,
    );
    expect(source).toContain("findNextItem(");
  });

  it("moves by navigation, so the address bar holds the screen you are on", () => {
    expect(source).toMatch(/navigate\(itemPath\(/);
  });

  it("keeps the selection and the camera underneath in step, for Esc", () => {
    expect(source).toContain(".select(next.id)");
    expect(source).toContain("revealItem(next.id)");
  });

  it("listens in capture phase, like Esc — framed content must not eat it", () => {
    expect(source).toMatch(/addEventListener\("keydown", onKey, true\)/);
  });

  it("leaves ⌘← alone while typing — that is start-of-line in a field", () => {
    expect(source).toMatch(/isTyping\(e\.target\)/);
  });
});

describe("the help panel tells the truth about it", () => {
  it("the ⌘-arrow entry says full screen walks too", () => {
    const entry = SHORTCUTS.find((s) => s.keys.includes("⌘←"));
    expect(entry).toBeDefined();
    expect(`${entry!.does} ${entry!.note ?? ""}`.toLowerCase()).toContain("full screen");
  });
});
