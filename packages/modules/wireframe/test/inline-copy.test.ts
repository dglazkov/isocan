import { describe, expect, it } from "vitest";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { CanvasContents, DialogHost, Operation } from "@isocan/core";
import { copyDeck } from "@isocan/core/copy-deck";
import { wireCopyFor, wireWordAt, wireWords } from "@isocan/core/wire-words";
import { presetOnWeb } from "../src/dialog.tsx";
import { presetText } from "../src/style-cli.ts";
import { embedWireSpec, ensureFleshedForCopy, readWire, renderWire, wireframe, type WireSpec } from "../src/core.ts";
import { wireWebCopy } from "../src/web-copy.ts";
import wireframeWeb from "../src/web.tsx";

/**
 * **The stage's in-place text edit on a wire screen** (copy-edit phase 1's
 * open bug, 2 Oct 2026). The edit used to splice the HTML and leave the
 * embedded spec saying the old words, so the next re-render took it back.
 * Here a double-clicked node is named by its word path (`wireWebCopy.at`),
 * the words go through the module's writer, and a restyle afterwards — which
 * redraws every screen from its spec — still says them. A node that draws
 * several words, or none of its own, is refused in a sentence.
 *
 * The node's place is read with parse5 the way the browser's `closest()`
 * reads it in `packages/web/src/lib/inlineSave.ts`. Synthetic: Acme's orders.
 */

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/** Every text node with its section and nearest `data-wf` — what the stage hands `at`. */
function places(html: string): Array<{ ordinal: number; slot?: string; wf?: string; text: string }> {
  const out: Array<{ ordinal: number; slot?: string; wf?: string; text: string }> = [];
  const attr = (el: Element, name: string) => el.attrs?.find((a) => a.name === name)?.value;
  const walk = (node: Node, slot?: string, wf?: string) => {
    const el = node as Element;
    const s = "tagName" in node ? (attr(el, "data-sec") ?? slot) : slot;
    const w = "tagName" in node ? (attr(el, "data-wf") ?? wf) : wf;
    const template = (node as DefaultTreeAdapterMap["template"]).content;
    if (template) walk(template as unknown as Node, s, w);
    for (const child of (el.childNodes ?? []) as Node[]) {
      if (child.nodeName === "#text") out.push({ ordinal: out.length, ...(s !== undefined ? { slot: s } : {}), ...(w !== undefined ? { wf: w } : {}), text: (child as DefaultTreeAdapterMap["textNode"]).value });
      else walk(child, s, w);
    }
  };
  walk(parse(html) as unknown as Node);
  return out;
}

const placeOf = (html: string, text: string, slot?: string) => {
  const found = places(html).find((p) => p.text.trim() === text && (slot === undefined || p.slot === slot));
  if (!found) throw new Error(`no text node says "${text}"`);
  const { ordinal: _o, ...place } = found;
  return place;
};

/** One screen on a canvas in memory, and the host the stage hands the module's writer. */
function canvasWith(html: string) {
  const blobs = new Map<string, string>();
  const items = new Map<string, { id: string; title: string; properties: Record<string, string>; x: number; y: number; width: number; height: number; currentVersionId: string; versions: Array<{ id: string; blobHash: string; mimeType: string; filename?: string }> }>();
  const sent: Array<{ op: Operation; group?: string }> = [];
  const store = (text: string) => {
    const hash = `hash-${blobs.size + 1}`;
    blobs.set(hash, text);
    return hash;
  };
  items.set("itm_orders", { id: "itm_orders", title: "Orders", properties: { fidelity: "wireframe" }, x: 0, y: 0, width: 390, height: 844, currentVersionId: "ver_1", versions: [{ id: "ver_1", blobHash: store(html), mimeType: "text/html", filename: "orders.html" }] });
  const apply = (op: Operation, group?: string) => {
    sent.push({ op, ...(group ? { group } : {}) });
    if (op.type === "item.add") {
      const at = op.placement as { x: number; y: number };
      items.set(op.itemId, { id: op.itemId, title: op.title ?? "", properties: op.properties ?? {}, x: at.x, y: at.y, width: op.width, height: op.height, currentVersionId: op.version.id, versions: [op.version] });
    } else if (op.type === "item.addVersion") {
      const item = items.get(op.itemId)!;
      item.versions.push(op.version);
      item.currentVersionId = op.version.id;
    } else if (op.type === "item.update") {
      const item = items.get(op.itemId)!;
      if (op.patch.properties) item.properties = { ...item.properties, ...op.patch.properties };
    }
  };
  const host = {
    send: async (ops: readonly Operation[], group?: string) => {
      for (const op of ops) apply(op, group);
    },
    putBlob: async (bytes: Blob) => {
      const text = await bytes.text();
      return { blobHash: store(text), size: text.length };
    },
    readText: async (hash: string) => blobs.get(hash)!,
    getCanvas: () => ({ items: Object.fromEntries(items) }) as unknown as CanvasContents,
    judge: async () => {
      throw Object.assign(new Error("no judge here"), { code: "judgment-unavailable" });
    },
    notice: () => {},
    close: () => {},
  } as unknown as DialogHost;
  const now = () => {
    const item = items.get("itm_orders")!;
    return blobs.get(item.versions.find((v) => v.id === item.currentVersionId)!.blobHash)!;
  };
  return { host, sent, now, items };
}

