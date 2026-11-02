import {
  CONTRAST_BODY,
  canvasScopes,
  checkDesign,
  contrastRatio,
  isGroupItem,
  luminance,
  newGroupId,
  newItemId,
  newVersionId,
  parseDesign,
  parseHex,
  type CanvasContents,
  type DesignSurface,
} from "@isocan/core";
import { designUse, ownDesignSystemAt } from "@isocan/core/design-use";
import {
  JEV_MODEL,
  chosenOption,
  stubAnswerer,
  type Answerer,
  type JevQuestion,
  type TextGenerator,
} from "./answerer.ts";
import { DENSITY_LEVELS, type DensityLevel } from "./catalog/index.ts";
import type { Screen } from "./flow.ts";
import type { WirePort } from "./port.ts";
import { PRESET_PROP } from "./presets.ts";
import { StyleResolver, governingSystem, restyle, type Restyled } from "./restyle.ts";
import { sanitizeFlowTitle } from "./copy-schema.ts";
import { compactDecisions } from "./why.ts";

/**
 * **Concurrent design system synthesis (`wire ds`) and deterministic AA contrast repair**
 * (`design.md` §15, Phase 13).
 *
 * Proposes candidate visual directions (`proposeThenPick`), asks Jev to select
 * the best direction, `surface:` mode, and `density`, repairs any low-contrast
 * foreground/background token pairs to $\ge 4.5:1$ (`repairContrast`), writes
 * the complete `DESIGN.md` item beside the flow, governs the scope, and
 * restyles the flow and its prototype in one op group (**Swap 1**).
 */

/** A candidate visual direction for `proposeThenPick`. */
export interface DsDirectionCandidate {
  id: string;
  name: string;
  summary: string;
  surface: DesignSurface;
  colors: {
    ground: string;
    surface: string;
    line: string;
    ink: string;
    "ink-muted": string;
    bar: string;
    primary: string;
    "on-primary": string;
  };
  fontFamily: string;
  radius: { sm: string; base: string; lg: string; full: string };
}

/** Built-in visual direction candidates for `proposeThenPick`. */
export const DS_DIRECTIONS: readonly DsDirectionCandidate[] = [
  {
    id: "nordic-slate",
    name: "Nordic Slate",
    summary: "Crisp cool slate greys, deep navy primary, high-clarity technical tables and operations tools",
    surface: "flat",
    colors: {
      ground: "#ffffff",
      surface: "#f1f5f9",
      line: "#cbd5e1",
      ink: "#0f172a",
      "ink-muted": "#475569",
      bar: "#e2e8f0",
      primary: "#1e3a8a",
      "on-primary": "#ffffff",
    },
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    radius: { sm: "4px", base: "6px", lg: "10px", full: "999px" },
  },
  {
    id: "editorial-warm",
    name: "Editorial Warm",
    summary: "Warm paper ground, stone surfaces, espresso ink and terracotta primary for consumer and publishing flows",
    surface: "raised",
    colors: {
      ground: "#fafaf9",
      surface: "#f5f5f4",
      line: "#d6d3d1",
      ink: "#1c1917",
      "ink-muted": "#57534e",
      bar: "#e7e5e4",
      primary: "#9a3412",
      "on-primary": "#ffffff",
    },
    fontFamily: "Georgia, 'Times New Roman', ui-serif, serif",
    radius: { sm: "6px", base: "8px", lg: "14px", full: "999px" },
  },
  {
    id: "precision-cobalt",
    name: "Precision Cobalt",
    summary: "Clean white ground, cool zinc borders, cobalt primary and raised cards for SaaS dashboards and analytics",
    surface: "raised",
    colors: {
      ground: "#ffffff",
      surface: "#f4f4f5",
      line: "#d4d4d8",
      ink: "#18181b",
      "ink-muted": "#52525b",
      bar: "#e4e4e7",
      primary: "#1d4ed8",
      "on-primary": "#ffffff",
    },
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    radius: { sm: "6px", base: "8px", lg: "12px", full: "999px" },
  },
  {
    id: "verdant-studio",
    name: "Verdant Studio",
    summary: "Soft sage-tinted surface, deep forest ink and emerald primary for health, sustainability and finance apps",
    surface: "glass",
    colors: {
      ground: "#ffffff",
      surface: "#f0fdf4",
      line: "#bbf7d0",
      ink: "#052e16",
      "ink-muted": "#166534",
      bar: "#dcfce7",
      primary: "#15803d",
      "on-primary": "#ffffff",
    },
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    radius: { sm: "8px", base: "12px", lg: "16px", full: "999px" },
  },
  {
    id: "industrial-amber",
    name: "Industrial Amber",
    summary: "High-contrast stark borders, bold surface shadows, dark bronze primary for field, warehouse and logistics tools",
    surface: "bold",
    colors: {
      ground: "#ffffff",
      surface: "#fef3c7",
      line: "#1c1917",
      ink: "#1c1917",
      "ink-muted": "#44403c",
      bar: "#fde68a",
      primary: "#78350f",
      "on-primary": "#ffffff",
    },
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    radius: { sm: "2px", base: "4px", lg: "6px", full: "999px" },
  },
];

