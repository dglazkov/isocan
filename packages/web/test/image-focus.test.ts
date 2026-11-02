import { describe, expect, it } from "vitest";
import {
  applyOperation,
  DRAWING_KIND,
  formatAspectRatio,
  imageBacklinksIn,
  invertOperation,
  nodeCapabilitiesFor,
  parseImageMetadata,
  type CanvasState,
  type FocusFacts,
  type Item,
  type Operation,
} from "@isocan/core";
import {
  computeCroppedDimensions,
  INITIAL_IMAGE_TRANSFORM,
  isFocusableImageItem,
  stackImageEditVersion,
} from "../src/components/ImageFocus.tsx";
import { resolveNodeFocus } from "../src/lib/focusRegistry.ts";

function buildPngWithTextChunk(
  width: number,
  height: number,
  textKey: string,
  textValue: string,
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA

  const enc = new TextEncoder();
  const keyBytes = enc.encode(textKey);
  const valBytes = enc.encode(textValue);
  const textChunkData = new Uint8Array(keyBytes.length + 1 + valBytes.length);
  textChunkData.set(keyBytes, 0);
  textChunkData[keyBytes.length] = 0;
  textChunkData.set(valBytes, keyBytes.length + 1);

  const makeChunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(4 + 4 + data.length + 4);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    // CRC placeholder
    dv.setUint32(8 + data.length, 0, false);
    return out;
  };

  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const cIhdr = makeChunk("IHDR", ihdr);
  const cText = makeChunk("tEXt", textChunkData);
  const cIend = makeChunk("IEND", new Uint8Array(0));

  const out = new Uint8Array(sig.length + cIhdr.length + cText.length + cIend.length);
  let off = 0;
  for (const part of [sig, cIhdr, cText, cIend]) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

function buildJpegWithExif(
  width: number,
  height: number,
  software: string,
  model: string,
): Uint8Array {
  const enc = new TextEncoder();
  const swBytes = enc.encode(`${software}\0`);
  const modelBytes = enc.encode(`${model}\0`);

  // Minimal Little-Endian TIFF with 2 IFD0 entries: Model (0x0110) and Software (0x0131)
  // Header(8) + Count(2) + 2*Entry(24) + NextIFD(4) = 38 bytes
  const strOffsetModel = 38;
  const strOffsetSw = strOffsetModel + modelBytes.length;
  const tiffLen = strOffsetSw + swBytes.length;
  const tiff = new Uint8Array(tiffLen);
  const tv = new DataView(tiff.buffer);
  tiff[0] = 0x49;
  tiff[1] = 0x49; // "II" little-endian
  tv.setUint16(2, 42, true);
  tv.setUint32(4, 8, true); // IFD0 offset = 8
  tv.setUint16(8, 2, true); // 2 entries

  // Entry 0: Model (0x0110), ASCII (2)
  tv.setUint16(10, 0x0110, true);
  tv.setUint16(12, 2, true);
  tv.setUint32(14, modelBytes.length, true);
  tv.setUint32(18, strOffsetModel, true);

  // Entry 1: Software (0x0131), ASCII (2)
  tv.setUint16(22, 0x0131, true);
  tv.setUint16(24, 2, true);
  tv.setUint32(26, swBytes.length, true);
  tv.setUint32(30, strOffsetSw, true);

  tv.setUint32(34, 0, true); // next IFD = 0
  tiff.set(modelBytes, strOffsetModel);
  tiff.set(swBytes, strOffsetSw);

  // APP1 segment: 0xFF 0xE1 + length(2) + "Exif\0\0"(6) + tiff
  const app1PayloadLen = 2 + 6 + tiff.length;
  const app1 = new Uint8Array(2 + app1PayloadLen);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  new DataView(app1.buffer).setUint16(2, app1PayloadLen, false);
  app1.set(enc.encode("Exif\0\0"), 4);
  app1.set(tiff, 10);

  // SOF0 segment: 0xFF 0xC0 + length(11) + bitDepth(1) + height(2) + width(2) + components(4)
  const sof0 = new Uint8Array(2 + 11);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  const sv = new DataView(sof0.buffer);
  sv.setUint16(2, 11, false);
  sof0[4] = 8;
  sv.setUint16(5, height, false);
  sv.setUint16(7, width, false);

  const soi = new Uint8Array([0xff, 0xd8]);
  const eoi = new Uint8Array([0xff, 0xd9]);
  const out = new Uint8Array(soi.length + app1.length + sof0.length + eoi.length);
  let off = 0;
  for (const part of [soi, app1, sof0, eoi]) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

function makeImageItem(
  id = "itm_hero_img",
  mimeType = "image/png",
  filename = "acme-hero.png",
  properties: Record<string, string> = {},
): Item {
  const version = {
    id: "ver_1",
    blobHash: "a".repeat(64),
    mimeType,
    filename,
    size: 4096,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "usr_test", name: "Test" },
  };
  return {
    id,
    title: "Acme Hero Image",
    description: "",
    x: 100,
    y: 120,
    width: 800,
    height: 450,
    properties,
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    updatedAt: version.createdAt,
    updatedBy: version.createdBy,
  };
}

