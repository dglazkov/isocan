import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import {
  PACK_IDS,
  applyLayersOnCanvas,
  embedWireSpec,
  fleshSpec,
  packOf,
  parseLayerDirective,
  readWire,
  renderWire,
  resolveItemLayers,
  wireframe,
  type Screen,
  type WirePort,
  type WireSpec,
} from "../src/core.ts";

describe("Wireframe fidelity layers", () => {
  it("parses tier presets and individual checkbox toggles", () => {
    const base = { system: true, copy: true, lofi: false, hifi: false };
    expect(parseLayerDirective("wire", base)).toEqual({
      system: false,
      copy: false,
      lofi: false,
      hifi: false,
    });
    expect(parseLayerDirective("lofi", base)).toEqual({
      system: true,
      copy: true,
      lofi: true,
      hifi: false,
    });
    expect(parseLayerDirective("hifi", base)).toEqual({
      system: true,
      copy: true,
      lofi: true,
      hifi: true,
    });
    expect(parseLayerDirective("-copy", base)).toEqual({
      system: true,
      copy: false,
      lofi: false,
      hifi: false,
    });
    expect(parseLayerDirective("-system +lofi", base)).toEqual({
      system: false,
      copy: true,
      lofi: true,
      hifi: false,
    });
  });

  it("renders non-destructive layer flags without erasing spec style or copy", () => {
    const packId = PACK_IDS[0]!;
    const base = fleshSpec(wireframe("list", { title: "Deliveries" }), "itm_test", packOf(packId));
    const styled: WireSpec = {
      ...base,
      style: {
        source: "design-system",
        itemId: "itm_ds",
        versionId: "ver_ds",
        roles: {
          primary: { token: "colors.primary", value: "#2997ff", p: 0.99, why: "named" },
          ground: { token: "colors.ground", value: "#050507", p: 0.99, why: "named" },
        },
        surface: "glass",
      },
      polish: [{ target: "main.1", add: ["wf-elevated"] }],
    };

    // Unchecking copy renders grey bars in the body while preserving spec.content and slot.fill in the embedded spec
    const noCopyHtml = renderWire({
      ...styled,
      layers: { system: true, copy: false, lofi: false, hifi: false },
    });
    const parsedNoCopy = readWire(noCopyHtml)!;
    expect(parsedNoCopy.content?.pack).toBe(packId);
    expect(parsedNoCopy.slots.some((s) => s.fill !== undefined)).toBe(true);
    const noCopyBody = noCopyHtml.split("<body")[1]!;
    expect(noCopyBody).not.toContain("Kickoff notes");

    // Unchecking system restores default greys in <style> while preserving spec.style in the embedded spec
    const noSystemHtml = renderWire({
      ...styled,
      layers: { system: false, copy: true, lofi: false, hifi: false },
    });
    const parsedNoSystem = readWire(noSystemHtml)!;
    expect(parsedNoSystem.style?.source).toBe("design-system");
    const noSystemCss = /<style>([\s\S]*?)<\/style>/.exec(noSystemHtml)![1]!;
    expect(noSystemCss).not.toContain("#2997ff");

    // Checking lofi adds .lofi class to frame and keeps polish CSS active
    const lofiHtml = renderWire({
      ...styled,
      layers: { system: true, copy: true, lofi: true, hifi: false },
    });
    expect(lofiHtml).toContain('class="frame app s-glass lofi"');
    expect(lofiHtml).toContain("wf-elevated");
  });

  it("embeds and reads back WireSpec inside bespoke High-Fi HTML", () => {
    const spec = wireframe("home", { title: "Duo Showcase" });
    const hifiHtml = `<!doctype html><html><head><title>High-Fi</title></head><body><h1>Showcase</h1></body></html>`;
    const embedded = embedWireSpec(hifiHtml, {
      ...spec,
      layers: { system: true, copy: true, lofi: true, hifi: true },
    });
    const roundTrip = readWire(embedded);
    expect(roundTrip?.title).toBe("Duo Showcase");
    expect(roundTrip?.layers?.hifi).toBe(true);
  });

  it("switches between saved version pointers and non-destructive layer renders on canvas", async () => {
    const spec = fleshSpec(wireframe("home", { title: "Showcase", flow: "flw_1" }), "itm_1", packOf("media"));
    const wireHtml = renderWire({ ...spec, layers: { system: false, copy: false, lofi: false, hifi: false } });
    const sysHtml = renderWire(spec);
    const hifiHtml = embedWireSpec(`<!doctype html><html><head></head><body><h1>High-Fi</h1></body></html>`, {
      ...spec,
      layers: { system: true, copy: true, lofi: true, hifi: true },
    });

    const blobs = new Map<string, string>([
      ["hash_wire", wireHtml],
      ["hash_sys", sysHtml],
      ["hash_hifi", hifiHtml],
    ]);

    const actor = { id: "agt_1", name: "Test" };
    const item = {
      id: "itm_1",
      title: "Showcase",
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      createdAt: "2026-10-01T00:00:00Z",
      createdBy: actor,
      updatedAt: "2026-10-01T00:02:00Z",
      updatedBy: actor,
      currentVersionId: "ver_hifi",
      versions: [
        { id: "ver_wire", blobHash: "hash_wire", mimeType: "text/html", filename: "showcase.html", size: wireHtml.length, createdAt: "2026-10-01T00:00:00Z", createdBy: actor },
        { id: "ver_sys", blobHash: "hash_sys", mimeType: "text/html", filename: "showcase.html", size: sysHtml.length, createdAt: "2026-10-01T00:01:00Z", createdBy: actor },
        { id: "ver_hifi", blobHash: "hash_hifi", mimeType: "text/html", filename: "showcase.html", size: hifiHtml.length, createdAt: "2026-10-01T00:02:00Z", createdBy: actor },
      ],
      properties: {
        fidelity: "wireframe",
        "wireLayer:wire": "ver_wire",
        "wireLayer:system": "ver_sys",
        "wireLayer:hifi": "ver_hifi",
        wireLayer: "hifi",
      },
    } as unknown as Item;

    const canvas = {
      items: { itm_1: item },
      comments: {},
      containers: {},
      connectors: {},
      zones: {},
    } as unknown as CanvasContents;

    const ops: unknown[] = [];
    const port: WirePort = {
      canvasId: "prj_test",
      actor,
      canvas: async () => canvas,
      readText: async (hash) => blobs.get(hash) ?? "",
      put: async (text) => {
        const hash = `hash_${blobs.size + 1}`;
        blobs.set(hash, text);
        return { blobHash: hash, size: text.length };
      },
      send: async (op) => {
        ops.push(op);
      },
    };

    const resolvedInitial = resolveItemLayers(item, spec);
    expect(resolvedInitial.tier).toBe("hifi");
    expect(resolvedInitial.hifi).toBe(true);

    const screen: Screen = { item: "itm_1", spec, x: 0, y: 0, width: 390, height: 844 };
    const res = await applyLayersOnCanvas(port, canvas, [screen], [screen], "wire");
    expect(res.changed[0]?.tier).toBe("wire");
    expect(ops.some((o: any) => o.type === "item.setCurrentVersion" && o.versionId === "ver_wire")).toBe(true);

    // WireLayersBar anchors underneath the screen (top = y + height = 844px) so it sits in the .item-under lane and never covers the screen.
    const { WireLayersBar } = await import("../src/layers-bar.tsx");
    const lib = "react-dom/server";
    const { renderToStaticMarkup } = (await import(lib)) as { renderToStaticMarkup: (el: unknown) => string };
    const { createElement } = await import("react");
    const html = renderToStaticMarkup(
      createElement(WireLayersBar, {
        canvas,
        selection: ["itm_1"],
        canEdit: true,
        past: false,
      }),
    );
    expect(html).toContain('data-wire-layers="itm_1"');
    expect(html).toContain('style="left:195px;top:844px"');
    expect(html).toContain("System");
    expect(html).toContain("Copy");
    expect(html).toContain("Low-Fi");
    expect(html).toContain("High-Fi");
    expect(html).toContain("Sync flow");
  });
});
