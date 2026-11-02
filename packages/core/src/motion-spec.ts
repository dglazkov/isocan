/**
 * **The spec an agent writes** (motion phase 2; `docs/projects/motion/design.md`
 * §3). Words go to an agent, and the agent writes a SPEC — never code: what
 * moves, how, on what pivot, after whom. `isocan motion new <svg…> --spec`
 * and `isocan motion edit <motion> --spec` read one with `motionSpecFrom`.
 *
 * **The authored form leaves out what the drawings already say.** The stage
 * and the layers — their ids, boxes, viewBoxes and named parts — are measured
 * from the selected SVGs by the builder, so an agent writes only `seconds`,
 * `loop` and `moves`. A pivot is said by NAME (`"base"`, `"center"`, `"top"`,
 * `"left"`, `"right"`), resolved here against the target's own box, or as a
 * point `{ "x": …, "y": … }` in the target's own SVG units. Named pivots are
 * what the principle checks read and what survive a refresh: a part redrawn
 * taller still turns on its base.
 *
 * `authoredSpec` is the way back — a motion's spec as an agent would write it
 * — which `isocan motion spec` prints for an agent to edit, and which
 * *Refresh from sources* re-resolves against the sources' newer drawings.
 */
import type { MotionBox, MotionChannel, MotionChannelName, MotionLayer, MotionMove, MotionPivot, MotionSpec } from "./motion-engine.ts";
import { MOTION_PIVOTS, pivotOn } from "./motion-recipes.ts";
import { validateMotionSpec } from "./motion-checks.ts";

/** A named pivot: `base`, `center`, `top`, `left` or `right`. */
export type MotionPivotName = (typeof MOTION_PIVOTS)[number];

/** One move as an agent writes it: the pivot by name or as a point. */
export interface MotionAuthoredMove {
  target: string;
  pivot?: MotionPivotName | { x: number; y: number };
  follows?: string;
  channels: Partial<Record<MotionChannelName, MotionChannel>>;
}

/** **The spec as an agent writes it**: a length, whether it loops, and what moves. */
export interface MotionAuthoredSpec {
  seconds: number;
  loop?: boolean;
  moves: MotionAuthoredMove[];
}

/** Every target a spec may name for these layers: each layer, and each of its named `<g id>` parts. */
export function motionTargets(layers: readonly Pick<MotionLayer, "id" | "parts">[]): string[] {
  return layers.flatMap((l) => [l.id, ...Object.keys(l.parts).map((p) => `${l.id}/${p}`)]);
}

