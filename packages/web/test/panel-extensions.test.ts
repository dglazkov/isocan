import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EXTENSION_COLORS,
  IDENTITY_COLORS,
  PANEL_BRIDGE_VERSION,
  PANEL_OP_MESSAGE_TYPE,
  PANEL_OP_RESULT_TYPE,
  panelActorId,
  panelActorRoute,
  panelSubject,
  readPanelExtension,
  type CanvasContents,
  type Item,
  type PanelOpResult,
} from "@isocan/core";
import { ExtensionPanelSurface } from "../src/components/ExtensionPanel.tsx";
import { panelFrame, type ContentOrigin } from "../src/lib/frame.ts";
import {
  bridgePanelFrame,
  clearPanelBridgeCredentials,
} from "../src/lib/panelBridge.ts";
import {
  extensionColor,
  panelUnavailableSentence,
  resolveCanvasPanel,
} from "../src/lib/panelExtensions.ts";
import { extensionPanelKey, openPanel } from "../src/lib/panels.ts";
import { dockEdges, railIsOpen } from "../src/lib/stage.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

const src = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

function makeItem(id: string, title: string, mimeType = "text/html", properties: Record<string, string> = {}): Item {
  const version = {
    id: `ver_${id}`,
    blobHash: `hash_${id}`,
    mimeType,
    filename: title,
    size: 42,
    createdAt: "2026-09-06T00:00:00Z",
    createdBy: { id: "usr_alice", name: "Alice" },
  };
  return {
    id,
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    title,
    description: "",
    properties,
    versions: [version],
    currentVersionId: version.id,
    createdAt: "2026-09-06T00:00:00Z",
    updatedAt: "2026-09-06T00:00:00Z",
  } as unknown as Item;
}

function makeCanvas(...items: Item[]): CanvasContents {
  return {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: {},
    trash: [],
  };
}

const contentOrigin: ContentOrigin = {
  base: "http://127.0.0.1:4442",
  ticket: null,
};

const manifest = {
  kind: "panel",
  title: "Acme Review",
  side: "left",
  src: "review.html",
};

