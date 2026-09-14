import { describe, expect, it } from "vitest";
import { withoutComments } from "./source.ts";

/**
 * **A guard on the thing the guards use.**
 *
 * Twenty-odd tests read source and assert on it, and every one of them is only
 * as good as the strip that runs first. The strip they all used could delete
 * real code and nobody would see it — lessons #66 — so its replacement is held
 * to the cases that broke it, plus the ordinary ones it must not break.
 */
describe("stripping prose from source", () => {
  it("leaves a `/*` that is inside a string exactly where it is", () => {
    // The case from switcher.test.ts: a route wildcard, not a comment.
    const src = ["const a = 1;", "const route = useMatch(`${CANVAS_ROUTE}/*`);", "const b = 2;"].join("\n");
    const bare = withoutComments(src);
    expect(bare).toContain("${CANVAS_ROUTE}/*");
    expect(bare).toContain("const b = 2;");
  });

  it("does not let a string's `/*` swallow the code below it", () => {
    const src = [
      'const pragma = "await import(/* @vite-ignore */ url)";',
      "const handler = onKey();",
      "/* real prose */",
      "const after = 3;",
    ].join("\n");
    const bare = withoutComments(src);
    // The old span regex ate from the string to the `*/` on line 3, taking
    // `handler` with it. That is the silent half of the bug.
    expect(bare).toContain("const handler = onKey();");
    expect(bare).toContain("const after = 3;");
    expect(bare).not.toContain("real prose");
  });

  it("removes ordinary block comments, JSDoc and `//` lines", () => {
    const src = [
      "/**",
      " * A doc comment about frobnication.",
      " */",
      "export const frob = 1;",
      "// a line comment",
      "/* a one-line block */",
      "const kept = 2;",
    ].join("\n");
    const bare = withoutComments(src);
    expect(bare).not.toMatch(/frobnication|line comment|one-line block/);
    expect(bare).toContain("export const frob = 1;");
    expect(bare).toContain("const kept = 2;");
  });

  it("removes a JSX comment, including one that spans lines", () => {
    const src = [
      "<div>",
      "  {/* what this section is for */}",
      "  {/* and one that runs",
      "      over two lines */}",
      "  <Thing />",
      "</div>",
    ].join("\n");
    const bare = withoutComments(src);
    expect(bare).not.toMatch(/what this section|over two lines/);
    expect(bare).toContain("<Thing />");
  });

  it("keeps a line whose comment opens after real code — prose that can only fail loudly", () => {
    // The documented limit. Leftover prose can make an assertion fail; a
    // swallowed subject makes one pass while proving nothing, which is worse.
    const bare = withoutComments("callIt(); /* why */\nconst next = 1;");
    expect(bare).toContain("callIt();");
    expect(bare).toContain("const next = 1;");
  });

  it("is not fooled by a multiplication that looks like a closer", () => {
    const src = ["/* open", "   still prose */", "const n = a */ b;"].join("\n");
    // Nonsense as code, but the point is the block ended at its own line.
    expect(withoutComments(src)).toContain("const n = a */ b;");
  });
});
