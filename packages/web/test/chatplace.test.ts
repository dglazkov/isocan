import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_AT_KEY, readChatAt } from "../src/lib/chatplace.ts";
import { barPreview, distanceTo, pickZone, writeChatAt } from "../src/lib/chatmove.ts";

/**
 * **The Chat at the bottom** (8 Oct 2026): a viewer may drag the Chat out of
 * the left dock into a bar centred at the bottom, minimized to its composer.
 * Where it lives is this viewer's layout — one localStorage key, no Operation.
 */

const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceeded");
  },
};

function memory(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("where the Chat is kept", () => {
  it("is the left dock until somebody chooses otherwise", () => {
    expect(readChatAt(memory())).toBe("left");
  });

  it("round-trips through one key that is not per canvas", () => {
    const store = memory();
    writeChatAt("bottom", store);
    expect([...store.data.keys()]).toEqual([CHAT_AT_KEY]);
    expect(readChatAt(store)).toBe("bottom");
    writeChatAt("left", store);
    expect(readChatAt(store)).toBe("left");
  });

  it("reads anything it did not write as the left dock", () => {
    const store = memory();
    store.setItem(CHAT_AT_KEY, "top");
    expect(readChatAt(store)).toBe("left");
  });

  it("survives storage that throws, both ways", () => {
    expect(readChatAt(throwing)).toBe("left");
    expect(() => writeChatAt("bottom", throwing)).not.toThrow();
  });
});

describe("which slot a drag lands in", () => {
  const zones: Parameters<typeof pickZone>[0] = [
    { at: "left", left: 20, top: 74, right: 360, bottom: 780 },
    { at: "bottom", left: 280, top: 716, right: 1000, bottom: 780 },
  ];

  it("is zero inside a slot and measured to the nearest edge outside it", () => {
    expect(distanceTo(zones[1]!, 600, 750)).toBe(0);
    expect(distanceTo(zones[1]!, 600, 700)).toBe(16);
    expect(distanceTo(zones[0]!, 400, 100)).toBe(40);
  });

  it("lights the nearer slot and lands a release in it", () => {
    expect(pickZone(zones, 640, 740)).toEqual({ nearest: "bottom", drop: "bottom" });
    expect(pickZone(zones, 100, 300)).toEqual({ nearest: "left", drop: "left" });
  });

  it("snaps back from a release out of reach of both", () => {
    expect(pickZone(zones, 800, 500)).toEqual({ nearest: "bottom", drop: null });
  });

  it("lands just outside a slot, within reach", () => {
    expect(pickZone(zones, 640, 660).drop).toBe("bottom");
    expect(pickZone(zones, 640, 660, 40).drop).toBeNull();
  });

  it("has nothing to pick from no slots", () => {
    expect(pickZone([], 1, 1)).toEqual({ nearest: null, drop: null });
  });
});

describe("what a minimized bar says about what came in", () => {
  const ada = { id: "usr_ada", name: "Ada" };
  const me = { id: "usr_me", name: "Me" };

  it("says nothing with nothing unread", () => {
    expect(barPreview([{ author: ada, body: "hi" }], 0, me.id)).toBeNull();
    expect(barPreview(undefined, 3, me.id)).toBeNull();
  });

  it("previews the newest message somebody else wrote, one line of it", () => {
    const comments = [
      { author: ada, body: "first" },
      { author: ada, body: "\n## Acme layout\nsecond line" },
      { author: me, body: "my reply" },
    ];
    expect(barPreview(comments, 2, me.id)).toBe("Ada: Acme layout");
  });

  it("truncates a long line to one", () => {
    const said = barPreview([{ author: ada, body: "x".repeat(400) }], 1, me.id, 40)!;
    expect(said).toHaveLength(40);
    expect(said.endsWith("…")).toBe(true);
  });
});

describe("moving it", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function fresh() {
    vi.resetModules();
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });
    const { useUiStore } = await import("../src/stores/uiStore.ts");
    const panels = await import("../src/lib/panels.ts");
    const move = await import("../src/lib/chatmove.ts");
    return { data, ui: useUiStore, panels, move };
  }

  it("to the bottom lets go of the dock, starts minimized, and remembers", async () => {
    const { data, ui, panels, move } = await fresh();
    panels.openPanel("prj_acme", "main", false);
    expect(ui.getState().mainPanelOpen).toBe(true);
    move.placeChat("prj_acme", "bottom");
    expect(ui.getState()).toMatchObject({ chatAt: "bottom", chatBarOpen: false, mainPanelOpen: false });
    expect(data.get(CHAT_AT_KEY)).toBe("bottom");
  });

  it("at the bottom, opening the Chat opens the bar and leaves the dock alone", async () => {
    const { ui, panels, move } = await fresh();
    panels.openPanel("prj_acme", "files", false);
    move.placeChat("prj_acme", "bottom");
    panels.openPanel("prj_acme", "main", false);
    expect(ui.getState()).toMatchObject({ chatBarOpen: true, mainPanelOpen: false, filesPanelOpen: true });
  });

  it("at the bottom, the mount restore leaves the dock empty and the bar minimized", async () => {
    const { ui, panels, move } = await fresh();
    move.placeChat("prj_acme", "bottom");
    panels.openPanel("prj_acme", "files", false);
    panels.openPanel("prj_acme", "main", false, false);
    expect(ui.getState()).toMatchObject({ chatBarOpen: false, mainPanelOpen: false, filesPanelOpen: false });
  });

  it("back to the left is today's dock, open", async () => {
    const { data, ui, move } = await fresh();
    move.placeChat("prj_acme", "bottom");
    move.placeChat("prj_acme", "left");
    expect(ui.getState()).toMatchObject({ chatAt: "left", mainPanelOpen: true, chatBarOpen: false });
    expect(data.get(CHAT_AT_KEY)).toBe("left");
  });
});
