import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMANDS,
  EXTENSION_ICONS,
  LABEL_LIMIT,
  PANEL_ROLE,
  PANEL_SIDES,
  TITLE_LIMIT,
  TOOL_ROLE,
  isPanelExtension,
  isToolExtension,
  panelCapabilities,
  panelExtensionItems,
  panelProperties,
  readPanelExtension,
  readToolExtension,
  toolCapabilities,
  toolExtensionItems,
  toolProperties,
  type CanvasContents,
  type Item,
  type PanelBytes,
  type SlashCommand,
} from "../src/index.ts";

/**
 * Stage 1 of `docs/projects/extensions/design.md`, held to the sentence the
 * whole design turns on:
 *
 * > **An extension may only ask for what a person could ask for.**
 *
 * Every refusal below is that sentence applied, and the tests are written
 * against the RULE rather than against the message, so rewording a refusal
 * does not redden the suite and weakening one does.
 */

const commands: SlashCommand[] = DEFAULT_COMMANDS;
const read = (o: unknown) => readToolExtension(JSON.stringify(o), commands);
const tidy = { kind: "tool", label: "Tidy", icon: "broom", does: "/format" };

describe("a declarative tool", () => {
  it("is the design's own example, and it reads", () => {
    // Straight out of the design doc. If this ever stops working the doc is
    // lying to whoever reads it first.
    const { tool, problem } = read(tidy);
    expect(problem).toBeUndefined();
    expect(tool).toEqual({ kind: "tool", label: "Tidy", icon: "broom", does: "/format" });
  });

  it("keeps the words after the command, because a person could type those too", () => {
    const { tool } = read({ ...tidy, does: "/format tighten the rows" });
    expect(tool?.does).toBe("/format tighten the rows");
  });

  it("is an item, found by one property", () => {
    expect(toolProperties()).toEqual({ role: TOOL_ROLE });
    expect(isToolExtension(item("a", { role: "tool" }))).toBe(true);
    expect(isToolExtension(item("b", { role: "design-system" })).valueOf()).toBe(false);
    expect(isToolExtension(item("c", {}))).toBe(false);
  });

  it("lists oldest first, so the rail does not reshuffle when one is edited", () => {
    const canvas = {
      items: {
        b: { ...item("b", { role: "tool" }), createdAt: "2026-09-02T00:00:00Z" },
        a: { ...item("a", { role: "tool" }), createdAt: "2026-09-01T00:00:00Z" },
        plain: item("plain", {}),
      },
    };
    expect(toolExtensionItems(canvas as never).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("what a tool may not be", () => {
  it("refuses a command this canvas does not have — the rule, stated", () => {
    // The sentence itself: a tool naming `/deploy` is asking for something no
    // person on this canvas could ask for either.
    const { tool, problem } = read({ ...tidy, does: "/deploy" });
    expect(tool).toBeUndefined();
    expect(problem).toContain("/deploy");
  });

  it("refuses an icon of its own", () => {
    /**
     * A security rule, not a style one: an icon is a place somebody would
     * otherwise paint anything at all, including a convincing copy of a
     * control that already exists.
     */
    for (const icon of ["<svg/>", "https://example.com/i.png", "data:image/png;base64,AA", "padlock"]) {
      expect(read({ ...tidy, icon }).tool, `icon ${icon} was accepted`).toBeUndefined();
    }
    for (const icon of EXTENSION_ICONS) expect(read({ ...tidy, icon }).tool).toBeDefined();
  });

  it("refuses to wear the app's own name, however it is spelled", () => {
    /**
     * From *it must look like an extension*: a control that looks exactly like
     * isocan is a place to put a convincing "sign in to continue". A check
     * that only catches the exact string is a check that catches nobody who is
     * actually trying, so the comparison ignores case and punctuation.
     */
    for (const label of ["Comment", "comment", "C O M M E N T", "isocan", "Add", "-add-"]) {
      expect(read({ ...tidy, label }).tool, `label "${label}" was accepted`).toBeUndefined();
    }
    // And does not over-reach: a word that merely contains one is fine.
    expect(read({ ...tidy, label: "Commentary" }).tool).toBeDefined();
  });

  it("refuses a label too long for a rail, and one with no words at all", () => {
    expect(read({ ...tidy, label: "x".repeat(LABEL_LIMIT) }).tool).toBeDefined();
    expect(read({ ...tidy, label: "x".repeat(LABEL_LIMIT + 1) }).tool).toBeUndefined();
    expect(read({ ...tidy, label: "   " }).tool).toBeUndefined();
    expect(read({ ...tidy, label: 12 }).tool).toBeUndefined();
  });

  it("refuses a panel, and says which verb reads one", () => {
    // Named rather than ignored: a manifest that quietly does nothing is worse
    // than one that says where it should have been taken. Phase 3 built the
    // panel reader, so this sentence names it — it used to say "stage 3", and
    // a refusal that points at an unbuilt stage ages into a lie.
    const { problem } = read({ ...tidy, kind: "panel" });
    expect(problem).toContain("isocan panel add");
  });

  it("says which line to fix rather than 'invalid manifest'", () => {
    // A refusal is read by whoever wrote the file, so it names the field.
    expect(readToolExtension("{", commands).problem).toContain("JSON");
    expect(readToolExtension("[]", commands).problem).toContain("list");
    expect(read({ label: "Tidy", icon: "broom", does: "/format" }).problem).toContain("kind");
    expect(read({ kind: "tool", icon: "broom", does: "/format" }).problem).toContain("label");
    expect(read({ kind: "tool", label: "Tidy", icon: "broom" }).problem).toContain("does");
    expect(read({ ...tidy, does: "format" }).problem).toContain("slash command");
  });
});

describe("the capability list, before you keep it", () => {
  /**
   * Stage 2, deliberately built at stage 1 for the reason the design gives:
   * *the habit has to exist before the tier that depends on it.*
   */
  it("is derived, never declared", () => {
    // A manifest that stated its own capabilities could understate them.
    const { tool } = read({ ...tidy, does: "/format tighten the rows" });
    const said = toolCapabilities(tool!, commands).join("\n");
    expect(said).toContain("posts a comment as you");
    expect(said, "the words it always sends are part of what it can do").toContain("tighten the rows");
    expect(said).toContain("undoable per actor");
  });

  it("tells apart a command answered in the app from one an agent carries out", () => {
    const local = commands.find((c) => c.local);
    expect(local, "no local built-in to check against").toBeTruthy();
    const { tool } = read({ ...tidy, does: `/${local!.name}` });
    const said = toolCapabilities(tool!, commands).join("\n");
    expect(said).toContain("answers in the app");
    expect(said).not.toContain("posts a comment as you");
  });

  it("says a tool is unavailable rather than pretending it works", () => {
    /**
     * The design's own open question — *what happens to a canvas whose
     * extension is gone?* — in miniature: a tool read while its home command
     * existed, asked about after it went away.
     */
    const { tool } = read(tidy);
    const said = toolCapabilities(tool!, []).join("\n");
    expect(said).toContain("does not have");
  });
});

function item(id: string, properties: Record<string, string>): Item {
  return {
    id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    title: `${id}.json`,
    description: "",
    properties,
    createdAt: "2026-09-06T00:00:00Z",
    updatedAt: "2026-09-06T00:00:00Z",
  } as Item;
}

/**
 * **Phase 3: the panel manifest, and one reader.** The same sentence again —
 * *an extension may only ask for what a person could ask for* — plus the one
 * the hosted tier turns on: **no reading past the canvas it is on.** `src`
 * names an item HERE, and every refusal below is one of those two rules
 * applied and written against the RULE rather than the wording.
 */

const review = { kind: "panel", title: "Acme Review", side: "left", src: "review.html" };

/** A canvas holding one HTML page called `review.html`, which is what a
 * person does first: `isocan add review.html`, then the manifest naming it. */
function canvasWith(...items: Item[]): CanvasContents {
  return { items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [] };
}

function page(id: string, title: string, mimeType = "text/html", opts: { versions?: boolean } = {}): Item {
  const version = { id: `ver_${id}`, blobHash: `hash-${id}`, mimeType, filename: title, size: 12 };
  return {
    ...item(id, {}),
    title,
    versions: opts.versions === false ? [] : [version],
    currentVersionId: opts.versions === false ? undefined : version.id,
  } as unknown as Item;
}

const here = canvasWith(page("itm_page", "review.html"));
const readPanel = (o: unknown, canvas: CanvasContents = here) => readPanelExtension(JSON.stringify(o), canvas);

describe("a declarative panel", () => {
  it("reads, and says where its bytes actually are", () => {
    const { panel, problem } = readPanel(review);
    expect(problem).toBeUndefined();
    expect(panel?.title).toBe("Acme Review");
    expect(panel?.side).toBe("left");
    expect(panel?.src).toBe("review.html");
    // Resolved, not declared: the frame phase 4 builds needs a blob hash to
    // put after the content base, and a manifest that carried one would be a
    // manifest that could name bytes this canvas does not have. Written as a
    // typed expectation so that a field appearing or changing shape is a
    // compile error here rather than a surprise there.
    const bytes: PanelBytes = { itemId: "itm_page", blobHash: "hash-itm_page", filename: "review.html", mimeType: "text/html" };
    expect(panel?.bytes).toEqual(bytes);
  });

  it("follows the item, so editing the page is what changes the panel", () => {
    // The whole argument for naming an ITEM rather than a hash: a new version
    // of the page is a new panel, and a bad one rolls back with the item.
    const edited = page("itm_page", "review.html");
    (edited as { versions: { blobHash: string }[] }).versions[0]!.blobHash = "hash-second-draft";
    expect(readPanel(review, canvasWith(edited)).panel?.bytes.blobHash).toBe("hash-second-draft");
  });

  it("is an item, found by one property", () => {
    expect(panelProperties()).toEqual({ role: PANEL_ROLE });
    expect(isPanelExtension(item("a", { role: "panel" }))).toBe(true);
    expect(isPanelExtension(item("b", { role: "tool" }))).toBe(false);
    expect(isPanelExtension(item("c", {}))).toBe(false);
  });

  it("lists oldest first, so the dock does not reshuffle when one is edited", () => {
    const canvas = {
      items: {
        b: { ...item("b", { role: "panel" }), createdAt: "2026-09-02T00:00:00Z" },
        a: { ...item("a", { role: "panel" }), createdAt: "2026-09-01T00:00:00Z" },
        tool: item("tool", { role: "tool" }),
      },
    };
    expect(panelExtensionItems(canvas as never).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("what a panel may not be", () => {
  it("refuses a src that is not on this canvas — the rule, stated", () => {
    // *No reading past the canvas it is on.* A panel naming a page nobody put
    // here is asking for bytes no person on this canvas could show either.
    const { panel, problem } = readPanel({ ...review, src: "elsewhere.html" });
    expect(panel).toBeUndefined();
    expect(problem).toContain("src");
    expect(problem).toContain("elsewhere.html");
  });

  it("refuses a src with a host of its own, however it is spelled", () => {
    // The failure the rule exists for: a panel whose page comes from a server
    // the author controls is a panel nobody on this canvas can see or version.
    for (const src of ["https://acme.example/panel.html", "//acme.example/panel.html", "/review.html", "data:text/html,<b>hi", "javascript:alert(1)"]) {
      const { panel, problem } = readPanel({ ...review, src });
      expect(panel, `src ${src} was accepted`).toBeUndefined();
      expect(problem).toContain("src");
    }
  });

  it("refuses a src two items answer to", () => {
    // A panel that could mean either is a panel whose bytes nobody can name —
    // and picking one would be picking silently.
    const twice = canvasWith(page("itm_one", "review.html"), page("itm_two", "review.html"));
    expect(readPanel(review, twice).panel).toBeUndefined();
    expect(readPanel(review, twice).problem).toContain("src");
  });

  it("refuses a src with no bytes, and one that is not a page", () => {
    expect(readPanel(review, canvasWith(page("itm_page", "review.html", "text/html", { versions: false }))).problem).toContain("src");
    expect(readPanel(review, canvasWith(page("itm_page", "review.html", "image/png"))).problem).toContain("src");
    expect(readPanel(review, canvasWith(page("itm_page", "review.html", "image/png"))).problem).toContain("image/png");
  });

  it("refuses to wear the app's own name, however it is spelled", () => {
    /**
     * The tool's reserved labels, pointed at the dock: a panel that looks
     * exactly like isocan is a place to put a convincing "sign in to
     * continue". "I S O C A N" and "isocan" are ONE attempt, so the
     * comparison flattens case and punctuation — a check that only catches
     * the exact string catches nobody who is actually trying.
     */
    for (const title of ["isocan", "I S O C A N", "IsoCan", "-isocan-", "Chat", "chat", "Files", "f i l e s", "Agents", "Context", "Personas", "Main"]) {
      expect(readPanel({ ...review, title }).panel, `title "${title}" was accepted`).toBeUndefined();
    }
    // And does not over-reach: a name that merely contains one is fine.
    expect(readPanel({ ...review, title: "Acme Context Notes" }).panel).toBeDefined();
  });

  it("refuses a title too long for a dock header, and one with no words at all", () => {
    expect(readPanel({ ...review, title: "x".repeat(TITLE_LIMIT) }).panel).toBeDefined();
    expect(readPanel({ ...review, title: "x".repeat(TITLE_LIMIT + 1) }).panel).toBeUndefined();
    expect(readPanel({ ...review, title: "   " }).panel).toBeUndefined();
    expect(readPanel({ ...review, title: 12 }).panel).toBeUndefined();
  });

  it("refuses a slot the app does not have", () => {
    // isocan draws the slot, so a panel may only name one that exists — the
    // closed-set argument the icons make, about geometry instead of pixels.
    for (const side of PANEL_SIDES) expect(readPanel({ ...review, side }).panel).toBeDefined();
    for (const side of ["right", "floating", "over the canvas", 1]) {
      expect(readPanel({ ...review, side }).panel, `side ${side} was accepted`).toBeUndefined();
    }
  });

  it("says which line to fix rather than 'invalid manifest'", () => {
    expect(readPanelExtension("{", here).problem).toContain("JSON");
    expect(readPanelExtension("[]", here).problem).toContain("list");
    expect(readPanel({ title: "Acme Review", side: "left", src: "review.html" }).problem).toContain("kind");
    expect(readPanel({ ...review, kind: "tool" }).problem).toContain("isocan tool add");
    expect(readPanel({ kind: "panel", side: "left", src: "review.html" }).problem).toContain("title");
    expect(readPanel({ kind: "panel", title: "Acme Review", src: "review.html" }).problem).toContain("side");
    expect(readPanel({ kind: "panel", title: "Acme Review", side: "left" }).problem).toContain("src");
  });
});

describe("what a panel may do, before you keep it", () => {
  it("is derived, and names where its bytes come from", () => {
    const { panel } = readPanel(review);
    const said = panelCapabilities(panel!).join("\n");
    expect(said).toContain("review.html");
    expect(said).toContain("itm_page");
    expect(said, "a panel's bytes are on this canvas and nowhere else").toContain("on this canvas");
  });

  it("names the capability a manifest would never declare about itself", () => {
    // It is not the manifest that decides what this panel shows — it is
    // whoever may edit the page. A declared list would leave that out, which
    // is the whole reason the list is derived.
    const said = panelCapabilities(readPanel(review).panel!).join("\n");
    expect(said).toContain("edit review.html");
  });

  it("does not claim powers this phase has not built", () => {
    /**
     * The honest half, and the one worth a test: there is no frame (phase 4)
     * and no door (phase 6), so the list says what the panel WILL be able to
     * do and that it cannot yet. A capability list that overstated would be
     * worse than none — somebody reads it before pressing --yes.
     */
    const said = panelCapabilities(readPanel(review).panel!).join("\n");
    expect(said).toContain("cannot run yet");
    expect(said).toContain("cannot send an operation");
    expect(said, "the frame is the content origin's, never the app's").toContain("content origin");
    expect(said, "it paints in its slot and nowhere else").toContain("left dock");
  });
});
