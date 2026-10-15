import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { Actor, Item } from "@isocan/core";
import { ALIGN_EDGES, alignLabel, keyFor, SHORTCUTS } from "@isocan/core";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { canvasMenu, itemMenu } from "../src/lib/menuentries.tsx";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **A right-click menu is a door to what the canvas can already do.**
 *
 * Almost every entry has a key, a double-click or a CLI verb behind it, and
 * the menu exists so nobody has to have read the shortcut list to find them.
 * Two are genuinely new — Download and Copy link — because they are what a
 * person reaches for on a menu and has never had here.
 *
 * What is guarded is the part that rots: the accelerators. They are looked up
 * from `SHORTCUTS` rather than spelled in the menu, so a rebound key cannot
 * leave the menu promising the old one — and a `shortcutFor` naming an entry
 * that does not exist renders a BLANK key, which is the failure this file
 * exists for. It happened while writing it: ⌘C and ⌘V had been implemented
 * and never registered, so Copy and Paste were about to ship keyless.
 */

const actor: Actor = { id: "usr_a", name: "A" };
const ctx = {
  canvasId: "prj_1",
  actor,
  world: { x: 0, y: 0 },
  navigate: () => {},
};

const item = (id: string, versions = 1): Item =>
  ({
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: id,
    properties: {},
    currentVersionId: "ver_1",
    versions: Array.from({ length: versions }, (_, n) => ({
      id: `ver_${n + 1}`,
      blobHash: "h",
      mimeType: "text/plain",
      filename: `${id}.txt`,
      size: 1,
    })),
  }) as unknown as Item;

const actions = (entries: MenuEntry[]): MenuAction[] =>
  entries.filter((e): e is MenuAction => !("separator" in e));
const labels = (entries: MenuEntry[]) => actions(entries).map((a) => a.label);
const find = (entries: MenuEntry[], label: string) =>
  actions(entries).find((a) => a.label.startsWith(label));
/** The menu as a person reads it: headings as "— Name", rules as "—". */
const shape = (entries: MenuEntry[]) =>
  entries.map((e) => ("separator" in e ? (e.separator ? `— ${e.separator}` : "—") : e.label));

describe("every accelerator the menu prints is a real one", () => {
  it("never shows a blank key", () => {
    // A `shortcutFor` naming a `does` that does not exist looks fine in the
    // source and renders an empty `<kbd>`. This is the only way to catch it.
    const all = [...itemMenu([item("itm_a")], ctx), ...canvasMenu(ctx)];
    for (const action of actions(all)) {
      if (!action.shortcutFor) continue;
      expect(keyFor(action.shortcutFor), `${action.label} names a shortcut nobody has`).toBeTruthy();
    }
  });

  it("covers the two keys that were implemented and never registered", () => {
    // Copy and paste shipped as ⌘C/⌘V without a SHORTCUTS row, so `?` and
    // `isocan shortcuts` did not know they existed.
    expect(keyFor("Copy the selection")).toBe("⌘C");
    expect(keyFor("Paste")).toBe("⌘V");
  });
});

