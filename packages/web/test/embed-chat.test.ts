import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeToHost } from "../src/lib/hostbridge.ts";
import { chatHiddenNow, embeddedNow } from "../src/lib/panels.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

// The bridge's camera actions glide a viewport this suite has no screen for;
// what is under test is that each one is asked for with the right arguments.
const revealed = vi.hoisted(() => [] as string[]);
const zoomedItems = vi.hoisted(() => [] as string[]);
const cameraCalls = vi.hoisted(() => [] as Array<{ fn: string; args: unknown[] }>);
vi.mock("../src/lib/zoomactions.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/zoomactions.ts")>()),
  revealItem: (id: string) => revealed.push(id),
  zoomToItem: (id: string) => zoomedItems.push(id),
  zoomToFit: () => cameraCalls.push({ fn: "zoomToFit", args: [] }),
  zoomTo100: () => cameraCalls.push({ fn: "zoomTo100", args: [] }),
  zoomToSelection: () => cameraCalls.push({ fn: "zoomToSelection", args: [] }),
  zoomBy: (factor: number) => cameraCalls.push({ fn: "zoomBy", args: [factor] }),
  glideToPoint: (x: number, y: number) => cameraCalls.push({ fn: "glideToPoint", args: [x, y] }),
  glideToBox: (box: unknown) => cameraCalls.push({ fn: "glideToBox", args: [box] }),
}));

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  revealed.length = 0;
  zoomedItems.length = 0;
  cameraCalls.length = 0;
  useUiStore.setState({ selectedItemIds: [], followSessionId: null, followingActorId: null, openThreadId: null });
});

/**
 * **Chat-free embed and the host bridge** (`docs/projects/jetski/design.md`,
 * phase 0). A canvas framed in an agent manager's pane beside a conversation
 * column (`?embed=1`) keeps its 320px Chat dock and the dock's rail button off
 * while the Agent Presence strip stays, and tells the pane — and only the
 * pane — what is selected.
 */
