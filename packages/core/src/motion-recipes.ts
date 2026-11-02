/**
 * **Recipes: a good default with no model** (motion phase 0;
 * `docs/projects/motion/design.md` §3). Each is a function from the layers —
 * their named parts, sizes and ink — to a spec in the engine's vocabulary.
 * Phase 0 carried `assemble` and `idle`; phase 3 adds `reveal`, `orbit` and
 * `emphasis`. Every recipe plays clean under the principle checks
 * (`motion-checks.ts`): whatever turns or scales names its pivot, a follower
 * trails its leader by at least a beat, and idle motion stays under its
 * ceiling — `packages/core/test/motion.test.ts` holds each one to that.
 */
import type { MotionBox, MotionLayer, MotionMove, MotionPivot, MotionSpec } from "./motion-engine.ts";

/** The recipes this build knows, in the order `--recipe` lists them. */
export const MOTION_RECIPES = ["assemble", "reveal", "idle", "orbit", "emphasis"] as const;

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
      for (const bell of ch?.bells ?? []) {
        bell.at = r3(bell.at * k);
        bell.width = r3(bell.width * k);
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
 * **`reveal`** — the whole drawing comes in a layer at a time, back to
 * front: each fades up, rises a little and grows the last few percent about
 * its own centre (said, so the centre check knows it was meant), a quarter
 * second after the one before. Line-only layers draw on instead. Unlike
 * `assemble` it does not take a drawing apart: a layer arrives whole.
 */
function reveal(layers: readonly MotionLayer[]): { moves: MotionMove[]; seconds: number } {
  const moves: MotionMove[] = [];
  let cursor = 0;
  let end = 0;
  let leader: string | null = null;
  for (const layer of layers) {
    const s = cursor, e = r3(cursor + 0.7);
    const move: MotionMove = layer.ink === "outline"
      ? { target: layer.id, channels: { draw: { keys: [{ t: s, v: 0 }, { t: e, v: 1, ease: "inOut" }] } } }
      : {
        target: layer.id,
        pivot: pivotOn(layer.viewBox, "center"),
        channels: {
          opacity: { keys: [{ t: s, v: 0 }, { t: r3(s + 0.35), v: 1, ease: "out" }] },
          y: { keys: [{ t: s, v: r3(layer.viewBox.height * 0.06) }, { t: e, v: 0, ease: "outQuart" }] },
          scale: { keys: [{ t: s, v: 0.96 }, { t: e, v: 1, ease: "outQuart" }] },
        },
      };
    if (leader) move.follows = leader;
    moves.push(move);
    leader = layer.id;
    end = Math.max(end, e);
    cursor = r3(cursor + 0.25);
  }
  return { moves, seconds: r3(end + 0.3) };
}

/**
 * **`orbit`** — a loop: each named part (or a layer with none) drifts round
 * a small circle about where it rests, leaning a degree or two into the
 * turn on its base, each a beat behind the one before it. The circle is two
 * waves a quarter-period apart, at 3% of the target's size — under the 5%
 * idle ceiling — and one turn per loop, so the loop has no seam. The lag is
 * in each wave's phase rather than `follows`: a loop has no start for a
 * follower to trail.
 */
function orbit(layers: readonly MotionLayer[], seconds: number): { moves: MotionMove[]; seconds: number } {
  const moves: MotionMove[] = [];
  let n = 0;
  const lag = (k: number) => r3(-(k * MOTION_BEAT) / seconds);
  const around = (target: string, box: MotionBox, pivot: MotionPivot) => {
    const r = r3(Math.max(box.width, box.height) * 0.03);
    const phase = lag(n++);
    moves.push({
      target,
      pivot,
      channels: {
        x: { wave: { period: seconds, amp: r, phase } },
        y: { wave: { period: seconds, amp: r, phase: r3(phase - 0.25) } },
        rotate: { wave: { period: seconds, amp: 1.5, phase } },
      },
    });
  };
  for (const layer of layers) {
    const names = Object.keys(layer.parts);
    if (names.length > 0) for (const name of names) around(`${layer.id}/${name}`, layer.parts[name]!, pivotOn(layer.parts[name]!, "base"));
    else around(layer.id, layer.viewBox, pivotOn(layer.viewBox, "base"));
  }
  return { moves, seconds };
}

/**
 * **`emphasis`** — a finished drawing that says "look here": every target
 * at rest, then a pulse runs through it — each named part (or a layer with
 * none) swells 8% and back on its base, as a bell, a fifth of a second after
 * the one before. Plays once; nothing is ever hidden, so the first frame and
 * the last are the drawing as it sits on the canvas.
 */
function emphasis(layers: readonly MotionLayer[]): { moves: MotionMove[]; seconds: number } {
  const moves: MotionMove[] = [];
  const width = 0.12;
  let at = 0.4;
  let leader: string | null = null;
  const pulse = (target: string, box: MotionBox) => {
    const move: MotionMove = {
      target,
      pivot: pivotOn(box, "base"),
      channels: { scale: { bells: [{ at: r3(at), width, amp: 0.08 }] } },
    };
    if (leader) move.follows = leader;
    moves.push(move);
    leader = target;
    at += 0.2;
  };
  for (const layer of layers) {
    const names = Object.keys(layer.parts);
    if (names.length > 0) for (const name of names) pulse(`${layer.id}/${name}`, layer.parts[name]!);
    else pulse(layer.id, layer.viewBox);
  }
  // The last bell falls away over about four widths, then a breath of stillness.
  return { moves, seconds: r3(at - 0.2 + width * 4 + 0.3) };
}

/** What each recipe does, in a line — the words *Animate…* and `--help` show. */
export const MOTION_RECIPE_WORDS: Record<MotionRecipeName, string> = {
  assemble: "line drawings draw on, named parts grow up from their base, the rest settles in last — plays once",
  reveal: "each drawing fades up and rises into place, back to front, a layer at a time — plays once",
  idle: "named parts sway a few degrees on their base, the rest breathes — loops",
  orbit: "each part drifts round a small circle where it rests, a beat behind the last — loops",
  emphasis: "the finished drawing, then a pulse runs through it, part by part — plays once",
};

/** The recipes that loop unless told otherwise: motion that never quite stops. */
const LOOPING: ReadonlySet<MotionRecipeName> = new Set(["idle", "orbit"]);

/**
 * **A recipe's spec for these layers.** `seconds` stretches or squeezes the
 * recipe's own timing to fit (a loop's one cycle, 4 s unless said); `loop`
 * defaults to the recipe's nature — `idle` and `orbit` loop, the others play
 * once and hold.
 */
export function motionRecipe(
  name: MotionRecipeName,
  layers: readonly MotionLayer[],
  stage: { width: number; height: number },
  options: MotionRecipeOptions = {},
): MotionSpec {
  let moves: MotionMove[];
  let seconds: number;
  if (LOOPING.has(name)) {
    ({ moves, seconds } = (name === "idle" ? idle : orbit)(layers, options.seconds ?? 4));
  } else {
    ({ moves, seconds } = (name === "assemble" ? assemble : name === "reveal" ? reveal : emphasis)(layers));
    if (options.seconds !== undefined && seconds > 0) {
      scaleTimes(moves, options.seconds / seconds);
      seconds = options.seconds;
    }
  }
  return {
    version: 1,
    seconds,
    loop: options.loop ?? LOOPING.has(name),
    stage,
    layers: [...layers],
    moves,
    recipe: name,
  };
}
