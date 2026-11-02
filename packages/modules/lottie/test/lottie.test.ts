import { afterEach, describe, expect, it } from "vitest";
import {
  itemKind,
  mimeFromName,
  moduleKindOf,
  nodeCapabilitiesFor,
  registerModule,
  unregisterModule,
  type Item,
} from "@isocan/core";
import {
  LOTTIE_JSON_MIME,
  LOTTIE_KIND,
  LOTTIE_POSTER_FRAME_PROP,
  LOTTIE_ZIP_MIME,
  extractLottiePalette,
  inspectLottie,
  lintLottie,
  lottieEmbedSnippets,
  lottieModule,
  parseLottieJson,
  profileLottieFrames,
  remapLottiePalette,
  removeLottieMarker,
  renderLottieFrameSvg,
  setLottieLayerHidden,
  setLottieLayerText,
  setLottieMarker,
  syncLottieToDesignSystem,
  trimLottie,
  type LottieDocument,
} from "../src/core.ts";
import { layerSubtargetFor, lottieFocusFacet, lottieWeb } from "../src/web.tsx";

const SYNTHETIC_LOTTIE: LottieDocument = {
  v: "5.7.4",
  nm: "Acme Checkout Spinner",
  fr: 60,
  ip: 0,
  op: 120,
  w: 200,
  h: 200,
  ddd: 0,
  markers: [
    { cm: "idle", tm: 0, dr: 60 },
    { cm: "success", tm: 60, dr: 60 },
  ],
  layers: [
    {
      ind: 1,
      ty: 4,
      nm: "Spinner Ring",
      ip: 0,
      op: 120,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [360], o: { x: [0.33], y: [0.33] }, i: { x: [0.67], y: [0.67] } },
            { t: 120, s: [360] },
          ],
        },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: "gr",
          nm: "Ring Group",
          it: [
            {
              ty: "el",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [120, 120] },
            },
            {
              ty: "st",
              c: { a: 0, k: [0.1216, 0.2471, 0.8157, 1] }, // #1f3fd0
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.9843, 0.9843, 0.9765, 1] }, // #fbfbf9
              o: { a: 0, k: 100 },
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
    },
    {
      ind: 2,
      ty: 5,
      nm: "Status Label",
      ip: 60,
      op: 120,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 110, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      t: {
        d: {
          k: [
            {
              t: 0,
              s: {
                t: "Paid",
                s: 20,
                fc: [0.1804, 0.5216, 0.251], // #2e8540
              },
            },
          ],
        },
      },
    },
  ],
};

function makeItem(mimeType: string, filename: string): Item {
  return {
    id: "itm_lottie_1",
    x: 0,
    y: 0,
    width: 240,
    height: 240,
    title: "Acme Spinner",
    description: "",
    properties: {},
    currentVersionId: "ver_1",
    versions: [
      {
        id: "ver_1",
        blobHash: "sha_1",
        mimeType,
        filename,
        size: 512,
      },
    ],
  } as unknown as Item;
}

afterEach(() => unregisterModule(lottieModule.name));

describe("@isocan/lottie module & kind capabilities", () => {
  it("registers the lottie kind, compound .lottie.json extension, and capability matrix", () => {
    const jsonItem = makeItem(LOTTIE_JSON_MIME, "spinner.lottie.json");
    const zipItem = makeItem(LOTTIE_ZIP_MIME, "spinner.lottie");

    expect(itemKind(jsonItem)).toBe("other");
    registerModule(lottieModule);

    expect(itemKind(jsonItem)).toBe("lottie");
    expect(itemKind(zipItem)).toBe("lottie");
    expect(moduleKindOf(LOTTIE_JSON_MIME)).toBe(LOTTIE_KIND);
    expect(mimeFromName("spinner.lottie.json")).toBe(LOTTIE_JSON_MIME);
    expect(mimeFromName("spinner.lottie")).toBe(LOTTIE_ZIP_MIME);
    expect(lottieModule.propertyKeys).toEqual([LOTTIE_POSTER_FRAME_PROP]);

    const jsonCaps = nodeCapabilitiesFor(jsonItem, jsonItem.versions[0]!);
    expect(jsonCaps).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: true,
    });

    const zipCaps = nodeCapabilitiesFor(zipItem, zipItem.versions[0]!);
    expect(zipCaps).toEqual({
      view: true,
      edit: true,
      enter: true,
      file: false,
    });
  });

  it("exposes WebModule renderer and ModuleFocus facet with layer subtargets", () => {
    expect(lottieWeb.renderers?.map((r) => r.mimes)).toEqual([
      [LOTTIE_JSON_MIME, LOTTIE_ZIP_MIME],
    ]);
    expect(lottieFocusFacet.id).toBe("module.lottie");
    expect(lottieFocusFacet.priority).toBe(20);

    const inspection = inspectLottie(SYNTHETIC_LOTTIE);
    const subtarget = layerSubtargetFor(inspection.layers[0]!);
    expect(subtarget).toEqual({
      kind: "lottie-layer",
      id: "1",
      label: "Layer #1: Spinner Ring (shape)",
      metadata: {
        ind: 1,
        name: "Spinner Ring",
        layerKind: "shape",
      },
    });
  });
});