describe("extensions phase 4: the panel frame on the content origin", () => {
  it("renders a frame whose src origin is contentBase() and never the app's, and refuses an app-origin path", () => {
    const page = makeItem("itm_page", "review.html");
    const panelItem = makeItem("itm_panel", "review-panel.json", "application/json", { role: "panel" });
    const canvas = makeCanvas(page, panelItem);

    const entry = resolveCanvasPanel(panelItem, canvas, JSON.stringify(manifest));
    expect(entry.problem).toBeUndefined();
    expect(entry.panel).toBeDefined();

    const html = renderToStaticMarkup(
      createElement(ExtensionPanelSurface, {
        canvasId: "prj_acme",
        active: entry,
        panels: [entry],
        origin: contentOrigin,
        onClose: () => {},
      }),
    );
    expect(html).toContain("<iframe");
    expect(html).toContain(
      'src="http://127.0.0.1:4442/api/projects/prj_acme/blobs/hash_itm_page"',
    );
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');

    // Never falls back to the app origin when contentBase() is null.
    expect(panelFrame(null, "prj_acme", "hash_itm_page")).toBeNull();
    const withoutContentOrigin = renderToStaticMarkup(
      createElement(ExtensionPanelSurface, {
        canvasId: "prj_acme",
        active: entry,
        panels: [entry],
        origin: null,
        onClose: () => {},
      }),
    );
    expect(withoutContentOrigin).not.toContain("<iframe");
    expect(withoutContentOrigin).toContain("Acme Review is unavailable");

    // Falsified by pointing the manifest at an app-origin path, which must refuse.
    for (const appPath of [
      "/api/projects/prj_acme/blobs/hash_itm_page",
      "/review.html",
      "http://127.0.0.1:4441/review.html",
    ]) {
      const refused = readPanelExtension(JSON.stringify({ ...manifest, src: appPath }), canvas);
      expect(refused.panel, `manifest with src="${appPath}" must be refused`).toBeUndefined();
      expect(refused.problem).toContain("src");
      expect(panelFrame(contentOrigin, "prj_acme", appPath)).toBeNull();
    }
  });

  it("wears its own name and an extension colour, never a person's IDENTITY_COLORS", () => {
    const page = makeItem("itm_page", "review.html");
    const panelItem = makeItem("itm_panel", "review-panel.json", "application/json", { role: "panel" });
    const canvas = makeCanvas(page, panelItem);
    const entry = resolveCanvasPanel(panelItem, canvas, JSON.stringify(manifest));

    const html = renderToStaticMarkup(
      createElement(ExtensionPanelSurface, {
        canvasId: "prj_acme",
        active: entry,
        panels: [entry],
        origin: contentOrigin,
        onClose: () => {},
      }),
    );
    expect(html).toContain("Acme Review");

    const personColors = new Set(IDENTITY_COLORS.map((c) => c.value.toLowerCase()));
    expect(personColors.has(entry.color.toLowerCase())).toBe(false);
    for (const ext of EXTENSION_COLORS) {
      expect(personColors.has(ext.value.toLowerCase())).toBe(false);
    }
    for (let i = 0; i < 50; i++) {
      const c = extensionColor(`itm_panel_${i}`);
      expect(personColors.has(c.toLowerCase()), `extensionColor took identity color ${c}`).toBe(false);
    }
    for (const identity of IDENTITY_COLORS) {
      expect(html.toLowerCase()).not.toContain(identity.value.toLowerCase());
    }
  });

  it("says a panel whose blob is gone is unavailable rather than silently dropping it", () => {
    const page = makeItem("itm_page", "review.html");
    const panelItem = makeItem("itm_panel", "review-panel.json", "application/json", { role: "panel" });
    const canvas = makeCanvas(page, panelItem);

    // 1. Page blob missing in store
    const missingBlob = resolveCanvasPanel(panelItem, canvas, JSON.stringify(manifest), true);
    expect(missingBlob.panel).toBeUndefined();
    expect(panelUnavailableSentence(missingBlob)).toContain("Acme Review is unavailable");
    expect(panelUnavailableSentence(missingBlob)).toContain("review.html");

    const htmlMissingBlob = renderToStaticMarkup(
      createElement(ExtensionPanelSurface, {
        canvasId: "prj_acme",
        active: missingBlob,
        panels: [missingBlob],
        origin: contentOrigin,
        onClose: () => {},
      }),
    );
    expect(htmlMissingBlob).not.toContain("<iframe");
    expect(htmlMissingBlob).toContain("Acme Review is unavailable");

    // 2. Referenced page item removed from canvas
    const withoutPage = resolveCanvasPanel(panelItem, makeCanvas(panelItem), JSON.stringify(manifest));
    expect(withoutPage.panel).toBeUndefined();
    expect(panelUnavailableSentence(withoutPage)).toContain("is unavailable");

    // 3. Panel manifest blob itself missing
    const missingManifest = resolveCanvasPanel(panelItem, canvas, null);
    expect(missingManifest.panel).toBeUndefined();
    expect(panelUnavailableSentence(missingManifest)).toContain("review-panel.json is unavailable");
  });

  it("reads a panel manifest with core's reader and no parser of its own", () => {
    const lib = src("lib/panelExtensions.ts");
    expect(lib).toContain("readPanelExtension");
    expect(lib, "the dock must not parse a panel manifest itself").not.toContain("JSON.parse");
  });

  it("treats an open canvas panel as a first-class dock occupant in railIsOpen and dockEdges", () => {
    const key = extensionPanelKey("itm_panel");
    expect(key).toBe("panel:itm_panel");

    openPanel("prj_acme", key, false, false);
    const ui = useUiStore.getState();
    expect(ui.extensionPanelOpen).toBe(true);
    expect(ui.extensionPanelId).toBe("itm_panel");
    expect(ui.mainPanelOpen).toBe(false);
    expect(ui.filesPanelOpen).toBe(false);
    expect(railIsOpen(ui)).toBe(true);
    expect(dockEdges(ui).left).toBeGreaterThan(100);

    openPanel("prj_acme", null, false, false);
    expect(useUiStore.getState().extensionPanelOpen).toBe(false);
    expect(useUiStore.getState().extensionPanelId).toBeNull();
  });
});

