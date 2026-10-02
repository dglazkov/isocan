// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, WebCopyWriter } from "@isocan/core";
import { wireWordAt, type WireSpecWords } from "@isocan/core/wire-words";
import type { InPlaceEdit } from "../src/lib/textEdits.ts";

/**
 * **The stage's save routes a wire screen's words to the module** (copy-edit
 * phase 1's open bug, 2 Oct 2026). A text edit on plain HTML is spliced and
 * lands as a version, as it always has; on a wireframe the same edit is named
 * by its word path and handed to the wireframe module's writer, because a
 * splice alone is undone by the next re-render. The writer itself — and that
 * the words survive a restyle — is `packages/modules/wireframe/test/inline-copy.test.ts`;
 * this holds the shell's half: which path a save takes, the node it names
 * (counted the way the frame counts), and the refusals it says. The shell
 * names no module (`test/modules.test.ts`), so the screen here is drawn by
 * hand in the renderer's shape — the marker, the embedded spec, `data-sec` —
 * and the writer's `at` is core's `wireWordAt`, which the module's is.
 *
 * Synthetic: Acme's orders.
 */

const SPEC: WireSpecWords = {
  title: "List",
  content: { title: "Orders" },
  slots: [
    { slot: "header", block: "app-bar" },
    { slot: "main.1", block: "list", fill: { items: [{ title: "Photo set", sub: "Shared with 2 people", status: "Archived", meta: "5 h ago", person: "Clara A." }] } },
  ],
};
const wire = `<!doctype html>
<!-- isocan:wireframe -->
<html lang="en"><head><meta charset="utf-8"><title>Orders</title><script type="application/json" id="isocan-wireframe">${JSON.stringify(SPEC)}</script></head>
<body class="screen"><div class="frame app"><section data-sec="header" data-wf="header"><span>Orders</span></section><div class="body"><div class="main"><section data-sec="main.1" data-wf="main.1"><div data-wf="main.1.row"><span>CA</span><div>Photo set</div><div>Shared with 2 people · Archived · 5 h ago</div></div></section></div></div></div></body>
</html>
`;
const title = "Orders";
const joined = "Shared with 2 people · Archived · 5 h ago";

const landed: File[] = [];
const applied: Array<{ edits: unknown; opts: unknown }> = [];
let writer: WebCopyWriter | undefined;

vi.mock("../src/lib/upload.ts", () => ({
  addVersionFromFile: async (_canvas: string, _actor: unknown, _item: string, file: File) => {
    landed.push(file);
  },
}));
vi.mock("../src/modules.ts", () => ({ modules: () => (writer ? [{ core: { name: "wireframe" }, copy: writer }] : []) }));
vi.mock("../src/lib/modulehost.ts", () => ({ webHostFor: () => ({}) }));

const { saveInPlace, wireRefusal } = await import("../src/lib/inlineSave.ts");

const actor = { id: "usr_dana", name: "Dana" };
const itemOf = (filename: string, mimeType = "text/html") => ({ id: "itm_orders", currentVersionId: "ver_1", versions: [{ id: "ver_1", blobHash: "hash-1", mimeType, filename }] }) as unknown as Item;

/** The ordinal the frame would give the node saying `text` — `createTreeWalker(SHOW_TEXT)` over the parsed file. */
function ordinalOf(source: string, text: string): number {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  for (let n = 0; walker.nextNode(); n++) if ((walker.currentNode as Text).data.trim() === text) return n;
  throw new Error(`no node says ${text}`);
}

function nodeOf(source: string, text: string): Text {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) if ((walker.currentNode as Text).data.trim() === text) return walker.currentNode as Text;
  throw new Error(`no node says ${text}`);
}

beforeEach(() => {
  landed.length = 0;
  applied.length = 0;
  writer = {
    kind: "wire",
    variant: async () => {
      throw new Error("not this door");
    },
    at: async (_html, place) => wireWordAt(SPEC, place),
    apply: async (_host, _canvas, _item, edits, opts) => {
      applied.push({ edits, opts });
      return { changed: edits.map((e) => e.address) };
    },
  };
});

describe("saveInPlace", () => {

  it("plain HTML is spliced and lands as a version, as before", async () => {
    const page = "<!doctype html><html><head><title>Acme</title></head><body><h1>Orders</h1></body></html>";
    const edit: InPlaceEdit = { ordinal: ordinalOf(page, "Orders"), from: "Orders", to: "Acme orders" };
    expect(await saveInPlace("canvas-acme", actor, itemOf("page.html"), page, [edit])).toBeNull();
    expect(await landed[0]!.text()).toContain("<h1>Acme orders</h1>");
    expect(applied).toEqual([]);
  });

  it("a wire screen's heading goes to the module's writer by its word path, with the spliced file beside it", async () => {
    const edit: InPlaceEdit = { ordinal: ordinalOf(wire, title), from: title, to: "Acme orders" };
    expect(await saveInPlace("canvas-acme", actor, itemOf("orders.html"), wire, [edit])).toBeNull();
    expect(landed).toEqual([]);
    expect(applied).toHaveLength(1);
    expect(applied[0]!.edits).toEqual([{ address: "title", text: title, to: "Acme orders" }]);
    expect(applied[0]!.opts).toMatchObject({ by: "Dana", html: expect.stringContaining("Acme orders") });
  });

  it("a row that joins several words is refused in a sentence, and nothing is written", async () => {
    const no = await saveInPlace("canvas-acme", actor, itemOf("orders.html"), wire, [{ ordinal: ordinalOf(wire, joined), from: joined, to: "Shared with nobody" }]);
    expect(no).toMatch(/several of the screen's words at once/);
    expect(landed).toEqual([]);
    expect(applied).toEqual([]);
    // …and the double-click says it before anything is typed.
    expect(await wireRefusal(wire, nodeOf(wire, joined))).toBe(no);
    expect(await wireRefusal(wire, nodeOf(wire, title))).toBeNull();
  });

  it("words and properties on a wire screen are saved apart; no module loaded is said, not spliced", async () => {
    const text: InPlaceEdit = { ordinal: ordinalOf(wire, title), from: title, to: "Acme orders" };
    const doc = new DOMParser().parseFromString(wire, "text/html");
    const body = [...doc.querySelectorAll("*")].indexOf(doc.body);
    const attr: InPlaceEdit = { kind: "attr", ordinal: body, tag: "body", name: "style", from: null, to: "color:red" };
    expect(await saveInPlace("canvas-acme", actor, itemOf("orders.html"), wire, [text, attr])).toMatch(/separately/);
    writer = undefined;
    expect(await saveInPlace("canvas-acme", actor, itemOf("orders.html"), wire, [text])).toMatch(/has not loaded yet/);
    expect(landed).toEqual([]);
  });
});
