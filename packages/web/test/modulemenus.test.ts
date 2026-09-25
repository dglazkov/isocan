import { describe, expect, it, vi } from "vitest";
import { FIDELITY_PROP, type Actor, type Item, type ModuleMenuFacts } from "@isocan/core";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **A module's rows in the item menu** (24 Sep 2026, wireframes: right-click
 * a wire → Style ▸). A loaded module's `menu` is asked for rows for the
 * items the menu is for, and the shell draws them — a submenu with a tick,
 * like its own — without knowing the module. A pick opens the module's own
 * dialog with the words a slash command would carry, through the store's
 * one door (`openModuleDialog`). The module here is synthetic and shaped
 * like the wireframe's, whose own tests hold its rows (`test/modules.test.ts`
 * refuses a module named outside its directory).
 */

const { state, opened } = vi.hoisted(() => ({
  state: { canvas: { items: {} as Record<string, unknown>, threads: {} } },
  opened: [] as Array<[string, string | undefined]>,
}));
vi.mock("../src/stores/canvasStore.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/stores/canvasStore.ts")>()),
  flashNotice: () => {},
  useCanvasStore: { getState: () => state },
}));
vi.mock("../src/lib/capability.ts", () => ({ canEditNow: () => true, useCanEdit: () => true }));

const { itemMenu } = await import("../src/lib/menuentries.tsx");
const { addModule } = await import("../src/modules.ts");
const { useUiStore } = await import("../src/stores/uiStore.ts");
useUiStore.setState({ openModuleDialog: (id: string, args?: string) => void opened.push([id, args]) } as never);

const asked: ModuleMenuFacts[] = [];
addModule({
  core: { name: "@acme/menus" },
  menu: (facts) => {
    asked.push(facts);
    if (!facts.items.every((i) => i.properties?.[FIDELITY_PROP] === "wireframe")) return [];
    return [{
      label: "Style",
      value: "House",
      writes: true,
      run: () => {},
      submenu: [
        { label: "House", checked: true, writes: true, run: () => facts.open("acme", "style house") },
        { separator: "Packs" },
        { label: "Acme", checked: false, writes: true, run: () => facts.open("acme", "style acme") },
      ],
    }];
  },
} as never);

const actor: Actor = { id: "usr_a", name: "A" };
const ctx = { canvasId: "prj_acme", actor, world: { x: 0, y: 0 }, navigate: () => {} };
const item = (id: string, properties: Record<string, string>): Item =>
  ({ id, x: 0, y: 0, width: 390, height: 844, title: `Acme ${id}`, properties, currentVersionId: "ver_1", versions: [] }) as unknown as Item;
const screen = (id: string) => item(id, { [FIDELITY_PROP]: "wireframe" });
const actions = (entries: MenuEntry[]): MenuAction[] => entries.filter((e): e is MenuAction => !("separator" in e));
const styleRow = (entries: MenuEntry[]) => actions(entries).find((a) => a.label === "Style");

describe("a module's rows in the item menu", () => {
  it("appear on the items the module says they are for, and on nothing else", () => {
    const row = styleRow(itemMenu([screen("a")], ctx))!;
    expect(row).toMatchObject({ label: "Style", value: "House", writes: true });
    expect(asked.at(-1)).toMatchObject({ canvas: state.canvas, items: [expect.objectContaining({ id: "a" })] });
    expect(styleRow(itemMenu([item("b", {})], ctx))).toBeUndefined();
    expect(styleRow(itemMenu([screen("a"), item("b", {})], ctx))).toBeUndefined();
  });

  it("draw as the shell's own submenu — ticks and a labelled separator — and a pick opens the module's dialog with its words", () => {
    const row = styleRow(itemMenu([screen("a")], ctx))!;
    expect(row.submenu!.map((r) => ("separator" in r ? `— ${r.separator}` : `${r.checked ? "✓ " : ""}${r.label}`))).toEqual(["✓ House", "— Packs", "Acme"]);
    opened.length = 0;
    (row.submenu![2] as MenuAction).run();
    expect(opened).toEqual([["acme", "style acme"]]);
  });
});
