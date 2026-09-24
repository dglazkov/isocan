import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { CanvasState } from "@isocan/core";
import { applyOperation } from "@isocan/core";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
const transport = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real,
    useMemo: (make: () => unknown) => make(),
    useState: <T,>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [hooks.slots[index], (value: T | ((old: T) => T)) => { hooks.slots[index] = typeof value === "function" ? (value as (old: T) => T)(hooks.slots[index] as T) : value; }];
    },
  };
});
vi.mock("../src/stores/canvasStore.ts", async (original) => {
  const real = await original<typeof import("../src/stores/canvasStore.ts")>();
  return { ...real, sendEchoedResult: transport.post, useCanvasStore: Object.assign((select: (state: ReturnType<typeof real.useCanvasStore.getState>) => unknown) => select(real.useCanvasStore.getState()), real.useCanvasStore) };
});
vi.mock("../src/stores/uiStore.ts", async (original) => {
  const real = await original<typeof import("../src/stores/uiStore.ts")>();
  return { ...real, useUiStore: Object.assign((select: (state: ReturnType<typeof real.useUiStore.getState>) => unknown) => select(real.useUiStore.getState()), real.useUiStore) };
});
import { TrashPanel } from "../src/components/TrashPanel.tsx";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

const actor = { id: "usr_acme", name: "Acme" };
function render() { hooks.cursor = 0; return TrashPanel({ canvasId: "prj_acme", actor }); }
function nodes(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function restoreButton() { return nodes(render()).find((node) => node.type === "button" && node.props.children === "Restore")!; }
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
beforeEach(() => {
  hooks.slots = []; transport.post.mockReset();
  let state: CanvasState | null = null;
  const ops = [
    { type: "project.create", canvasId: "prj_acme", title: "Acme" },
    { type: "item.add", itemId: "itm_acme", title: "Acme", width: 100, height: 80, placement: { x: 0, y: 0 }, version: { id: "ver_acme", blobHash: "hash_acme", filename: "acme.md", mimeType: "text/markdown", size: 4 } },
    { type: "item.delete", itemId: "itm_acme" },
  ] as const;
  for (const op of ops) state = applyOperation(state, { id: `op_${op.type}`, canvasId: "prj_acme", actor, ts: "2026-09-13T00:00:00Z", op });
  useCanvasStore.setState({ canvasId: "prj_acme", record: state!.project, canvas: state!.canvas, confirmed: state, capability: "edit" });
  useUiStore.setState({ trashOpen: true });
});

describe("mounted Trash follows its queued restore receipt", () => {
  it.each(["accepted", "refused"] as const)("unlocks after %s even when closed and reopened while queued", async (status) => {
    let release!: (outcome: { status: "accepted" | "refused"; message?: string }) => void;
    const completion = new Promise<{ status: "accepted" | "refused"; message?: string }>((resolve) => { release = resolve; });
    transport.post.mockResolvedValue({ status: "queued", completion });
    (restoreButton().props.onClick as () => void)(); await settle();
    expect(restoreButton().props.disabled).toBe(true);
    useUiStore.setState({ trashOpen: false }); expect(render()).toBeNull();
    useUiStore.setState({ trashOpen: true }); expect(restoreButton().props.disabled).toBe(true);
    (restoreButton().props.onClick as () => void)(); await settle();
    expect(transport.post).toHaveBeenCalledTimes(1);
    release({ status, ...(status === "refused" ? { message: "Acme restore changed" } : {}) }); await settle();
    expect(restoreButton().props.disabled).toBe(false);
    expect(nodes(render()).some((node) => node.props.children === (status === "accepted" ? "Restored 1 item." : "Acme restore changed"))).toBe(true);
  });
});
