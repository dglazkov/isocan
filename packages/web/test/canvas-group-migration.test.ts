import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasGroupMigrationPreview, CanvasState, Operation } from "@isocan/core";
import { applyOperation } from "@isocan/core";

// React slots let these tests invoke the real form and its handlers. Transport
// remains the production API/store path, including queue and refusal handling.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as Array<() => unknown> }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real,
    useCallback: (fn: unknown) => fn,
    useEffect: (fn: () => unknown, deps: unknown[]) => {
      const index = hooks.cursor++;
      const key = JSON.stringify(deps);
      if (hooks.slots[index] !== key) { hooks.slots[index] = key; hooks.effects.push(fn); }
    },
    useState: <T,>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [hooks.slots[index], (value: T | ((old: T) => T)) => { hooks.slots[index] = typeof value === "function" ? (value as (old: T) => T)(hooks.slots[index] as T) : value; }];
    },
  };
});
vi.mock("../src/stores/canvasStore.ts", async (original) => {
  const real = await original<typeof import("../src/stores/canvasStore.ts")>();
  return { ...real, useCanvasStore: Object.assign((select: (state: ReturnType<typeof real.useCanvasStore.getState>) => unknown) => select(real.useCanvasStore.getState()), real.useCanvasStore) };
});
vi.mock("../src/stores/uiStore.ts", async (original) => {
  const real = await original<typeof import("../src/stores/uiStore.ts")>();
  return { ...real, useUiStore: Object.assign((select: (state: ReturnType<typeof real.useUiStore.getState>) => unknown) => select(real.useUiStore.getState()), real.useUiStore) };
});
import { GroupMigration, MigrationReview } from "../src/components/GroupMigration.tsx";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { openGroupCreation, openGroupAddition } from "../src/lib/canvasgroups.ts";
import { canvasGroupEntries } from "../src/lib/canvasgroupmenus.ts";
import { CanvasCard } from "../src/components/CanvasCard.tsx";
import { ViewerGate } from "../src/App.tsx";
import { CANVAS_GROUPS_REQUIRED } from "@isocan/core";

