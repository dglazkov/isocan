import type {
  CoreModule,
  Item,
  ItemVersion,
  ModuleKind,
  NodeCapabilities,
} from "@isocan/core";

/**
 * **Lottie & dotLottie motion animations** (`docs/projects/lottie/design.md`).
 *
 * A Lottie Bodymovin JSON file (`application/vnd.lottie+json`, `.lottie.json`)
 * or dotLottie archive (`application/vnd.lottie+zip`, `.lottie`) is a structured
 * vector scene graph of layers, bezier shapes, keyframes, and named markers.
 * Removing `@isocan/lottie` leaves every `.lottie.json` readable as plain JSON
 * and every `.lottie` downloadable.
 */
export const LOTTIE_JSON_MIME = "application/vnd.lottie+json";
export const LOTTIE_ZIP_MIME = "application/vnd.lottie+zip";
export const LOTTIE_POSTER_FRAME_PROP = "lottiePosterFrame";

export const LOTTIE_KIND: ModuleKind = {
  id: "lottie",
  mimes: [LOTTIE_JSON_MIME, LOTTIE_ZIP_MIME],
  extensions: ["lottie.json", "lottie"],
  label: "Animations",
  noun: "animation",
  icon: "video",
};

export function isLottieItem(_item: Item, version: ItemVersion): boolean {
  const mime = version.mimeType ?? "";
  if (mime === LOTTIE_JSON_MIME || mime === LOTTIE_ZIP_MIME) return true;
  const lower = (version.filename ?? "").toLowerCase();
  return lower.endsWith(".lottie.json") || lower.endsWith(".lottie");
}

export function lottieCapabilities(
  item: Item,
  version: ItemVersion,
): Partial<NodeCapabilities> | null {
  if (!isLottieItem(item, version)) return null;
  const isArchive =
    version.mimeType === LOTTIE_ZIP_MIME ||
    (version.filename ?? "").toLowerCase().endsWith(".lottie");
  return {
    view: true,
    edit: true,
    enter: true,
    file: !isArchive,
  };
}

export const lottieModule: CoreModule = {
  name: "@isocan/lottie",
  propertyKeys: [LOTTIE_POSTER_FRAME_PROP],
  kinds: [LOTTIE_KIND],
  capabilities: lottieCapabilities,
};

// ---------- Lottie JSON schema & inspection

export interface LottieMarker {
  cm: string;
  tm: number;
  dr: number;
}

export interface LottieDocument {
  v?: string;
  nm?: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  ddd?: number;
  layers: Record<string, any>[];
  assets?: Record<string, any>[];
  markers?: LottieMarker[];
  [key: string]: any;
}

export type LottieLayerKind =
  | "precomp"
  | "solid"
  | "image"
  | "null"
  | "shape"
  | "text"
  | "other";

export interface LottieLayerSummary {
  ind: number;
  name: string;
  kind: LottieLayerKind;
  ty: number;
  ip: number;
  op: number;
  hidden: boolean;
  parent: number | null;
  shapeCount: number;
  text?: string;
}

export interface LottiePaletteEntry {
  hex: string;
  occurrences: number;
  layers: string[];
}

export type LottieTarget = "web-svg" | "thorvg" | "ios" | "android";

export interface LottieLintIssue {
  severity: "warning" | "info";
  code:
    | "expression"
    | "merge-paths"
    | "track-matte"
    | "mask"
    | "effect"
    | "3d-layer"
    | "external-image";
  layerInd?: number;
  layerName?: string;
  message: string;
  targets: LottieTarget[];
}

export interface LottieFrameSample {
  frame: number;
  activeLayers: number;
  vertices: number;
  masksAndMattes: number;
  score: number;
}

export interface LottieInspection {
  name: string;
  version: string;
  width: number;
  height: number;
  fps: number;
  inPoint: number;
  outPoint: number;
  totalFrames: number;
  durationSeconds: number;
  layers: LottieLayerSummary[];
  layerCounts: Record<LottieLayerKind, number>;
  markers: LottieMarker[];
  palette: LottiePaletteEntry[];
  assetCount: number;
}

/** Quick check whether a parsed JSON object has the core Bodymovin fields. */
export function isLottieObject(value: unknown): value is LottieDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.fr === "number" &&
    typeof obj.ip === "number" &&
    typeof obj.op === "number" &&
    typeof obj.w === "number" &&
    typeof obj.h === "number" &&
    Array.isArray(obj.layers)
  );
}

/** Parse and validate a Lottie JSON string. */
export function parseLottieJson(
  raw: string,
): LottieDocument | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { error: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!isLottieObject(parsed)) {
    return {
      error:
        "Not a valid Lottie Bodymovin JSON document (expected numeric fr, ip, op, w, h and layers[]).",
    };
  }
  return parsed;
}

function layerKindOf(ty: number): LottieLayerKind {
  switch (ty) {
    case 0:
      return "precomp";
    case 1:
      return "solid";
    case 2:
      return "image";
    case 3:
      return "null";
    case 4:
      return "shape";
    case 5:
      return "text";
    default:
      return "other";
  }
}

