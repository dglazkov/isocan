import { describe, expect, it } from "vitest";
import { applyCopyDeck, checkCopyEdits, copyDeck, parseCopyEdits, wireCopyFile, type CopyEdit } from "../src/copy-deck.ts";
import { copyBudget } from "../src/copy-fit.ts";

/**
 * **The copy deck on plain HTML** (copy-edit phase 1). A screen's words as
 * data — role, address, reading order — and an apply that changes the words
 * and nothing else. The wire half (paths equal to the wireframe module's
 * `wordsOf`, a rendered screen) is `packages/modules/wireframe/test/copy-deck.test.ts`,
 * because only that package can render one.
 *
 * Synthetic: Acme's sign-in screen.
 */

const ACME = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Acme — sign in</title>
  <style>.cta { color: var(--accent); }</style>
  <script>window.track = () => "Do not read me";</script>
</head>
<body class="screen">
  <nav class="top"><a href="/">Home</a> <a href="/help">Help</a></nav>
  <main data-wf="main">
    <h1 class="title">Welcome back to Acme</h1>
    <p>Sign in to see your orders &amp; returns.</p>
    <form>
      <label for="email">Email</label>
      <input id="email" type="email" placeholder='you@acme.test'>
      <div role="alert" class="err">That password is not right</div>
      <button class="cta" type="submit">Sign in</button>
      <input type="submit" value="Continue">
    </form>
    <img src="hero.png" alt="Acme parcels on a shelf">
    <a href="/reset" class="link">Forgot your password?</a>
    <p data-copy-role="empty">No orders yet</p>
  </main>
