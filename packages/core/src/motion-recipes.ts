/**
 * **Recipes: a good default with no model** (motion phase 0;
 * `docs/projects/motion/design.md` §3). Each is a function from the layers —
 * their named parts, sizes and ink — to a spec in the engine's vocabulary.
 * Phase 0 carries `assemble` and `idle`; `reveal`, `orbit` and `emphasis`
 * are phase 3's.
 */
import type { MotionBox, MotionLayer, MotionMove, MotionPivot, MotionSpec } from "./motion-engine.ts";

/** The recipes this build knows, in the order `--recipe` lists them. */
export const MOTION_RECIPES = ["assemble", "idle"] as const;

/** A recipe's name. */
export type MotionRecipeName = (typeof MOTION_RECIPES)[number];

/** Is this a recipe this build knows? */
export function isMotionRecipe(name: string): name is MotionRecipeName {
  return (MOTION_RECIPES as readonly string[]).includes(name);
}

/**
 * **A beat**: how long a follower trails its leader, and the shortest gap
 * the follower check accepts. A tenth of a second reads as "after", not
 * "at the same time".
 */
export const MOTION_BEAT = 0.1;

/** The named pivots a recipe or an agent may ask for, on a target's box. */
export const MOTION_PIVOTS = ["base", "center", "top", "left", "right"] as const;

/** A named pivot on a box, in that box's own units. */
export function pivotOn(box: MotionBox, at: (typeof MOTION_PIVOTS)[number]): MotionPivot {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const point = {
    base: [cx, box.y + box.height],
    center: [cx, cy],
    top: [cx, box.y],
    left: [box.x, cy],
    right: [box.x + box.width, cy],
  }[at];
  return { x: point[0]!, y: point[1]!, at };
}

/** Options every recipe takes: a length to fit to, and whether it loops. */
export interface MotionRecipeOptions {
  seconds?: number;
  loop?: boolean;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function scaleTimes(moves: MotionMove[], k: number): void {
  for (const move of moves) {
    for (const ch of Object.values(move.channels)) {
      for (const key of ch?.keys ?? []) key.t = r3(key.t * k);
      if (ch?.wave) {
        ch.wave.period = r3(ch.wave.period * k);
        if (ch.wave.from !== undefined) ch.wave.from = r3(ch.wave.from * k);
      }
    }
  }
}

/**
 * **`assemble`** — Scene 1's shape. Line-only layers draw on; layers with
 * named parts grow their parts up from the base, each a beat after the one
 * before, turning on the base rather than the middle; everything else
 * settles in last, a beat after the growing stops. Back to front within
 * each kind, which is the canvas's stacking.
 */
function assemble(layers: readonly MotionLayer[]): { moves: MotionMove[]; seconds: number } {
  const moves: MotionMove[] = [];
  let cursor = 0;
  let leader: { target: string } | null = null;
  const push = (move: MotionMove) => {
    if (leader) move.follows = leader.target;
    moves.push(move);
    leader = move;
  };
  for (const layer of layers.filter((l) => l.ink === "outline")) {
    push({ target: layer.id, channels: { draw: { keys: [{ t: cursor, v: 0 }, { t: r3(cursor + 0.9), v: 1, ease: "inOut" }] } } });
    cursor = r3(cursor + 0.45);
  }
  let end = cursor;
  for (const layer of layers.filter((l) => l.ink !== "outline" && Object.keys(l.parts).length > 0)) {
    for (const [name, box] of Object.entries(layer.parts)) {
      const s = cursor, e = r3(cursor + 0.9);
      push({
        target: `${layer.id}/${name}`,
        pivot: pivotOn(box, "base"),
        channels: {
          scale: { keys: [{ t: s, v: 0.2 }, { t: e, v: 1, ease: "outBack" }] },
          rotate: { keys: [{ t: s, v: -14 }, { t: e, v: 0, ease: "outBack" }] },
          opacity: { keys: [{ t: s, v: 0 }, { t: r3(s + 0.25), v: 1, ease: "out" }] },
        },
      });
      end = Math.max(end, e);
      cursor = r3(cursor + 0.12);
    }
  }
  cursor = r3(Math.max(cursor, end) + 0.15);
  for (const layer of layers.filter((l) => l.ink !== "outline" && Object.keys(l.parts).length === 0)) {
    const s = cursor, e = r3(cursor + 0.6);
    push({
      target: layer.id,
      channels: {
        opacity: { keys: [{ t: s, v: 0 }, { t: r3(s + 0.3), v: 1, ease: "out" }] },
        y: { keys: [{ t: s, v: r3(layer.viewBox.height * 0.12) }, { t: e, v: 0, ease: "outBack" }] },
      },
    });
    end = Math.max(end, e);
    cursor = r3(cursor + 0.15);
  }
  return { moves, seconds: r3(Math.max(end, cursor) + 0.3) };
}

/**
 * **`idle`** — motion that never quite stops: named parts sway a few degrees
 * on their base, each a little behind the last; a layer with no parts
 * breathes about its centre (said, so the centre check does not fire).
 * One sway per loop, so the loop has no seam.
 */
function idle(layers: readonly MotionLayer[], seconds: number): { moves: MotionMove[]; seconds: number } {
  const moves: MotionMove[] = [];
  let n = 0;
  for (const layer of layers) {
    const names = Object.keys(layer.parts);
    if (names.length > 0) {
      for (const name of names) {
        moves.push({
          target: `${layer.id}/${name}`,
          pivot: pivotOn(layer.parts[name]!, "base"),
          channels: { rotate: { wave: { period: seconds, amp: 3, phase: r3(n * 0.04) } } },
        });
        n++;
      }
    } else {
      moves.push({
        target: layer.id,
        pivot: pivotOn(layer.viewBox, "center"),
        channels: { scale: { wave: { period: seconds, amp: 0.015, phase: r3(n * 0.04) } } },
      });
      n++;
    }
  }
  return { moves, seconds };
}

/**
 * **A recipe's spec for these layers.** `seconds` stretches or squeezes the
 * recipe's own timing to fit; `loop` defaults to the recipe's nature —
 * `assemble` plays once and holds, `idle` loops.
 */
export function motionRecipe(
  name: MotionRecipeName,
  layers: readonly MotionLayer[],
  stage: { width: number; height: number },
  options: MotionRecipeOptions = {},
): MotionSpec {
  let moves: MotionMove[];
  let seconds: number;
  if (name === "assemble") {
    ({ moves, seconds } = assemble(layers));
    if (options.seconds !== undefined && seconds > 0) {
      scaleTimes(moves, options.seconds / seconds);
      seconds = options.seconds;
    }
  } else {
    ({ moves, seconds } = idle(layers, options.seconds ?? 4));
  }
  return {
    version: 1,
    seconds,
    loop: options.loop ?? name === "idle",
    stage,
    layers: [...layers],
    moves,
    recipe: name,
  };
}
