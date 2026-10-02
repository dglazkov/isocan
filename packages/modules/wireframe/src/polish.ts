import { CONTRAST_BODY, contrastRatio, newGroupId, type CanvasContents } from "@isocan/core";
import {
  JEV_MODEL,
  chosenOption,
  stubAnswerer,
  type Answerer,
  type JevQuestion,
} from "./answerer.ts";
import { isBlueprint } from "./content/flesh-spec.ts";
import type { Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import type { WirePort } from "./port.ts";
import { renderWire } from "./render.ts";
import { writeWire } from "./rerender.ts";
import {
  POLISH_TOKENS,
  wireTitle,
  type PolishToken,
  type WirePolishPatch,
  type WireSpec,
} from "./spec.ts";
import { DEFAULT_THEME } from "./theme.ts";
import { compactDecisions } from "./why.ts";

/**
 * **Jev-budgeted visual polish (`wire polish`) and Swap 2 contract verification**
 * (`design.md` §15, Phase 13).
 *
 * Scores `polish_intensity` ($0\text{–}1$) to determine a strict patch budget
 * (`0 | 4 | 8 | 12`), proposes typed `WirePolishPatch` entries keyed by
 * `data-wf` / `data-sec` paths, and verifies (`verifyWireContract`) that every
 * `data-sec`, `data-wf`, `data-hot`, and `data-intent` node and $\ge 4.5:1$
 * token contrast is preserved before writing a version.
 */

/** Allowed patch count budgets mapped from `polish_intensity`. */
export const POLISH_BUDGETS = [0, 4, 8, 12] as const;

/** A single allowed polish patch budget (`0 | 4 | 8 | 12`). */
export type PolishBudget = (typeof POLISH_BUDGETS)[number];

/**
 * Map a `polish_intensity` score ($0\text{–}1$) deterministically to a patch
 * budget: `< 0.25 → 0`, `0.25–0.50 → 4`, `0.50–0.75 → 8`, `> 0.75 → 12`.
 */
export function polishIntensityBudget(intensity: number): PolishBudget {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped < 0.25) return 0;
  if (clamped < 0.5) return 4;
  if (clamped <= 0.75) return 8;
  return 12;
}

function collectAttrValues(html: string, attr: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`\\b${attr}="([^"]+)"`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) out.add(m[1]);
  }
  return out;
}

/** Result of `verifyWireContract`. */
export interface WireContractVerification {
  ok: boolean;
  problems: string[];
}

/**
 * Pure contract gate for `WireSpec.polish` and **Swap 2** custom primitive
 * overrides (`design.md` §15). Asserts that:
 * 1. Every `data-sec` and `data-wf` path in `baselineHtml` is preserved in `candidateHtml`;
 * 2. Every `data-hot` and `data-intent` attribute in `baselineHtml` is preserved in `candidateHtml`;
 * 3. Every patch in `spec.polish` targets an existing `data-wf` or `data-sec` path and uses allowed `POLISH_TOKENS`;
 * 4. Resolved foreground/background theme token pairs maintain $\ge 4.5:1$ contrast.
 */
