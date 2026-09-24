import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FIDELITY_PROP, registerModule, unregisterModule, type Actor, type CoreModule, type Item } from "@isocan/core";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **A module's mark, on the web** (wireframes phase 2): a module record
 * declares a mark as data — the wireframe's 📐 keep is the first — and the
 * shell draws it, offers it in the item menu and answers its key without
 * importing the module. The record here is synthetic and shaped like the
 * wireframe's (whose own tests hold its values), because the shell must work
 * for any module's mark, and a test naming a module outside its directory is
 * refused (`test/modules.test.ts`). What this holds:
 * the entry is offered on a wireframe screen and nowhere else, it says what
 * pressing it does, it sends the same `item.update` the CLI's `wire keep`
 * sends (one group per gesture), and the key and the menu are one act.
 */

const { sent, state } = vi.hoisted(() => ({
  sent: [] as Array<{ op: unknown; group: string | undefined }>,
  state: { canvas: { items: {} as Record<string, unknown>, threads: {} } },
}));
vi.mock("../src/stores/canvasStore.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/stores/canvasStore.ts")>()),
  sendEchoed: async (_canvas: string, _actor: unknown, op: unknown, group?: string) => {
    sent.push({ op, group });
  },
  flashNotice: () => {},
  useCanvasStore: { getState: () => state },
}));
vi.mock("../src/lib/capability.ts", () => ({ canEditNow: () => true, useCanEdit: () => true }));
vi.mock("../src/lib/modulehost.ts", () => ({
  webHostFor: (_canvasId: string, actor: Actor) => ({ send: async () => {}, putBlob: async () => ({ blobHash: "h", size: 1 }), viewer: actor }),
}));

const { itemMenu, markByKey } = await import("../src/lib/menuentries.tsx");

const acmeMarks: CoreModule = {
  name: "@acme/marks",
  marks: [{ property: "wireKeep", emoji: "📐", title: "In the prototype", on: "Use in prototype", off: "Remove from prototype", key: "K", offeredOn: { [FIDELITY_PROP]: "wireframe" } }],
};

const actor: Actor = { id: "usr_a", name: "A" };
const ctx = { canvasId: "prj_acme", actor, world: { x: 0, y: 0 }, navigate: () => {} };

const item = (id: string, properties: Record<string, string>): Item =>
  ({ id, x: 0, y: 0, width: 390, height: 876, title: `Acme ${id}`, properties, currentVersionId: "ver_1", versions: [{ id: "ver_1", blobHash: "h", mimeType: "text/html", filename: `${id}.html`, size: 1 }] }) as unknown as Item;
const screen = (id: string, extra: Record<string, string> = {}) => item(id, { [FIDELITY_PROP]: "wireframe", ...extra });

const actions = (entries: MenuEntry[]): MenuAction[] => entries.filter((e): e is MenuAction => !("separator" in e));
const keepEntry = (entries: MenuEntry[]) => actions(entries).find((a) => a.label.startsWith("📐"));

beforeAll(() => registerModule(acmeMarks));
afterAll(() => unregisterModule(acmeMarks.name));
beforeEach(() => {
  sent.length = 0;
});