describe("Phase 3 — Image binary metadata extraction (PNG tEXt, JPEG EXIF, SVG)", () => {
  it("extracts PNG dimensions, bit depth, RGBA color type, and tEXt generation parameters", () => {
    const png = buildPngWithTextChunk(1920, 1080, "prompt", "Acme isometric dashboard illustration");
    const meta = parseImageMetadata(png, "image/png");
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.aspectRatio).toBe("16:9");
    expect(meta.bitDepth).toBe(8);
    expect(meta.colorType).toBe("rgba");
    expect(meta.hasAlpha).toBe(true);
    expect(meta.textTags.prompt).toBe("Acme isometric dashboard illustration");
  });

  it("extracts JPEG SOF0 dimensions and APP1 EXIF TIFF tags", () => {
    const jpeg = buildJpegWithExif(1200, 900, "Acme Camera Pipeline 2.0", "AcmeCam Pro");
    const meta = parseImageMetadata(jpeg, "image/jpeg");
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(900);
    expect(meta.aspectRatio).toBe("4:3");
    expect(meta.exifTags.Model).toBe("AcmeCam Pro");
    expect(meta.exifTags.Software).toBe("Acme Camera Pipeline 2.0");
  });

  it("extracts SVG viewBox dimensions and <title> / <desc> tags", () => {
    const svg = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>Acme Crest</title><desc>Vector emblem</desc></svg>`,
    );
    const meta = parseImageMetadata(svg, "image/svg+xml");
    expect(meta.format).toBe("svg");
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.aspectRatio).toBe("1:1");
    expect(meta.textTags.Title).toBe("Acme Crest");
    expect(meta.textTags.Description).toBe("Vector emblem");
  });

  it("simplifies standard aspect ratios and formats irregular ones cleanly", () => {
    expect(formatAspectRatio(1920, 1080)).toBe("16:9");
    expect(formatAspectRatio(1080, 1080)).toBe("1:1");
    expect(formatAspectRatio(1440, 900)).toBe("8:5");
    expect(formatAspectRatio(731, 419)).toBe("1.74:1");
  });
});

describe("Phase 3 — Canvas Where Used backlinks for images", () => {
  it("resolves HTML embeds, item property links, and comment thread references", () => {
    const img = makeImageItem("itm_logo", "image/png", "acme-logo.png");
    const screen = makeImageItem("itm_landing", "text/html", "landing.html");
    const card = makeImageItem("itm_card", "text/markdown", "readme.md", {
      poster: img.versions[0]!.blobHash,
    });

    const canvas = {
      items: {
        [img.id]: img,
        [screen.id]: screen,
        [card.id]: card,
      },
      trash: [],
      threads: {
        thr_1: {
          id: "thr_1",
          x: 0,
          y: 0,
          anchorItemId: screen.id,
          main: false,
          createdAt: "2026-10-15T00:00:00.000Z",
          createdBy: { id: "usr_test", name: "Test" },
          comments: [
            {
              id: "cmt_1",
              author: { id: "usr_test", name: "Test" },
              body: "Swap #Acme Hero Image into the nav bar",
              items: [img.id],
              createdAt: "2026-10-15T00:00:00.000Z",
            },
          ],
        },
      },
    };

    const backlinks = imageBacklinksIn(canvas, img, {
      [screen.id]: `<html><body><img src="/blobs/${img.versions[0]!.blobHash}" /></body></html>`,
    });

    expect(backlinks.some((b) => b.kind === "item-content" && b.itemId === screen.id)).toBe(true);
    expect(backlinks.some((b) => b.kind === "item-property" && b.itemId === card.id)).toBe(true);
    expect(backlinks.some((b) => b.kind === "thread" && b.threadId === "thr_1")).toBe(true);
  });
});

describe("Phase 3 — Image ModuleFocus & Edit Studio version stacking + undo", () => {
  it("matches raster and SVG images via builtin.image and excludes freehand drawings", () => {
    const png = makeImageItem("itm_png", "image/png", "photo.png");
    expect(resolveNodeFocus(png)?.id).toBe("builtin.image");
    expect(nodeCapabilitiesFor(png)).toEqual({
      view: true,
      edit: true,
      enter: false,
      file: false,
    });

    const svg = makeImageItem("itm_svg", "image/svg+xml", "diagram.svg");
    expect(resolveNodeFocus(svg)?.id).toBe("builtin.image");
    expect(nodeCapabilitiesFor(svg)).toEqual({
      view: true,
      edit: true,
      enter: false,
      file: true,
    });

    const sketch = makeImageItem("itm_sketch", "image/svg+xml", "sketch.svg", {
      kind: DRAWING_KIND,
    });
    expect(isFocusableImageItem(sketch, sketch.versions[0]!)).toBe(false);
    expect(resolveNodeFocus(sketch)?.id).not.toBe("builtin.image");
  });

  it("computes cropped and rotated output dimensions accurately", () => {
    expect(
      computeCroppedDimensions(1600, 900, {
        ...INITIAL_IMAGE_TRANSFORM,
        crop: { x: 10, y: 10, width: 50, height: 50 },
        rotation: 0,
      }),
    ).toEqual({ width: 800, height: 450 });

    expect(
      computeCroppedDimensions(1600, 900, {
        ...INITIAL_IMAGE_TRANSFORM,
        crop: { x: 0, y: 0, width: 50, height: 100 },
        rotation: 90,
      }),
    ).toEqual({ width: 900, height: 800 });
  });

  it("stacks a cropped image as a new ItemVersion (item.addVersion) and restores the prior version on undo", async () => {
    const actor = { id: "usr_test", name: "Test" };
    const img = makeImageItem("itm_crop", "image/png", "acme-shot.png");

    let state: CanvasState = {
      project: {
        id: "prj_acme",
        title: "Acme Canvas",
        description: "",
        properties: {},
        createdAt: "2026-10-15T00:00:00.000Z",
        createdBy: actor,
        updatedAt: "2026-10-15T00:00:00.000Z",
        updatedBy: actor,
      },
      canvas: {
        items: { [img.id]: img },
        trash: [],
        threads: {},
      },
    };

    const recordedOps: { op: Operation; inverse: Operation | null }[] = [];

    const fakeFacts: FocusFacts = {
      canvasId: "prj_acme",
      canvas: state.canvas,
      item: img,
      version: img.versions[0]!,
      actor,
      canEdit: true,
      capabilities: nodeCapabilitiesFor(img),
      readText: async () => "",
      subtarget: null,
      setSubtarget: () => {},
      askAgent: () => {},
      host: {
        viewer: actor,
        putBlob: async (bytes) => ({
          blobHash: "b".repeat(64),
          size: bytes.size,
        }),
        send: async (ops) => {
          for (const op of ops) {
            const inverse = invertOperation(state, op);
            recordedOps.push({ op, inverse });
            state = applyOperation(state, {
              id: "op_test_addver",
              canvasId: "prj_acme",
              ts: "2026-10-15T00:01:00.000Z",
              actor,
              op,
            })!;
          }
        },
        enrol: async () => ({ actorId: "usr_agent" }),
        select: () => {},
        commands: () => [],
        runCommand: async () => "posted",
        retract: async () => {},
        reveal: () => {},
      },
    };

    const croppedBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const newVerId = await stackImageEditVersion(fakeFacts, croppedBlob, "image/png");

    expect(recordedOps).toHaveLength(1);
    expect(recordedOps[0]!.op.type).toBe("item.addVersion");

    const afterCrop = state.canvas.items[img.id]!;
    expect(afterCrop.versions).toHaveLength(2);
    expect(afterCrop.currentVersionId).toBe(newVerId);
    expect(afterCrop.versions[1]!.blobHash).toBe("b".repeat(64));

    // Undo (applying the recorded inverse op, exactly as `isocan undo` does)
    const inverseOp = recordedOps[0]!.inverse!;
    expect(inverseOp).not.toBeNull();
    state = applyOperation(state, {
      id: "op_test_undo",
      canvasId: "prj_acme",
      ts: "2026-10-15T00:02:00.000Z",
      actor,
      op: inverseOp,
    })!;

    const afterUndo = state.canvas.items[img.id]!;
    expect(afterUndo.versions).toHaveLength(1);
    expect(afterUndo.currentVersionId).toBe("ver_1");
    expect(afterUndo.versions[0]!.blobHash).toBe("a".repeat(64));
  });
});