</body>
</html>`;

describe("copyDeck — plain HTML", () => {
  const deck = copyDeck(ACME);

  it("reads the strings in reading order with their roles, skipping head, script and style", () => {
    expect(deck.kind).toBe("html");
    expect(deck.strings.map((s) => [s.role, s.text])).toEqual([
      ["nav", "Home"],
      ["nav", "Help"],
      ["heading", "Welcome back to Acme"],
      ["body", "Sign in to see your orders & returns."],
      ["label", "Email"],
      ["placeholder", "you@acme.test"],
      ["error", "That password is not right"],
      ["button", "Sign in"],
      ["button", "Continue"],
      ["alt", "Acme parcels on a shelf"],
      ["link", "Forgot your password?"],
      ["empty", "No orders yet"],
    ]);
    // Each string carries its role's budget (copy-fit.ts): a button gets one line, body copy is unbounded.
    expect(deck.strings.every((s) => JSON.stringify(s.budget) === JSON.stringify(copyBudget(s.role)))).toBe(true);
    expect(deck.strings.find((s) => s.role === "button")!.budget).toMatchObject({ lines: 1, chars: 40 });
  });

  it("addresses a text node by its ordinal and an attribute by element and name, and names the data-wf it sits in", () => {
    const by = Object.fromEntries(deck.strings.map((s) => [s.text, s]));
    expect(by["Welcome back to Acme"]!.address).toMatch(/^t\d+$/);
    expect(by["you@acme.test"]!.address).toMatch(/^a\d+@placeholder$/);
    expect(by["Continue"]!.address).toMatch(/^a\d+@value$/);
    expect(by["Acme parcels on a shelf"]!.address).toMatch(/^a\d+@alt$/);
    expect(by["Welcome back to Acme"]!.wf).toBe("main");
    expect(by["Home"]!.wf).toBeUndefined();
    expect(new Set(deck.strings.map((s) => s.address)).size).toBe(deck.strings.length);
  });
});

describe("applyCopyDeck — words only", () => {
  const deck = copyDeck(ACME);
  const at = (text: string) => deck.strings.find((s) => s.text === text)!;
  const edit = (text: string, to: string): CopyEdit => ({ address: at(text).address, text, to });

  it("changes the addressed text and attribute values, byte-identical everywhere else", () => {
    const r = applyCopyDeck(ACME, [
      edit("Welcome back to Acme", "Good to see you"),
      edit("Sign in to see your orders & returns.", "Your orders & returns are <here>."),
      edit("you@acme.test", "name@acme.test"),
      edit("Continue", 'Go "on"'),
      edit("Sign in", "Sign in"), // unchanged: not an edit
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The original with only those substrings swapped — and the escaping each place needs.
    const expected = ACME
      .replace(">Welcome back to Acme<", ">Good to see you<")
      .replace("Sign in to see your orders &amp; returns.", "Your orders &amp; returns are &lt;here>.")
      .replace("placeholder='you@acme.test'", "placeholder='name@acme.test'")
      .replace('value="Continue"', 'value="Go &quot;on&quot;"');
    expect(r.html).toBe(expected);
    expect(r.changed).toHaveLength(4);
    // And it reads back as the new words.
    expect(copyDeck(r.html).strings.map((s) => s.text)).toContain('Go "on"');
  });

  it("keeps a node's surrounding whitespace where it was", () => {
    const html = `<ul>\n  <li>\n    Acme Basic\n  </li>\n</ul>`;
    const s = copyDeck(html).strings[0]!;
    expect(s.text).toBe("Acme Basic");
    const r = applyCopyDeck(html, [{ address: s.address, text: s.text, to: "Acme Starter" }]);
    expect(r).toEqual({ ok: true, html: `<ul>\n  <li>\n    Acme Starter\n  </li>\n</ul>`, changed: [s.address] });
  });

  it("refuses a stale address by name, and writes nothing", () => {
    const moved = ACME.replace("Welcome back to Acme", "Hello again");
    const r = applyCopyDeck(moved, [edit("Welcome back to Acme", "Good to see you")]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain(at("Welcome back to Acme").address);
    expect(r.reason).toContain("heading");
    expect(r.reason).toContain('"Hello again"');
    expect(r.reason).toContain("changed since the deck was read");
  });

  it("refuses an address that is no longer there, a repeat, and an empty change", () => {
    expect(applyCopyDeck(ACME, [{ address: "t9999", text: "Acme", to: "x" }])).toMatchObject({ ok: false, reason: expect.stringContaining("no string at t9999") });
    const e = edit("Email", "Your email");
    expect(applyCopyDeck(ACME, [e, e])).toMatchObject({ ok: false, reason: expect.stringContaining("twice") });
    expect(applyCopyDeck(ACME, [edit("Email", "Email")])).toEqual({ ok: false, reason: "nothing changed" });
  });

  it("refuses a wireframe: its words are its spec's", () => {
    const wire = `<!doctype html>\n<!-- isocan:wireframe -->\n<html><head><script type="application/json" id="isocan-wireframe">{"title":"Orders","slots":[]}</script></head><body><h1>Orders</h1></body></html>`;
    expect(copyDeck(wire)).toEqual({ kind: "wire", strings: [], unfleshed: true });
    expect(applyCopyDeck(wire, [])).toMatchObject({ ok: false, reason: expect.stringContaining("wireframe") });
    expect(wireCopyFile(wire, [])).toMatchObject({ ok: false, reason: expect.stringContaining("wire flesh") });
  });
});

describe("parseCopyEdits", () => {
  it("takes the printed deck with a `to` beside the strings that change", () => {
    const deck = copyDeck(ACME);
    const file = { kind: deck.kind, strings: deck.strings.map((s) => (s.text === "Email" ? { ...s, to: "Work email" } : s)) };
    const edits = parseCopyEdits(JSON.parse(JSON.stringify(file)));
    expect(edits).toEqual([{ address: deck.strings.find((s) => s.text === "Email")!.address, text: "Email", to: "Work email" }]);
    expect(checkCopyEdits(deck, edits)).toMatchObject({ ok: true });
  });

  it("refuses a file that is not a deck, and an edit without its check", () => {
    expect(() => parseCopyEdits({ title: "x" })).toThrow(/copy deck/);
    expect(() => parseCopyEdits([{ address: "t1", to: "x" }])).toThrow(/no "text"/);
  });
});
