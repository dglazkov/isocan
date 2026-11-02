import {
  DEFAULT_CONFIDENCE_FLOOR,
  DEFAULT_ENTROPY_GATE,
  gatedChoice,
  type GatedChoiceOption,
  type JevRequest,
  type JevResponse,
} from "./answerer.ts";
import { PLATFORMS, type WireSpec } from "./spec.ts";
import {
  DENSITY_LEVELS,
  TEMPLATE_IDS,
  type DensityLevel,
  type Platform,
  type TemplateId,
} from "./catalog/index.ts";

/**
 * **Entropy-gated `/ask` on root flow decisions** (design §12).
 *
 * Leaf decisions (`main.2`, prop choices, intents) vary cheaply on the canvas
 * as sibling cards, so pausing to ask a person about a leaf is noise. Root flow
 * decisions (`platform`, `pack`, `style.direction`), however, reshape every
 * screen at once. When Jev's Shannon entropy on a root decision exceeds `1.0`
 * bit (or top confidence is below `0.50`) and neither `--no-ask` nor
 * `WireSpec.pinned` settles it, `gateFlowDecision` surfaces the top 3 options
 * with their probabilities so the canvas or CLI can ask once and pin the
 * answer in `WireSpec.pinned`.
 */

/** Root flow decision keys that can trigger an entropy-gated `/ask`. */
export const ROOT_GATE_KEYS = ["platform", "pack", "style.direction"] as const;

/** A root flow decision key from `ROOT_GATE_KEYS`. */
export type RootGateKey = (typeof ROOT_GATE_KEYS)[number];

/** One root flow disambiguation question surfaced when entropy exceeds the gate. */
export interface RootGateQuestion {
  /** Which root decision is ambiguous (`platform`, `pack`, `style.direction`). */
  key: RootGateKey;
  /** Human-readable question text. */
  prompt: string;
  /** Measured Shannon entropy in bits. */
  entropy: number;
  /** Top 3 candidate options with their probabilities. */
  options: GatedChoiceOption[];
  /** Argmax option if the user declines to override. */
  chosen: string;
}

const ROOT_PROMPTS: Record<RootGateKey, string> = {
  platform: "Which platform should this flow target?",
  pack: "Which domain content pack fits this request best?",
  "style.direction": "Which visual style direction should govern this flow?",
};

/**
 * Parse `--pin key=value` CLI flags into a `Record<string, string>` map.
 * Throws a clear error when an entry is missing `=` or has an empty key/value.
 */
export function parsePinFlags(flags: readonly string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!flags) return out;
  for (const raw of flags) {
    const eq = raw.indexOf("=");
    if (eq <= 0 || eq === raw.length - 1) {
      throw new Error(`--pin "${raw}" must be key=value (for example: --pin platform=web)`);
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (!key || !value) {
      throw new Error(`--pin "${raw}" must have a non-empty key and value`);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Evaluate root decisions present in `req`/`res` against the entropy gate.
 * Returns both the `resolved` map (including any `pinned` overrides) and any
 * `asks` that exceeded `maxEntropyBits` (default `1.0`) when `noAsk` is false.
 */
export function gateFlowDecision(
  req: JevRequest,
  res: JevResponse,
  opts: {
    pinned?: Record<string, string>;
    noAsk?: boolean;
    maxEntropyBits?: number;
    minConfidence?: number;
  } = {},
): { resolved: Record<string, string>; asks: RootGateQuestion[] } {
  const resolved: Record<string, string> = { ...(opts.pinned ?? {}) };
  const asks: RootGateQuestion[] = [];
  for (const key of ROOT_GATE_KEYS) {
    const q = req.questions[key];
    const a = res.answers[key];
    if (!q || !a) continue;
    const gated = gatedChoice(q, a, {
      ...(opts.pinned?.[key] !== undefined ? { pinned: opts.pinned[key]! } : {}),
      ...(opts.noAsk !== undefined ? { noAsk: opts.noAsk } : {}),
      maxEntropyBits: opts.maxEntropyBits ?? DEFAULT_ENTROPY_GATE,
      minConfidence: opts.minConfidence ?? DEFAULT_CONFIDENCE_FLOOR,
      topK: 3,
    });
    resolved[key] = gated.value;
    if (gated.status === "ask") {
      asks.push({
        key,
        prompt: ROOT_PROMPTS[key],
        entropy: gated.entropy,
        options: gated.options,
        chosen: gated.value,
      });
    }
  }
  return { resolved, asks };
}

/**
 * Format a `RootGateQuestion` as a canvas `/ask` comment or CLI disambiguation
 * line showing the top 3 options and their probabilities.
 */
export function formatAskComment(q: RootGateQuestion): string {
  const opts = q.options.map((o) => `${o.value} (${Math.round(o.p * 100)}%)`).join(" · ");
  return `/ask ${q.prompt} [entropy ${q.entropy.toFixed(2)} bits] — ${opts}`;
}

/**
 * Stamp `pinned` decisions onto every `WireSpec` in a flow. When `pinned.platform`,
 * `pinned.template`, or `pinned.density` names a valid catalog id, updates the
 * spec field to match.
 */
export function applyPinnedToSpecs(
  specs: readonly WireSpec[],
  pinned: Record<string, string> | undefined,
): WireSpec[] {
  if (!pinned || Object.keys(pinned).length === 0) return [...specs];
  const pinnedPlatform = PLATFORMS.includes(pinned.platform as Platform)
    ? (pinned.platform as Platform)
    : undefined;
  const pinnedTemplate = TEMPLATE_IDS.includes(pinned.template as TemplateId)
    ? (pinned.template as TemplateId)
    : undefined;
  const pinnedDensity = DENSITY_LEVELS.includes(pinned.density as DensityLevel)
    ? (pinned.density as DensityLevel)
    : undefined;
  return specs.map((spec) => ({
    ...spec,
    ...(pinnedPlatform ? { platform: pinnedPlatform } : {}),
    ...(pinnedTemplate ? { template: pinnedTemplate } : {}),
    ...(pinnedDensity ? { density: pinnedDensity } : {}),
    pinned: { ...(spec.pinned ?? {}), ...pinned },
  }));
}
