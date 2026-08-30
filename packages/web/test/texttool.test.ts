import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { TEXT_COLUMN, TEXT_COLUMN_MAX, TEXT_FACES, TEXT_STYLES } from "@isocan/core";

/**
 * **Four things the Text tool got wrong, all reported together.**
 *
 * The box wrapped instead of growing; the tool dropped back to Select the
 * instant it was used; the step you chose was forgotten on every reload; and
 * ⌘Enter appeared to do nothing.
 *
 * The fourth turned out not to live here at all — `addTextNode` posts with
 * `sendOp`, which has NO local echo, so the text only appears when the home's
 * broadcast arrives. On a silently-dead socket the node was created and the
 * tab never learned, which is why a reload revealed it. That is the connection
 * bug, fixed separately; it is written here because the next person to read
 * "⌘Enter does nothing" should not start by looking at this keydown handler.
 */
const source = (p: string) =>
  readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the composer grows to the right before it wraps", () => {
  it("has a hard limit past the readable column", () => {
    /* `TEXT_COLUMN` is where prose SHOULD wrap; `TEXT_COLUMN_MAX` is where it
       MUST. Wrapping a title because it passed the column is a box that was
       too small, not typography. */
    for (const style of TEXT_STYLES) {
      expect(TEXT_COLUMN_MAX[style]).toBeGreaterThan(TEXT_COLUMN[style]);
    }
  });

  it("measures and wraps against the same number", () => {
    /* The mirror's `maxWidth` is what the words wrap at and the clamp is what
       commits. If they disagreed, the box would commit a width the words were
       never laid out in — which is the bug the mirror exists to prevent. */
    const composer = source("../src/components/TextComposer.tsx");
    expect(composer).toContain("Math.min(TEXT_COLUMN_MAX[style], width)");
    expect(composer).toContain("maxWidth: TEXT_COLUMN_MAX[style]");
  });
});

describe("the tool stays on", () => {
  it("does not drop back to Select when a composer opens", () => {
    /* Labelling six clusters is the job; reaching for the tool between every
       one was the cost. The commit-then-open composition is what makes staying
       in the tool work — see the comment at the press handler. */
    const viewport = source("../src/components/CanvasViewport.tsx");
    const textBranch = viewport.slice(
      viewport.indexOf('activeTool === "text"'),
      viewport.indexOf('activeTool === "text"') + 700,
    );
    expect(textBranch).toContain("setPendingText");
    expect(textBranch).not.toContain('setActiveTool("select")');
  });
});

describe("the step and face are remembered across reloads", () => {
  const ui = source("../src/stores/uiStore.ts");

  it("reads them from storage rather than starting at the default", () => {
    /* They were remembered in memory already, which is indistinguishable from
       not remembering them for anybody who reloads. */
    expect(ui).toContain("lastTextStyle: readTextStyle()");
    expect(ui).toContain("lastTextFace: readTextFace()");
  });

  it("writes them when they change", () => {
    expect(ui).toMatch(/setLastText:[\s\S]{0,200}writeText\(/);
  });

  it("validates what comes back against the closed sets", () => {
    /* A hand-edited or stale key must not open the composer at a step that no
       longer exists. The sets are the source; a second list here would be the
       thing that goes stale. */
    expect(ui).toContain("TEXT_STYLES.includes(");
    expect(ui).toContain("TEXT_FACES.includes(");
    expect(TEXT_STYLES.length).toBeGreaterThan(1);
    expect(TEXT_FACES.length).toBeGreaterThan(1);
  });

  it("survives a browser that refuses storage", () => {
    /* Private windows and blocked site data throw on access. A tool that
       cannot remember a preference must still be a tool. */
    expect(ui).toMatch(/function readTextStyle[\s\S]{0,300}catch/);
    expect(ui).toMatch(/function writeText[\s\S]{0,300}catch/);
  });
});