describe("the keep mark in the item menu", () => {
  it("is offered on a wireframe screen and on nothing else", () => {
    expect(keepEntry(itemMenu([screen("a")], ctx))?.label).toBe("📐 Use in prototype");
    expect(keepEntry(itemMenu([item("b", {})], ctx))).toBeUndefined();
    // A selection with one non-screen in it is not offered the mark at all.
    expect(keepEntry(itemMenu([screen("a"), item("b", {})], ctx))).toBeUndefined();
  });

  it("says Remove from prototype on a screen in it, and counts what a selection will move", () => {
    expect(keepEntry(itemMenu([screen("a", { wireKeep: "yes" })], ctx))?.label).toBe("📐 Remove from prototype");
    // Mixed: everything turns ON, and only the two unkept ones move.
    expect(keepEntry(itemMenu([screen("a", { wireKeep: "yes" }), screen("b"), screen("c")], ctx))?.label).toBe("📐 Use in prototype (2)");
  });

  it("sends the property patch `wire keep` sends — one op per screen that moves, one group per gesture, signed by the person", () => {
    keepEntry(itemMenu([screen("a", { wireKeep: "yes" }), screen("b"), screen("c")], ctx))!.run();
    // `<property>By` is who put the mark on: this person, not whatever picked the screen before.
    expect(sent.map((s) => s.op)).toEqual([
      { type: "item.update", itemId: "b", patch: { properties: { wireKeep: "yes", wireKeepBy: "usr_a" } } },
      { type: "item.update", itemId: "c", patch: { properties: { wireKeep: "yes", wireKeepBy: "usr_a" } } },
    ]);
    expect(new Set(sent.map((s) => s.group)).size).toBe(1);
  });

  it("takes anybody's mark off — a property has no owner — and who put it on goes with it", () => {
    // Put on by a machine (a composed flow's first choice): the mark says who, and that stops nobody.
    keepEntry(itemMenu([screen("a", { wireKeep: "yes", wireKeepBy: "jev" })], ctx))!.run();
    expect(sent.map((s) => s.op)).toEqual([{ type: "item.update", itemId: "a", patch: { removeProperties: ["wireKeep", "wireKeepBy"] } }]);
  });
});

describe("⇧K is the menu entry's act", () => {
  it("toggles the selected screens by the mark's key, and ignores a selection that is not a screen", () => {
    state.canvas.items = { a: screen("a"), b: item("b", {}) };
    void markByKey("KeyK", ["a", "b"], "prj_acme", actor);
    // A person's ⇧K is signed as theirs.
    expect(sent.map((s) => s.op)).toEqual([{ type: "item.update", itemId: "a", patch: { properties: { wireKeep: "yes", wireKeepBy: "usr_a" } } }]);
    sent.length = 0;
    void markByKey("KeyJ", ["a"], "prj_acme", actor);
    expect(sent).toEqual([]);
  });

  it("awaits the mark's `follow` after the marks are sent, in the same group, handed the canvas they left", async () => {
    const seen: Array<{ group: string; changed: string[]; on: boolean; sentBefore: number; canvas: unknown; viewer: string }> = [];
    const following: CoreModule = {
      name: "@acme/following",
      marks: [{
        ...acmeMarks.marks![0]!,
        key: "J",
        follow: async ({ group, changed, on, host }) => {
          seen.push({ group, changed: changed.map((i) => i.id), on, sentBefore: sent.length, canvas: host.getCanvas(), viewer: host.viewer.id });
        },
      }],
    };
    registerModule(following);
    try {
      state.canvas.items = { a: screen("a"), b: screen("b") };
      await markByKey("KeyJ", ["a", "b"], "prj_acme", actor);
      expect(sent.length).toBe(2);
      expect(seen).toEqual([{ group: sent[0]!.group, changed: ["a", "b"], on: true, sentBefore: 2, canvas: state.canvas, viewer: "usr_a" }]);
    } finally {
      unregisterModule(following.name);
    }
  });

  it("is answered by the canvas's key handler and listed in the help panel", () => {
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    expect(read("../src/pages/CanvasPage.tsx")).toMatch(/moduleMarks\(\)\.some\(\(m\) => "Key" \+ m\.key == e\.code\)/);
    // The panel lists them through core's `markShortcuts`, which reads the loaded marks — the same rows `isocan shortcuts` prints.
    expect(read("../src/components/HelpPanel.tsx")).toContain("markShortcuts()");
    expect(read("../../core/src/shortcuttext.ts")).toContain("moduleMarks()");
    expect(read("../src/components/ItemView.tsx")).toContain("moduleMarks().map(");
  });
});
