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
