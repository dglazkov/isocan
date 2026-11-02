import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@isocan/core";
import { crossesCover } from "../src/lib/keys.ts";
import { FLIP_NEXT, FLIP_PREV } from "../src/lib/deckflip.ts";
import { loadedWith } from "./cssrules.ts";

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

/**
 * The deck (#87): bare arrows flip through the items marked as slides, in
 * reading order — or everything, with none marked. Linear where ⌘-arrows are
 * spatial, and decided in core (`deckStep`), so `isocan slides` and this walk
 * cannot disagree about the same deck.
 */
describe("bare arrows flip the deck", () => {
  it("the cover keeps them from the canvas underneath", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
      expect(crossesCover({ key }), key).toBe(false);
    }
  });

  it("asks core which slide is next, not its own idea of the deck", () => {
    expect(source).toMatch(/import \{[^}]*\bdeckStep\b[^}]*\} from "@isocan\/core"/);
    expect(source).toContain("deckStep(canvas, itemId");
  });

  it("answers a clicker too — Page Up/Down flip", () => {
    // The keys live in `deckflip.ts` beside the flip itself, so full screen
    // and the viewer read one set (cleanup DU-1, 27 Sep 2026: the viewer's
    // was a copy "kept in step" by nothing). Ask the set, and that both read it.
    expect(FLIP_NEXT.has("PageDown")).toBe(true);
    expect(FLIP_PREV.has("PageUp")).toBe(true);
    for (const face of ["FullScreen.tsx", "Viewer.tsx"]) {
      const text = readFileSync(fileURLToPath(new URL(`../src/components/${face}`, import.meta.url)), "utf8");
      expect(text, face).toMatch(/import \{[^}]*\bFLIP_NEXT\b[^}]*\} from "\.\.\/lib\/deckflip\.ts"/);
      expect(text, `${face} spells the keys again`).not.toContain('"PageDown"');
    }
  });

  it("leaves arrows alone while typing — that is the caret's business", () => {
    // The flip branch must carry its own isTyping guard, not borrow the
    // ⌘-branch's: each returns before the other runs.
    const flip = source.slice(source.indexOf("FLIP_NEXT.has(e.key) || FLIP_PREV.has(e.key)"));
    expect(flip.slice(0, 400)).toMatch(/isTyping\(e\.target\)/);
  });

  it("is registered in the help panel", () => {
    const entry = SHORTCUTS.find((s) => s.does === "Flip through the slides");
    expect(entry).toBeDefined();
    expect(entry!.note!.toLowerCase()).toContain("full screen");
  });
});

/**
 * **The menu entry works on a selection**, which is how a deck is actually
 * made: ten screens in one gesture, not ten gestures. It used to be
 * `disabled: many`, so the app could not do what `isocan slides add
 * <items...>` had done since it shipped.
 */
describe("marking a selection as slides", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../src/lib/menuentries.tsx", import.meta.url)),
    "utf8",
  );
  const entry = src.slice(src.indexOf("label: slideLabel(items)"));
  const body = entry.slice(0, entry.indexOf("{ separator:"));

  it("is not disabled for a multi-selection any more", () => {
    expect(body).not.toContain("disabled: many");
  });

  it("asks core which way to go, rather than deciding again here", () => {
    // The one fold: if the app decided for itself, it could disagree with
    // `isocan slides add` about what a mixed selection means.
    expect(body).toContain("slideIntent(items)");
  });

  it("is one undo for the whole gesture", () => {
    // Ten ops with no group is ten presses of ⌘Z to take back one act.
    expect(body).toContain("newGroupId()");
    expect(body).toContain("group,");
  });

  it("writes only for the items that actually move", () => {
    expect(body).toContain("for (const item of changing)");
    expect(body).toContain("if (changing.length === 0) return;");
  });
});

/**
 * **Full screen draws none of the stage's chrome.**
 *
 * It used to rest: the pane bar ("Saved — v6", the walk arrows, "Edit text")
 * faded with `.fs-bar` after a few still seconds, keeping its strip so the
 * slide would not grow under a still mouse. Then the header became a floating
 * pill and the bar sat UNDER it — covered, and still taking the slide's top
 * strip (19 Oct 2026). Full screen is the presenting surface and never offers
 * the editor, so it gets the bare stage, exactly as a hosted canvas always did.
 */
describe("full screen gives the slide the whole stage", () => {
  // The stage's rules ship with it (`artifact-stage.css`) since 27 Sep 2026.
  const css = loadedWith("artifact-stage.css");
  const fs = readFileSync(
    fileURLToPath(new URL("../src/components/FullScreen.tsx", import.meta.url)),
    "utf8",
  );
  const stage = readFileSync(
    fileURLToPath(new URL("../src/components/ArtifactStage.tsx", import.meta.url)),
    "utf8",
  );

  it("returns the bare stage for full screen before any pane is built", () => {
    expect(stage).toContain('if (surface === "fullscreen" || !editable ||');
    // Below that return there is no full-screen branch left to drift.
    const marker = 'if (surface === "fullscreen" || !editable ||';
    const afterReturn = stage.slice(stage.indexOf(marker) + marker.length);
    expect(afterReturn).not.toMatch(/surface [!=]== "fullscreen"/);
  });

  it("keeps no rules for chrome it no longer draws", () => {
    expect(css).not.toContain(".fullscreen.resting .stage-pane-bar");
    expect(css).not.toContain(".fullscreen .stage-preview-pane");
    expect(css).not.toContain(".fullscreen .stage-rail");
  });

  it("does not lean on `:has()` for the typing exception", () => {
    /**
     * `:has(.stage-editor:focus-within)` parses, and `Element.matches()`
     * agrees it matches — and the style engine does not apply it. Measured in
     * a browser, not assumed. Somebody typing must not watch the toolbar
     * above their own text fade, so that fact lives in the wake instead.
     */
    expect(css).not.toContain(":has(.stage-editor:focus-within)");
    expect(fs).toContain("if (isTyping(event.target)) wake();");
    expect(fs).toContain('window.addEventListener("keydown", typingWake)');
  });
});
