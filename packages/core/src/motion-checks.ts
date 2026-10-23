/**
 * **The engine's principles as checks, not prose** (motion phase 0;
 * `docs/projects/motion/design.md` §1).
 *
 * Two kinds of answer. A spec that cannot be played honestly — a rotation
 * with no pivot, a target that is not there, a number that is not one — is
 * REFUSED by `validateMotionSpec`, in words. A spec that plays but breaks a
 * principle is played and WARNED about by `motionWarnings`: a part turning
 * on its own centre without saying so, a follower that does not trail its
 * leader by a beat, idle motion past its ceiling, a jump between two frames,
 * a loop whose end is not its start. The builder returns the warnings and
 * the CLI prints them; a warning is advice to whoever wrote the spec, and a
 * person may mean exactly what it flags.
 */
import { motionEngine, type MotionBox, type MotionChannelName, type MotionSpec } from "./motion-engine.ts";
import { MOTION_BEAT } from "./motion-recipes.ts";

/** One broken principle, named by `code`, about one target, in a sentence. */
export interface MotionWarning {
  code: "pivot-centre" | "follower-lag" | "idle-ceiling" | "teleport" | "loop-seam";
  target: string;
  message: string;
}

/** The longest motion a spec may be, matching the movie cap (design §6). */
export const MOTION_MAX_SECONDS = 60;

const CHANNELS: readonly MotionChannelName[] = ["x", "y", "rotate", "scale", "opacity", "draw"];
const EASES = new Set(Object.keys(motionEngine.EASINGS));

/** Idle amplitude ceilings: rotate in degrees, scale and opacity as fractions, x/y as a share of the target's size. */
const IDLE_CEILING = { rotate: 6, scale: 0.05, opacity: 0.2, draw: 0.2, move: 0.05 } as const;

/** The most a channel may change in one frame at 120 fps before it reads as a jump. */
const JUMP = { rotate: 20, scale: 0.25, opacity: 0.5, draw: 0.5, move: 0.2 } as const;