function countShapes(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const obj = it as Record<string, unknown>;
    total += 1;
    if (Array.isArray(obj.it)) total += countShapes(obj.it);
  }
  return total;
}

function extractTextValue(layer: Record<string, any>): string | undefined {
  const k = layer.t?.d?.k;
  if (Array.isArray(k) && k[0]?.s && typeof k[0].s.t === "string") {
    return k[0].s.t;
  }
  return undefined;
}

/** Summarize structure, timing, markers, layers, and color palette of a Lottie document. */
export function inspectLottie(doc: LottieDocument): LottieInspection {
  const layerCounts: Record<LottieLayerKind, number> = {
    precomp: 0,
    solid: 0,
    image: 0,
    null: 0,
    shape: 0,
    text: 0,
    other: 0,
  };
  const layers: LottieLayerSummary[] = (doc.layers ?? []).map((layer, idx) => {
    const ty = typeof layer.ty === "number" ? layer.ty : -1;
    const kind = layerKindOf(ty);
    layerCounts[kind] += 1;
    const ind = typeof layer.ind === "number" ? layer.ind : idx + 1;
    const text = ty === 5 ? extractTextValue(layer) : undefined;
    return {
      ind,
      name: typeof layer.nm === "string" && layer.nm.trim() ? layer.nm : `Layer ${ind}`,
      kind,
      ty,
      ip: typeof layer.ip === "number" ? layer.ip : doc.ip,
      op: typeof layer.op === "number" ? layer.op : doc.op,
      hidden: Boolean(layer.hd),
      parent: typeof layer.parent === "number" ? layer.parent : null,
      shapeCount: countShapes(layer.shapes),
      ...(text !== undefined ? { text } : {}),
    };
  });

  const totalFrames = Math.max(0, doc.op - doc.ip);
  const fps = doc.fr > 0 ? doc.fr : 60;
  const durationSeconds = Number((totalFrames / fps).toFixed(2));
  const markers: LottieMarker[] = (doc.markers ?? []).map((m) => ({
    cm: String(m.cm ?? ""),
    tm: Number(m.tm ?? 0),
    dr: Number(m.dr ?? 0),
  }));

  return {
    name: typeof doc.nm === "string" && doc.nm.trim() ? doc.nm : "Untitled Animation",
    version: typeof doc.v === "string" ? doc.v : "5.7.0",
    width: doc.w,
    height: doc.h,
    fps,
    inPoint: doc.ip,
    outPoint: doc.op,
    totalFrames,
    durationSeconds,
    layers,
    layerCounts,
    markers,
    palette: extractLottiePalette(doc),
    assetCount: Array.isArray(doc.assets) ? doc.assets.length : 0,
  };
}

// ---------- Color palette extraction, remapping & DESIGN.md sync

function unitRgbToHex(rgb: readonly number[]): string | null {
  if (rgb.length < 3) return null;
  const r = rgb[0]!;
  const g = rgb[1]!;
  const b = rgb[2]!;
  if (
    typeof r !== "number" ||
    typeof g !== "number" ||
    typeof b !== "number" ||
    Number.isNaN(r) ||
    Number.isNaN(g) ||
    Number.isNaN(b)
  ) {
    return null;
  }
  const scale = r <= 1 && g <= 1 && b <= 1 ? 255 : 1;
  const toByte = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * scale)))
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toLowerCase();
}

function hexToUnitRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [
    Number(r.toFixed(4)),
    Number(g.toFixed(4)),
    Number(b.toFixed(4)),
  ];
}

export function normalizeHex(hex: string): string | null {
  const rgb = hexToUnitRgb(hex);
  return rgb ? unitRgbToHex(rgb) : null;
}

function collectOrRemapColorProp(
  colorProp: any,
  layerName: string,
  record: (hex: string, layer: string) => void,
  remap?: ReadonlyMap<string, [number, number, number]>,
): number {
  if (!colorProp || typeof colorProp !== "object") return 0;
  let changed = 0;
  const k = colorProp.k;
  if (Array.isArray(k)) {
    if (typeof k[0] === "number") {
      const hex = unitRgbToHex(k);
      if (hex) {
        record(hex, layerName);
        const next = remap?.get(hex);
        if (next) {
          k[0] = next[0];
          k[1] = next[1];
          k[2] = next[2];
          changed += 1;
        }
      }
    } else {
      for (const kf of k) {
        for (const key of ["s", "e"] as const) {
          if (Array.isArray(kf?.[key]) && typeof kf[key][0] === "number") {
            const hex = unitRgbToHex(kf[key]);
            if (hex) {
              record(hex, layerName);
              const next = remap?.get(hex);
              if (next) {
                kf[key][0] = next[0];
                kf[key][1] = next[1];
                kf[key][2] = next[2];
                changed += 1;
              }
            }
          }
        }
      }
    }
  }
  return changed;
}

