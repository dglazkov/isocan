/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **House Agent contract & structured comment metadata** (Open Stitch Phase 2B,
 * OS1 ADRs 0020, 0177, 0269).
 *
 * Pure, dependency-free vocabulary shared across `@isocan/core`,
 * `@isocan/house-agent`, `@isocan/cli`, and `@isocan/web`:
 * - Canonical `@house` handle, role, and session key.
 * - Deterministic 0 ms first-person future-tense `instantAck` (never `"Thinking…"`).
 * - `HouseCommentMeta` (`thoughtTrace`, `plan`, `goal`, `ack`) with pure
 *   `encodeHouseMeta` / `parseHouseMeta` helpers so any agent (house or BYO)
 *   writing this metadata into a comment gets the same rich UI.
 */

/** Canonical handle claimed by the house agent (or a BYO agent taking its role). */
export const HOUSE_HANDLE = "house";

/** Canonical role label for the house agent's station and presence. */
export const HOUSE_ROLE = "house";

/** Deterministic session key used by the house agent. */
export const HOUSE_SESSION_KEY = "agent:house";

/** Step status inside a structured {@link HousePlanMeta}. */
export type HousePlanStepState = "pending" | "active" | "done" | "failed";

/** One step in an agent's structured plan rendered by `PlanView`. */
interface HousePlanStep {
  id: string;
  label: string;
  state: HousePlanStepState;
}

/** Structured plan attached to a comment via {@link HouseCommentMeta}. */
export interface HousePlanMeta {
  title: string;
  steps: HousePlanStep[];
}

/** Lifecycle status of an agent's goal rendered by `GoalStatus`. */
type HouseGoalState = "drafting" | "running" | "waiting" | "done" | "stalled";

/** Goal status badge metadata attached to a comment via {@link HouseCommentMeta}. */
export interface HouseGoalMeta {
  state: HouseGoalState;
  wave?: number | undefined;
}

/**
 * Structured metadata carried in an agent comment so `ThoughtTrace`, `PlanView`,
 * and `GoalStatus` render identically whether posted by the house agent or a
 * BYO agent.
 */
export interface HouseCommentMeta {
  ack?: string | undefined;
  thoughtTrace?: string[] | undefined;
  plan?: HousePlanMeta | undefined;
  goal?: HouseGoalMeta | undefined;
}

/**
 * Deterministic 0 ms first-person future-tense acknowledgement for a prompt.
 * Always begins with `"I'll "` and never emits `"Thinking…"`.
 */
export function instantAck(prompt: string): string {
  const clean = prompt.trim();
  if (!clean) return "I'll take a look at the canvas now.";
  if (/\b(delete|remove|trash|clear)\b/i.test(clean)) {
    return "I'll check what's on the canvas and clean that up.";
  }
  if (/\b(move|arrange|align|layout|organize|group|tid(y|ies))\b/i.test(clean)) {
    return "I'll check the layout and arrange those items.";
  }
  if (/\b(edit|update|change|fix|refactor|rename|rewrite|revise|tweak)\b/i.test(clean)) {
    return "I'll inspect the current items and apply that update.";
  }
  if (/\b(add|create|make|build|draw|sketch|wire|generate|draft|write)\b/i.test(clean)) {
    return "I'll read the canvas and create that for you.";
  }
  if (/\b(explain|what|why|how|summarize|summary|describe|review|critique|check|find|where)\b/i.test(clean)) {
    return "I'll read the canvas and answer that for you.";
  }
  return "I'll look at the canvas and get right on that.";
}

const META_PREFIX = "<!-- isocan:house-meta:";
const META_SUFFIX = " -->";
const META_BLOCK_RE = /\n*<!--\s*isocan:house-meta:([\s\S]*?)-->\s*$/;

const PLAN_STEP_STATES: ReadonlySet<string> = new Set(["pending", "active", "done", "failed"]);
const GOAL_STATES: ReadonlySet<string> = new Set(["drafting", "running", "waiting", "done", "stalled"]);

function hasMetaContent(meta: HouseCommentMeta): boolean {
  return Boolean(
    meta.ack?.trim() ||
    (meta.thoughtTrace && meta.thoughtTrace.length > 0) ||
    meta.plan ||
    meta.goal,
  );
}

function normalizeMeta(raw: unknown): HouseCommentMeta | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: HouseCommentMeta = {};

  if (typeof obj.ack === "string" && obj.ack.trim()) {
    out.ack = obj.ack.trim();
  }

  if (Array.isArray(obj.thoughtTrace)) {
    const lines = obj.thoughtTrace
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (lines.length > 0) out.thoughtTrace = lines;
  }

  if (obj.plan && typeof obj.plan === "object" && !Array.isArray(obj.plan)) {
    const planObj = obj.plan as Record<string, unknown>;
    const title = typeof planObj.title === "string" ? planObj.title.trim() : "";
    const stepsRaw = Array.isArray(planObj.steps) ? planObj.steps : [];
    const steps: HousePlanStep[] = [];
    for (const step of stepsRaw) {
      if (!step || typeof step !== "object" || Array.isArray(step)) continue;
      const s = step as Record<string, unknown>;
      const id = typeof s.id === "string" ? s.id.trim() : "";
      const label = typeof s.label === "string" ? s.label.trim() : "";
      const state = typeof s.state === "string" && PLAN_STEP_STATES.has(s.state)
        ? (s.state as HousePlanStepState)
        : "pending";
      if (id && label) steps.push({ id, label, state });
    }
    if (title || steps.length > 0) {
      out.plan = { title: title || "Plan", steps };
    }
  }

  if (obj.goal && typeof obj.goal === "object" && !Array.isArray(obj.goal)) {
    const goalObj = obj.goal as Record<string, unknown>;
    if (typeof goalObj.state === "string" && GOAL_STATES.has(goalObj.state)) {
      const wave = typeof goalObj.wave === "number" && Number.isFinite(goalObj.wave)
        ? Math.trunc(goalObj.wave)
        : undefined;
      out.goal = {
        state: goalObj.state as HouseGoalState,
        ...(wave !== undefined ? { wave } : {}),
      };
    }
  }

  return hasMetaContent(out) ? out : null;
}

/**
 * Encode {@link HouseCommentMeta} into a comment body as an HTML metadata
 * block so any agent writing via `thread.reply` or `comment.update` gets the
 * same rich UI without new ops.
 */
export function encodeHouseMeta(body: string, meta: HouseCommentMeta): string {
  const cleanBody = body.replace(META_BLOCK_RE, "").trimEnd();
  const normalized = normalizeMeta(meta);
  if (!normalized) return cleanBody;
  // Prevent accidental HTML comment termination inside JSON strings.
  const json = JSON.stringify(normalized).replace(/-->/g, "--\\u003e");
  const block = `${META_PREFIX}${json}${META_SUFFIX}`;
  return cleanBody ? `${cleanBody}\n\n${block}` : block;
}

/**
 * Extract {@link HouseCommentMeta} from a comment body, returning the clean
 * prose `body` and the parsed `meta` (or `null` when absent or malformed).
 */
export function parseHouseMeta(rawBody: string): { body: string; meta: HouseCommentMeta | null } {
  const match = META_BLOCK_RE.exec(rawBody);
  if (!match) return { body: rawBody, meta: null };
  const stripped = rawBody.slice(0, match.index).trimEnd();
  const payload = match[1]?.trim();
  if (!payload) return { body: stripped, meta: null };
  try {
    const parsed = JSON.parse(payload) as unknown;
    return { body: stripped, meta: normalizeMeta(parsed) };
  } catch {
    return { body: stripped, meta: null };
  }
}
