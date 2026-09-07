import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { firstLine } from "../src/components/CommentWhen.tsx";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const when = read("../src/components/CommentWhen.tsx");
const panel = read("../src/components/MainThreadPanel.tsx");
const layer = read("../src/components/CommentLayer.tsx");
const css = read("../src/styles.css");

/**
 * **Folding a message away, by clicking its date** (7 Sep 2026).
 *
 * Asked for after a thread where one agent's report ran longer than the screen
 * and everything said before it was somewhere above.
 */
describe("a message folds by its date", () => {
  it("is a button, and says what it does to a screen reader", () => {
    /* A span with an onClick is not reachable by keyboard and announces
       nothing. `aria-expanded` is the whole difference between a date and a
       disclosure, and it is the half that is invisible in a screenshot — so it
       is the half a test has to hold. */
    expect(when).toContain('<button');
    expect(when).toMatch(/aria-expanded=\{!collapsed\}/);
    expect(when).toMatch(/title=\{collapsed \?/);
  });

  it("folds in both places a comment is drawn", () => {
    // The Chat panel and the pin popover render the same comment and neither
    // owns the other. Two copies of "what a fold keeps" would drift.
    for (const [name, src] of [["MainThreadPanel", panel], ["CommentLayer", layer]] as const) {
      expect(src, `${name} uses the shared date`).toContain("<CommentWhen comment={comment} />");
      expect(src, `${name} wraps its body in the shared fold`).toContain("<CommentFold comment={comment}>");
      expect(src, `${name} spells no timestamp of its own`).not.toContain(
        "new Date(comment.createdAt).toLocaleString()",
      );
    }
  });

  it("keeps the first line, so a folded thread is still navigable", () => {
    /* The design decision, and the reason a fold is not simply `display:none`.
       A column of names and times is a list you cannot read down — you would
       open each one to find the one you meant, which is worse than scrolling
       past them. */
    expect(firstLine("Done — the agent run is fake output\n\nmore below")).toBe(
      "Done — the agent run is fake output",
    );
    expect(firstLine("\n\n  leading blank lines  \nthen this")).toBe("leading blank lines");
  });

  it("strips markdown from the preview rather than rendering it", () => {
    /* A heading's ## and a bullet's - are noise in a one-line summary, and
       rendering markdown inside a preview would let a bold run or a link
       change the line's height — the one thing a folded row must not do. */
    expect(firstLine("## The header work")).toBe("The header work");
    expect(firstLine("- **bold** and `code`")).toBe("bold and code");
    expect(firstLine("[the brief](http://example.com/x) is up")).toBe("the brief is up");
    expect(firstLine("> quoted")).toBe("quoted");
  });

  it("clips a long first line instead of wrapping it", () => {
    // A preview that wrapped would make folding change the height it saved.
    const long = firstLine("x".repeat(400));
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith("…")).toBe(true);
    expect(css).toContain("text-overflow: ellipsis");
  });

  it("survives a message with nothing in it", () => {
    // An empty body is reachable: a comment that is only an attached item.
    expect(firstLine("")).toBe("");
    expect(when, "and the fold still has something to click").toContain('|| "…"');
  });

  it("does not follow the reader to tomorrow", () => {
    /* Deliberately not persisted and deliberately not a canvas fact. Two
       people reading one thread are not reading it for the same reason, so one
       of them folding a long report must not fold it for everybody — and a
       thread you come back to should look like the thread, not like the shape
       you left it in and have since forgotten. */
    const store = read("../src/stores/uiStore.ts");
    expect(store).toContain("collapsedComments: []");
    const decl = store.slice(store.indexOf("toggleComment: (id) =>"));
    expect(decl.slice(0, 400), "no localStorage write").not.toMatch(/write[A-Za-z]*\(/);
  });
});