/** Record of a single deterministic contrast repair applied to a colour token. */
export interface ContrastRepair {
  role: string;
  against: string;
  from: string;
  to: string;
  beforeRatio: number;
  afterRatio: number;
}

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function mixRgb(
  rgb: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: rgb.r + (target.r - rgb.r) * t,
    g: rgb.g + (target.g - rgb.g) * t,
    b: rgb.b + (target.b - rgb.b) * t,
  };
}

function ensurePairContrast(fgHex: string, bgHexes: readonly string[], minRatio: number): string {
  const parsedFg = parseHex(fgHex);
  const bgLums = bgHexes
    .map((b) => luminance(b))
    .filter((l): l is number => l !== null);
  if (!parsedFg || bgLums.length === 0) return fgHex;

  const passesAll = (candidate: string) =>
    bgHexes.every((bg) => {
      const r = contrastRatio(candidate, bg);
      return r !== null && r >= minRatio;
    });

  if (passesAll(fgHex)) return fgHex;

  // Decide whether darkening toward black or lightening toward white achieves better minimum contrast
  const avgBgLum = bgLums.reduce((acc, l) => acc + l, 0) / bgLums.length;
  const primaryTarget = avgBgLum > 0.35 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const fallbackTarget = avgBgLum > 0.35 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };

  for (const target of [primaryTarget, fallbackTarget]) {
    for (let step = 1; step <= 50; step++) {
      const t = step / 50;
      const mixed = mixRgb(parsedFg, target, t);
      const hex = rgbToHex(mixed.r, mixed.g, mixed.b);
      if (passesAll(hex)) return hex;
    }
  }
  return avgBgLum > 0.35 ? "#000000" : "#ffffff";
}

/**
 * Deterministic WCAG AA ($\ge 4.5:1$) contrast pass across a design system's
 * colour role tokens (`ink`, `ink-muted`, `primary` against `ground` and
 * `surface`, and `on-primary` against `primary`). Nudges foreground lightness
 * until every pair meets `minRatio`.
 */
export function repairContrast(
  colors: Record<string, string>,
  minRatio: number = CONTRAST_BODY,
): { colors: Record<string, string>; repairs: ContrastRepair[] } {
  const out: Record<string, string> = { ...colors };
  const repairs: ContrastRepair[] = [];
  const ground = out.ground ?? "#ffffff";
  const surface = out.surface ?? ground;
  const bgs = [ground, surface];

  for (const role of ["ink", "ink-muted", "primary"] as const) {
    const current = out[role];
    if (!current) continue;
    const worstBefore = Math.min(
      ...bgs.map((bg) => contrastRatio(current, bg) ?? minRatio),
    );
    if (worstBefore < minRatio) {
      const fixed = ensurePairContrast(current, bgs, minRatio);
      const worstAfter = Math.min(
        ...bgs.map((bg) => contrastRatio(fixed, bg) ?? minRatio),
      );
      out[role] = fixed;
      repairs.push({
        role,
        against: "ground/surface",
        from: current,
        to: fixed,
        beforeRatio: worstBefore,
        afterRatio: worstAfter,
      });
    }
  }

  if (out["on-primary"] && out.primary) {
    const current = out["on-primary"];
    const before = contrastRatio(current, out.primary) ?? minRatio;
    if (before < minRatio) {
      const fixed = ensurePairContrast(current, [out.primary], minRatio);
      const after = contrastRatio(fixed, out.primary) ?? minRatio;
      out["on-primary"] = fixed;
      repairs.push({
        role: "on-primary",
        against: "primary",
        from: current,
        to: fixed,
        beforeRatio: before,
        afterRatio: after,
      });
    }
  }

  return { colors: out, repairs };
}