function boxOf(layers: readonly MotionLayer[], target: string): MotionBox | undefined {
  const [layerId, part, extra] = target.split("/");
  if (extra !== undefined) return undefined;
  const layer = layers.find((l) => l.id === layerId);
  if (!layer) return undefined;
  return part === undefined ? layer.viewBox : layer.parts[part];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const SPEC_KEYS = new Set(["seconds", "loop", "moves", "version", "recipe", "stage", "layers"]);
const MOVE_KEYS = new Set(["target", "pivot", "follows", "channels"]);

/**
 * **Read an authored spec against the layers it will move**, or refuse it in
 * words — the first problem, naming the targets there are when a name is
 * wrong. `stage` and `layers` in the JSON are ignored rather than trusted:
 * they are always the drawings' own. The result has passed
 * `validateMotionSpec`; its warnings are the caller's to say.
 */
export function motionSpecFrom(authored: unknown, layers: readonly MotionLayer[], stage: { width: number; height: number }): MotionSpec {
  if (!isObject(authored)) throw new Error("a motion spec is a JSON object: { \"seconds\": …, \"loop\": …, \"moves\": [ … ] }");
  for (const key of Object.keys(authored)) {
    if (!SPEC_KEYS.has(key)) throw new Error(`a motion spec has seconds, loop and moves — not "${key}"`);
  }
  const { seconds, loop, moves } = authored;
  if (!finite(seconds)) throw new Error("a motion spec says how long it is: \"seconds\", a number");
  if (loop !== undefined && typeof loop !== "boolean") throw new Error("\"loop\" is true or false");
  if (!Array.isArray(moves)) throw new Error("a motion spec's \"moves\" is a list — one entry per thing that moves");
  const targets = motionTargets(layers);
  const named = targets.join(", ");
  const out: MotionMove[] = moves.map((raw, i) => {
    if (!isObject(raw)) throw new Error(`move ${i + 1} is not an object`);
    for (const key of Object.keys(raw)) {
      if (!MOVE_KEYS.has(key)) throw new Error(`move ${i + 1} has target, pivot, follows and channels — not "${key}"`);
    }
    const target = raw.target;
    if (typeof target !== "string" || !boxOf(layers, target)) {
      throw new Error(`move ${i + 1} moves ${JSON.stringify(target)}, which is not here — the targets are ${named}`);
    }
    if (raw.follows !== undefined && (typeof raw.follows !== "string" || !boxOf(layers, raw.follows))) {
      throw new Error(`"${target}" follows ${JSON.stringify(raw.follows)}, which is not here — the targets are ${named}`);
    }
    if (!isObject(raw.channels)) throw new Error(`"${target}" says no channels — what moves: x, y, rotate, scale, opacity or draw`);
    const move: MotionMove = { target, channels: structuredClone(raw.channels) as MotionMove["channels"] };
    if (raw.follows !== undefined) move.follows = raw.follows as string;
    if (raw.pivot !== undefined) move.pivot = pivotFrom(raw.pivot, boxOf(layers, target)!, target);
    return move;
  });
  const spec: MotionSpec = { version: 1, seconds, loop: loop ?? false, stage: { ...stage }, layers: [...layers], moves: out };
  validateMotionSpec(spec);
  return spec;
}

function pivotFrom(raw: unknown, box: MotionBox, target: string): MotionPivot {
  if (typeof raw === "string") {
    if (!(MOTION_PIVOTS as readonly string[]).includes(raw)) {
      throw new Error(`"${target}" turns on "${raw}" — a pivot is ${MOTION_PIVOTS.join(", ")}, or a point { "x": …, "y": … } in its own units`);
    }
    return pivotOn(box, raw as MotionPivotName);
  }
  if (isObject(raw) && finite(raw.x) && finite(raw.y)) {
    const at = typeof raw.at === "string" && raw.at ? raw.at : "point";
    if ((MOTION_PIVOTS as readonly string[]).includes(at)) return pivotOn(box, at as MotionPivotName);
    return { x: raw.x, y: raw.y, at };
  }
  throw new Error(`"${target}"'s pivot is a name (${MOTION_PIVOTS.join(", ")}) or a point { "x": …, "y": … }`);
}

/**
 * **A motion's spec as an agent writes it** — named pivots by name, a point
 * as a point, and no stage or layers. What `isocan motion spec` prints, and
 * what `motionSpecFrom` reads back into the same spec for the same drawings.
 */
export function authoredSpec(spec: Pick<MotionSpec, "seconds" | "loop" | "moves">): MotionAuthoredSpec {
  return {
    seconds: spec.seconds,
    loop: spec.loop,
    moves: spec.moves.map((m) => {
      const move: MotionAuthoredMove = { target: m.target, channels: structuredClone(m.channels) };
      if (m.pivot) move.pivot = (MOTION_PIVOTS as readonly string[]).includes(m.pivot.at) ? (m.pivot.at as MotionPivotName) : { x: m.pivot.x, y: m.pivot.y };
      if (m.follows !== undefined) move.follows = m.follows;
      return move;
    }),
  };
}

/**
 * **The spec a motion document carries**, read from its text without running
 * it — the `<script type="application/json" id="motion-spec">` the builder
 * writes. Null when the document is not a motion's.
 */
export function motionDocumentSpec(html: string): MotionSpec | null {
  const m = /<script type="application\/json" id="motion-spec">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try {
    const spec = JSON.parse(m[1]!) as MotionSpec;
    return isObject(spec) && Array.isArray(spec.moves) && Array.isArray(spec.layers) ? spec : null;
  } catch {
    return null;
  }
}