/** The box a target lives in, in its own units: a layer's viewBox, or a part's coarse box. */
function boxOf(spec: MotionSpec, target: string): MotionBox | undefined {
  const [layerId, part] = target.split("/");
  const layer = spec.layers.find((l) => l.id === layerId);
  if (!layer) return undefined;
  return part === undefined ? layer.viewBox : layer.parts[part];
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * **Refuse a spec that cannot be played honestly**, in words. Throws on the
 * first problem; returns nothing when the spec is playable.
 */
export function validateMotionSpec(spec: MotionSpec): void {
  if (spec.version !== 1) throw new Error(`motion spec version ${String(spec.version)} is not one this build plays (1)`);
  if (!finite(spec.seconds) || spec.seconds <= 0 || spec.seconds > MOTION_MAX_SECONDS) {
    throw new Error(`a motion is more than 0 and at most ${MOTION_MAX_SECONDS} seconds long, not ${String(spec.seconds)}`);
  }
  const ids = new Set<string>();
  for (const layer of spec.layers) {
    if (ids.has(layer.id)) throw new Error(`two layers are both called "${layer.id}"`);
    ids.add(layer.id);
  }
  const seen = new Set<string>();
  for (const move of spec.moves) {
    const where = `"${move.target}"`;
    if (!boxOf(spec, move.target)) throw new Error(`${where} is not a layer or a named part (<g id>) of one`);
    if (seen.has(move.target)) throw new Error(`${where} has two moves — put its channels in one`);
    seen.add(move.target);
    if (move.follows !== undefined && !boxOf(spec, move.follows)) throw new Error(`${where} follows "${move.follows}", which is not there`);
    if ((move.channels.rotate || move.channels.scale) && !move.pivot) {
      throw new Error(`${where} turns or scales but names no pivot — say where it turns (base, center, top, left, right, or a point)`);
    }
    if (move.pivot && (!finite(move.pivot.x) || !finite(move.pivot.y))) throw new Error(`${where}'s pivot is not a point`);
    for (const [name, ch] of Object.entries(move.channels)) {
      if (!CHANNELS.includes(name as MotionChannelName)) throw new Error(`${where} has a channel "${name}" — the channels are ${CHANNELS.join(", ")}`);
      let last = -Infinity;
      for (const key of ch?.keys ?? []) {
        if (!finite(key.t) || !finite(key.v)) throw new Error(`${where} ${name} has a key that is not a number`);
        if (key.t < last) throw new Error(`${where} ${name}'s keys are out of order at ${key.t} s`);
        if (key.ease !== undefined && !EASES.has(key.ease)) throw new Error(`${where} ${name} eases "${key.ease}" — the curves are ${[...EASES].join(", ")}`);
        last = key.t;
      }
      if (ch?.wave && (!finite(ch.wave.period) || ch.wave.period <= 0 || !finite(ch.wave.amp))) throw new Error(`${where} ${name}'s wave needs a period above 0 and an amplitude`);
      for (const b of ch?.bells ?? []) if (!finite(b.at) || !finite(b.width) || !finite(b.amp)) throw new Error(`${where} ${name} has a bell that is not numbers`);
    }
  }
}

const startOf = (spec: MotionSpec, target: string): number | undefined => {
  const move = spec.moves.find((m) => m.target === target);
  const times = Object.values(move?.channels ?? {}).flatMap((ch) => [...(ch?.keys ?? []).map((k) => k.t), ...(ch?.wave ? [ch.wave.from ?? 0] : [])]);
  return times.length > 0 ? Math.min(...times) : undefined;
};

/**
 * **The principles, checked.** Assumes a spec `validateMotionSpec` accepted;
 * returns every warning, in the order of the moves.
 */
export function motionWarnings(spec: MotionSpec): MotionWarning[] {
  const out: MotionWarning[] = [];
  const e = motionEngine;
  for (const move of spec.moves) {
    const box = boxOf(spec, move.target)!;
    const size = Math.max(box.width, box.height, 1);
    const warn = (code: MotionWarning["code"], message: string) => out.push({ code, target: move.target, message: `${move.target}: ${message}` });

    if (move.channels.rotate && move.pivot && move.pivot.at !== "center") {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      if (Math.hypot(move.pivot.x - cx, move.pivot.y - cy) < size * 0.05) {
        warn("pivot-centre", "turns on its own centre — real things turn on a base or a joint; name the pivot \"center\" if the middle is meant");
      }
    }

    if (move.follows !== undefined) {
      const mine = startOf(spec, move.target), theirs = startOf(spec, move.follows);
      if (mine !== undefined && theirs !== undefined && mine < theirs + MOTION_BEAT - 1e-9) {
        warn("follower-lag", `follows ${move.follows} but starts ${Math.round((mine - theirs) * 1000)} ms after it — a follower trails by at least a beat (${MOTION_BEAT * 1000} ms)`);
      }
    }

    for (const name of CHANNELS) {
      const ch = move.channels[name];
      if (!ch) continue;
      const kind = name === "x" || name === "y" ? "move" : name;
      const scale = kind === "move" ? size : 1;
      if (ch.wave && Math.abs(ch.wave.amp) > IDLE_CEILING[kind] * scale) {
        warn("idle-ceiling", `${name} idles by ${ch.wave.amp}, past the ceiling of ${IDLE_CEILING[kind] * scale}${name === "rotate" ? "°" : ""} — idle motion is felt, not watched`);
      }
      const jump = JUMP[kind] * scale;
      const steps = Math.max(2, Math.ceil(spec.seconds * 120));
      let prev = e.channel(name, ch, 0);
      for (let i = 1; i <= steps; i++) {
        const t = (spec.seconds * i) / steps;
        const v = e.channel(name, ch, t >= spec.seconds && spec.loop ? spec.seconds - 1e-9 : t);
        if (Math.abs(v - prev) > jump) {
          warn("teleport", `${name} jumps by ${Math.round(Math.abs(v - prev) * 1000) / 1000} near ${Math.round(t * 100) / 100} s — nothing should teleport between frames`);
          break;
        }
        prev = v;
      }
      if (spec.loop) {
        const end = e.channel(name, ch, spec.seconds - 1e-9), start = e.channel(name, ch, 0);
        if (Math.abs(end - start) > jump) warn("loop-seam", `${name} ends at ${Math.round(end * 1000) / 1000} and starts at ${Math.round(start * 1000) / 1000}, so it jumps where it loops`);
      }
    }
  }
  return out;
}