function walkShapesForColors(
  shapes: unknown,
  layerName: string,
  record: (hex: string, layer: string) => void,
  remap?: ReadonlyMap<string, [number, number, number]>,
): number {
  if (!Array.isArray(shapes)) return 0;
  let changed = 0;
  for (const shape of shapes) {
    if (!shape || typeof shape !== "object") continue;
    const s = shape as Record<string, any>;
    if ((s.ty === "fl" || s.ty === "st") && s.c) {
      changed += collectOrRemapColorProp(s.c, layerName, record, remap);
    } else if ((s.ty === "gf" || s.ty === "gs") && s.g?.k?.k) {
      const count = typeof s.g.p === "number" ? s.g.p : 0;
      const arr = s.g.k.k;
      if (Array.isArray(arr) && typeof arr[0] === "number") {
        for (let i = 0; i < count && i * 4 + 3 < arr.length; i++) {
          const offset = i * 4;
          const hex = unitRgbToHex([arr[offset + 1], arr[offset + 2], arr[offset + 3]]);
          if (hex) {
            record(hex, layerName);
            const next = remap?.get(hex);
            if (next) {
              arr[offset + 1] = next[0];
              arr[offset + 2] = next[1];
              arr[offset + 3] = next[2];
              changed += 1;
            }
          }
        }
      }
    }
    if (Array.isArray(s.it)) {
      changed += walkShapesForColors(s.it, layerName, record, remap);
    }
  }
  return changed;
}

function walkLayersForColors(
  layers: unknown,
  record: (hex: string, layer: string) => void,
  remap?: ReadonlyMap<string, [number, number, number]>,
): number {
  if (!Array.isArray(layers)) return 0;
  let changed = 0;
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    const l = layer as Record<string, any>;
    const layerName = typeof l.nm === "string" && l.nm ? l.nm : `Layer ${l.ind ?? ""}`;
    if (l.ty === 1 && typeof l.sc === "string") {
      const hex = normalizeHex(l.sc);
      if (hex) {
        record(hex, layerName);
        const next = remap?.get(hex);
        if (next) {
          l.sc = unitRgbToHex(next)!;
          changed += 1;
        }
      }
    }
    changed += walkShapesForColors(l.shapes, layerName, record, remap);
    if (l.ty === 5 && Array.isArray(l.t?.d?.k)) {
      for (const kf of l.t.d.k) {
        if (Array.isArray(kf?.s?.fc)) {
          const hex = unitRgbToHex(kf.s.fc);
          if (hex) {
            record(hex, layerName);
            const next = remap?.get(hex);
            if (next) {
              kf.s.fc[0] = next[0];
              kf.s.fc[1] = next[1];
              kf.s.fc[2] = next[2];
              changed += 1;
            }
          }
        }
      }
    }
  }
  return changed;
}

/** Extract all unique normalized hex colors across layers, shapes, gradients, and text. */
export function extractLottiePalette(doc: LottieDocument): LottiePaletteEntry[] {
  const map = new Map<string, { occurrences: number; layers: Set<string> }>();
  const record = (hex: string, layer: string) => {
    const entry = map.get(hex) ?? { occurrences: 0, layers: new Set<string>() };
    entry.occurrences += 1;
    entry.layers.add(layer);
    map.set(hex, entry);
  };
  walkLayersForColors(doc.layers, record);
  for (const asset of doc.assets ?? []) {
    if (Array.isArray(asset?.layers)) walkLayersForColors(asset.layers, record);
  }
  return [...map.entries()]
    .map(([hex, v]) => ({ hex, occurrences: v.occurrences, layers: [...v.layers] }))
    .sort((a, b) => b.occurrences - a.occurrences || a.hex.localeCompare(b.hex));
}

/** Remap hex colors in a Lottie document (`{ "#6366f1": "#b5523b" }`) and return a cloned document. */
export function remapLottiePalette(
  doc: LottieDocument,
  mappings: Readonly<Record<string, string>>,
): { doc: LottieDocument; remappedCount: number } {
  const clone: LottieDocument = structuredClone(doc);
  const normalized = new Map<string, [number, number, number]>();
  for (const [from, to] of Object.entries(mappings)) {
    const fromHex = normalizeHex(from);
    const toRgb = hexToUnitRgb(to);
    if (fromHex && toRgb) normalized.set(fromHex, toRgb);
  }
  if (normalized.size === 0) return { doc: clone, remappedCount: 0 };
  const noop = () => {};
  let remappedCount = walkLayersForColors(clone.layers, noop, normalized);
  for (const asset of clone.assets ?? []) {
    if (Array.isArray(asset?.layers)) {
      remappedCount += walkLayersForColors(asset.layers, noop, normalized);
    }
  }
  return { doc: clone, remappedCount };
}

