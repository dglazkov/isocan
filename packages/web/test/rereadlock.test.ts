// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor, ItemVersion } from "@isocan/core";

/**
 * **A re-read is not a reason to lock a form** (cleanup RH-5, 27 Sep 2026).
 *
 * Five design panels re-read their workflow on every op anybody makes on the
 * canvas (`lastSeq`) and on a poll, and each set its `checking` flag for the
 * length of every read — so a panel that already had its reading in hand
 * disabled its forms, hid its actions and announced "Checking…" whenever
 * anything happened anywhere, a teammate's cursor-free drag included. What
 * locks a form is having nothing to act on: the first read of a scope, or a
 * read that failed. A refresh over a reading in hand keeps the form open and
 * swaps the reading in when it lands.
 *
 * Each case renders the real panel (jsdom, `createRoot`), lets the first read
 * land, then moves `lastSeq` with the next read held open, and asks the gate
 * the panel hands its form while that read is in flight. The children that
 * receive the gate are stood in for, so the panel's own decision is what is
 * measured; the readers are the network edge and are stubbed there.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seen = vi.hoisted(() => ({ gates: [] as Array<{ who: string; checking: boolean }> }));
const readers = vi.hoisted(() => ({
  requests: vi.fn(),
  reviews: vi.fn(),
  comparisons: vi.fn(),
  system: vi.fn(),
  blobText: vi.fn(),
}));

vi.mock("../src/lib/whilevisible.ts", () => ({ everyWhileVisible: () => () => {} }));
vi.mock("../src/lib/capability.ts", async (original) => ({ ...(await original<object>()), useCanEdit: () => true, canEditNow: () => true }));
vi.mock("@isocan/api/design-request", async (original) => ({ ...(await original<object>()), readDesignRequests: readers.requests }));
vi.mock("@isocan/api/design-review", async (original) => ({ ...(await original<object>()), readDesignReviews: readers.reviews }));
vi.mock("@isocan/api/design-decision", async (original) => ({ ...(await original<object>()), readDesignComparisons: readers.comparisons }));
vi.mock("@isocan/api/design-system", async (original) => ({ ...(await original<object>()), readDesignSystem: readers.system }));
vi.mock("../src/lib/api.ts", async (original) => ({ ...(await original<object>()), readBlobText: readers.blobText }));
// The children the gate is handed to, recorded rather than drawn.
vi.mock("../src/components/DesignTaskCard.tsx", () => ({
  DesignTaskCard: ({ checking }: { checking: boolean }) => { seen.gates.push({ who: "task-card", checking }); return null; },
}));
vi.mock("../src/components/DesignReviewHandoff.tsx", () => ({
  DesignReviewHandoff: ({ canEdit }: { canEdit: boolean }) => { seen.gates.push({ who: "review-handoff", checking: !canEdit }); return null; },
}));
vi.mock("../src/components/DesignComparisonActions.tsx", () => ({
  DesignComparisonActions: ({ checking }: { checking: boolean }) => { seen.gates.push({ who: "comparison-actions", checking }); return null; },
}));
vi.mock("../src/components/DesignComparisonRecovery.tsx", () => ({ DesignComparisonRecovery: () => null }));
vi.mock("../src/components/ExactReferenceCard.tsx", () => ({ LocalExactReferenceCard: () => null }));
vi.mock("../src/components/DesignReviewButton.tsx", () => ({ DesignReviewButton: () => null }));
vi.mock("../src/components/DesignTaskReceipt.tsx", () => ({ DesignReceiptView: () => null }));
vi.mock("../src/components/DesignRecipeLibrary.tsx", () => ({ DesignRecipeLibrary: () => null }));

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { DesignTaskPanel } = await import("../src/components/DesignTaskPanel.tsx");
const { DesignReviewPanel } = await import("../src/components/DesignReviewPanel.tsx");
const { DesignComparisonDialog } = await import("../src/components/DesignComparisonDialog.tsx");
const { DesignRecordFace } = await import("../src/components/DesignRecordFace.tsx");
const { DesignSystemsDialog } = await import("../src/components/DesignSystemsDialog.tsx");

const acme: Actor = { id: "usr_acme", name: "Acme" };
const source = { entrance: "canvas-chat", threadId: "thr_acme", commentId: "cmt_acme" } as const;
/** Enough of a request row for a panel to decide to draw its card. */
const row = { ref: { versionId: "ver_brief" }, brief: { requestId: "req_acme", source }, receipts: [], allowedActions: ["update"] };

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  seen.gates.length = 0;
  for (const read of Object.values(readers)) read.mockReset();
  useCanvasStore.setState({ canvasId: "prj_acme", lastSeq: 1, past: null });
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

/** Draw it, let the first read land, then move the canvas with the next
 * read held open — and answer what the form was handed meanwhile. */
