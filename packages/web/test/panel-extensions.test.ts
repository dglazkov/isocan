import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EXTENSION_COLORS,
  IDENTITY_COLORS,
  readPanelExtension,
  type CanvasContents,
  type Item,
} from "@isocan/core";
import { ExtensionPanelSurface } from "../src/components/ExtensionPanel.tsx";
import { panelFrame, type ContentOrigin } from "../src/lib/frame.ts";
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