function luminanceOfHex(hex: string): number {
  const rgb = hexToUnitRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function saturationOfHex(hex: string): number {
  const rgb = hexToUnitRgb(hex);
  if (!rgb) return 0;
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  const min = Math.min(rgb[0], rgb[1], rgb[2]);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

/** Extract hex colors mentioned in a `DESIGN.md` document. */
export function extractDesignSystemColors(markdown: string): string[] {
  const found = new Set<string>();
  const re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const norm = normalizeHex(m[0]);
    if (norm) found.add(norm);
  }
  return [...found];
}

/**
 * Map a Lottie animation's palette onto the colors declared in a `DESIGN.md`
 * (matching vibrant accent to vibrant accent, dark ink to dark ink, light
 * surface to light surface).
 */
export function syncLottieToDesignSystem(
  doc: LottieDocument,
  designMarkdown: string,
): {
  doc: LottieDocument;
  mappings: Record<string, string>;
  remappedCount: number;
} {
  const dsColors = extractDesignSystemColors(designMarkdown);
  const palette = extractLottiePalette(doc);
  if (dsColors.length === 0 || palette.length === 0) {
    return { doc: structuredClone(doc), mappings: {}, remappedCount: 0 };
  }

  const mappings: Record<string, string> = {};
  const dsAccent =
    [...dsColors].sort((a, b) => saturationOfHex(b) - saturationOfHex(a))[0] ??
    dsColors[0]!;
  const dsDark =
    [...dsColors].sort((a, b) => luminanceOfHex(a) - luminanceOfHex(b))[0] ??
    dsColors[0]!;
  const dsLight =
    [...dsColors].sort((a, b) => luminanceOfHex(b) - luminanceOfHex(a))[0] ??
    dsColors[0]!;

  for (const entry of palette) {
    const lum = luminanceOfHex(entry.hex);
    const sat = saturationOfHex(entry.hex);
    if (sat > 0.25) {
      if (entry.hex !== dsAccent) mappings[entry.hex] = dsAccent;
    } else if (lum < 0.25) {
      if (entry.hex !== dsDark) mappings[entry.hex] = dsDark;
    } else if (lum > 0.8) {
      if (entry.hex !== dsLight) mappings[entry.hex] = dsLight;
    }
  }

  const { doc: updated, remappedCount } = remapLottiePalette(doc, mappings);
  return { doc: updated, mappings, remappedCount };
}

// ---------- Trim, FPS, Markers & Layer edits

export function trimLottie(
  doc: LottieDocument,
  patch: { ip?: number; op?: number; fr?: number; w?: number; h?: number },
): LottieDocument {
  const clone = structuredClone(doc);
  if (patch.ip !== undefined && Number.isFinite(patch.ip)) clone.ip = Math.max(0, patch.ip);
  if (patch.op !== undefined && Number.isFinite(patch.op)) clone.op = Math.max(clone.ip + 1, patch.op);
  if (patch.fr !== undefined && patch.fr > 0) clone.fr = patch.fr;
  if (patch.w !== undefined && patch.w > 0) clone.w = Math.round(patch.w);
  if (patch.h !== undefined && patch.h > 0) clone.h = Math.round(patch.h);
  return clone;
}

export function setLottieMarker(
  doc: LottieDocument,
  name: string,
  tm: number,
  dr: number,
): LottieDocument {
  const clone = structuredClone(doc);
  const markers: LottieMarker[] = Array.isArray(clone.markers) ? [...clone.markers] : [];
  const idx = markers.findIndex((m) => m.cm === name);
  const entry: LottieMarker = { cm: name, tm, dr: Math.max(0, dr) };
  if (idx >= 0) markers[idx] = entry;
  else markers.push(entry);
  markers.sort((a, b) => a.tm - b.tm);
  clone.markers = markers;
  return clone;
}

export function removeLottieMarker(
  doc: LottieDocument,
  name: string,
): LottieDocument {
  const clone = structuredClone(doc);
  clone.markers = (clone.markers ?? []).filter((m) => m.cm !== name);
  return clone;
}

export function setLottieLayerHidden(
  doc: LottieDocument,
  layerInd: number,
  hidden: boolean,
): LottieDocument {
  const clone = structuredClone(doc);
  for (const l of clone.layers) {
    if (l.ind === layerInd) {
      if (hidden) l.hd = true;
      else delete l.hd;
    }
  }
  return clone;
}

export function setLottieLayerText(
  doc: LottieDocument,
  layerInd: number,
  newText: string,
): LottieDocument {
  const clone = structuredClone(doc);
  for (const l of clone.layers) {
    if (l.ind === layerInd && l.ty === 5 && Array.isArray(l.t?.d?.k) && l.t.d.k[0]?.s) {
      l.t.d.k[0].s.t = newText;
    }
  }
  return clone;
}

// ---------- DevTools: Cross-Platform Compatibility Linter & Frame Profiler

function hasExpressionInTree(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(hasExpressionInTree);
  const obj = node as Record<string, unknown>;
  if (typeof obj.x === "string" && obj.x.trim().length > 0 && "k" in obj) return true;
  return Object.values(obj).some(hasExpressionInTree);
}

function hasMergePathsInShapes(shapes: unknown): boolean {
  if (!Array.isArray(shapes)) return false;
  for (const s of shapes) {
    if (!s || typeof s !== "object") continue;
    const obj = s as Record<string, unknown>;
    if (obj.ty === "mm") return true;
    if (Array.isArray(obj.it) && hasMergePathsInShapes(obj.it)) return true;
  }
  return false;
}

/** Audit a Lottie document for cross-platform feature support and performance traps. */
export function lintLottie(
  doc: LottieDocument,
  target?: LottieTarget,
): LottieLintIssue[] {
  const issues: LottieLintIssue[] = [];

  for (const [idx, layer] of (doc.layers ?? []).entries()) {
    const ind = typeof layer.ind === "number" ? layer.ind : idx + 1;
    const layerName = typeof layer.nm === "string" && layer.nm ? layer.nm : `Layer ${ind}`;

    if (hasExpressionInTree(layer.ks) || hasExpressionInTree(layer.shapes)) {
      issues.push({
        severity: "warning",
        code: "expression",
        layerInd: ind,
        layerName,
        message: `Layer "${layerName}" uses After Effects expressions (x), which are ignored by ThorVG, iOS, and Android runtimes.`,
        targets: ["thorvg", "ios", "android"],
      });
    }
    if (hasMergePathsInShapes(layer.shapes)) {
      issues.push({
        severity: "warning",
        code: "merge-paths",
        layerInd: ind,
        layerName,
        message: `Layer "${layerName}" uses Merge Paths (mm), which is unsupported on ThorVG / Web Canvas and expensive on mobile.`,
        targets: ["thorvg", "ios", "android"],
      });
    }
    if (typeof layer.tt === "number" && layer.tt > 0) {
      issues.push({
        severity: "info",
        code: "track-matte",
        layerInd: ind,
        layerName,
        message: `Layer "${layerName}" uses a Track Matte (tt=${layer.tt}); verify stencil buffer budget on mobile.`,
        targets: ["thorvg", "ios", "android"],
      });
    }
    if (Array.isArray(layer.masksProperties) && layer.masksProperties.length > 0) {
      issues.push({
        severity: "info",
        code: "mask",
        layerInd: ind,
        layerName,
        message: `Layer "${layerName}" has ${layer.masksProperties.length} vector mask(s); complex mask intersections increase per-frame raster cost.`,
        targets: ["web-svg", "thorvg", "ios", "android"],
      });
    }
    if (Array.isArray(layer.ef) && layer.ef.length > 0) {
      issues.push({
        severity: "warning",
        code: "effect",
        layerInd: ind,
        layerName,
        message: `Layer "${layerName}" uses After Effects layer effects (ef), which have limited support outside Web SVG.`,
        targets: ["thorvg", "ios", "android"],
      });
    }
    if (layer.ddd === 1) {
      issues.push({
        severity: "warning",
        code: "3d-layer",
        layerInd: ind,
        layerName,
        message: `Layer "${layerName}" is marked 3D (ddd=1); 3D transforms degrade on ThorVG and mobile players.`,
        targets: ["thorvg", "ios", "android"],
      });
    }
  }

  for (const asset of doc.assets ?? []) {
    if (
      typeof asset?.p === "string" &&
      asset.e !== 1 &&
      !asset.p.startsWith("data:")
    ) {
      issues.push({
        severity: "warning",
        code: "external-image",
        message: `Asset "${asset.id ?? asset.p}" references an external image (${asset.u ?? ""}${asset.p}) instead of embedding base64 or dotLottie zip assets.`,
        targets: ["web-svg", "thorvg", "ios", "android"],
      });
    }
  }

  return target ? issues.filter((i) => i.targets.includes(target)) : issues;
}

function countShapeVertices(shapes: unknown): number {
  if (!Array.isArray(shapes)) return 0;
  let total = 0;
  for (const s of shapes) {
    if (!s || typeof s !== "object") continue;
    const obj = s as Record<string, any>;
    if (obj.ty === "sh") {
      const k = obj.ks?.k;
      const verts = Array.isArray(k) ? k[0]?.s?.[0]?.v : k?.v;
      total += Array.isArray(verts) ? verts.length : 4;
    } else if (obj.ty === "rc" || obj.ty === "el") {
      total += 4;
    } else if (obj.ty === "sr") {
      total += 10;
    }
    if (Array.isArray(obj.it)) total += countShapeVertices(obj.it);
  }
  return total;
}

/** Sample per-frame active layers, vertices, and mask/matte complexity across the timeline. */
export function profileLottieFrames(
  doc: LottieDocument,
  maxSamples = 48,
): { samples: LottieFrameSample[]; peakFrame: number; peakScore: number } {
  const span = Math.max(1, doc.op - doc.ip);
  const count = Math.min(maxSamples, Math.max(1, Math.ceil(span)));
  const step = span / count;
  const samples: LottieFrameSample[] = [];
  let peakFrame = doc.ip;
  let peakScore = 0;

  for (let i = 0; i < count; i++) {
    const frame = Number((doc.ip + i * step).toFixed(1));
    let activeLayers = 0;
    let vertices = 0;
    let masksAndMattes = 0;
    for (const layer of doc.layers ?? []) {
      if (layer.hd) continue;
      const lip = typeof layer.ip === "number" ? layer.ip : doc.ip;
      const lop = typeof layer.op === "number" ? layer.op : doc.op;
      if (frame < lip || frame >= lop) continue;
      activeLayers += 1;
      vertices += countShapeVertices(layer.shapes);
      if (typeof layer.tt === "number" && layer.tt > 0) masksAndMattes += 1;
      if (Array.isArray(layer.masksProperties)) masksAndMattes += layer.masksProperties.length;
    }
    const score = activeLayers * 2 + vertices + masksAndMattes * 6;
    if (score > peakScore) {
      peakScore = score;
      peakFrame = Math.round(frame);
    }
    samples.push({ frame: Math.round(frame), activeLayers, vertices, masksAndMattes, score });
  }

  return { samples, peakFrame, peakScore };
}

// ---------- Deterministic SVG Frame Renderer (zero external runtime needed)

function cubicBezierY(x1: number, y1: number, x2: number, y2: number, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (x1 === y1 && x2 === y2) return t;
  // Newton-Raphson for u given x(u) = t
  let u = t;
  for (let i = 0; i < 6; i++) {
    const xu = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
    const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - xu / dx));
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
}