describe("the item menu", () => {
  afterEach(() => useCanvasStore.setState({ capability: "edit", record: null } as never));

  it("offers the acts an item has", () => {
    const entries = itemMenu([item("itm_a", 2)], ctx);
    for (const label of ["Copy", "Cut", "Duplicate", "View", "Edit", "Enter", "Fit", "Rename", "Version history", "Compare versions", "Download", "Copy link", "Delete"]) {
      expect(labels(entries), `missing ${label}`).toContain(label);
    }
  });

  it("marks the destructive one, and only it", () => {
    const entries = itemMenu([item("itm_a")], ctx);
    expect(actions(entries).filter((a) => a.danger).map((a) => a.label)).toEqual(["Delete"]);
  });

  /**
   * **Left out when it cannot apply, not dimmed** (14 Oct 2026). This test
   * said the opposite until Dion counted twenty-four rows on four items, a
   * third of them grey: a menu that is mostly grey teaches people to stop
   * reading it. Dimmed is for "not right now", where seeing it is the hint.
   */
  it("leaves out what cannot apply to this selection rather than dimming it", () => {
    const many = itemMenu([item("itm_a"), item("itm_b")], ctx);
    for (const label of ["View", "Edit", "Enter", "Rename", "Version history", "Compare versions", "Explain", "Copy link", "Download", "Agents always read this", "Agents skip this"]) {
      expect(labels(many), `${label} on two items`).not.toContain(label);
    }
    expect(actions(many).filter((a) => a.disabled).map((a) => a.label)).toEqual([]);
    const single = itemMenu([item("itm_a")], ctx);
    for (const label of ["Tidy", "Arrange", "Align"]) expect(labels(single).some((l) => l.startsWith(label)), `${label} on one item`).toBe(false);
    expect(actions(single).filter((a) => a.disabled).map((a) => a.label)).toEqual([]);
  });

  it("is the same skeleton for one item and for four, most used first", () => {
    expect(shape(itemMenu([item("itm_a", 2)], ctx))).toEqual([
      "— Groups", "Preview group conversion…", "Group selection", "Add to group…",
      "—", "Copy", "Cut", "Duplicate",
      "—", "View", "Edit", "Enter", "Fit",
      "—", "Rename", "Version history", "Compare versions", "Explain",
      "—", "Copy link", "Download",
      "— For agents", "Agents always read this", "Agents skip this",
      "—", "🎬 Make this a slide",
      "—", "Delete",
    ]);
    const four = ["itm_a", "itm_b", "itm_c", "itm_d"].map((id) => item(id));
    expect(shape(itemMenu(four, ctx))).toEqual([
      "— Groups", "Preview group conversion…", "Group selection", "Add to group…",
      "—", "Tidy 4 items", "Arrange",
      "—", "Copy 4 items", "Cut", "Duplicate",
      "—", "Fit",
      "—", "🎬 Make 4 slides",
      "—", "Delete 4 items",
    ]);
  });

  it("puts the arranging that needs an answer under Arrange, worded by core's edges", () => {
    const arrange = (n: number) => find(itemMenu(Array.from({ length: n }, (_, i) => item(`itm_${i}`)), ctx), "Arrange")!.submenu!;
    const edges = ALIGN_EDGES.map((edge) => `Align ${alignLabel(edge).toLowerCase()}`);
    expect(shape(arrange(2))).toEqual([...edges, "—", "Pack into a grid"]);
    // Space evenly is the web's group-canvas act, and needs a middle to move.
    useCanvasStore.setState({ record: { groupMode: "groups" } } as never);
    expect(shape(arrange(2))).toEqual([...edges, "—", "Pack into a grid"]);
    expect(shape(arrange(3))).toEqual([...edges, "—", "Space evenly across", "Space evenly down", "—", "Pack into a grid"]);
    // Smart is a canvas-wide reading order; it lives in ⌘K and the CLI, not here.
    expect(JSON.stringify(itemMenu([item("itm_a"), item("itm_b")], ctx))).not.toMatch(/smart/i);
  });

  it("says what agents do with an item, as a ticked pair", () => {
    const rows = (props: Record<string, string>) => {
      const one = { ...item("itm_a"), properties: props } as Item;
      return actions(itemMenu([one], ctx)).filter((a) => a.label.startsWith("Agents"));
    };
    expect(rows({}).map((a) => [a.label, a.checked])).toEqual([["Agents always read this", false], ["Agents skip this", false]]);
    expect(rows({ context: "pinned" }).map((a) => a.checked)).toEqual([true, false]);
    expect(rows({ context: "excluded" }).map((a) => a.checked)).toEqual([false, true]);
  });

  it("drops every write on a view-only canvas, and the headings left with nothing under them", () => {
    useCanvasStore.setState({ capability: "read" } as never);
    const single = itemMenu([item("itm_a", 2)], ctx);
    expect(actions(single).some((a) => a.writes)).toBe(false);
    expect(shape(single)).toEqual([
      "— Groups", "Preview group conversion…",
      "—", "Copy",
      "—", "View", "Enter", "Fit",
      "—", "Version history", "Compare versions", "Explain",
      "—", "Copy link", "Download",
    ]);
    const four = ["itm_a", "itm_b", "itm_c", "itm_d"].map((id) => item(id));
    expect(shape(itemMenu(four, ctx))).toEqual(["— Groups", "Preview group conversion…", "—", "Copy 4 items", "—", "Fit"]);
  });

  it("counts what it will act on, so the label cannot lie", () => {
    const many = itemMenu([item("itm_a"), item("itm_b")], ctx);
    expect(labels(many)).toContain("Copy 2 items");
    expect(labels(many)).toContain("Delete 2 items");
  });

  it("offers version history only where there is history", () => {
    expect(find(itemMenu([item("itm_a", 1)], ctx), "Version")).toBeUndefined();
    expect(find(itemMenu([item("itm_a", 3)], ctx), "Version")?.disabled).toBeFalsy();
  });
});