const actor = { id: "usr_acme", name: "Acme" };
const box = { x: 0, y: 0, width: 500, height: 500 };
let preview: CanvasGroupMigrationPreview;
let initial: CanvasState;
let posted: Array<{ op: Operation; originGroupMode?: string }>;
function row(id: string, parentAfter: string | null = null): CanvasGroupMigrationPreview["live"][number] { return { itemId: id, title: id, kindBefore: "text", kindAfter: "text", parentBefore: null, parentAfter, boxBefore: box, boxAfter: box }; }
function render() {
  hooks.cursor = 0;
  const tree = GroupMigration({ canvasId: "prj_acme", actor });
  for (const effect of hooks.effects.splice(0)) effect();
  return tree;
}
function nodes(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function button(label: string) { return nodes(render()).find((node) => node.type === "button" && node.props.children === label); }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
beforeEach(() => {
  hooks.slots = []; hooks.effects = []; posted = [];
  initial = applyOperation(null, { id: "op_birth", canvasId: "prj_acme", actor, ts: "2026-09-13T00:00:00Z", op: { type: "project.create", canvasId: "prj_acme", title: "Acme", groupMode: "legacy" } })!;
  useCanvasStore.setState({ canvasId: "prj_acme", confirmed: initial, project: initial.project, canvas: initial.canvas, lastSeq: 3, past: null, queue: [], refused: [], capability: "edit" });
  useUiStore.setState({ groupDialog: { kind: "migrate", itemIds: [] } });
  preview = { canvasId: "prj_acme", revision: 3, migrationVersion: 1, status: "ready", fromMode: "legacy", toMode: "groups", boundary: null,
    live: [{ ...row("itm_area"), kindBefore: "area", kindAfter: "group" }, row("itm_card", "itm_area")],
    trash: [{ ...row("itm_trash"), kindBefore: "area", kindAfter: "group", restorePolicy: "frame-only" }],
    ambiguities: [{ itemId: "itm_card", candidateIds: ["itm_area", "itm_tie"], chosenId: "itm_area" }], danglingAnnotations: ["itm_ink"], repairs: [{ itemId: "itm_area", location: "live", boxBefore: box, boxAfter: { ...box, y: -80, height: 580 }, reasons: ["Reserve title and grid label gutters"] }], history: { undoBoundarySeq: 4, explanation: "Older undo stops here. Exact conversion undo requires no later live, trash or redo dependencies." } };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/groups/migration")) return Response.json(preview);
    posted.push(JSON.parse(String(init?.body)));
    return Response.json({ error: "Preview revision changed", code: "group-conflict" }, { status: 409 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("conversion is a reviewed writer request", () => {
  it.each([CANVAS_GROUPS_REQUIRED, "not-admitted", "offline"])("handles the new-arrival %s snapshot outcome without inventing an access decision", async (code) => {
    const before = useCanvasStore.getState();
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (code === "offline") throw new TypeError("Failed to fetch");
      return Response.json({ error: "Acme response", code }, { status: code === CANVAS_GROUPS_REQUIRED ? 426 : 403 });
    }));
    const door = createElement("div", null, "Identity door");
    const gate = () => { hooks.cursor = 0; const tree = ViewerGate({ canvasId: "prj_acme", itemId: null, door }); for (const effect of hooks.effects.splice(0)) effect(); return tree; };
    gate(); await settle();
    const tree = gate();
    const reload = nodes(tree).some((node) => node.type === "button" && node.props.children === "Reload app");
    expect(reload).toBe(code === CANVAS_GROUPS_REQUIRED);
    expect(nodes(tree).some((node) => node.props.children === "Identity door")).toBe(code !== CANVAS_GROUPS_REQUIRED);
    expect(useCanvasStore.getState().queue).toBe(before.queue);
    expect(useCanvasStore.getState().confirmed).toBe(before.confirmed);
  });
  it("renders ownership, ties, repairs, dangling links, trash and the history boundary", () => {
    const html = renderToStaticMarkup(createElement(MigrationReview, { preview }));
    for (const text of ["itm_card", "itm_area", "itm_tie", "itm_ink", "itm_trash", "Reserve title and grid label gutters", "frame only", "Older undo stops here", "sequence 4"]) expect(html).toContain(text);
    expect(html).not.toMatch(/<img|<iframe|item-thumb/);
  });
  it("keeps a complete large preview accessible through explicit pages without content previews", () => {
    preview.live = Array.from({ length: 1000 }, (_, i) => row(`itm_${i}`)); preview.trash = [];
    const html = renderToStaticMarkup(createElement(MigrationReview, { preview }));
    expect(html.match(/data-migration-item-id=/g)).toHaveLength(50);
    expect(html).toContain("1000 live records"); expect(html).toContain("of 1000"); expect(html).toContain("Next");
  });
  it("submits exactly the reviewed revision and keeps the legacy state when refused", async () => {
    render(); await settle();
    expect(button("Convert canvas to groups")?.props.disabled).toBe(false);
    (button("Convert canvas to groups")!.props.onClick as () => void)(); await settle();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ originGroupMode: "legacy", op: { type: "group.change", action: { kind: "migrate", expectedRevision: 3 } } });
    expect(useCanvasStore.getState().confirmed).toEqual(initial);
    expect(useCanvasStore.getState().project?.groupMode).toBe("legacy");
    expect(nodes(render()).some((node) => node.props.role === "alert" && String(node.props.children).includes("Refresh the preview"))).toBe(true);
  });
  it("requires refresh after a newer revision and hides conversion from readers", async () => {
    render(); await settle(); useCanvasStore.setState({ lastSeq: 4 });
    expect(button("Convert canvas to groups")?.props.disabled).toBe(true);
    (button("Convert canvas to groups")!.props.onClick as () => void)(); await settle(); expect(posted).toEqual([]);
    useCanvasStore.setState({ capability: "read" }); expect(button("Convert canvas to groups")).toBeUndefined();
  });
  it("keeps queued conversion in legacy mode and blocks a second confirm after reopening", async () => {
    render(); await settle();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/groups/migration")) return Response.json(preview);
      throw new TypeError("Failed to fetch");
    }));
    (button("Convert canvas to groups")!.props.onClick as () => void)(); await settle();
    expect(useCanvasStore.getState().project?.groupMode).toBe("legacy");
    expect(useCanvasStore.getState().queue).toHaveLength(1);
    hooks.slots = []; hooks.effects = [];
    render(); await settle();
    expect(button("Convert canvas to groups")?.props.disabled).toBe(true);
    (button("Convert canvas to groups")!.props.onClick as () => void)(); await settle();
    expect(useCanvasStore.getState().queue).toHaveLength(1);
  });
  it("offers migration from legacy creation and membership paths without writing", () => {
    openGroupCreation(["itm_card"]); expect(useUiStore.getState().groupDialog?.kind).toBe("migrate");
    useUiStore.setState({ groupDialog: null }); openGroupAddition(["itm_card"]); expect(useUiStore.getState().groupDialog?.kind).toBe("migrate");
    const entry = canvasGroupEntries([], { canvasId: "prj_acme", actor, navigate: () => {} }).find((row) => "label" in row && row.label === "Preview group conversion…");
    expect(entry).not.toHaveProperty("writes"); expect(posted).toEqual([]);
  });
  it("draws group frames behind members in canvas thumbnails without counting frames as files", () => {
    const version = { id: "ver_acme", blobHash: "hash_acme", filename: "acme.md", mimeType: "text/markdown", size: 4 };
    let state = initial;
    for (const [id, kind] of [["itm_inner", "group"], ["itm_outer", "group"], ["itm_card", "text"]] as const) state = applyOperation(state, { id: `op_${id}`, canvasId: "prj_acme", actor, ts: "2026-09-13T00:00:00Z", op: { type: "item.add", itemId: id, title: id, width: 500, height: 500, placement: { x: 0, y: 0 }, properties: { kind }, version: { ...version, id: `ver_${id}` } } })!;
    state.canvas.items.itm_inner!.containerId = "itm_outer";
    state.canvas.items.itm_card!.containerId = "itm_inner";
    hooks.slots = [{ kind: "ready", title: "Acme", canvas: state.canvas, here: 0 }]; hooks.cursor = 0;
    const html = renderToStaticMarkup(createElement(CanvasCard, { canvasId: "prj_acme", width: 500, height: 500 }));
    expect(html).toContain("1 item");
    expect(html.indexOf('title="itm_outer"')).toBeLessThan(html.indexOf('title="itm_inner"'));
    expect(html.indexOf('title="itm_inner"')).toBeLessThan(html.indexOf('title="itm_card"'));
    expect(html.match(/kind-area/g)).toHaveLength(2);
  });
});
