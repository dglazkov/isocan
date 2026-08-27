import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { textCommit } from "../src/lib/text.ts";
import { rules, selectorsOf, withoutComments } from "./cssrules.ts";

/**
 * **The Text tool's two halves that a screenshot cannot hold onto.**
 *
 * Everything else about this tool was checked by using it — click the canvas,
 * type, click away, watch it land, watch `isocan ls` name it. What that leaves
 * behind is exactly the two things nobody will re-check by hand next month:
 * the rules a composer closes by, and the fact that a text node wears no card.
 */

describe("what closing a composer means", () => {
  it("leaves nothing behind when nothing was typed", () => {
    // Picking up the tool and thinking better of it is the commonest thing
    // anyone will do with it.
    expect(textCommit("", "", false)).toEqual({ do: "nothing", why: "empty" });
    expect(textCommit("   \n  ", "", false)).toEqual({ do: "nothing", why: "empty" });
  });

  it("does not turn emptying an existing note into a delete", () => {
    // Select-all-backspace-click-away is a slip, and it must not be the one
    // gesture that silently removes an item from a shared canvas. The words
    // stay; deleting is a delete.
    expect(textCommit("", "still here", true)).toEqual({ do: "nothing", why: "empty" });
  });

  it("does not push a version for words that did not change", () => {
    // Double-clicking a note to read it, then clicking away, is a read. If
    // that stacked a version, the version stack would stop meaning "somebody
    // changed this" within a day of shipping.
    expect(textCommit("ship on friday", "ship on friday", true)).toEqual({
      do: "nothing",
      why: "unchanged",
    });
    // Trailing whitespace is not a change either — the commit trims, so an
    // unchanged body must compare trimmed as well.
    expect(textCommit("ship on friday\n", "  ship on friday", true)).toEqual({
      do: "nothing",
      why: "unchanged",
    });
  });

  it("creates when there was no item, revises when there was", () => {
    expect(textCommit(" hello ", "", false)).toEqual({ do: "create", body: "hello" });
    expect(textCommit("hello", "goodbye", true)).toEqual({ do: "revise", body: "hello" });
  });
});

describe("a text node wears no card", () => {
  const bare = withoutComments();
  const all = rules(bare);
  const forSelector = (want: string) =>
    all.filter((r) => selectorsOf(r).some((s) => s.trim() === want));

  it("makes the item itself transparent", () => {
    const decls = forSelector(".item.textnode")
      .map((r) => r.body)
      .join(";");
    expect(decls, ".item.textnode must exist").not.toBe("");
    expect(decls).toMatch(/background:\s*transparent/);
    expect(decls).toMatch(/box-shadow:\s*none/);
  });

  /**
   * The regression this file exists for.
   *
   * The first wording of a note looked right; the SECOND brought a white card
   * back, because a second version makes the item grow a "ply" — the sheet of
   * paper peeking out from under it that means "there is more here". Ink had
   * already hit this and fixed it for itself, which is exactly why nobody
   * looking at the text rules would have noticed the gap.
   */
  it("keeps the version ply from painting that card back on", () => {
    const decls = forSelector(".item.textnode .ply")
      .map((r) => r.body)
      .join(";");
    expect(decls, "a text node with two versions grows a white card without this").not.toBe("");
    expect(decls).toMatch(/background:\s*transparent/);
  });
});

/**
 * **Two words that must not be the same word.**
 *
 * The canvas's Files panel lists everything ON THE CANVAS. The workbench's
 * section lists what is in the DIRECTORY bound to it on this machine. They
 * are different sets, they disagree constantly (a canvas of twelve screens
 * beside a repo holding one `index.html`), and when both were called "Files"
 * the disagreement was reported as a bug in the app — twice.
 *
 * Bound, the section names the folder. Unbound it has no folder to name, and
 * that is the state this guards: the fallback must not be the canvas panel's
 * word.
 */
describe("the workbench directory section is not the canvas Files panel", () => {
  it("never falls back to the canvas panel's word", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/components/WbFiles.tsx", import.meta.url)),
      "utf8",
    );
    // The rendered fallback, not the prose around it: comments in this file
    // discuss the collision at length and must stay free to say the word.
    const header = src.slice(src.indexOf("<h3>"), src.indexOf("</h3>"));
    expect(header).not.toMatch(/"Files"/);
    expect(header).toMatch(/"Directory"/);
  });
});

/**
 * **Every renderer of a text node honours its line breaks, or none should.**
 *
 * `breaks` is a prop, so it is a thing a new call site can forget — and the
 * failure is quiet and split-brained: the canvas shows the note the way it
 * was typed while full screen runs the lines together, which reads as the
 * app having lost the text rather than as a missing flag. That is exactly
 * what happened the first time; the canvas got it and the stage did not.
 */
describe("every VersionContent site says whether it is a text node", () => {
  const sites = [
    "../src/components/ItemView.tsx",
    "../src/components/ArtifactStage.tsx",
    "../src/components/ItemThumb.tsx",
    "../src/components/VersionFanOut.tsx",
  ];

  it("passes textNode wherever VersionContent is mounted", () => {
    for (const site of sites) {
      const src = readFileSync(fileURLToPath(new URL(site, import.meta.url)), "utf8");
      const mounts = src.split("<VersionContent").slice(1);
      expect(mounts.length, `${site} no longer mounts VersionContent`).toBeGreaterThan(0);
      for (const mount of mounts) {
        // The props of this one element, up to its close.
        const props = mount.slice(0, mount.indexOf("/>"));
        expect(props, `${site} mounts VersionContent without textNode`).toContain("textNode=");
      }
    }
  });
});

/**
 * **The style controls are part of the composer, not "away" from it.**
 *
 * Click-outside is what commits a text node, and the first version of it
 * asked whether the press landed inside the TEXTAREA. The step and face
 * buttons sit in the same box but not in the textarea, so choosing a size
 * counted as clicking away: the composer committed at the OLD style and
 * closed, which made the one control that changes how the words look
 * impossible to use on them. Caught by using it, so it gets a guard.
 */
describe("choosing a size does not dismiss the composer", () => {
  it("tests the whole composer for the click-outside, not just the textarea", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../src/components/TextComposer.tsx", import.meta.url)),
      "utf8",
    );
    const effect = src.slice(src.indexOf("function onDown"), src.indexOf("document.addEventListener"));
    expect(effect, "the outside test must use the composer box").toContain("box.current");
    expect(effect, "testing the textarea alone makes the toolbar unusable").not.toContain(
      "area.current",
    );
  });
});
