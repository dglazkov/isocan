import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAPERS } from "@isocan/core";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css");

/**
 * **Paper is offered on both surfaces, or it is a habit.**
 *
 * The one law this project has: a rule the app enforces and the CLI does not
 * know about is not a rule. That applies to what you can MAKE as much as to
 * what you can do — a style only the app can set would be a canvas the
 * terminal cannot reproduce.
 */
describe("a post-it is a text node wearing paper", () => {
  it("is offered by the CLI too, not only by the Text tool", () => {
    const cli = read("../../cli/src/main.ts");
    expect(cli).toContain('.option("--paper <colour>"');
    expect(cli).toContain("PAPER_PROP");
  });

  it("asks core which papers exist, on both surfaces", () => {
    // Not a hand-written list in either place: one closed set, or the two
    // drift and a note made in the terminal renders as nothing in the app.
    expect(read("../src/components/TextComposer.tsx")).toContain("PAPERS");
    expect(read("../../cli/src/main.ts")).toContain("PAPERS");
  });

  it("gives every paper a colour in BOTH themes", () => {
    // A tint tuned on white and forgotten in the dark is the exact bug the
    // token rule exists for. Paper stays pale in both — it is a bright object
    // on a dark desk — so these are dimmed, never inverted.
    const roots = [...css.matchAll(/:root[^{]*\{([^}]*)\}/gs)].map((m) => m[1]!);
    const light = roots.find((b) => b.includes("--paper-yellow:"));
    const dark = roots.filter((b) => b.includes("--paper-yellow:"))[1];
    expect(light, "no light paper tokens").toBeTruthy();
    expect(dark, "no dark paper tokens").toBeTruthy();
    for (const one of PAPERS) {
      expect(light, `--paper-${one} missing in light`).toContain(`--paper-${one}:`);
      expect(dark, `--paper-${one} missing in dark`).toContain(`--paper-${one}:`);
    }
  });

  it("puts the card back that a plain text node takes away", () => {
    // `.item.textnode` is deliberately chromeless — transparent, no border,
    // no shadow. Paper is the opposite on purpose: edges and a shadow are
    // what make it read as an object you could pick up.
    const rule = css.slice(css.indexOf(".item.textnode.paper {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("background: var(--paper)");
    expect(body).toContain("box-shadow:");
  });

  it("offers 'no paper' first, so a caption stays the default", () => {
    // A picker whose first option is a colour quietly makes every note a
    // sticky one.
    expect(read("../src/components/TextComposer.tsx")).toContain("[null, ...PAPERS]");
  });
});