function scalarOf(v: unknown, index = 0): number {
  if (typeof v === "number") return v;
  if (Array.isArray(v) && typeof v[index] === "number") return v[index];
  return 0;
}

export function interpolateNumber(prop: any, frame: number, fallback: number): number {
  if (!prop || typeof prop !== "object") return fallback;
  const k = prop.k;
  if (typeof k === "number") return k;
  if (!Array.isArray(k) || k.length === 0) return fallback;
  if (typeof k[0] === "number") return k[0];

  if (frame <= (k[0]?.t ?? 0)) return scalarOf(k[0]?.s, 0);
  for (let i = 0; i < k.length - 1; i++) {
    const cur = k[i]!;
    const nxt = k[i + 1]!;
    const t0 = typeof cur.t === "number" ? cur.t : 0;
    const t1 = typeof nxt.t === "number" ? nxt.t : t0;
    if (frame >= t0 && frame <= t1) {
      if (cur.h === 1 || t1 <= t0) return scalarOf(cur.s, 0);
      const rawT = (frame - t0) / (t1 - t0);
      const ox = scalarOf(cur.o?.x, 0) || 0.33;
      const oy = scalarOf(cur.o?.y, 0) || 0.33;
      const ix = scalarOf(cur.i?.x, 0) || 0.67;
      const iy = scalarOf(cur.i?.y, 0) || 0.67;
      const eased = cubicBezierY(ox, oy, ix, iy, rawT);
      const s0 = scalarOf(cur.s, 0);
      const s1 = cur.e !== undefined ? scalarOf(cur.e, 0) : scalarOf(nxt.s, 0);
      return s0 + (s1 - s0) * eased;
    }
  }
  const last = k[k.length - 1]!;
  return last.s !== undefined ? scalarOf(last.s, 0) : scalarOf(k[k.length - 2]?.e, 0);
}