describe("the canvas menu", () => {
  it("dims paste when the clipboard is empty", () => {
    // Empty by default in a fresh store — the honest state for a menu opened
    // before anything has been copied.
    expect(find(canvasMenu(ctx), "Paste")?.disabled).toBe(true);
  });

  it("offers writing text where the click landed", () => {
    expect(labels(canvasMenu(ctx))).toContain("Write text here");
  });
});

/**
 * **⇧D, in all three places somebody might look for it.**
 *
 * A shortcut nobody can discover is a shortcut nobody has. The accelerator is
 * declared ONCE in core's `SHORTCUTS` and read from there by the shortcuts
 * modal and by the context menu (`shortcutFor`), so a rebound key cannot leave
 * one of them telling somebody the old one. The launcher shows it too — that
 * is most of what a launcher is for.
 */
describe("Download has a key, and every surface knows it", () => {
  const row = SHORTCUTS.find((s) => s.does === "Download");

  it("is in the one registry", () => {
    expect(row, "no SHORTCUTS row for Download").toBeDefined();
    expect(row!.keys).toContain("⇧D");
  });

  it("is bound on the canvas, and shifted rather than bare", () => {
    /* The unshifted letters are the tools. A canvas where `d` writes to your
       disk is a canvas where a mistyped tool saves a file. */
    const page = read("pages/CanvasPage.tsx");
    expect(page).toMatch(/e\.shiftKey && e\.key\.toLowerCase\(\) === "d"/);
    expect(page).toContain("downloadItem(");
  });

  it("calls the same function the menu calls", () => {
    /* Two doors onto one act, never two implementations of it — the second
       would be the one that forgets the filename. */
    expect(read("lib/menuentries.tsx")).toContain("downloadItem(");
    expect(read("lib/actions.ts")).toContain("downloadItem(");
  });

  it("shows the key in the menu by lookup, not by spelling it", () => {
    const menu = read("lib/menuentries.tsx");
    const entry = menu.slice(menu.indexOf('label: "Download"'), menu.indexOf('label: "Download"') + 260);
    expect(entry).toContain('shortcutFor: "Download"');
    expect(entry).not.toContain("⇧D");
  });

  it("is offered by the launcher, with the key shown", () => {
    const actions = read("lib/actions.ts");
    const entry = actions.slice(actions.indexOf('id: "download"'), actions.indexOf('id: "download"') + 300);
    expect(entry).toContain('keys: "⇧D"');
  });

  it("is offered only for a single item, everywhere that offers it", () => {
    /* A "download" of six is a different feature. Quietly saving the first of
       them is the worst answer available, so all three refuse rather than
       guess. */
    const actions = read("lib/actions.ts");
    const entry = actions.slice(actions.indexOf('id: "download"'), actions.indexOf('id: "download"') + 400);
    expect(entry).toMatch(/selection\.length === 1/);
    expect(read("pages/CanvasPage.tsx")).toMatch(/ids\.length === 1 \? canvas\?\.items/);
  });
});

/** The web sources, for the guards that read them. */
function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");
}

it("hands keyboard focus to submenu children only after their React commit", () => {
  const menu = read("components/ContextMenu.tsx");
  const submenu = menu.slice(menu.indexOf("function Submenu"));
  expect(menu).toContain('focused.dataset.menuIntent = "keyboard-open"');
  expect(submenu).toMatch(/useLayoutEffect\(\(\) => \{\s*if \(!open \|\| !focusChildren\) return;/);
  expect(submenu).toContain('first?.focus()');
  // Hover asks the menu's aim (lib/menuaim.ts) and never asks for focus.
  expect(submenu).toContain('onPointerEnter={() => aim.want(entry.label)}');
  expect(menu).toContain('parent.dataset.menuIntent = "close"');
  expect(menu).not.toContain('queueMicrotask');
});
