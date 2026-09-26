import { describe, expect, it } from "vitest";
import { diffVersions, embeddedWire, markSource, type DiffSide } from "@isocan/core/diff";
import { readWire, renderWire, resolveSlot, wireframe, type WireSpec } from "../src/core.ts";

/**
 * **A wire changes by its spec, so it diffs by its spec**
 * (docs/projects/version-diff/design.md).
 *
 * A screen's HTML is a rendering; what a person or Jev decided is the
 * `WireSpec` inside it — which block in which slot, its props, its intents,
 * its words. Core's diff reads that spec rather than the markup, and says
 * "stacked list → data table" instead of forty changed `<div>`s. Core cannot
 * import this module, so it repeats the marker and script id; the first case
 * holds its reader equal to `readWire` on a real rendered screen.
 *
 * Synthetic: an Acme orders list.
 */

const side = (spec: WireSpec): DiffSide => {
  const text = renderWire(spec);
  return { mimeType: "text/html", filename: "orders.html", size: text.length, text };
};

const base = (): WireSpec => wireframe("list", { title: "Orders" });

describe("wire diff", () => {
  it("reads the embedded spec exactly as the module does", () => {
    const html = renderWire(base());
    expect(embeddedWire(html)).toEqual(readWire(html));
    expect(embeddedWire("<!doctype html><p>not a wire</p>")).toBeNull();
  });

  it("names blocks swapped, removed, added, props and intents (the links) changed", () => {
    const before = base();
    const after = structuredClone(before);
    after.title = "Deliveries";
    after.slots = after.slots.map((s) => (s.slot === "main.3" ? resolveSlot("list", "main.3", "data-table") : s));
    after.slots = after.slots.filter((s) => s.slot !== "main.2");
    const header = after.slots.find((s) => s.slot === "header")!;
    header.intents = { "action-1": "settings" };
    header.props = { ...header.props, search: true };

    const d = diffVersions(side(before), side(after));
    expect(d.kind).toBe("wire");
    expect(d.unit).toBe("block");
    expect(d.changes.map((c) => [c.op, c.what])).toEqual([
      ["changed", "the screen's title “Orders” → “Deliveries”"],
      ["changed", "the header (app bar): search on; action 1 now does settings (link was filter)"],
      ["removed", "took chip out of main section 2"],
      ["changed", "main section 3 (data table): stacked list → data table"],
    ]);
    expect(d.summary).toMatch(/^1 block removed, 3 changed: /);
  });

  it("names an added section", () => {
    const after = base();
    const before = { ...after, slots: after.slots.filter((s) => s.slot !== "fab") };
    const d = diffVersions(side(before), side(after));
    expect(d.changes.map((c) => [c.op, c.what])).toEqual([["added", "added a fab in the floating button"]]);
  });

  it("names a reorder, which today only a hand-written spec can make", () => {
    // `validateWire` holds slots in recipe order, so `renderWire` cannot draw
    // a reordered screen; a spec embedded by hand still can, and says so.
    const raw = (spec: WireSpec): DiffSide => {
      const text = `<!doctype html>\n<!-- isocan:wireframe -->\n<html><head><script type="application/json" id="isocan-wireframe">${JSON.stringify(spec)}</script></head><body></body></html>`;
      return { mimeType: "text/html", filename: "orders.html", size: text.length, text };
    };
    const before = base();
    const after = structuredClone(before);
    const [a, b] = [after.slots.findIndex((s) => s.slot === "main.1"), after.slots.findIndex((s) => s.slot === "main.2")];
    [after.slots[a], after.slots[b]] = [after.slots[b]!, after.slots[a]!];
    const d = diffVersions(raw(before), raw(after));
    expect(d.changes.map((c) => c.op)).toEqual(["moved"]);
  });

  it("marks the slot's own section in each side's source", () => {
    const before = base();
    const after = structuredClone(before);
    after.slots = after.slots.map((s) => (s.slot === "main.3" ? resolveSlot("list", "main.3", "card-grid") : s));
    const d = diffVersions(side(before), side(after));
    const marked = markSource(renderWire(after), d, "after");
    expect(marked).toMatch(/<section class="slot w" data-slot="main\.3"[^>]* data-isocan-change="changed" data-isocan-step="1">/);
    // The spec inside is untouched, so the marked screen is still the same wire.
    expect(readWire(marked)).toEqual(after);
  });

  it("finds nothing between a screen and itself", () => {
    expect(diffVersions(side(base()), side(base())).identical).toBe(true);
  });
});