export function interpolateVector(prop: any, frame: number, fallback: number[]): number[] {
  if (!prop || typeof prop !== "object") return fallback;
  const k = prop.k;
  if (Array.isArray(k) && typeof k[0] === "number") return k as number[];
  if (!Array.isArray(k) || k.length === 0) return fallback;

  const vecOf = (v: unknown): number[] => (Array.isArray(v) ? v.map((n) => (typeof n === "number" ? n : 0)) : fallback);

  if (frame <= (k[0]?.t ?? 0)) return vecOf(k[0]?.s);
  for (let i = 0; i < k.length - 1; i++) {
    const cur = k[i]!;
    const nxt = k[i + 1]!;
    const t0 = typeof cur.t === "number" ? cur.t : 0;
    const t1 = typeof nxt.t === "number" ? nxt.t : t0;
    if (frame >= t0 && frame <= t1) {
      if (cur.h === 1 || t1 <= t0) return vecOf(cur.s);
      const rawT = (frame - t0) / (t1 - t0);
      const ox = scalarOf(cur.o?.x, 0) || 0.33;
      const oy = scalarOf(cur.o?.y, 0) || 0.33;
      const ix = scalarOf(cur.i?.x, 0) || 0.67;
      const iy = scalarOf(cur.i?.y, 0) || 0.67;
      const eased = cubicBezierY(ox, oy, ix, iy, rawT);
      const s0 = vecOf(cur.s);
      const s1 = cur.e !== undefined ? vecOf(cur.e) : vecOf(nxt.s);
      return s0.map((v, idx) => v + ((s1[idx] ?? v) - v) * eased);
    }
  }
  const last = k[k.length - 1]!;
  return last.s !== undefined ? vecOf(last.s) : vecOf(k[k.length - 2]?.e);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bezierShapeToPathD(shapeVal: any): string {
  if (!shapeVal || !Array.isArray(shapeVal.v) || shapeVal.v.length === 0) return "";
  const v: [number, number][] = shapeVal.v;
  const i: [number, number][] = Array.isArray(shapeVal.i) ? shapeVal.i : [];
  const o: [number, number][] = Array.isArray(shapeVal.o) ? shapeVal.o : [];
  const closed = Boolean(shapeVal.c);
  const parts: string[] = [`M ${v[0]![0]} ${v[0]![1]}`];
  for (let idx = 0; idx < v.length - 1; idx++) {
    const p0 = v[idx]!;
    const p1 = v[idx + 1]!;
    const out0 = o[idx] ?? [0, 0];
    const in1 = i[idx + 1] ?? [0, 0];
    parts.push(
      `C ${p0[0] + out0[0]} ${p0[1] + out0[1]}, ${p1[0] + in1[0]} ${p1[1] + in1[1]}, ${p1[0]} ${p1[1]}`,
    );
  }
  if (closed && v.length > 1) {
    const last = v[v.length - 1]!;
    const first = v[0]!;
    const outLast = o[v.length - 1] ?? [0, 0];
    const inFirst = i[0] ?? [0, 0];
    parts.push(
      `C ${last[0] + outLast[0]} ${last[1] + outLast[1]}, ${first[0] + inFirst[0]} ${first[1] + inFirst[1]}, ${first[0]} ${first[1]} Z`,
    );
  }
  return parts.join(" ");
}

function transformAttrOf(ks: any, frame: number): { transform: string; opacity: number } {
  if (!ks || typeof ks !== "object") return { transform: "", opacity: 1 };
  const p = interpolateVector(ks.p, frame, [0, 0]);
  const a = interpolateVector(ks.a, frame, [0, 0]);
  const s = interpolateVector(ks.s, frame, [100, 100]);
  const r = interpolateNumber(ks.r, frame, 0);
  const o = interpolateNumber(ks.o, frame, 100) / 100;
  const px = Number((p[0] ?? 0).toFixed(2));
  const py = Number((p[1] ?? 0).toFixed(2));
  const ax = Number((a[0] ?? 0).toFixed(2));
  const ay = Number((a[1] ?? 0).toFixed(2));
  const sx = Number(((s[0] ?? 100) / 100).toFixed(4));
  const sy = Number(((s[1] ?? 100) / 100).toFixed(4));
  const rot = Number(r.toFixed(2));
  const parts: string[] = [];
  if (px !== 0 || py !== 0) parts.push(`translate(${px} ${py})`);
  if (rot !== 0) parts.push(`rotate(${rot})`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx} ${sy})`);
  if (ax !== 0 || ay !== 0) parts.push(`translate(${-ax} ${-ay})`);
  return { transform: parts.join(" "), opacity: Math.max(0, Math.min(1, o)) };
}

function renderShapeItemsSvg(
  items: any[],
  frame: number,
  wireframe: boolean,
): string {
  if (!Array.isArray(items)) return "";
  let fill = "none";
  let fillOpacity = 1;
  let stroke = wireframe ? "#0ea5e9" : "none";
  let strokeWidth = wireframe ? 1.5 : 0;
  const trItem = items.find((it) => it?.ty === "tr");
  const { transform, opacity } = transformAttrOf(trItem, frame);

  for (const it of items) {
    if (!it || it.hd) continue;
    if (it.ty === "fl" && !wireframe) {
      const c = interpolateVector(it.c, frame, [0, 0, 0]);
      fill = unitRgbToHex(c) ?? "#000000";
      fillOpacity = interpolateNumber(it.o, frame, 100) / 100;
    } else if (it.ty === "st" && !wireframe) {
      const c = interpolateVector(it.c, frame, [0, 0, 0]);
      stroke = unitRgbToHex(c) ?? "#000000";
      strokeWidth = interpolateNumber(it.w, frame, 1);
    }
  }

  const paintAttrs = `fill="${fill}" fill-opacity="${Number(fillOpacity.toFixed(3))}" stroke="${stroke}" stroke-width="${Number(strokeWidth.toFixed(2))}"`;
  const nodes: string[] = [];

  for (const it of items) {
    if (!it || it.hd) continue;
    if (it.ty === "gr" && Array.isArray(it.it)) {
      nodes.push(renderShapeItemsSvg(it.it, frame, wireframe));
    } else if (it.ty === "rc") {
      const sz = interpolateVector(it.s, frame, [100, 100]);
      const pos = interpolateVector(it.p, frame, [0, 0]);
      const rad = interpolateNumber(it.r, frame, 0);
      const w = sz[0] ?? 100;
      const h = sz[1] ?? 100;
      const x = (pos[0] ?? 0) - w / 2;
      const y = (pos[1] ?? 0) - h / 2;
      nodes.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${rad.toFixed(2)}" ${paintAttrs} />`,
      );
    } else if (it.ty === "el") {
      const sz = interpolateVector(it.s, frame, [100, 100]);
      const pos = interpolateVector(it.p, frame, [0, 0]);
      const rx = (sz[0] ?? 100) / 2;
      const ry = (sz[1] ?? 100) / 2;
      nodes.push(
        `<ellipse cx="${(pos[0] ?? 0).toFixed(2)}" cy="${(pos[1] ?? 0).toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" ${paintAttrs} />`,
      );
    } else if (it.ty === "sh") {
      const k = it.ks?.k;
      const shapeVal = Array.isArray(k) ? k[0]?.s?.[0] ?? k[0]?.s : k;
      const d = bezierShapeToPathD(shapeVal);
      if (d) nodes.push(`<path d="${d}" ${paintAttrs} />`);
    }
  }

  if (nodes.length === 0) return "";
  const gAttrs: string[] = [];
  if (transform) gAttrs.push(`transform="${transform}"`);
  if (opacity < 1) gAttrs.push(`opacity="${opacity.toFixed(3)}"`);
  return `<g${gAttrs.length ? ` ${gAttrs.join(" ")}` : ""}>${nodes.join("")}</g>`;
}