async function rereadWith(render: () => ReturnType<typeof h>, read: ReturnType<typeof vi.fn>, first: unknown, settled?: () => void) {
  read.mockResolvedValueOnce(first);
  root = createRoot(host);
  await act(async () => root!.render(render()));
  await act(async () => {});
  settled?.();
  // Open once the first read lands — so what the op does is what is measured.
  const last = seen.gates.at(-1);
  if (last) expect(last.checking, `${last.who} was locked even before the op`).toBe(false);
  read.mockReturnValue(new Promise(() => {}));
  const before = seen.gates.length;
  await act(async () => useCanvasStore.setState({ lastSeq: 2 }));
  expect(read.mock.calls.length, "the panel did not re-read on the op — this case measures nothing").toBeGreaterThanOrEqual(2);
  return seen.gates.slice(before);
}

describe("a design panel keeps its form open while it re-reads", () => {
  it("the task panel does not lock its cards", async () => {
    const after = await rereadWith(
      () => h(DesignTaskPanel, { canvasId: "prj_acme", actor: acme }),
      readers.requests,
      { requests: [row], unavailable: [] },
    );
    expect(after.length, "the card was not drawn after the op").toBeGreaterThan(0);
    expect(after.filter((g) => g.checking), "the task card was locked by a background re-read").toEqual([]);
  });

  it("the review panel does not take the handoff away", async () => {
    const after = await rereadWith(
      () => h(DesignReviewPanel, { canvasId: "prj_acme", actor: acme, requestId: "req_acme", threadId: undefined, canEdit: true, selected: null, select: () => {} }),
      readers.reviews,
      { runs: [], unavailable: [], offers: [] },
    );
    expect(after.length).toBeGreaterThan(0);
    expect(after.filter((g) => g.checking), "the handoff lost its standing to a background re-read").toEqual([]);
    expect(host.textContent).not.toContain("Checking the saved review");
  });

  it("the comparison dialog does not lock its actions", async () => {
    const comparison = {
      source, status: "open", reasons: [], references: [], author: acme,
      comparison: { id: "cmp_acme", uncertainty: "structure", fidelity: "wireframe", mode: "comparison", scenario: "", alternatives: [], recommendedAlternativeId: "", recommendation: "", revision: 1, requestId: "req_acme", target: {} },
    };
    const after = await rereadWith(
      () => h(DesignComparisonDialog, { canvasId: "prj_acme", actor: acme, filter: { requestId: "req_acme" }, initialSource: source as never, onClose: () => {} }),
      readers.comparisons,
      { comparisons: [comparison], decisions: [], unavailable: [] },
    );
    expect(after.length).toBeGreaterThan(0);
    expect(after.filter((g) => g.checking), "the comparison's actions were locked by a background re-read").toEqual([]);
  });

  it("a design record's face does not lock the card it draws", async () => {
    readers.blobText.mockResolvedValue(JSON.stringify({}));
    const version = { id: "ver_brief", blobHash: "a".repeat(64), mimeType: "application/json", filename: "acme.json", size: 2, designRecord: { kind: "brief", requestId: "req_acme" } } as unknown as ItemVersion;
    // The brief itself is parsed by core; a synthetic blob that does not parse
    // would stop the read before the request, so the parse is what is stood in.
    const briefs = await import("@isocan/core/design-brief");
    vi.spyOn(briefs, "parseDesignBrief").mockReturnValue({ kind: "brief" } as never);
    const after = await rereadWith(
      () => h(DesignRecordFace, { canvasId: "prj_acme", version, actor: acme }),
      readers.requests,
      { requests: [row], unavailable: [] },
    );
    expect(after.length, "the card was not drawn after the op").toBeGreaterThan(0);
    expect(after.filter((g) => g.checking), "the record's card was locked by a background re-read").toEqual([]);
  });

  it("the design-system dialog keeps its actions enabled", async () => {
    const governing = {
      status: "available", title: "Acme system", exempt: false, artifact: null, refusedSources: [],
      selection: { reason: "The canvas default.", candidates: [], level: "canvas" },
    };
    const open = () => [...host.ownerDocument.querySelectorAll("button")].find((b) => b.textContent === "Open working document");
    await rereadWith(
      () => h(DesignSystemsDialog, { canvasId: "prj_acme", actor: acme, initialTarget: { kind: "canvas" }, onClose: () => {} }),
      readers.system,
      { governing, direction: { status: "absent" } },
      // Enabled once the first read lands, so what the op does is what is measured.
      () => expect(open()?.disabled, "the action was not enabled even before the op").toBe(false),
    );
    expect(open(), "the dialog did not draw its actions — this case measures nothing").toBeTruthy();
    expect(open()!.disabled, "the dialog disabled its actions for a background re-read").toBe(false);
  });
});
