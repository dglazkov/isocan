// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { GroupAction } from "@isocan/core";
import { resolveGroupOperation } from "@isocan/core";
import { groupFixture } from "../../api/test/group-fixture.ts";

/**
 * **The group layout form saves what it lets you make, and clears a grid**
 * (Loop finding, 30 Sep 2026). Lowering "Grid rows" below the named rows used
 * to save `{ rowCount: 2, rows: [Q1, Q2, Q3] }`, which the writer refused; and
 * nothing in the web sent `clearGrid`. The form now trims labels in the same
 * save, says which before it does, and has "Clear grid" — and for both acts
 * it sends exactly the action the CLI's `canvas group grid` sends, because
 * both build it with core's `groupGridAction` / `groupGridLayout`.
 *
 * The real form is rendered (jsdom, `createRoot`); the send is stood in for
 * at `changeCanvasGroup`, and the CLI's side is the real `CanvasGroups.grid`
 * over the in-memory transport, with its outgoing action recorded.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sent = vi.hoisted(() => ({ actions: [] as unknown[] }));
vi.mock("../src/lib/canvasgroups.ts", async (original) => ({
  ...(await original<object>()),
  changeCanvasGroup: async (_canvasId: string, _actor: unknown, action: unknown) => { sent.actions.push(action); },
}));
vi.mock("../src/lib/api.ts", async (original) => ({ ...(await original<object>()), readBlobText: async () => "" }));

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { GroupLayoutControls } = await import("../src/components/GroupLayoutControls.tsx");

let root: Root | null = null;
let host: HTMLDivElement;
beforeEach(() => { sent.actions.length = 0; host = document.createElement("div"); document.body.appendChild(host); });
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); });

/** A 3×3 Acme board, every row and column named, one card in the bottom-right cell. */
async function board() {
  const f = groupFixture(); f.card("late");
  const group = (await f.api.new("Acme board", { at: { x: 0, y: 0 }, size: { width: 1600, height: 1600 } })).itemId!;
  await f.api.grid(group, { rows: 3, columns: 3 }, { rows: ["Q1", "Q2", "Q3"], columns: ["Now", "Next", "Later"] });
  await f.api.add(group, ["late"], { place: true, cell: { row: 3, column: 3 } });
  const cli: GroupAction[] = [];
  const send = f.client.changeGroup;
  f.client.changeGroup = (canvasId, who, action, opId) => { cli.push(action); return send(canvasId, who, action, opId); };
  return { f, group, cli };
}
async function render(f: Awaited<ReturnType<typeof board>>["f"], group: string) {
  useCanvasStore.setState({ canvasId: f.state.project.id, record: f.state.project, canvas: f.state.canvas });
  root = createRoot(host);
  await act(async () => root!.render(h(GroupLayoutControls, { canvasId: f.state.project.id, actor: f.actor, item: f.state.canvas.items[group]! })));
}
async function type(label: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function press(name: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === name);
  expect(button, `no "${name}" button`).toBeTruthy();
  await act(async () => { button!.click(); });
}

describe("the group layout form and the CLI send one grid act", () => {
  it("a shrink to 2×2 names what it drops, saves one valid op, and equals the CLI's grid 2x2", async () => {
    const { f, group, cli } = await board();
    await render(f, group);
    await type("Grid rows", "2");
    await type("Grid columns", "2");
    expect(host.textContent).toContain("Removes labels: Q3, Later");
    await press("Save layout");
    expect(sent.actions).toHaveLength(1);
    const web = sent.actions[0] as GroupAction;
    expect(web).toEqual({ kind: "layout", itemId: group, layout: expect.objectContaining({ rowCount: 2, columnCount: 2, rows: ["Q1", "Q2"], columns: ["Now", "Next"] }) });
    // The writer accepts it: one group op.
    expect(resolveGroupOperation(f.state, { type: "group.change", action: web }, { actor: f.actor, ts: "2026-09-30T12:00:00.000Z", opId: "op_web" }).type).toBe("group.change");
    const before = f.writes.length;
    await f.api.grid(group, { rows: 2, columns: 2 });
    expect(f.writes).toHaveLength(before + 1);
    expect(cli).toEqual([web]);
    // The card in the vanished cell stays put and stays a member.
    expect(f.state.canvas.items.late).toMatchObject({ containerId: group });
  });

  it("Clear grid sends the CLI's --clear act", async () => {
    const { f, group, cli } = await board();
    await render(f, group);
    await press("Clear grid");
    expect(sent.actions).toHaveLength(1);
    expect(sent.actions[0]).toMatchObject({ kind: "layout", itemId: group, clearGrid: true });
    await f.api.grid(group, null);
    expect(cli).toEqual(sent.actions);
  });

  it("offers no Clear grid on a group without one, and no trim note until a count drops", async () => {
    const f = groupFixture();
    const group = (await f.api.new("Acme plain", { at: { x: 0, y: 0 } })).itemId!;
    await render(f, group);
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Clear grid")).toBe(false);
    expect(host.textContent).not.toContain("Removes labels");
  });
});