export function verifyWireContract(
  baselineHtml: string,
  candidateHtml: string,
  spec?: WireSpec,
): WireContractVerification {
  const problems: string[] = [];

  const baseSec = collectAttrValues(baselineHtml, "data-sec");
  const candSec = collectAttrValues(candidateHtml, "data-sec");
  for (const s of baseSec) {
    if (!candSec.has(s)) {
      problems.push(`missing data-sec="${s}" in candidate HTML`);
    }
  }

  const baseWf = collectAttrValues(baselineHtml, "data-wf");
  const candWf = collectAttrValues(candidateHtml, "data-wf");
  for (const w of baseWf) {
    if (!candWf.has(w)) {
      problems.push(`missing data-wf="${w}" in candidate HTML`);
    }
  }

  const baseHot = collectAttrValues(baselineHtml, "data-hot");
  const candHot = collectAttrValues(candidateHtml, "data-hot");
  for (const h of baseHot) {
    if (!candHot.has(h)) {
      problems.push(`missing hotspot data-hot="${h}" in candidate HTML`);
    }
  }

  const baseIntent = collectAttrValues(baselineHtml, "data-intent");
  const candIntent = collectAttrValues(candidateHtml, "data-intent");
  for (const intent of baseIntent) {
    if (!candIntent.has(intent)) {
      problems.push(`missing actionable intent data-intent="${intent}" in candidate HTML`);
    }
  }

  if (spec?.polish) {
    const allowedTokens = new Set<string>(POLISH_TOKENS);
    for (const patch of spec.polish) {
      if (!baseWf.has(patch.target) && !baseSec.has(patch.target)) {
        problems.push(`polish target "${patch.target}" does not match any data-wf or data-sec path on the screen`);
      }
      for (const t of patch.add ?? []) {
        if (!allowedTokens.has(t)) {
          problems.push(`polish token "${t}" on "${patch.target}" is not in POLISH_TOKENS`);
        }
      }
      for (const t of patch.remove ?? []) {
        if (!allowedTokens.has(t)) {
          problems.push(`polish remove token "${t}" on "${patch.target}" is not in POLISH_TOKENS`);
        }
      }
    }
  }

  if (spec?.style && spec.style.source === "design-system") {
    const roles = spec.style.roles;
    const ground = roles.ground?.value ?? DEFAULT_THEME.ground;
    const surface = roles.surface?.value ?? DEFAULT_THEME.surface;
    const ink = roles.ink?.value ?? DEFAULT_THEME.ink;
    const muted = roles["ink-muted"]?.value ?? DEFAULT_THEME["ink-muted"];
    const primary = roles.primary?.value ?? DEFAULT_THEME.primary;
    const onPrimary = roles["on-primary"]?.value ?? DEFAULT_THEME["on-primary"];

    const pairs: Array<[string, string, string]> = [
      ["ink vs ground", ink, ground],
      ["ink vs surface", ink, surface],
      ["ink-muted vs ground", muted, ground],
      ["ink-muted vs surface", muted, surface],
      ["on-primary vs primary", onPrimary, primary],
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio !== null && ratio < CONTRAST_BODY) {
        problems.push(`contrast violation (${label}): ${ratio}:1 < ${CONTRAST_BODY}:1`);
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Apply `patches` to `spec`, render the resulting HTML, and verify the
 * structural and contrast contract (`verifyWireContract`) before returning.
 * Throws if any contract invariant is violated.
 */
export function applyWirePolish(
  spec: WireSpec,
  patches: readonly WirePolishPatch[],
): { spec: WireSpec; html: string } {
  const unpolishedSpec: WireSpec = { ...spec };
  delete unpolishedSpec.polish;
  const baselineHtml = renderWire(unpolishedSpec);

  const mergedPatches = [...(spec.polish ?? []), ...patches];
  const nextSpec: WireSpec =
    mergedPatches.length > 0 ? { ...spec, polish: mergedPatches } : unpolishedSpec;
  const candidateHtml = renderWire(nextSpec);

  const check = verifyWireContract(baselineHtml, candidateHtml, nextSpec);
  if (!check.ok) {
    throw new Error(`wire polish rejected by contract gate:\n  ${check.problems.join("\n  ")}`);
  }
  return { spec: nextSpec, html: candidateHtml };
}

/** Result of `planPolishWithJev`. */
export interface PlannedPolish {
  intensity: number;
  budget: PolishBudget;
  patches: WirePolishPatch[];
  by: string;
  decisions: Record<string, Record<string, number>>;
}

const POLISH_DESCRIPTIONS: Record<PolishToken | "none", string> = {
  "wf-elevated": "Elevated card surface with soft shadow and border",
  "wf-bordered": "Crisp 1.5px bordered container with balanced padding",
  "wf-subtle": "Subtle tinted surface background fill",
  "wf-emphasis": "Left accent border emphasizing the section",
  "wf-compact-pad": "Tighter inner padding for compact data sections",
  "wf-spacious-pad": "Generous inner padding for hero or focal sections",
  "wf-rounded-lg": "Larger corner radius for prominent cards",
  "wf-accent-ring": "Primary focus/accent outline ring",
  none: "Leave section unpolished",
};

/**
 * Ask Jev for `polish_intensity` ($0\text{–}1$) and per-slot visual refinement
 * tokens on `spec`, capped to `polishIntensityBudget(intensity)` patches.
 */
export async function planPolishWithJev(
  spec: WireSpec,
  answerer: Answerer = stubAnswerer(1),
  opts: { intensity?: number } = {},
): Promise<PlannedPolish> {
  const resolvedSlots = spec.slots.filter((s) => s.block !== null);
  const questions: Record<string, JevQuestion> = {
    "polish.intensity": {
      type: "noul",
      instructions: "Should this screen receive visual polish refinements (elevation, surface contrast, emphasis borders)?",
      criteria: {
        true: "Apply visual polish tokens to refine section hierarchy and surface depth",
        false: "Keep sections unpolished",
      },
    },
  };
  for (const s of resolvedSlots) {
    questions[`polish.slot.${s.slot}`] = {
      type: "choice",
      instructions: `Choose the visual polish token for slot "${s.slot}" (${s.block}).`,
      criteria: POLISH_DESCRIPTIONS,
    };
  }

  const req = {
    model: JEV_MODEL,
    state: {
      task: "Score polish_intensity and choose per-slot visual refinement tokens",
      archetype: spec.archetype,
      title: spec.title,
      request: spec.request,
      slots: resolvedSlots.map((s) => ({ slot: s.slot, block: s.block })),
    },
    questions,
  };
  const answered = await answerer.answer(req);

  const intAns = answered.response.answers["polish.intensity"];
  const rawIntensity =
    opts.intensity !== undefined
      ? opts.intensity
      : intAns && intAns.type === "noul"
        ? intAns.noul
        : 0.5;
  const budget = polishIntensityBudget(rawIntensity);
  const patches: WirePolishPatch[] = [];

  if (budget > 0) {
    for (const s of resolvedSlots) {
      if (patches.length >= budget) break;
      const q = questions[`polish.slot.${s.slot}`]!;
      const ans = answered.response.answers[`polish.slot.${s.slot}`];
      const pick = ans && ans.type === "choice" ? chosenOption(q, ans).value : "wf-bordered";
      const token: PolishToken =
        pick !== "none" && (POLISH_TOKENS as readonly string[]).includes(pick)
          ? (pick as PolishToken)
          : s.slot.startsWith("main")
            ? "wf-elevated"
            : "wf-subtle";
      patches.push({ target: s.slot, add: [token] });
    }
  }

  return {
    intensity: Math.round(rawIntensity * 1000) / 1000,
    budget,
    patches,
    by: answered.by,
    decisions: compactDecisions(req, answered.response),
  };
}

/** Result of `polishWireOnCanvas`. */
export interface PolishCanvasResult {
  group: string;
  by: string;
  changed: Array<{
    itemId: string;
    title: string;
    intensity: number;
    budget: PolishBudget;
    patches: WirePolishPatch[];
    spec: WireSpec;
  }>;
  prototypes: Array<{ itemId: string; what: string }>;
}

/**
 * Run Jev-budgeted `wire polish` across target screens on a canvas, verifying
 * `verifyWireContract` on each screen, writing one version per changed screen,
 * and rebuilding kept prototypes in a single op group.
 */
export async function polishWireOnCanvas(
  port: WirePort,
  canvas: CanvasContents,
  all: readonly Screen[],
  screens: readonly Screen[],
  answerer: Answerer = stubAnswerer(1),
  opts: { intensity?: number; clear?: boolean; group?: string } = {},
): Promise<PolishCanvasResult> {
  const group = opts.group ?? newGroupId();
  const changed: PolishCanvasResult["changed"] = [];
  let by: string = answerer.name;

  for (const s of screens) {
    if (isBlueprint(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;

    if (opts.clear) {
      if (!s.spec.polish || s.spec.polish.length === 0) continue;
      const cleared: WireSpec = { ...s.spec };
      delete cleared.polish;
      if (await writeWire(port, item, cleared, group, s.spec)) {
        changed.push({
          itemId: s.item,
          title: wireTitle(cleared),
          intensity: 0,
          budget: 0,
          patches: [],
          spec: cleared,
        });
      }
      continue;
    }

    const planned = await planPolishWithJev(s.spec, answerer, {
      ...(opts.intensity !== undefined ? { intensity: opts.intensity } : {}),
    });
    by = planned.by;
    if (planned.patches.length === 0) continue;

    const mergedDecisions = { ...(s.spec.decisions ?? {}), ...planned.decisions };
    const { spec: polished } = applyWirePolish(
      Object.keys(mergedDecisions).length > 0
        ? { ...s.spec, decisions: mergedDecisions }
        : s.spec,
      planned.patches,
    );
    if (JSON.stringify(polished) === JSON.stringify(s.spec)) continue;
    if (await writeWire(port, item, polished, group, s.spec)) {
      changed.push({
        itemId: s.item,
        title: wireTitle(polished),
        intensity: planned.intensity,
        budget: planned.budget,
        patches: planned.patches,
        spec: polished,
      });
    }
  }

  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group,
  );

  return { group, by, changed, prototypes };
}