/** Result of `proposeThenPick`. */
export interface PickedDirection {
  direction: DsDirectionCandidate;
  surface: DesignSurface;
  density: DensityLevel;
  p: number;
  by: string;
  decisions: Record<string, Record<string, number>>;
}

/**
 * Ask Jev in a single batched call to select the best visual direction,
 * `surface:` elevation mode, and `density` for `request`.
 */
export async function proposeThenPick(
  request: string,
  answerer: Answerer = stubAnswerer(1),
  candidates: readonly DsDirectionCandidate[] = DS_DIRECTIONS,
): Promise<PickedDirection> {
  const list = candidates.length > 0 ? candidates : DS_DIRECTIONS;
  const dirCriteria = Object.fromEntries(list.map((c) => [c.id, `${c.name}: ${c.summary}`]));
  const surfaceCriteria: Record<DesignSurface, string> = {
    flat: "Flat hairline borders and crisp surfaces without drop shadows",
    raised: "Subtle elevation and soft card shadows",
    glass: "Translucent frosted panels with backdrop blur",
    bold: "High-contrast stark borders and offset shadows",
  };
  const dirQ: JevQuestion = {
    type: "choice",
    instructions: "Select the visual direction that best fits the product and request.",
    criteria: dirCriteria,
  };
  const surfQ: JevQuestion = {
    type: "choice",
    instructions: "Select the surface elevation mode for the design system.",
    criteria: surfaceCriteria,
  };
  const densQ: JevQuestion = {
    type: "score",
    instructions: "Score the appropriate information density for the product.",
    criteria: [
      "1 — compact density (tight 8px spacing for data-dense tools)",
      "2 — default density (balanced 12px spacing)",
      "3 — spacious density (generous 16px editorial spacing)",
    ],
  };
  const questions: Record<string, JevQuestion> = {
    "ds.direction": dirQ,
    "ds.surface": surfQ,
    "ds.density": densQ,
  };
  const req = {
    model: JEV_MODEL,
    state: { task: "Choose design system direction, surface and density", request },
    questions,
  };

  const answered = await answerer.answer(req);

  const dirAns = answered.response.answers["ds.direction"];
  const dirChoice = dirAns ? chosenOption(dirQ, dirAns) : null;
  const pickedId = dirChoice ? dirChoice.value : list[0]!.id;
  const direction = list.find((c) => c.id === pickedId) ?? list[0]!;
  const p = dirChoice ? dirChoice.p : 1;

  const surfAns = answered.response.answers["ds.surface"];
  const pickedSurface =
    surfAns && surfAns.type === "choice"
      ? (chosenOption(surfQ, surfAns).value as DesignSurface)
      : direction.surface;

  const densAns = answered.response.answers["ds.density"];
  const scoreIdx =
    densAns && densAns.type === "score"
      ? Math.max(0, Math.min(2, Math.round(densAns.score)))
      : 1;
  const density: DensityLevel = DENSITY_LEVELS[scoreIdx] ?? "default";

  return {
    direction,
    surface: pickedSurface,
    density,
    p: Math.round(p * 1000) / 1000,
    by: answered.by,
    decisions: compactDecisions(req, answered.response),
  };
}

/** Options for `synthesizeDesignSystem`. */
export interface SynthesizeDsOptions {
  name?: string;
  surface?: DesignSurface;
  colors?: Partial<Record<string, string>>;
  candidates?: readonly DsDirectionCandidate[];
  generator?: TextGenerator;
}

/** Result of `synthesizeDesignSystem`. */
export interface SynthesizedDesignSystem {
  name: string;
  direction: DsDirectionCandidate;
  surface: DesignSurface;
  density: DensityLevel;
  colors: Record<string, string>;
  repairs: ContrastRepair[];
  markdown: string;
  by: string;
  p: number;
  decisions: Record<string, Record<string, number>>;
}

/**
 * Synthesize a complete, WCAG AA contrast-repaired `DESIGN.md` document for `request`.
 */
