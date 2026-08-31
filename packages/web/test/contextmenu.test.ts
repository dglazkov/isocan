import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Actor, Item } from "@isocan/core";
import { keyFor, SHORTCUTS } from "@isocan/core";
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
  it("offers the acts an item has", () => {
    const entries = itemMenu([item("itm_a", 2)], ctx);
    for (const label of ["Copy", "Cut", "Duplicate", "Rename", "Download", "Copy link", "Delete"]) {
      expect(labels(entries), `missing ${label}`).toContain(label);
    }
  });

  it("marks the destructive one, and only it", () => {
    const entries = itemMenu([item("itm_a")], ctx);
    expect(actions(entries).filter((a) => a.danger).map((a) => a.label)).toEqual(["Delete"]);
  });

  it("dims what does not apply rather than removing it", () => {
    // A menu whose shape changes between one open and the next is a menu you
    // cannot learn — so single-item acts are shown, dimmed, on a multi-select.
    const many = itemMenu([item("itm_a"), item("itm_b")], ctx);
    expect(find(many, "Rename")?.disabled).toBe(true);
    expect(find(many, "Download")?.disabled).toBe(true);
    expect(find(many, "Copy")?.disabled).toBeFalsy();
  });

  it("counts what it will act on, so the label cannot lie", () => {
    const many = itemMenu([item("itm_a"), item("itm_b")], ctx);
    expect(labels(many)).toContain("Copy 2 items");
    expect(labels(many)).toContain("Delete 2 items");
  });

  it("offers version history only where there is history", () => {
    expect(find(itemMenu([item("itm_a", 1)], ctx), "Version")?.disabled).toBe(true);
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
