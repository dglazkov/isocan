import { describe, expect, it } from "vitest";
import { applyCopyDeck, applyCopyDeckToFace, copyDeck } from "../src/copy-deck.ts";
import { PARENT_PROP } from "../src/lineage.ts";
import { PLACEMENT_GAP } from "../src/placement.ts";
import { COPY_STANCE_PROP, COPY_WHY_PROP, VARIANT_GAP, VARIANT_PARENT_PROP, checkCopyVariants, copyMixEdits, copyMixOps, copyMixRows, copyVariantOps, copyVariantsOf, copyVariantsRequest, flowCopyDeck, placeholderCopyVariants, splitFlowEdits } from "../src/copy-variants.ts";
import { parseVoiceSection } from "../src/copy-voice.ts";
import { stubTextGenerator } from "../src/jev.ts";
import type { CanvasContents, Item } from "../src/model.ts";

/**
 * **Copy variants** (copy-edit phase 2): one question for N voices, the check
 * an answer — a model's or an agent's file — must pass, the placeholder that
 * lands when no model is reachable, and the ops that put the variants on the
 * canvas as `/variation` children. The real-daemon walk (`words vary --from`,
 * `choose`, undo) is `packages/cli/test/words-vary.test.ts`.
 *
 * Synthetic: Acme's checkout screen.
 */

const CHECKOUT = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Acme checkout</title><style>.pay { font-weight: 600 }</style></head>
<body class="screen">
  <main data-wf="main">
    <h1 class="title">Review your order</h1>
    <p>Two items, shipped by Acme.</p>
    <label for="card">Card number</label>
    <input id="card" placeholder="1234 5678">
    <button class="pay" type="submit">Pay now</button>
  </main>