export interface LottieSvgRenderOptions {
  wireframe?: boolean;
  hiddenLayerInds?: ReadonlySet<number>;
  soloLayerInd?: number | null;
}

/**
 * Render any frame of a Lottie animation as deterministic, self-contained SVG.
 * Powers both the canvas/studio player and `isocan lottie poster`.
 */
export function renderLottieFrameSvg(
  doc: LottieDocument,
  frame: number,
  options: LottieSvgRenderOptions = {},
): string {
  const { wireframe = false, hiddenLayerInds, soloLayerInd = null } = options;
  const clampedFrame = Math.max(doc.ip, Math.min(doc.op, frame));
  const layerElements: string[] = [];

  // Lottie layers stack top-to-bottom in AE (index 0 is top-most), so SVG draws bottom-up.
  const ordered = [...(doc.layers ?? [])].reverse();
  for (const [idx, layer] of ordered.entries()) {
    const ind = typeof layer.ind === "number" ? layer.ind : idx + 1;
    if (soloLayerInd !== null && ind !== soloLayerInd) continue;
    if (hiddenLayerInds?.has(ind)) continue;
    if (layer.hd && soloLayerInd !== ind) continue;
    const lip = typeof layer.ip === "number" ? layer.ip : doc.ip;
    const lop = typeof layer.op === "number" ? layer.op : doc.op;
    if (clampedFrame < lip || clampedFrame > lop) continue;

    const { transform, opacity } = transformAttrOf(layer.ks, clampedFrame);
    const gAttrs: string[] = [`data-lottie-layer="${ind}"`];
    if (transform) gAttrs.push(`transform="${transform}"`);
    if (opacity < 1) gAttrs.push(`opacity="${opacity.toFixed(3)}"`);

    let inner = "";
    if (layer.ty === 1 && typeof layer.sc === "string") {
      const sw = typeof layer.sw === "number" ? layer.sw : doc.w;
      const sh = typeof layer.sh === "number" ? layer.sh : doc.h;
      inner = wireframe
        ? `<rect width="${sw}" height="${sh}" fill="none" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="4 4" />`
        : `<rect width="${sw}" height="${sh}" fill="${escapeXml(layer.sc)}" />`;
    } else if (layer.ty === 4 && Array.isArray(layer.shapes)) {
      inner = renderShapeItemsSvg(layer.shapes, clampedFrame, wireframe);
    } else if (layer.ty === 5) {
      const k = layer.t?.d?.k?.[0]?.s;
      if (k && typeof k.t === "string") {
        const fc = Array.isArray(k.fc) ? unitRgbToHex(k.fc) ?? "#000000" : "#000000";
        const sz = typeof k.s === "number" ? k.s : 24;
        inner = `<text font-size="${sz}" fill="${wireframe ? "none" : fc}" stroke="${wireframe ? "#0ea5e9" : "none"}">${escapeXml(k.t)}</text>`;
      }
    }

    if (inner) {
      layerElements.push(`<g ${gAttrs.join(" ")}>${inner}</g>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.w} ${doc.h}" width="${doc.w}" height="${doc.h}">${layerElements.join("")}</svg>`;
}

/** Generate ready-to-paste embed code snippets for Web, React, iOS, and Android. */
export function lottieEmbedSnippets(opts: {
  filename: string;
  loop?: boolean;
  speed?: number;
  segment?: string | null;
}): Record<"html" | "react" | "ios" | "android", string> {
  const { filename, loop = true, speed = 1, segment = null } = opts;
  const html = `<script src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.3.0/dist/dotlottie-wc.js" type="module"></script>\n<dotlottie-wc src="./${filename}" autoplay${loop ? " loop" : ""}${speed !== 1 ? ` speed="${speed}"` : ""}${segment ? ` segment="${segment}"` : ""} style="width: 300px; height: 300px"></dotlottie-wc>`;
  const react = `import { DotLottieReact } from "@lottiefiles/dotlottie-react";\n\nexport function Animation() {\n  return <DotLottieReact src="./${filename}" autoplay loop={${loop}} speed={${speed}}${segment ? ` marker="${segment}"` : ""} />;\n}`;
  const ios = `let animationView = LottieAnimationView(name: "${filename.replace(/\.lottie(\.json)?$/i, "")}")\nanimationView.loopMode = ${loop ? ".loop" : ".playOnce"}\nanimationView.animationSpeed = ${speed}\n${segment ? `animationView.play(marker: "${segment}")` : "animationView.play()"}`;
  const android = `val composition by rememberLottieComposition(LottieCompositionSpec.Asset("${filename}"))\nLottieAnimation(\n  composition = composition,\n  iterations = ${loop ? "LottieConstants.IterateForever" : "1"},\n  speed = ${speed}f\n)`;
  return { html, react, ios, android };
}

export default lottieModule;