export async function synthesizeDesignSystem(
  request: string,
  answerer: Answerer = stubAnswerer(1),
  opts: SynthesizeDsOptions = {},
): Promise<SynthesizedDesignSystem> {
  const picked = await proposeThenPick(request, answerer, opts.candidates);
  const surface = opts.surface ?? picked.surface;
  const mergedColors: Record<string, string> = { ...picked.direction.colors };
  for (const [k, v] of Object.entries(opts.colors ?? {})) {
    if (typeof v === "string") mergedColors[k] = v;
  }

  const { colors, repairs } = repairContrast(mergedColors, CONTRAST_BODY);
  const name = sanitizeFlowTitle(opts.name ?? `${picked.direction.name} — ${request || "Design System"}`);
  const { fontFamily, radius } = picked.direction;

  const markdown = [
    "---",
    "version: alpha",
    `name: "${name.replace(/"/g, "'")}"`,
    `description: "Synthesized design system (${picked.direction.name}, surface ${surface}, density ${picked.density}) for ${request.replace(/"/g, "'") || "wireframe flow"}."`,
    `surface: ${surface}`,
    "colors:",
    `  ground: "${colors.ground}"`,
    `  surface: "${colors.surface}"`,
    `  line: "${colors.line}"`,
    `  ink: "${colors.ink}"`,
    `  ink-muted: "${colors["ink-muted"]}"`,
    `  bar: "${colors.bar}"`,
    `  primary: "${colors.primary}"`,
    `  on-primary: "${colors["on-primary"]}"`,
    "typography:",
    "  title:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 20px",
    "    fontWeight: 600",
    "    lineHeight: 1.3",
    "  body:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 14px",
    "    fontWeight: 400",
    "    lineHeight: 1.5",
    "  label:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 14px",
    "    fontWeight: 500",
    "    lineHeight: 1.4",
    "rounded:",
    `  sm: ${radius.sm}`,
    `  base: ${radius.base}`,
    `  lg: ${radius.lg}`,
    `  full: ${radius.full}`,
    "spacing:",
    "  xs: 4px",
    `  base: ${picked.density === "compact" ? "8px" : picked.density === "spacious" ? "16px" : "12px"}`,
    "  md: 16px",
    "  lg: 24px",
    "components:",
    "  button-primary:",
    '    backgroundColor: "{colors.primary}"',
    '    textColor: "{colors.on-primary}"',
    '    typography: "{typography.label}"',
    '    rounded: "{rounded.base}"',
    "    height: 40px",
    '    padding: "0 {spacing.md}"',
    "  card:",
    '    backgroundColor: "{colors.ground}"',
    '    textColor: "{colors.ink}"',
    '    rounded: "{rounded.lg}"',
    '    padding: "{spacing.lg}"',
    "---",
    "",
    "## Overview",
    "",
    `${picked.direction.summary}. Synthesized for "${request || "this canvas"}" with deterministic WCAG AA contrast verification.`,
    "",
    "## Colors",
    "",
    `- **ground** (${colors.ground}) and **surface** (${colors.surface}) establish the canvas hierarchy.`,
    `- **ink** (${colors.ink}) and **ink-muted** (${colors["ink-muted"]}) maintain ≥ 4.5:1 AA contrast against both ground and surface.`,
    `- **primary** (${colors.primary}) and **on-primary** (${colors["on-primary"]}) anchor primary actions.`,
    "",
    "## Typography",
    "",
    `Set in ${fontFamily} with a 20px semibold title and 14px body/label scale.`,
    "",
    "## Layout",
    "",
    `Default density is ${picked.density}.`,
    "",
    "## Elevation & Depth",
    "",
    `\`surface: ${surface}\` governs card and chrome depth across the flow.`,
    "",
    "## Shapes",
    "",
    `Controls use ${radius.base} corners; cards use ${radius.lg}.`,
    "",
    "## Components",
    "",
    "Primary buttons use `{colors.primary}` with `{colors.on-primary}`; cards sit on `{colors.ground}`.",
    "",
    "## Do's and Don'ts",
    "",
    "- Do keep every foreground/background pair at or above 4.5:1 contrast.",
    "- Don't introduce unmapped literal hex colours outside the role tokens.",
    "",
  ].join("\n");

  const doc = parseDesign(markdown);
  const findings = checkDesign(doc).filter((f) => f.severity === "error" || f.severity === "warning");
  if (findings.length > 0) {
    throw new Error(`Synthesized DESIGN.md failed design check: ${findings.map((f) => `${f.where}: ${f.what}`).join("; ")}`);
  }

  return {
    name,
    direction: picked.direction,
    surface,
    density: picked.density,
    colors,
    repairs,
    markdown,
    by: picked.by,
    p: picked.p,
    decisions: picked.decisions,
  };
}

