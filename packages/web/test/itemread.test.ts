import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **"Read / select text" is offered on the item you chose, not on every text item.**
 *
 * Reported 30 Sep 2026: drawn inside every Markdown and plain-text item at all
 * times, the button covered the words of small chromeless nodes (a mind map's
 * branches) and wrapped into a column of "Read / select text". It now needs
 * the item to be the sole selection (or already entered), and on a text node
 * it hangs below the words instead of over them.
 */
describe("the reading-mode door", () => {
  const view = read("../src/components/ItemView.tsx");
  const css = read("../src/styles.css");

  it("renders only for the sole selection or the entered item", () => {
    const at = view.indexOf('className="btn item-read"');
    expect(at).toBeGreaterThan(0);
    const guard = view.slice(view.lastIndexOf("{!isCanvasGroup", at), at);
    expect(guard).toMatch(/\(soleSelection \|\| entered\)/);
  });

  it("hangs below a text node, never over its words, on one line", () => {
    const rule = css.match(/\.item\.textnode \.item-read \{([^}]*)\}/);
    expect(rule, "a text-node placement rule exists").not.toBeNull();
    expect(rule![1]).toMatch(/top:\s*calc\(100% \+ \d+px\)/);
    expect(rule![1]).toMatch(/white-space:\s*nowrap/);
  });
});