describe("extensions phase 6: the narrow door (postMessage bridge)", () => {
  function makeMockWindow() {
    const listeners = new Set<(e: MessageEvent) => void>();
    return {
      addEventListener(type: string, fn: EventListener) {
        if (type === "message") listeners.add(fn as (e: MessageEvent) => void);
      },
      removeEventListener(type: string, fn: EventListener) {
        if (type === "message") listeners.delete(fn as (e: MessageEvent) => void);
      },
      dispatch(event: Partial<MessageEvent>) {
        for (const fn of listeners) fn(event as MessageEvent);
      },
    };
  }

  it("ignores messages from any origin other than the content origin", async () => {
    clearPanelBridgeCredentials();
    const win = makeMockWindow();
    const calls: string[] = [];
    const replies: PanelOpResult[] = [];
    const frameReplies: unknown[] = [];
    const fakeFrame = {
      postMessage(msg: unknown) {
        frameReplies.push(msg);
      },
    } as unknown as Window;

    const cleanup = bridgePanelFrame({
      canvasId: "prj_acme",
      itemId: "itm_panel",
      contentOrigin: "http://127.0.0.1:4442",
      frameWindow: () => fakeFrame,
      win,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("{}", { status: 200 });
      },
      onReply: (res) => replies.push(res),
    });

    for (const badOrigin of [
      "http://127.0.0.1:4441",
      "https://evil.example",
      "null",
      "",
    ]) {
      win.dispatch({
        origin: badOrigin,
        source: fakeFrame,
        data: {
          type: PANEL_OP_MESSAGE_TYPE,
          version: PANEL_BRIDGE_VERSION,
          requestId: "req_ignore",
          op: { type: "item.move", itemId: "itm_page", x: 10, y: 20 },
        },
      });
    }

    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
    expect(replies).toEqual([]);
    expect(frameReplies).toEqual([]);
    cleanup();
  });

  it("refuses an unknown protocol version rather than guessing at it", async () => {
    clearPanelBridgeCredentials();
    const win = makeMockWindow();
    const calls: string[] = [];
    const frameReplies: Array<{ msg: PanelOpResult; targetOrigin: string }> = [];
    const fakeFrame = {
      postMessage(msg: PanelOpResult, targetOrigin: string) {
        frameReplies.push({ msg, targetOrigin });
      },
    } as unknown as Window;

    const cleanup = bridgePanelFrame({
      canvasId: "prj_acme",
      itemId: "itm_panel",
      contentOrigin: "http://127.0.0.1:4442",
      frameWindow: () => fakeFrame,
      win,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("{}", { status: 200 });
      },
    });

    win.dispatch({
      origin: "http://127.0.0.1:4442",
      source: fakeFrame,
      data: {
        type: PANEL_OP_MESSAGE_TYPE,
        version: 2,
        requestId: "req_v2",
        op: { type: "item.move", itemId: "itm_page", x: 10, y: 20 },
      },
    });

    expect(calls).toEqual([]);
    expect(frameReplies).toHaveLength(1);
    expect(frameReplies[0]!.targetOrigin).toBe("http://127.0.0.1:4442");
    expect(frameReplies[0]!.msg).toEqual({
      type: PANEL_OP_RESULT_TYPE,
      version: PANEL_BRIDGE_VERSION,
      requestId: "req_v2",
      ok: false,
      code: "bad-version",
      error: expect.stringContaining("not supported"),
    });
    expect(Object.isFrozen(frameReplies[0]!.msg)).toBe(true);
    cleanup();
  });

  it("refuses an operation outside the vocabulary, tells the panel that proposing a new op is proposing a product feature, and writes nothing", async () => {
    clearPanelBridgeCredentials();
    const win = makeMockWindow();
    const calls: string[] = [];
    const frameReplies: PanelOpResult[] = [];
    const fakeFrame = {
      postMessage(msg: PanelOpResult) {
        frameReplies.push(msg);
      },
    } as unknown as Window;

    const cleanup = bridgePanelFrame({
      canvasId: "prj_acme",
      itemId: "itm_panel",
      contentOrigin: "http://127.0.0.1:4442",
      frameWindow: () => fakeFrame,
      win,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("{}", { status: 200 });
      },
    });

    win.dispatch({
      origin: "http://127.0.0.1:4442",
      source: fakeFrame,
      data: {
        type: PANEL_OP_MESSAGE_TYPE,
        version: PANEL_BRIDGE_VERSION,
        requestId: "req_unknown",
        op: { type: "panel.secretWrite", itemId: "itm_page" },
      },
    });

    expect(calls).toEqual([]);
    expect(frameReplies).toEqual([
      {
        type: PANEL_OP_RESULT_TYPE,
        version: PANEL_BRIDGE_VERSION,
        requestId: "req_unknown",
        ok: false,
        code: "unknown-op",
        error: expect.stringContaining("proposing a new op is proposing a product feature"),
      },
    ]);
    cleanup();
  });

  it("stamps valid operations with the panel's actor, sends them through /api/ops, and never hands the frame any object other than the frozen PanelOpResult", async () => {
    clearPanelBridgeCredentials();
    const win = makeMockWindow();
    const requests: Array<{ url: string; headers: Record<string, string>; body: unknown }> = [];
    const frameReplies: PanelOpResult[] = [];
    const fakeFrame = {
      postMessage(msg: PanelOpResult) {
        frameReplies.push(msg);
      },
    } as unknown as Window;

    const cleanup = bridgePanelFrame({
      canvasId: "prj_acme",
      itemId: "itm_panel",
      contentOrigin: "http://127.0.0.1:4442",
      frameWindow: () => fakeFrame,
      win,
      fetchImpl: async (input, init) => {
        const url = String(input);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ url, headers, body });

        if (url === panelActorRoute("prj_acme", "itm_panel")) {
          return new Response(
            JSON.stringify({
              actor: { id: panelActorId("itm_panel"), name: "Acme Review" },
              color: "#5b7a8c",
              grant: {
                id: "gnt_panel_1",
                canvasId: "prj_acme",
                subject: panelSubject("itm_panel"),
                grantedBy: "bdg_owner",
                at: "2026-09-06T00:00:00Z",
              },
              badgeId: "bdg_panel_secret",
              token: "tok_panel_secret_do_not_leak",
            }),
            { status: 200 },
          );
        }
        if (url === "/api/ops") {
          return new Response(
            JSON.stringify({
              seq: 17,
              envelope: {
                id: "op_17",
                canvasId: "prj_acme",
                actor: { id: panelActorId("itm_panel"), name: "Acme Review" },
                timestamp: "2026-09-06T00:00:01Z",
                op: (body as { op: unknown }).op,
              },
              internalStoreHandle: { secret: "never_leak" },
            }),
            { status: 200 },
          );
        }
        return new Response("not found", { status: 404 });
      },
    });

    win.dispatch({
      origin: "http://127.0.0.1:4442",
      source: fakeFrame,
      data: {
        type: PANEL_OP_MESSAGE_TYPE,
        version: PANEL_BRIDGE_VERSION,
        requestId: "req_move_1",
        op: { type: "item.move", itemId: "itm_page", x: 120, y: 240 },
      },
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toHaveLength(2);
    expect(requests[1]!.url).toBe("/api/ops");
    expect(requests[1]!.headers["Authorization"]).toBe("Bearer tok_panel_secret_do_not_leak");
    expect(requests[1]!.body).toMatchObject({
      canvasId: "prj_acme",
      actor: { id: panelActorId("itm_panel"), name: "Acme Review" },
      op: { type: "item.move", itemId: "itm_page", x: 120, y: 240 },
    });

    expect(frameReplies).toHaveLength(1);
    const reply = frameReplies[0]!;
    expect(Object.isFrozen(reply)).toBe(true);
    expect(Object.keys(reply).sort()).toEqual(["id", "ok", "requestId", "seq", "type", "version"]);
    expect(reply).toEqual({
      type: PANEL_OP_RESULT_TYPE,
      version: PANEL_BRIDGE_VERSION,
      requestId: "req_move_1",
      ok: true,
      seq: 17,
      id: "op_17",
    });
    expect(JSON.stringify(reply)).not.toContain("tok_panel_secret_do_not_leak");
    expect(JSON.stringify(reply)).not.toContain("bdg_panel_secret");
    expect(JSON.stringify(reply)).not.toContain("never_leak");
    cleanup();
  });
});
