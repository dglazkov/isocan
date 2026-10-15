// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor, DesignBrief } from "@isocan/core";

/**
 * **The brief card draws said and inferred from `origin`** (proactive-agent
 * phase 5, design §7), and its Right is the brief's own update and nothing
 * else. The real `BriefCard` in jsdom over a synthetic Acme brief; the
 * mutation is the network edge, so its `run` is recorded rather than sent.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sent = vi.hoisted(() => ({ ops: [] as unknown[] }));
vi.mock("../src/lib/design-request-draft.ts", () => ({
  useDesignMutation: () => ({ run: async (op: unknown) => { sent.ops.push(op); }, pending: null, busy: false, error: "", refused: false, storageError: "", clear: () => {} }),
}));

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { BriefCard } = await import("../src/components/BriefCard.tsx");

const maya: Actor = { id: "usr_maya", name: "Maya" };
const brief: DesignBrief = {
  schemaVersion: 1, kind: "brief", requestId: "req_acme", epoch: 1, requestingActorId: maya.id,
  source: { entrance: "canvas-chat", threadId: "thr_1", commentId: "cmt_1" },
  progress: "active", intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null,
  audience: "regulars who order weekly", primaryTask: "a pre-order app", constraints: ["pickup only"],
  facts: [{ id: "never", name: "Never", value: "pushy", origin: "assumed", sources: [] }],
  context: { canvasId: "prj_acme", revision: 1, rootIds: [], expandedIds: [], includeExcluded: false, ambient: true, entries: [], counts: { included: 0, excluded: 0, unavailable: 0 } },
  references: [], outstandingDecisionIds: [], outputIds: [],
};
const ref = { home: "https://example.test", canvasId: "prj_acme", itemId: "itm_brief", versionId: "ver_brief", blobHash: "a".repeat(64) };
const row = { ref, brief, receipts: [], allowedActions: ["update"] };

let root: Root | null = null;
let host: HTMLDivElement;
beforeEach(() => {
  sent.ops.length = 0;
  useCanvasStore.setState({ canvasId: "prj_acme", canvas: { items: {}, threads: {}, trash: [] } as never, past: null });
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

describe("the brief card", () => {
  it("rules said lines solid and inferred ones in pencil, with Right and Wrong only on the inferred", () => {
    root = createRoot(host);
    act(() => root!.render(h(BriefCard, { canvasId: "prj_acme", actor: maya, row: row as never, canEdit: true, onChanged: () => {} })));
    const line = (cite: string) => host.querySelector(`[data-brief-line="${cite}"]`)!;
    expect(line("for").hasAttribute("data-said")).toBe(true);
    expect(line("for").textContent).toContain("regulars who order weekly");
    expect(line("never").hasAttribute("data-inferred")).toBe(true);
    expect(line("never").textContent).toContain("pushy · assumed");
    expect(line("now").hasAttribute("data-inferred")).toBe(true);
    expect(line("feel").hasAttribute("data-said") || line("feel").hasAttribute("data-inferred")).toBe(false);
    expect(line("for").querySelector("[data-brief-right]")).toBeNull();
    expect(line("never").querySelector("[data-brief-right]")).not.toBeNull();
    expect(line("never").querySelector("[data-brief-wrong]")).not.toBeNull();
  });

  it("Right sends the brief's update with that fact supplied, and nothing else", async () => {
    root = createRoot(host);
    act(() => root!.render(h(BriefCard, { canvasId: "prj_acme", actor: maya, row: row as never, canEdit: true, onChanged: () => {} })));
    await act(async () => (host.querySelector('[data-brief-line="never"] [data-brief-right]') as HTMLButtonElement).click());
    expect(sent.ops).toHaveLength(1);
    expect(sent.ops[0]).toMatchObject({ type: "design.request", action: { kind: "update", brief: ref, epoch: 1, patch: { facts: [{ id: "never", value: "pushy", origin: "supplied" }] } } });
  });

  it("draws no controls for a reader", () => {
    root = createRoot(host);
    act(() => root!.render(h(BriefCard, { canvasId: "prj_acme", actor: maya, row: row as never, canEdit: false, onChanged: () => {} })));
    expect(host.querySelector("[data-brief-right], [data-brief-wrong], [data-brief-edit]")).toBeNull();
  });
});
