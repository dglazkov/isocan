import { beforeEach, describe, expect, it, vi } from "vitest";

// Supply only React's state slots. The actual production hook decides draft
// completion, queue locking, refresh, and canvas ownership in every assertion.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return { ...real,
    useState: <T,>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [hooks.slots[index], (value: T | ((old: T) => T)) => { hooks.slots[index] = typeof value === "function" ? (value as (old: T) => T)(hooks.slots[index] as T) : value; }];
    },
    useRef: <T,>(initial: T) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
  };
});
import { useMessageSend } from "../src/lib/messagecontext.ts";
import { useCanvasStore, type sendEchoedResult } from "../src/stores/canvasStore.ts";

const refresh = vi.fn();
const resetOverride = vi.fn();
const context = { enabled: true, manifest: null, request: { rootIds: ["itm_acme"], expectedRevision: 4 }, includeExcluded: false, setIncludeExcluded: resetOverride, refresh, error: null, loading: false, stale: false };
function render(draft = "Review Acme") { hooks.cursor = 0; return useMessageSend("prj_acme", context, draft); }
beforeEach(() => { hooks.slots = []; refresh.mockClear(); resetOverride.mockClear(); useCanvasStore.setState({ canvasId: "prj_acme" }); });

describe("composer completion follows the writer receipt", () => {
  it("keeps newer unsent text after the captured draft is accepted", async () => {
    let release!: (value: Awaited<ReturnType<typeof sendEchoedResult>>) => void;
    const completeDraft = vi.fn();
    const pending = render("First message").submit(() => new Promise((resolve) => { release = resolve; }), completeDraft);
    render("First message and new unsent words");
    release({ status: "accepted" }); await pending;
    expect(completeDraft).not.toHaveBeenCalled();
    expect(render("First message and new unsent words").disabled).toBe(false);
  });
  it.each(["accepted", "refused"] as const)("settles a queued message's own eventual %s outcome and permits the next send", async (status) => {
    let release!: (value: { status: "accepted" | "refused"; message?: string }) => void;
    const completion = new Promise<{ status: "accepted" | "refused"; message?: string }>((resolve) => { release = resolve; });
    const completed = vi.fn();
    await render().submit(async () => ({ status: "queued", completion }), completed);
    expect(render().disabled).toBe(true);
    release({ status, ...(status === "refused" ? { message: "Context changed" } : {}) }); await completion;
    expect(render().disabled).toBe(false);
    expect(completed).toHaveBeenCalledTimes(status === "accepted" ? 1 : 0);
    expect(render().error).toBe(status === "accepted" ? "" : "Context changed");
    const next = vi.fn(async () => ({ status: "accepted" as const }));
    await render().submit(next, completed);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it("ignores a queued outcome after navigating to another canvas", async () => {
    let release!: (value: { status: "accepted" }) => void;
    const completion = new Promise<{ status: "accepted" }>((resolve) => { release = resolve; });
    const completed = vi.fn();
    await render().submit(async () => ({ status: "queued", completion }), completed);
    useCanvasStore.setState({ canvasId: "prj_other" });
    release({ status: "accepted" }); await completion;
    expect(completed).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
  it("keeps a refused draft, refreshes scope, and only clears it after reviewed acceptance", async () => {
    let draft = "Review Acme";
    let release!: (value: Awaited<ReturnType<typeof sendEchoedResult>>) => void;
    const post = vi.fn(() => new Promise<Awaited<ReturnType<typeof sendEchoedResult>>>((resolve) => { release = resolve; }));
    const form = render();
    const pending = form.submit(post, () => { draft = ""; });
    await form.submit(post, () => { draft = ""; });
    expect(post).toHaveBeenCalledTimes(1);
    expect(render().disabled).toBe(true);
    release({ status: "refused", message: "Context changed; refresh it" }); await pending;
    expect(draft).toBe("Review Acme");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(render()).toMatchObject({ disabled: false, error: "Context changed; refresh it" });
    await render().submit(async () => ({ status: "accepted" }), () => { draft = ""; });
    expect(draft).toBe(""); expect(refresh).toHaveBeenCalledTimes(2); expect(resetOverride).toHaveBeenCalledWith(false);
  });
  it("locks a queued message instead of allowing a second submit", async () => {
    const completed = vi.fn();
    await render().submit(async () => ({ status: "queued" }), completed);
    const queued = render(); expect(queued.disabled).toBe(true); expect(queued.error).toContain("queued");
    const duplicate = vi.fn(async () => ({ status: "accepted" as const }));
    await queued.submit(duplicate, completed);
    expect(duplicate).not.toHaveBeenCalled(); expect(completed).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
  it.each(["accepted", "refused", "queued"] as const)("ignores a late %s outcome after navigation", async (status) => {
    const completed = vi.fn(); let release!: () => void;
    const pending = render().submit(async () => { await new Promise<void>((resolve) => { release = resolve; }); return { status, message: "Acme result" }; }, completed);
    useCanvasStore.setState({ canvasId: "prj_other" }); release(); await pending;
    expect(completed).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(render().error).toBe("");
  });
});
