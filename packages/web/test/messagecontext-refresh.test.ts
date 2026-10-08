// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";

/**
 * **A refresh keeps the card it is refreshing** (8 Oct 2026). Dion: going
 * between stack and spread, the composer's "Group Photos · 11 items" card
 * "goes and comes back so it all flashes and the pieces above move". The
 * toggle writes an op, the preview goes stale, and it rebuilds 600 ms later;
 * the hook used to drop its manifest for the rebuild, so the card became a
 * one-line Loading and then the card again. The real hook, the real store,
 * and a manifest fetch held open so the in-between moment can be looked at.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pending: Array<(m: unknown) => void> = [];
vi.mock("../src/lib/api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/api.ts")>()),
  fetchContextManifest: () => new Promise((resolve) => pending.push(resolve)),
}));

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { useMessageContext } = await import("../src/lib/messagecontext.ts");

const manifest = (revision: number) => ({ revision, rootIds: ["grp_acme"], expandedIds: [], entries: [], counts: { included: 11, excluded: 0, unavailable: 0 }, canvasId: "prj_acme" });

function Probe() {
  const context = useMessageContext("prj_acme", ["grp_acme"]);
  return h("p", null, context.manifest ? `card r${(context.manifest as { revision: number }).revision}` : context.loading ? "loading" : "none");
}

afterEach(() => { vi.useRealTimers(); pending.length = 0; });

describe("the composer's context card, while the canvas changes under it", () => {
  it("stays on screen through a refresh and updates in place", async () => {
    vi.useFakeTimers();
    useCanvasStore.setState({ record: { groupMode: "groups" } as never, lastSeq: 5 } as never);
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(h(Probe)));
    expect(host.textContent).toBe("loading");
    await act(async () => { pending.shift()!(manifest(5)); });
    expect(host.textContent).toBe("card r5");

    // Stack the group: an op lands, the preview is behind, and rebuilds after a beat.
    await act(async () => useCanvasStore.setState({ lastSeq: 6 } as never));
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(pending, "the preview asked for a fresh manifest").toHaveLength(1);
    expect(host.textContent, "the card stays while the refresh is in flight").toBe("card r5");

    await act(async () => { pending.shift()!(manifest(6)); });
    expect(host.textContent).toBe("card r6");
    act(() => root.unmount());
  });
});