</body>
</html>`;

const deck = copyDeck(CHECKOUT);
const addr = (text: string) => deck.strings.find((s) => s.text === text)!.address;

const VOICES = {
  variants: [
    { stance: "Plain and direct", why: "Says what happens and nothing else.", edits: [{ address: addr("Review your order"), to: "Check your order" }, { address: addr("Pay now"), to: "Pay" }] },
    { stance: "Warm", why: "Feels like a person is helping.", edits: [{ address: addr("Review your order"), to: "Almost there — take a look" }] },
    { stance: "Benefit-first", why: "Leads with what the buyer gets.", edits: [{ address: addr("Pay now"), to: "Get my order" }, { address: addr("1234 5678"), to: "Your card number" }] },
  ],
};

describe("copyVariantsRequest — one question for N voices", () => {
  it("names every string with its role and address, the brief and the voice, and asks for exactly n", () => {
    const { prompt, schema } = copyVariantsRequest(deck, 3, "shorter, for a first-time buyer", { tone: "Calm, never shouting", use: [], avoid: [], glossary: [], problems: [] });
    for (const s of deck.strings) expect(prompt).toContain(`${s.address}\t${s.role}\t${JSON.stringify(s.text)}`);
    expect(prompt).toContain("exactly 3 variants");
    expect(prompt).toContain("shorter, for a first-time buyer");
    expect(prompt).toContain("Calm, never shouting");
    const variants = schema.properties!.variants!;
    expect(variants.minItems).toBe(3);
    expect(variants.maxItems).toBe(3);
    const edit = variants.items!.properties!.edits!.items!;
    expect(edit.properties!.address!.enum).toEqual(deck.strings.map((s) => s.address));
    expect(variants.items!.required).toEqual(["stance", "why", "edits"]);
  });

  it("leaves the brief and voice out when there are none", () => {
    const { prompt } = copyVariantsRequest(deck, 2);
    expect(prompt).not.toContain("What the person asked for");
    expect(prompt).not.toContain("product's voice");
  });

  it("is answerable by the stub generator with addresses the deck has", async () => {
    const { prompt, schema } = copyVariantsRequest(deck, 3);
    const answer = (await stubTextGenerator(1).generateJson(prompt, schema)) as { variants: Array<{ edits: Array<{ address: string }> }> };
    expect(answer.variants).toHaveLength(3);
    for (const v of answer.variants) for (const e of v.edits) expect(deck.strings.map((s) => s.address)).toContain(e.address);
  });
});

describe("checkCopyVariants — the rules an answer is held to", () => {
  it("takes three distinct voices and carries each string's current text as the check", () => {
    const r = checkCopyVariants(deck, VOICES, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.variants.map((v) => v.stance)).toEqual(["Plain and direct", "Warm", "Benefit-first"]);
    expect(r.variants[0]!.edits).toEqual([
      { address: addr("Review your order"), text: "Review your order", to: "Check your order" },
      { address: addr("Pay now"), text: "Pay now", to: "Pay" },
    ]);
  });

  it("refuses the wrong n", () => {
    expect(checkCopyVariants(deck, VOICES, 2)).toEqual({ ok: false, reason: "asked for 2 variants and got 3" });
    expect(checkCopyVariants(deck, VOICES)).toMatchObject({ ok: true });
  });

  it("refuses an address the screen does not have, by variant and address", () => {
    const bad = { variants: [{ ...VOICES.variants[0]!, edits: [{ address: "t999", to: "Hello" }] }] };
    expect(checkCopyVariants(deck, bad)).toMatchObject({ ok: false, reason: expect.stringMatching(/variant 1 \(Plain and direct\) edits t999, which this screen does not have/) });
  });

  it("refuses a duplicate stance, case and spacing aside", () => {
    const dup = { variants: [VOICES.variants[0]!, { ...VOICES.variants[1]!, stance: "plain  and DIRECT" }] };
    expect(checkCopyVariants(deck, dup)).toMatchObject({ ok: false, reason: expect.stringContaining("is variant 1's too") });
  });

  it("refuses a stance that is a paragraph, a missing why, no edits, and edits that change nothing", () => {
    const one = (patch: Record<string, unknown>) => ({ variants: [{ ...VOICES.variants[0]!, ...patch }] });
    expect(checkCopyVariants(deck, one({ stance: "a voice that says rather a lot" }))).toMatchObject({ ok: false, reason: expect.stringContaining("more than 5 words") });
    expect(checkCopyVariants(deck, one({ why: " " }))).toMatchObject({ ok: false, reason: expect.stringContaining("has no why") });
    expect(checkCopyVariants(deck, one({ edits: [] }))).toMatchObject({ ok: false, reason: expect.stringContaining("changes no words") });
    expect(checkCopyVariants(deck, one({ edits: [{ address: addr("Pay now"), to: "Pay now" }] }))).toMatchObject({ ok: false, reason: expect.stringContaining("changes no words") });
    expect(checkCopyVariants(deck, { variants: "three" })).toMatchObject({ ok: false });
  });

  it("holds a string to its role: a button stays one short line, nothing is emptied", () => {
    const one = (to: string, text = "Pay now") => ({ variants: [{ stance: "Loud", why: "Because.", edits: [{ address: addr(text), to }] }] });
    expect(checkCopyVariants(deck, one("Pay\nnow"))).toMatchObject({ ok: false, reason: expect.stringContaining("a button stays one line") });
    expect(checkCopyVariants(deck, one("Pay for everything in your basket right now please"))).toMatchObject({ ok: false, reason: expect.stringContaining("a button stays under 40") });
    expect(checkCopyVariants(deck, one("  "))).toMatchObject({ ok: false, reason: expect.stringContaining("does not remove them") });
    expect(checkCopyVariants(deck, one("Two items.\nShipped by Acme.", "Two items, shipped by Acme."))).toMatchObject({ ok: true });
  });
});

describe("placeholderCopyVariants — said as what they are", () => {
  it("passes the same check, with stances that say Placeholder and words that say so too", () => {
    const raw = placeholderCopyVariants(deck, 3);
    const r = checkCopyVariants(deck, raw, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.variants.map((v) => v.stance)).toEqual(["Placeholder A", "Placeholder B", "Placeholder C"]);
    expect(r.variants[1]!.edits.map((e) => e.to)).toEqual(["Placeholder heading B", "Placeholder button B"]);
    expect(r.variants[0]!.why).toContain("not written copy");
  });

  it("on a flow's deck, says so on every screen — a flow's voice is the whole flow's (copy-edit phase 5)", () => {
    const screens = ["itm_a", "itm_b", "itm_c"].map((itemId) => ({ itemId, title: itemId, deck }));
    const flow = flowCopyDeck(screens);
    const r = checkCopyVariants(flow, placeholderCopyVariants(flow, 2), 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byScreen = splitFlowEdits(r.variants[1]!.edits);
    expect([...byScreen.keys()]).toEqual(["itm_a", "itm_b", "itm_c"]);
    for (const edits of byScreen.values()) expect(edits.map((e) => e.to)).toEqual(["Placeholder heading B", "Placeholder button B"]);
  });
});

describe("a variant is words only", () => {
  it("applies each voice so the file is the original with only those strings swapped", () => {
    const r = checkCopyVariants(deck, VOICES, 3);
    if (!r.ok) throw new Error(r.reason);
    const [plain, warm, benefit] = r.variants.map((v) => applyCopyDeck(CHECKOUT, v.edits));
    expect(plain).toMatchObject({ ok: true, html: CHECKOUT.replace(">Review your order<", ">Check your order<").replace(">Pay now<", ">Pay<") });
    expect(warm).toMatchObject({ ok: true, html: CHECKOUT.replace(">Review your order<", ">Almost there — take a look<") });
    expect(benefit).toMatchObject({ ok: true, html: CHECKOUT.replace(">Pay now<", ">Get my order<").replace('placeholder="1234 5678"', 'placeholder="Your card number"') });
  });
});

describe("applyCopyDeckToFace — a visual face takes the same words", () => {
  it("lands each edit on the face's string at the same place, and refuses a face whose words differ", () => {
    const face = CHECKOUT.replace("<body class=\"screen\">", "<body class=\"screen\"><img src=\"data:image/png;base64,AAAA\">");
    const edits = [{ address: addr("Pay now"), text: "Pay now", to: "Pay" }];
    expect(applyCopyDeckToFace(deck, face, edits)).toMatchObject({ ok: true, html: face.replace(">Pay now<", ">Pay<") });
    expect(applyCopyDeckToFace(deck, face.replace("Pay now", "Buy now"), edits)).toMatchObject({ ok: false, reason: expect.stringContaining("visual face's words differ") });
  });
});

describe("copyVariantOps — /variation children, stacked under the source", () => {
  it("spells lineage's parent property and placement's gap exactly as they do", () => {
    expect(VARIANT_PARENT_PROP).toBe(PARENT_PROP);
    expect(VARIANT_GAP).toBe(PLACEMENT_GAP);
  });

  const item = (id: string, patch: Partial<Item> = {}): Item => ({
    id, title: "Acme checkout", x: 100, y: 200, width: 400, height: 300, versions: [], currentVersionId: "ver_1", properties: {}, createdAt: "2026-10-02T00:00:00.000Z", ...patch,
  } as unknown as Item);
  const version = (id: string) => ({ id, blobHash: `hash_${id}`, mimeType: "text/html", filename: "checkout.html", size: 10 });

  it("adds each as parent=<source>, titled with its stance, carrying stance and why, below the source and its children", () => {
    const source = item("itm_src");
    const earlier = item("itm_old", { y: 560, height: 300, properties: { parent: "itm_src" } });
    const canvas = { items: { itm_src: source, itm_old: earlier } } as unknown as CanvasContents;
    const r = checkCopyVariants(deck, VOICES, 3);
    if (!r.ok) throw new Error(r.reason);
    const ops = copyVariantOps(canvas, source, r.variants.map((variant, i) => ({ itemId: `itm_v${i}`, variant, version: version(`ver_${i}`), ...(i === 0 ? { properties: { fidelity: "wireframe" } } : {}) })));
    expect(ops.map((o) => o.title)).toEqual(["Acme checkout — Plain and direct", "Acme checkout — Warm", "Acme checkout — Benefit-first"]);
    expect(ops.map((o) => o.placement)).toEqual([
      { x: 100, y: 900, chosen: true },
      { x: 100, y: 1240, chosen: true },
      { x: 100, y: 1580, chosen: true },
    ]);
    expect(ops[0]!.properties).toEqual({ fidelity: "wireframe", parent: "itm_src", [COPY_STANCE_PROP]: "Plain and direct", [COPY_WHY_PROP]: "Says what happens and nothing else." });
    expect(ops[1]!.properties).toEqual({ parent: "itm_src", [COPY_STANCE_PROP]: "Warm", [COPY_WHY_PROP]: "Feels like a person is helping." });
    expect(ops.every((o) => o.type === "item.add" && o.width === 400 && o.height === 300 && !("containerId" in o))).toBe(true);
    expect(ops.map((o) => o.itemId)).toEqual(["itm_v0", "itm_v1", "itm_v2"]);
  });

  it("lands in the source's group, exactly where it is put", () => {
    const source = item("itm_src", { containerId: "itm_group" } as Partial<Item>);
    const canvas = { items: { itm_src: source } } as unknown as CanvasContents;
    const r = checkCopyVariants(deck, { variants: [VOICES.variants[1]!] });
    if (!r.ok) throw new Error(r.reason);
    const [op] = copyVariantOps(canvas, source, [{ itemId: "itm_a", variant: r.variants[0]!, version: version("ver_a") }]);
    expect(op).toMatchObject({ containerId: "itm_group", groupPlacement: "exact", placement: { x: 100, y: 540 } });
  });
});

/**
 * **Compare and mix** (copy-edit phase 3, journey scene 2): the rows where any
 * voice differs, the picks made one edit set on the SOURCE, words only, and
 * the ops — one version, every voice to the trash — that one group sends.
 * The real-daemon walk (pick from two voices, one undo) is
 * `packages/cli/test/words-mix.test.ts`; the web's is `copy-mix` in
 * `scripts/journeys.mjs`.
 */
describe("compare and mix — per string, from several voices", () => {
  const voiced = (v: (typeof VOICES.variants)[number]) => {
    const out = applyCopyDeck(CHECKOUT, v.edits.map((e) => ({ address: e.address, text: deck.strings.find((s) => s.address === e.address)!.text, to: e.to })));
    if (!out.ok) throw new Error(out.reason);
    return out.html;
  };
  const variants = VOICES.variants.map((v, i) => ({ itemId: `itm_v${i}`, stance: v.stance, deck: copyDeck(voiced(v)) }));
  const [plain, warm, benefit] = variants.map((v) => v.itemId) as [string, string, string];

  it("finds a source's voices — stance-bearing parent= children, top to bottom — and leaves a layout variation out", () => {
    const at = (id: string, y: number, properties: Record<string, string>) => ({ id, x: 0, y, properties }) as unknown as Item;
    const canvas = {
      items: {
        itm_src: at("itm_src", 0, {}),
        itm_b: at("itm_b", 900, { parent: "itm_src", [COPY_STANCE_PROP]: "Warm" }),
        itm_a: at("itm_a", 500, { parent: "itm_src", [COPY_STANCE_PROP]: "Plain" }),
        itm_layout: at("itm_layout", 700, { parent: "itm_src" }),
        itm_other: at("itm_other", 100, { parent: "itm_else", [COPY_STANCE_PROP]: "Warm" }),
      },
    } as unknown as CanvasContents;
    expect(copyVariantsOf(canvas, "itm_src").map((i) => i.id)).toEqual(["itm_a", "itm_b"]);
  });

  it("has one row per string any voice says differently, in reading order, with every voice's words", () => {
    const r = copyMixRows(deck, variants);
    if (!r.ok) throw new Error(r.reason);
    expect(r.rows.map((row) => row.source)).toEqual(["Review your order", "1234 5678", "Pay now"]);
    const heading = r.rows[0]!;
    expect(heading).toMatchObject({ address: addr("Review your order"), role: "heading" });
    expect(heading.variants).toEqual([
      { itemId: plain, text: "Check your order" },
      { itemId: warm, text: "Almost there — take a look" },
      { itemId: benefit, text: "Review your order" },
    ]);
  });

  it("refuses a voice that no longer lines up with its source string for string", () => {
    const moved = copyDeck(CHECKOUT.replace("<p>Two items, shipped by Acme.</p>", ""));
    const r = copyMixRows(moved, variants);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining('"Plain and direct" no longer lines up with its source') });
  });

  it("makes the picks one edit set on the source — the heading from one voice, the button from another — and changes only those words", () => {
    const picks = { [addr("Pay now")]: benefit, [addr("Review your order")]: warm };
    const r = copyMixEdits(deck, variants, picks, "itm_src");
    if (!r.ok) throw new Error(r.reason);
    // Reading order, whatever order the picks came in; each edit carries the source's text as its check.
    expect(r.edits).toEqual([
      { address: addr("Review your order"), text: "Review your order", to: "Almost there — take a look" },
      { address: addr("Pay now"), text: "Pay now", to: "Get my order" },
    ]);
    const out = applyCopyDeck(CHECKOUT, r.edits);
    if (!out.ok) throw new Error(out.reason);
    expect(copyDeck(out.html).strings.map((s) => s.text)).toEqual(deck.strings.map((s) => (s.text === "Review your order" ? "Almost there — take a look" : s.text === "Pay now" ? "Get my order" : s.text)));
    // Words only: the mixed file is the source byte for byte outside those two strings.
    expect(out.html).toBe(CHECKOUT.replace("Review your order</h1>", "Almost there — take a look</h1>").replace(">Pay now<", ">Get my order<"));
  });

  it("is a whole voice when every row comes from it", () => {
    const r = copyMixEdits(deck, variants, { [addr("Review your order")]: plain, [addr("Pay now")]: plain });
    if (!r.ok) throw new Error(r.reason);
    const out = applyCopyDeck(CHECKOUT, r.edits);
    if (!out.ok) throw new Error(out.reason);
    expect(out.html).toBe(voiced(VOICES.variants[0]!));
  });

  it("keeps the source's words where the pick is the source itself, and refuses in words what it cannot mix", () => {
    expect(copyMixEdits(deck, variants, { [addr("Pay now")]: "itm_src", [addr("Review your order")]: plain }, "itm_src")).toMatchObject({ ok: true, edits: [{ to: "Check your order" }] });
    expect(copyMixEdits(deck, variants, {}, "itm_src")).toEqual({ ok: false, reason: expect.stringContaining("the mix is the source's own words") });
    expect(copyMixEdits(deck, variants, { [addr("Pay now")]: "itm_src" }, "itm_src")).toEqual({ ok: false, reason: expect.stringContaining("the mix is the source's own words") });
    expect(copyMixEdits(deck, variants, { [addr("Pay now")]: "itm_nope" })).toEqual({ ok: false, reason: expect.stringContaining("itm_nope is not one of this screen's copy variants") });
    expect(copyMixEdits(deck, variants, { t999: plain })).toEqual({ ok: false, reason: expect.stringContaining("no string at t999") });
    expect(copyMixEdits(deck, variants, { [addr("Two items, shipped by Acme.")]: plain })).toEqual({ ok: false, reason: expect.stringContaining("no voice changed") });
    expect(copyMixEdits(deck, variants, { [addr("Pay now")]: warm })).toEqual({ ok: false, reason: expect.stringContaining('"Warm" kept') });
  });

  it("sends one version of the source, then every voice to the trash — convergeOps's shape, for one group", () => {
    const version = { id: "ver_mix", blobHash: "hash_mix", mimeType: "text/html", filename: "checkout.html", size: 10 };
    expect(copyMixOps("itm_src", version, [plain, warm, benefit])).toEqual([
      { type: "item.addVersion", itemId: "itm_src", version },
      { type: "item.delete", itemId: plain },
      { type: "item.delete", itemId: warm },
      { type: "item.delete", itemId: benefit },
    ]);
  });
});

describe("the product's voice — in the question, and in the check (copy-edit phase 4)", () => {
  const voice = parseVoiceSection("Plain, second person.\n\nAvoid: seamless\n\nGlossary:\n- sign in — never log in");

  it("reaches the prompt: tone, avoided words, glossary", () => {
    const { prompt } = copyVariantsRequest(deck, 2, undefined, voice);
    expect(prompt).toContain("The product's voice, from its DESIGN.md — keep to it in every variant:");
    expect(prompt).toContain("Tone: Plain, second person.");
    expect(prompt).toContain("Words to avoid — never write them: seamless.");
    expect(prompt).toContain('Say "sign in", never "log in".');
  });

  it("refuses a variant that writes an avoided word or a banned form, naming the variant and the string", () => {
    const avoided = { variants: [{ stance: "Smooth", why: "Feels easy.", edits: [{ address: addr("Pay now"), to: "Pay seamlessly" }, { address: addr("Review your order"), to: "A seamless checkout" }] }] };
    const out = checkCopyVariants(deck, avoided, 1, voice);
    expect(out).toEqual({ ok: false, reason: `variant 1 (Smooth) says "seamless" — the voice avoids it at ${addr("Review your order")} (heading) — DESIGN.md's Voice section` });
    const banned = { variants: [{ stance: "Account", why: "Asks first.", edits: [{ address: addr("Pay now"), to: "Log in to pay" }] }] };
    expect(checkCopyVariants(deck, banned, 1, voice)).toMatchObject({ ok: false, reason: expect.stringContaining('says "Log in" — the voice says "sign in", never "log in"') });
    // Without a voice, the same answers pass: the voice is the product's, not a rule of its own.
    expect(checkCopyVariants(deck, banned, 1).ok).toBe(true);
  });
});