describe("chat-free embed (?embed=1)", () => {
  it("reads the one spelling the writer writes", () => {
    expect(chatHiddenNow("?embed=1")).toBe(true);
    expect(chatHiddenNow("?embed=1&chat=on")).toBe(false);
    expect(embeddedNow("?embed=1&chat=on")).toBe(true);
    expect(chatHiddenNow("?chat=off")).toBe(false);
    expect(embeddedNow("")).toBe(false);
  });

  it("keeps the answer the window was LOADED with, through the app's own navigation", async () => {
    vi.resetModules();
    const location = { search: "?embed=1" };
    vi.stubGlobal("window", { location, innerWidth: 1280, innerHeight: 800 });
    const panels = await import("../src/lib/panels.ts");
    expect(panels.chatHiddenNow()).toBe(true);
    // Opening an item full screen is a navigation, and it drops the query.
    location.search = "";
    expect(panels.chatHiddenNow()).toBe(true);
    expect(panels.embeddedNow()).toBe(true);
  });

  it("folds a request for the Chat into a closed dock, remembers nothing it folded, and still opens the rest", async () => {
    vi.resetModules();
    const written: string[] = [];
    vi.stubGlobal("window", { location: { search: "?embed=1" }, innerWidth: 1280, innerHeight: 800 });
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => written.push(`${key}=${value}`),
      getItem: () => null,
    });
    const panels = await import("../src/lib/panels.ts");
    const { useUiStore: ui } = await import("../src/stores/uiStore.ts");
    ui.getState().setMainPanelOpen(false);
    panels.openPanel("prj_acme", "main", false);
    expect(ui.getState().mainPanelOpen).toBe(false);
    expect(written).toEqual([]);

    panels.openPanel("prj_acme", "agents", false);
    expect(ui.getState().agentsPanelOpen).toBe(true);
    expect(written).toContain("isocan.agentspanel.prj_acme=open");
  });

  it("guards the dock and its rail button, keeps the agents door, and installs the bridge", () => {
    expect(read("../src/components/MainThreadPanel.tsx")).toContain(
      "if (!canvas || !open || chatHiddenNow()) return null;",
    );
    const railStrip = read("../src/components/RailStrip.tsx");
    expect(railStrip).toContain("{!hideChat && (");
    expect(railStrip).toContain('className="strip-chat strip-agents"');
    expect(read("../src/pages/CanvasPage.tsx")).toContain("bridgeToHost(canvasId)");
  });

  it("leaves no way in to a Chat that is not there", () => {
    // Every surface that can open the Chat — a menu row, a ⌘K entry, a
    // button, a key — asks first. One that does not is a control that does
    // nothing inside a pane, and it is named here.
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    const opensChat = /openPanel\([^)]*"main"|panel: "main"|\["main", "Chat"/;
    const ungated = (readdirSync(src, { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith("panels.ts"))
      .filter((file) => {
        const text = readFileSync(`${src}${file}`, "utf8");
        return opensChat.test(text) && !text.includes("chatHiddenNow()");
      });
    expect(ungated).toEqual([]);
    // And the ones that exist today are found at all.
    for (const file of ["lib/actions.ts", "lib/menuentries.tsx", "components/CommandPalette.tsx", "components/ModuleWorkspace.tsx"]) {
      expect(opensChat.test(read(`../src/${file}`))).toBe(true);
    }
  });
});

/** A framed window and its parent, with every message either one is sent. */
function framedWindow() {
  const toParent: Array<{ data: unknown; target: string }> = [];
  const listeners = new Set<(e: MessageEvent) => void>();
  const parent = { postMessage: (data: unknown, target: string) => toParent.push({ data, target }) };
  const win = {
    parent,
    addEventListener: (_type: string, fn: (e: MessageEvent) => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: (e: MessageEvent) => void) => listeners.delete(fn),
  };
  const send = (data: unknown, origin: string, source: unknown = parent) => {
    for (const fn of listeners) fn({ data, origin, source } as MessageEvent);
  };
  return { win: win as unknown as Window, parent, toParent, listeners, send };
}

describe("the host bridge", () => {
  const HOST = "https://host.example";
  const canvas = {
    items: {
      it_hero: { id: "it_hero", title: "Acme hero" },
      it_card: { id: "it_card", title: "Acme card", containerId: "it_grid" },
    },
  };

  it("says ready, then posts selections only to the origin that answered it", () => {
    useCanvasStore.setState({ canvas } as never);
    const frame = framedWindow();
    const stop = bridgeToHost("prj_acme", frame.win, true);
    expect(frame.toParent).toEqual([{ data: { type: "isocan:ready", canvasId: "prj_acme" }, target: "*" }]);

    // Nobody has said hello: a selection goes nowhere.
    useUiStore.setState({ selectedItemIds: ["it_hero"] });
    expect(frame.toParent).toHaveLength(1);

    // A hello from anything but the parent, or from an opaque origin, is ignored.
    frame.send({ type: "isocan:hello" }, "https://elsewhere.example", {});
    frame.send({ type: "isocan:hello" }, "null");
    expect(frame.toParent).toHaveLength(1);

    frame.send({ type: "isocan:hello" }, HOST);
    expect(frame.toParent.at(-1)).toEqual({
      data: { type: "isocan:selection", canvasId: "prj_acme", items: [{ id: "it_hero", title: "Acme hero", groupId: null }] },
      target: HOST,
    });

    useUiStore.setState({ selectedItemIds: ["it_card", "it_gone"] });
    expect(frame.toParent.at(-1)).toEqual({
      data: { type: "isocan:selection", canvasId: "prj_acme", items: [{ id: "it_card", title: "Acme card", groupId: "it_grid" }] },
      target: HOST,
    });

    stop();
    expect(frame.listeners.size).toBe(0);
    const before = frame.toParent.length;
    useUiStore.setState({ selectedItemIds: [] });
    expect(frame.toParent).toHaveLength(before);
  });

  it("points at an item only when the host that said hello asks, and only at one on this canvas", () => {
    useCanvasStore.setState({ canvas } as never);
    const frame = framedWindow();
    const stop = bridgeToHost("prj_acme", frame.win, true);
    frame.send({ type: "isocan:focus-item", itemId: "it_card" }, HOST);
    expect(revealed).toEqual([]); // no hello yet

    frame.send({ type: "isocan:hello" }, HOST);
    frame.send({ type: "isocan:focus-item", itemId: "it_card" }, "https://elsewhere.example");
    frame.send({ type: "isocan:focus-item", itemId: "it_missing" }, HOST);
    frame.send({ type: "isocan:focus-item", itemId: 7 }, HOST);
    expect(revealed).toEqual([]);

    frame.send({ type: "isocan:focus-item", itemId: "it_card" }, HOST);
    expect(useUiStore.getState().selectedItemIds).toEqual(["it_card"]);
    expect(revealed).toEqual(["it_card"]);

    frame.send({ type: "isocan:focus-item", itemId: "it_hero", zoom: true }, HOST);
    expect(useUiStore.getState().selectedItemIds).toEqual(["it_hero"]);
    expect(zoomedItems).toEqual(["it_hero"]);
    stop();
  });

  it("drives camera, selection, follow, and threads from the verified host", () => {
    useCanvasStore.setState({
      canvas: {
        ...canvas,
        threads: {
          th_card: { id: "th_card", anchorItemId: "it_card" },
          th_free: { id: "th_free", x: 120, y: 240 },
        },
      },
      sessions: [{ sessionId: "ses_scout", actorId: "usr_scout" }],
    } as never);
    const frame = framedWindow();
    const stop = bridgeToHost("prj_acme", frame.win, true);
    frame.send({ type: "isocan:hello" }, HOST);

    frame.send({ type: "isocan:camera", action: "fit" }, HOST);
    frame.send({ type: "isocan:camera", action: "100" }, HOST);
    frame.send({ type: "isocan:camera", action: "selection" }, HOST);
    frame.send({ type: "isocan:camera", action: "in", factor: 1.5 }, HOST);
    frame.send({ type: "isocan:camera", action: "out" }, HOST);
    frame.send({ type: "isocan:camera", action: "item", itemId: "it_hero" }, HOST);
    frame.send({ type: "isocan:camera", action: "point", x: 40, y: -80 }, HOST);
    frame.send({ type: "isocan:camera", action: "box", box: { minX: 0, minY: 0, maxX: 400, maxY: 300 } }, HOST);
    expect(zoomedItems).toEqual(["it_hero"]);
    expect(cameraCalls).toEqual([
      { fn: "zoomToFit", args: [] },
      { fn: "zoomTo100", args: [] },
      { fn: "zoomToSelection", args: [] },
      { fn: "zoomBy", args: [1.5] },
      { fn: "zoomBy", args: [1 / 1.5] },
      { fn: "glideToPoint", args: [40, -80] },
      { fn: "glideToBox", args: [{ minX: 0, minY: 0, maxX: 400, maxY: 300 }] },
    ]);

    frame.send({ type: "isocan:select", itemIds: ["it_hero", "it_card", "it_missing"], zoom: true }, HOST);
    expect(useUiStore.getState().selectedItemIds).toEqual(["it_hero", "it_card"]);
    expect(cameraCalls.at(-1)).toEqual({ fn: "zoomToSelection", args: [] });

    frame.send({ type: "isocan:follow", sessionId: "ses_scout", actorId: "usr_scout" }, HOST);
    expect(useUiStore.getState().followSessionId).toBe("ses_scout");
    expect(useUiStore.getState().followingActorId).toBe("usr_scout");
    frame.send({ type: "isocan:follow", sessionId: null, actorId: null }, HOST);
    expect(useUiStore.getState().followSessionId).toBeNull();
    expect(useUiStore.getState().followingActorId).toBeNull();

    frame.send({ type: "isocan:open-thread", threadId: "th_card", zoom: true }, HOST);
    expect(useUiStore.getState().openThreadId).toBe("th_card");
    expect(zoomedItems.at(-1)).toBe("it_card");

    frame.send({ type: "isocan:open-thread", threadId: "th_free" }, HOST);
    expect(useUiStore.getState().openThreadId).toBe("th_free");
    expect(cameraCalls.at(-1)).toEqual({ fn: "glideToPoint", args: [120, 240] });
    stop();
  });

  it("does nothing at all in a tab nobody framed, or in a page that was not opened as an embed", () => {
    const frame = framedWindow();
    bridgeToHost("prj_acme", frame.win, false)();
    expect(frame.toParent).toEqual([]);
    expect(frame.listeners.size).toBe(0);

    const top = framedWindow();
    (top.win as unknown as { parent: unknown }).parent = top.win;
    bridgeToHost("prj_acme", top.win, true)();
    expect(top.listeners.size).toBe(0);
  });
});