describe("Lottie inspection, palette remapping & DESIGN.md sync", () => {
  it("parses and inspects Bodymovin JSON metadata, layers, markers, and palette", () => {
    const parsed = parseLottieJson(JSON.stringify(SYNTHETIC_LOTTIE));
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;

    const info = inspectLottie(parsed);
    expect(info.name).toBe("Acme Checkout Spinner");
    expect(info.width).toBe(200);
    expect(info.height).toBe(200);
    expect(info.fps).toBe(60);
    expect(info.totalFrames).toBe(120);
    expect(info.durationSeconds).toBe(2);
    expect(info.layers).toHaveLength(2);
    expect(info.markers.map((m) => m.cm)).toEqual(["idle", "success"]);
    expect(info.palette.map((p) => p.hex)).toContain("#1f3fd0");
  });

  it("remaps static and keyframed colors and syncs to a DESIGN.md palette", () => {
    const palette = extractLottiePalette(SYNTHETIC_LOTTIE);
    expect(palette.some((p) => p.hex === "#1f3fd0")).toBe(true);

    const { doc: remapped, remappedCount } = remapLottiePalette(SYNTHETIC_LOTTIE, {
      "#1f3fd0": "#e11d48",
    });
    expect(remappedCount).toBe(1);
    const nextPalette = extractLottiePalette(remapped);
    expect(nextPalette.some((p) => p.hex === "#e11d48")).toBe(true);
    expect(nextPalette.some((p) => p.hex === "#1f3fd0")).toBe(false);

    const designMd = `# Acme System\n- Primary: #0ea5e9\n- Ground: #ffffff\n- Ink: #111827\n`;
    const synced = syncLottieToDesignSystem(SYNTHETIC_LOTTIE, designMd);
    expect(synced.remappedCount).toBeGreaterThan(0);
    expect(extractLottiePalette(synced.doc).some((p) => p.hex === "#0ea5e9")).toBe(true);
  });

  it("trims frames, manages markers, and edits layer visibility and text", () => {
    const trimmed = trimLottie(SYNTHETIC_LOTTIE, { ip: 10, op: 90, fr: 30 });
    expect(trimmed.ip).toBe(10);
    expect(trimmed.op).toBe(90);
    expect(trimmed.fr).toBe(30);

    const withMarker = setLottieMarker(trimmed, "loading", 20, 30);
    expect(withMarker.markers?.some((m) => m.cm === "loading" && m.tm === 20)).toBe(true);

    const withoutIdle = removeLottieMarker(withMarker, "idle");
    expect(withoutIdle.markers?.some((m) => m.cm === "idle")).toBe(false);

    const hiddenLayer = setLottieLayerHidden(SYNTHETIC_LOTTIE, 1, true);
    expect(inspectLottie(hiddenLayer).layers[0]?.hidden).toBe(true);

    const relabeled = setLottieLayerText(SYNTHETIC_LOTTIE, 2, "Confirmed");
    expect(inspectLottie(relabeled).layers[1]?.text).toBe("Confirmed");
  });
});

describe("Lottie DevTools linter, frame profiler & deterministic SVG renderer", () => {
  it("flags cross-platform hazards (expressions, merge paths, 3D layers, external images)", () => {
    const risky: LottieDocument = {
      ...SYNTHETIC_LOTTIE,
      assets: [{ id: "img_0", p: "hero.png", u: "images/", e: 0 }],
      layers: [
        {
          ind: 1,
          ty: 4,
          nm: "Complex Shape",
          ddd: 1,
          ks: { o: { a: 0, k: 100, x: "wiggle(2, 10)" } },
          shapes: [{ ty: "mm", nm: "Merge Paths 1" }],
          ef: [{ ty: 21, nm: "Fill Effect" }],
        },
      ],
    };

    const allIssues = lintLottie(risky);
    const codes = allIssues.map((i) => i.code);
    expect(codes).toContain("expression");
    expect(codes).toContain("merge-paths");
    expect(codes).toContain("3d-layer");
    expect(codes).toContain("effect");
    expect(codes).toContain("external-image");

    // Web SVG supports expressions & merge paths, so filtering for web-svg omits them
    const webSvgIssues = lintLottie(risky, "web-svg");
    expect(webSvgIssues.map((i) => i.code)).toEqual(["external-image"]);
  });

  it("profiles per-frame complexity and renders interpolated SVG frames", () => {
    const profile = profileLottieFrames(SYNTHETIC_LOTTIE, 12);
    expect(profile.samples.length).toBe(12);
    expect(profile.peakScore).toBeGreaterThan(0);

    const svg0 = renderLottieFrameSvg(SYNTHETIC_LOTTIE, 0);
    expect(svg0).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"');
    expect(svg0).toContain('stroke="#1f3fd0"');
    // Text layer starts at ip: 60, so frame 0 does not render "Paid"
    expect(svg0).not.toContain("Paid");

    const svg80 = renderLottieFrameSvg(SYNTHETIC_LOTTIE, 80);
    expect(svg80).toContain("Paid");
    expect(svg80).toContain("rotate(");

    const wireSvg = renderLottieFrameSvg(SYNTHETIC_LOTTIE, 80, { wireframe: true });
    expect(wireSvg).toContain('stroke="#0ea5e9"');

    const snippets = lottieEmbedSnippets({
      filename: "spinner.lottie.json",
      loop: true,
      speed: 1.5,
      segment: "success",
    });
    expect(snippets.html).toContain("dotlottie-wc");
    expect(snippets.react).toContain("DotLottieReact");
  });
});