const fleshed = (archetype: string, title: string): WireSpec => ensureFleshedForCopy(wireframe(archetype, { title }));

describe("an in-place text edit on a wire screen writes the spec", () => {
  it("the wireframe's web half carries the writer the stage looks for", () => {
    expect(wireframeWeb.copy).toMatchObject({ kind: "wire", at: wireWebCopy.at, apply: wireWebCopy.apply });
    expect(typeof wireframeWeb.copy?.variant).toBe("function");
  });

  it("a heading edited in place survives a restyle that redraws the screen from its spec", async () => {
    const html = renderWire(fleshed("list", "Orders"));
    const title = readWire(html)!.content!.title!;
    const at = await wireWebCopy.at(html, placeOf(html, title, "header"));
    expect(at).toEqual({ ok: true, address: "title", text: title });
    if (!at.ok) return;

    const c = canvasWith(html);
    const r = await wireWebCopy.apply(c.host, "canvas-acme", "itm_orders", [{ address: at.address, text: at.text, to: "Acme orders" }], { by: "Dana" });
    expect(r.changed).toEqual(["title"]);
    // One act: one version (and nothing else) in one op group — one undo.
    expect(c.sent.map((s) => s.op.type)).toEqual(["item.addVersion"]);
    expect(new Set(c.sent.map((s) => s.group)).size).toBe(1);
    const after = c.now();
    expect(readWire(after)!.content!.title).toBe("Acme orders");
    expect(copyDeck(after).strings[0]).toMatchObject({ address: "title", text: "Acme orders" });
    // The file is the renderer's own drawing of the new words — the bar and the heading move together.
    expect(after).toBe(renderWire(readWire(after)!));

    // The re-render that used to take it back: a style redraws every screen from its spec.
    await presetOnWeb("canvas-acme", c.host, "material", [], async (p) => presetText(p));
    const restyled = c.now();
    expect(restyled).not.toBe(after);
    expect(readWire(restyled)!.style).toBeDefined();
    expect(placeOf(restyled, "Acme orders", "header")).toBeDefined();
    expect(places(restyled).some((p) => p.text.trim() === title && p.slot === "header")).toBe(false);
  });

  it("a word in a list row survives the redraw too, and only that word changed", async () => {
    const html = renderWire(fleshed("list", "Orders"));
    const deck = copyDeck(html);
    const row = deck.strings.find((s) => s.address === "main.3/items.0.title")!;
    const at = await wireWebCopy.at(html, placeOf(html, row.text, "main.3"));
    expect(at).toEqual({ ok: true, address: "main.3/items.0.title", text: row.text });
    const c = canvasWith(html);
    await wireWebCopy.apply(c.host, "canvas-acme", "itm_orders", [{ address: row.address, text: row.text, to: "Spring catalogue" }], { by: "Dana" });
    await presetOnWeb("canvas-acme", c.host, "material", [], async (p) => presetText(p));
    const words = new Map(wireWords(readWire(c.now())!).map((w) => [w.address, w.text]));
    expect(words.get("main.3/items.0.title")).toBe("Spring catalogue");
    const before = new Map(wireWords(readWire(html)!).map((w) => [w.address, w.text]));
    for (const [address, text] of before) if (address !== row.address) expect(words.get(address), address).toBe(text);
    expect(placeOf(c.now(), "Spring catalogue", "main.3")).toBeDefined();
  });

  it("a screen that is not its renderer's drawing keeps its bytes, with the edit spliced and the new words embedded", async () => {
    const spec = fleshed("list", "Orders");
    const title = spec.content!.title!;
    const crafted = embedWireSpec(`<!doctype html><html><head><title>Acme</title></head><body><main class="craft" data-sec="header"><h1>${title}</h1></main></body></html>`, spec);
    const spliced = crafted.replace(`<h1>${title}</h1>`, "<h1>Acme orders</h1>");
    const c = canvasWith(crafted);
    await wireWebCopy.apply(c.host, "canvas-acme", "itm_orders", [{ address: "title", text: title, to: "Acme orders" }], { by: "Dana", html: spliced });
    const after = c.now();
    expect(after).toContain('<main class="craft" data-sec="header"><h1>Acme orders</h1></main>');
    expect(readWire(after)!.content!.title).toBe("Acme orders");
  });

  it("a word that moved under the edit is refused by name, and nothing is sent", async () => {
    const html = renderWire(fleshed("list", "Orders"));
    const c = canvasWith(html);
    await expect(wireWebCopy.apply(c.host, "canvas-acme", "itm_orders", [{ address: "title", text: "Something else", to: "Acme orders" }], { by: "Dana" })).rejects.toThrow(/title no longer says "Something else"/);
    expect(c.sent).toEqual([]);
  });
});

