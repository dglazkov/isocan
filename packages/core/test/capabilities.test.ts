import { afterEach, describe, expect, it } from "vitest";
import {
  AREA_PROPERTIES,
  BROWSER_MIME,
  CANVAS_KIND,
  DESIGN_SYSTEM_ROLE,
  DRAWING_PROPERTIES,
  TEXT_PROPERTIES,
  nodeCapabilitiesFor,
  registerModule,
  unregisterModule,
  type Item,
  type ItemVersion,
} from "../src/index.ts";

function makeVersion(mimeType: string, filename = "file.txt", visualMime?: string): ItemVersion {
  return {
    id: "v1",
    blobHash: "sha256:0000000000000000000000000000000000000000000000000000000000000001",
    mimeType,
    filename,
    size: 128,
    createdAt: "2026-10-14T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
    ...(visualMime
      ? {
          visual: {
            blobHash: "sha256:0000000000000000000000000000000000000000000000000000000000000002",
            mimeType: visualMime,
            filename: "preview.html",
            size: 256,
          },
        }
      : {}),
  };
}

function makeItem(
  mimeType: string,
  opts: {
    filename?: string;
    properties?: Record<string, string>;
    visualMime?: string;
  } = {},
): Item {
  const version = makeVersion(mimeType, opts.filename, opts.visualMime);
  return {
    id: "it_acme",
    title: "Acme Artifact",
    description: "",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    properties: opts.properties ?? {},
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    updatedAt: version.createdAt,
    updatedBy: version.createdBy,
  };
}

describe("nodeCapabilitiesFor", () => {
  afterEach(() => {
    unregisterModule("@isocan/test-focus");
  });

  it("enables view, edit, enter, and file for HTML screens and wireframes", () => {
    const screen = makeItem("text/html", { filename: "acme-home.html" });
    expect(nodeCapabilitiesFor(screen)).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: true,
    });

    const wireframe = makeItem("text/html", {
      filename: "acme-checkout.html",
      properties: { fidelity: "wireframe" },
    });
    expect(nodeCapabilitiesFor(wireframe)).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: true,
    });
  });

  it("enables view and edit on raster images without enter or file", () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
      const img = makeItem(mime, { filename: "acme-hero.png" });
      expect(nodeCapabilitiesFor(img)).toEqual({
        view: true,
        edit: true,
        enter: false,
        file: false,
      });
    }
  });

  it("enables view, edit, and file on uploaded SVGs without inline enter", () => {
    const svg = makeItem("image/svg+xml", { filename: "acme-logo.svg" });
    expect(nodeCapabilitiesFor(svg)).toEqual({
      view: true,
      edit: true,
      enter: false,
      file: true,
    });
  });

  it("treats DESIGN.md design systems as view + edit + file, never enter", () => {
    const ds = makeItem("text/markdown", {
      filename: "DESIGN.md",
      properties: { role: DESIGN_SYSTEM_ROLE },
    });
    expect(nodeCapabilitiesFor(ds)).toEqual({
      view: true,
      edit: true,
      enter: false,
      file: true,
    });
  });

  it("enables view, edit, enter, and file on Markdown and plain-text documents", () => {
    const doc = makeItem("text/markdown", { filename: "acme-brief.md" });
    expect(nodeCapabilitiesFor(doc)).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: true,
    });

    const txt = makeItem("text/plain", { filename: "notes.txt" });
    expect(nodeCapabilitiesFor(txt)).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: true,
    });
  });

  it("enables view, edit, and enter on videos without file source", () => {
    const video = makeItem("video/mp4", { filename: "acme-demo.mp4" });
    expect(nodeCapabilitiesFor(video)).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: false,
    });
  });

  it("enables view and enter (no edit/file) on browser frames and placed canvases", () => {
    const site = makeItem(BROWSER_MIME, { filename: "localhost-5173.uri" });
    expect(nodeCapabilitiesFor(site)).toEqual({
      view: true,
      edit: false,
      enter: true,
      file: false,
    });

    const placedCanvas = makeItem(BROWSER_MIME, {
      filename: "canvas.uri",
      properties: { kind: CANVAS_KIND, canvas: "c_other" },
    });
    expect(nodeCapabilitiesFor(placedCanvas)).toEqual({
      view: true,
      edit: false,
      enter: true,
      file: false,
    });
  });

  it("disables view, edit, enter, and file on canvas text nodes, groups, and areas", () => {
    const textNode = makeItem("text/markdown", { properties: { ...TEXT_PROPERTIES } });
    expect(nodeCapabilitiesFor(textNode)).toEqual({
      view: false,
      edit: false,
      enter: false,
      file: false,
    });

    const group = makeItem("text/markdown", { properties: { kind: "group" } });
    expect(nodeCapabilitiesFor(group)).toEqual({
      view: false,
      edit: false,
      enter: false,
      file: false,
    });

    const area = makeItem("text/markdown", { properties: { ...AREA_PROPERTIES } });
    expect(nodeCapabilitiesFor(area)).toEqual({
      view: false,
      edit: false,
      enter: false,
      file: false,
    });
  });

  it("treats freehand drawings as view-only on the canvas", () => {
    const drawing = makeItem("image/svg+xml", { properties: { ...DRAWING_PROPERTIES } });
    expect(nodeCapabilitiesFor(drawing)).toEqual({
      view: true,
      edit: false,
      enter: false,
      file: false,
    });
  });

  it("applies module capability overrides when registered and falls back on unregister", () => {
    const custom = makeItem("application/vnd.acme+json", { filename: "acme.json" });
    expect(nodeCapabilitiesFor(custom)).toEqual({
      view: true,
      edit: false,
      enter: false,
      file: false,
    });

    registerModule({
      name: "@isocan/test-focus",
      capabilities: (_item, version) =>
        version.mimeType === "application/vnd.acme+json"
          ? { edit: true, enter: true, file: true }
          : undefined,
    });

    expect(nodeCapabilitiesFor(custom)).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: true,
    });

    unregisterModule("@isocan/test-focus");
    expect(nodeCapabilitiesFor(custom)).toEqual({
      view: true,
      edit: false,
      enter: false,
      file: false,
    });
  });
});
