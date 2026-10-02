import { describe, expect, it } from "vitest";
import { copyDeck, wireCopyFile } from "@isocan/core/copy-deck";
import { applyCopy, blockContentSchema, copyOf, ensureFleshedForCopy, readWire, renderWire, validateCopyPayload, wireframe, wordsOf, type WireSpec } from "../src/core.ts";

/**
 * **The copy deck on a rendered wireframe** (copy-edit phase 1).
 *
 * A wire screen's rendered text is not its words — a list row draws three
 * of them joined by " · ", an avatar draws initials — so its deck reads the
 * embedded spec, and its address is `wire copy`'s word path. Core repeats
 * this module's `wordsOf` (it cannot import a module); these cases hold the
 * two equal on real rendered screens, and hold the deck's edits to being
 * exactly the copy file `wire copy --apply` takes.
 *
 * Synthetic: Acme's orders list and settings.
 */

const fleshed = (archetype: string, title: string): WireSpec => ensureFleshedForCopy(wireframe(archetype, { title }));

describe("copyDeck on a wireframe", () => {
  for (const archetype of ["list", "detail", "home", "form", "settings", "sign-in", "profile", "feed", "state", "confirm"]) {
    it(`${archetype}: the deck's paths are wire copy's paths, slot by slot, in wordsOf order`, () => {
      const spec = fleshed(archetype, "Acme");
      const deck = copyDeck(renderWire(spec));
      expect(deck.kind).toBe("wire");
      const words = copyOf(spec);
      expect(deck.strings[0]).toMatchObject({ address: "title", role: "heading", text: words.title });
      const fromDeck = new Map<string, Array<[string, string]>>();
      for (const s of deck.strings) {
        if (s.address === "title" || s.address === "bar") continue;
        const cut = s.address.indexOf("/");
        const slot = s.address.slice(0, cut);
        fromDeck.set(slot, [...(fromDeck.get(slot) ?? []), [s.address.slice(cut + 1), s.text]]);
      }
      for (const slot of spec.slots.filter((s) => s.block && s.fill)) {
        expect(fromDeck.get(slot.slot) ?? [], slot.slot).toEqual(Object.entries(wordsOf(slot.fill)));
      }
      // Every path the schema offers is in the deck, and nothing else is.
      const schemaSlots = (blockContentSchema(spec).properties!.slots as { properties: Record<string, { properties: Record<string, unknown> }> }).properties;
      const schemaPaths = Object.entries(schemaSlots).flatMap(([slot, s]) => Object.keys(s.properties).map((p) => `${slot}/${p}`)).sort();
      expect(deck.strings.filter((s) => s.address.includes("/")).map((s) => s.address).sort()).toEqual(schemaPaths);
    });
  }

  it("gives roles from the block and the path, and names the data-wf each word draws in", () => {
    const deck = copyDeck(renderWire(fleshed("list", "Orders")));
    const at = (address: string) => deck.strings.find((s) => s.address === address);
    expect(at("main.1/labels.0")).toMatchObject({ role: "placeholder", wf: "main.1" });
    expect(at("main.2/labels.0")).toMatchObject({ role: "label", wf: "main.2" });
    expect(at("main.3/items.0.title")).toMatchObject({ role: "body", wf: "main.3" });
    expect(at("fab/actions.action")).toMatchObject({ role: "button", wf: "fab.action" });
    expect(deck.strings.every((s) => s.budget === null)).toBe(true);
  });

  it("is in reading order: the title, then slots as the screen draws them", () => {
    const spec = fleshed("list", "Orders");
    const html = renderWire(spec);
    const slots = [...new Set(copyDeck(html).strings.slice(1).map((s) => s.address.split("/")[0]!))];
    const drawn = slots.map((slot) => html.indexOf(`data-sec="${slot}"`));
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
  });

  it("an unfleshed wireframe has no words yet", () => {
    expect(copyDeck(renderWire(wireframe("list", { title: "Orders" })))).toEqual({ kind: "wire", strings: [], unfleshed: true });
  });
});

describe("wireCopyFile — a deck's edits are wire copy's file", () => {
  it("turns edits into the copy file applyCopy takes, and the words land", () => {
    const spec = fleshed("list", "Orders");
    const html = renderWire(spec);
    const deck = copyDeck(html);
    const row = deck.strings.find((s) => s.address === "main.3/items.0.title")!;
    const r = wireCopyFile(html, [
      { address: "title", text: deck.strings[0]!.text, to: "Acme orders" },
      { address: row.address, text: row.text, to: "Spring catalogue" },
    ]);
    expect(r).toEqual({ ok: true, file: { title: "Acme orders", slots: { "main.3": { "items.0.title": "Spring catalogue" } } }, changed: ["title", "main.3/items.0.title"] });
    if (!r.ok) return;
    const next = applyCopy(spec, validateCopyPayload(spec, r.file), "agent-acme");
    const after = copyDeck(renderWire(next));
    expect(after.strings.find((s) => s.address === "title")!.text).toBe("Acme orders");
    expect(after.strings.find((s) => s.address === row.address)!.text).toBe("Spring catalogue");
    expect(readWire(renderWire(next))!.content).toMatchObject({ source: "copy", by: "agent-acme" });
  });

  it("refuses a stale word by its path", () => {
    const spec = fleshed("list", "Orders");
    const html = renderWire(spec);
    const r = wireCopyFile(html, [{ address: "main.3/items.0.title", text: "Something older", to: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/main\.3\/items\.0\.title .* now says/);
  });
});