/** Result of `wireDsOnCanvas` (**Swap 1**). */
export interface WireDsCanvasResult {
  group: string;
  dsItemId: string;
  what: "added" | "versioned";
  synthesized: SynthesizedDesignSystem;
  restyled: Restyled;
}

const GAP = 160;

/**
 * Synthesize a `DESIGN.md` item on the canvas, set it as the governing design
 * system (`designUse`), and restyle the target screens and their prototype in
 * a single op group (**Swap 1**).
 */
export async function wireDsOnCanvas(
  port: WirePort,
  all: readonly Screen[],
  screens: readonly Screen[],
  request: string,
  answerer: Answerer = stubAnswerer(1),
  opts: SynthesizeDsOptions = {},
): Promise<WireDsCanvasResult> {
  if (screens.length === 0) {
    throw new Error('no wireframe to style — `isocan wire "<request>"` composes some');
  }
  const effectiveRequest = request.trim() || screens[0]!.spec.request || screens[0]!.spec.title;
  const synthesized = await synthesizeDesignSystem(effectiveRequest, answerer, opts);
  const before = await port.canvas();
  const group = newGroupId();

  const firstItem = before.items[screens[0]!.item];
  const scope = firstItem ? (canvasScopes(before, firstItem)[0]?.id ?? null) : null;
  const existing = ownDesignSystemAt(before, scope);
  const title = `DESIGN.md — ${synthesized.direction.name}`;

  let dsItemId: string;
  let what: "added" | "versioned";

  if (existing) {
    dsItemId = existing.id;
    const upload = await port.put(synthesized.markdown, "text/markdown", "DESIGN.md");
    await port.send(
      {
        type: "item.addVersion",
        itemId: existing.id,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: "text/markdown",
          filename: "DESIGN.md",
          size: upload.size,
        },
      },
      group,
    );
    await port.send(
      {
        type: "item.update",
        itemId: existing.id,
        patch: { title, properties: { [PRESET_PROP]: synthesized.direction.id } },
      },
      group,
    );
    what = "versioned";
  } else {
    dsItemId = newItemId();
    const upload = await port.put(synthesized.markdown, "text/markdown", "DESIGN.md");
    const scopeItem = scope ? before.items[scope] : undefined;
    await port.send(
      {
        type: "item.add",
        itemId: dsItemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: "text/markdown",
          filename: "DESIGN.md",
          size: upload.size,
        },
        width: 560,
        height: 720,
        placement: {
          x: Math.max(...screens.map((s) => s.x + s.width)) + GAP,
          y: Math.min(...screens.map((s) => s.y)),
          chosen: true,
        } as never,
        title,
        properties: { [PRESET_PROP]: synthesized.direction.id },
        ...(scopeItem && isGroupItem(scopeItem)
          ? { containerId: scopeItem.id, groupPlacement: "exact" as const }
          : {}),
      },
      group,
    );
    const landed = await port.canvas();
    await port.send(designUse(landed, landed.items[dsItemId]!).op, group);
    what = "added";
  }

  const after = await port.canvas();
  const governs = (canvas: CanvasContents, s: Screen) => {
    const item = canvas.items[s.item];
    const system = item ? governingSystem(canvas, item) : null;
    return system ? `${system.id}@${system.currentVersionId}` : "";
  };
  const asked = new Set(screens.map((s) => s.item));
  const touched = all.filter(
    (s) => after.items[s.item] && (asked.has(s.item) || governs(before, s) !== governs(after, s)),
  );
  const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec));
  const restyled = await restyle(port, after, all, touched, resolver, { toDefault: false, group });

  return {
    group,
    dsItemId,
    what,
    synthesized,
    restyled,
  };
}
