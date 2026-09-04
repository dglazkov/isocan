import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The reading is proved in `core/test/context.test.ts`. This is that both
 * surfaces read the SAME one — which is the whole design of this feature.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");
const panel = read("components/ContextPanel.tsx");

describe("the Context view", () => {
  it("asks core, the same function `isocan context` asks", () => {
    // "A view the CLI cannot print is a view agents cannot use, and the whole
    // point is that both read the same thing." Two readers would agree until
    // the day one of them was taught something the other was not.
    expect(panel).toMatch(/contextLayers\(canvas, linked\)/);
    const cli = readFileSync(
      fileURLToPath(new URL("../../cli/src/main.ts", import.meta.url)),
      "utf8",
    );
    expect(cli).toMatch(/contextLayers\(snapshot\.canvas/);
  });

  it("stores nothing, which is why this stage came first", () => {
    // No op, no write, no persisted list. There is no context record to keep
    // in step with the thing it describes, so the view cannot be stale about
    // anything except by being closed.
    expect(panel, "a context view that writes is a context view that drifts").not.toMatch(
      /sendOp|item\.add|item\.update/,
    );
  });

  it("does not report machine facts it cannot have", () => {
    /**
     * A bound directory is a fact about somebody's laptop. Listing it in a
     * browser as "not here" would report the absence of a thing that cannot
     * exist on this surface — which reads as a missing feature rather than as
     * a category error.
     */
    // Against the CODE: the component's own comment explains why it has no
    // directory, and would otherwise fail on its own explanation. Third time
    // this trap has been worth the two extra lines.
    const code = panel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "no machine facts on a surface that cannot have them").not.toMatch(/directory/i);
    expect(code, "and no extras object at all").toMatch(/contextLayers\(canvas, linked\)/);
  });

  it("shows a reason beside anything it flags", () => {
    // "3 items have changed since it was last written" is actionable. A
    // warning triangle is an accusation.
    expect(panel).toMatch(/piece\.stale &&/);
    expect(panel).toMatch(/piece\.fix &&/);
  });

  it("joins the dock through the one answer, not a fifth spelling", () => {
    const stage = read("lib/stage.ts");
    expect(stage).toMatch(/ui\.contextPanelOpen/);
    expect(stage).toMatch(/railSpan\(railIsOpen\(ui\)/);
  });
});