describe("a node that is not one word of its own is refused in words", () => {
  const html = renderWire(fleshed("list", "Orders"));
  const spec = readWire(html)!;
  const item = spec.slots.find((s) => s.slot === "main.3")!.fill as { items: Array<{ sub: string; status: string; meta: string; person: string }> };
  const first = item.items[0]!;

  it("a row that draws sub · status · meta as one line points at `isocan words`", async () => {
    const joined = `${first.sub} · ${first.status} · ${first.meta}`;
    const at = await wireWebCopy.at(html, placeOf(html, joined, "main.3"));
    expect(at.ok).toBe(false);
    if (at.ok) return;
    expect(at.reason).toMatch(/several of the screen's words at once/);
    expect(at.reason).toContain("`isocan words <screen>`");
  });

  it("initials drawn from a person's name, and an icon, are not words of their own", async () => {
    const initials = places(html).find((p) => p.slot === "main.3" && /^[A-Z]{2}$/.test(p.text.trim()))!;
    const at = await wireWebCopy.at(html, initials);
    expect(at).toMatchObject({ ok: false, reason: expect.stringMatching(/not words of its own/) });
    expect(await wireWebCopy.at(html, placeOf(html, "›", "main.3"))).toMatchObject({ ok: false });
  });

  it("the same words twice in one place cannot be told apart", async () => {
    const settings = renderWire(fleshed("settings", "Orders"));
    const words = wireWords(readWire(settings)!).filter((w) => w.address.startsWith("main.2/"));
    const twice = words.find((w) => w.text !== "" && words.filter((o) => o.text === w.text).length > 1);
    expect(twice).toBeDefined();
    const at = await wireWebCopy.at(settings, placeOf(settings, twice!.text, "main.2"));
    expect(at).toMatchObject({ ok: false, reason: expect.stringMatching(/more than once/) });
  });

  it("an unfleshed wireframe has no words yet", () => {
    const bars = renderWire(wireframe("list", { title: "Orders" }));
    expect(wireWordAt(readWire(bars)!, { text: "Orders" })).toMatchObject({ ok: false, reason: expect.stringMatching(/wire flesh/) });
  });

  it("a stale or doubled edit is refused before anything is written", () => {
    expect(wireCopyFor(spec, [{ address: "title", text: spec.content!.title!, to: "A" }, { address: "title", text: spec.content!.title!, to: "B" }])).toMatchObject({ ok: false, reason: expect.stringMatching(/edited twice/) });
    expect(wireCopyFor(spec, [{ address: "title", text: spec.content!.title!, to: "  " }])).toMatchObject({ ok: false, reason: "title must not be empty" });
  });
});
