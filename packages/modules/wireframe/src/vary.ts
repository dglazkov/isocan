import { chromeFor } from "./compose.ts";
import { refill } from "./content/flesh-spec.ts";
import { LEAVE_OUT, flipWords, recipe, resolveSlot, type WireFlip, type WireSlot, type WireSpec } from "./spec.ts";

export { blockWords, flipWords } from "./spec.ts";

/**
 * **Variations — from the distribution** (design §5; research §4, *Variations
 * come from the distribution, not from asking again*).
 *
 * Variation 1 is the screen itself: the argmax everywhere. Each further
 * variation flips ONE decision to its runner-up, spending them where the
 * answerer was least certain — the decision whose runner-up holds the most
 * probability first. A runner-up under `VARIATION_FLOOR` is not an honest
 * alternative, so a screen whose every runner-up is under it has none, and
 * says *one way to draw this* rather than inventing one.
 *
 * Nothing here asks anything: the probabilities are the ones rounds 2 and 3
 * already wrote into the spec (`p`, `alternatives`, `declined`). A spec with
 * none — drawn by hand — has nothing to vary.
 *
 * Only the screen's own decisions vary. The chrome (header and nav) was
 * fixed once for the whole flow by round 1, and a variation that swapped one
 * screen's tab bar would be a different product, not a different screen.
 */

/** Under this, a runner-up offers no honest variation (design §5: "0.10 to start"). */
export const VARIATION_FLOOR = 0.1;

/** Extra variations a composed flow makes per screen, at most. */
export const DEFAULT_VARIATIONS = 2;

/** One choice point on a screen, and its runner-up. */
export interface Decision extends WireFlip {
  kind: "block" | "include";
  /** The probability of what the screen shows. */
  p: number;
  /** The probability of `to`. */
  runnerUp: number;
}

/** Every structural decision this screen's answerer made, with its runner-up — the chrome left out. */
export function decisions(spec: WireSpec): Decision[] {
  const r = recipe(spec.archetype);
  const out: Decision[] = [];
  const order = (slot: string) => r.sections.findIndex((s) => s.slot === slot);
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const section = r.sections.find((s) => s.slot === slot.slot);
    if (!section || (spec.chrome && chromeFor(section, spec.chrome) !== null)) continue;
    const alts = slot.alternatives ?? [];
    const block = alts.find((a) => a.block !== LEAVE_OUT);
    if (block && slot.p !== undefined) {
      out.push({ slot: slot.slot, kind: "block", from: slot.block, to: block.block, p: slot.p, runnerUp: block.p });
    }
    const out_ = alts.find((a) => a.block === LEAVE_OUT);
    if (out_) out.push({ slot: slot.slot, kind: "include", from: slot.block, to: LEAVE_OUT, p: 1 - out_.p, runnerUp: out_.p });
  }
  for (const d of spec.declined ?? []) {
    out.push({ slot: d.slot, kind: "include", from: LEAVE_OUT, to: d.block, p: d.p, runnerUp: 1 - d.p });
  }
  return out.sort((a, b) => order(a.slot) - order(b.slot));
}

const same = (a: WireFlip, b: WireFlip) => a.slot === b.slot && a.from === b.from && a.to === b.to;

/**
 * **Which decisions to flip, in the order to flip them**: the honest ones
 * (runner-up at or over the floor), the runner-up holding the most
 * probability first; ties to the less certain choice, then recipe order.
 * `made` are flips a sibling already shows, which are not made twice.
 */
export function honestFlips(spec: WireSpec, made: readonly WireFlip[] = []): Decision[] {
  const r = recipe(spec.archetype);
  const order = (slot: string) => r.sections.findIndex((s) => s.slot === slot);
  return decisions(spec)
    .filter((d) => d.runnerUp >= VARIATION_FLOOR && !made.some((m) => same(m, d)))
    .sort((a, b) => b.runnerUp - a.runnerUp || a.p - b.p || order(a.slot) - order(b.slot));
}

/** True when the answerer offered no honest alternative anywhere on this screen. */
export function oneWay(spec: WireSpec): boolean {
  return honestFlips(spec).length === 0;
}


/**
 * **One variation**: the screen with a single decision flipped to its
 * runner-up. Its `title` stays the screen's — it is the heading drawn inside
 * the frame — and its item is named by `wireTitle`, "<Screen> · <what flipped>". A swapped or restored block takes its component's default props
 * and intents — round 3 asked about the argmax's props, not the runner-up's —
 * and the flipped slot keeps the distribution with the roles swapped, so the
 * variation still knows what it was chosen over.
 */
export function vary(spec: WireSpec, d: Decision, variantOf: string): WireSpec {
  const r = recipe(spec.archetype);
  let slots = spec.slots;
  let declined = spec.declined ?? [];
  if (d.kind === "block") {
    slots = slots.map((slot): WireSlot => {
      if (slot.slot !== d.slot) return slot;
      const alternatives = [{ block: d.from, p: d.p }, ...(slot.alternatives ?? []).filter((a) => a.block !== d.to)].sort((a, b) => b.p - a.p);
      return { ...resolveSlot(r.id, slot.slot, d.to), p: d.runnerUp, alternatives };
    });
  } else if (d.to === LEAVE_OUT) {
    slots = slots.filter((slot) => slot.slot !== d.slot);
    declined = [...declined, { slot: d.slot, p: d.runnerUp, block: d.from }];
  } else {
    const back: WireSlot = { ...resolveSlot(r.id, d.slot, d.to), p: d.runnerUp, alternatives: [{ block: LEAVE_OUT, p: d.p }] };
    const at = r.sections.findIndex((s) => s.slot === d.slot);
    const before = slots.filter((slot) => r.sections.findIndex((s) => s.slot === slot.slot) < at);
    slots = [...before, back, ...slots.slice(before.length)];
    declined = declined.filter((x) => x.slot !== d.slot);
  }
  const out: WireSpec = {
    ...spec,
    slots,
    declined,
    variantOf,
    flip: { slot: d.slot, from: d.from, to: d.to },
    round: 3,
  };
  delete out.varied;
  if (declined.length === 0) delete out.declined;
  // A fleshed screen's variation is fleshed with the same pack and seed (design §10): only the flipped slot fills anew.
  return refill(out, variantOf, [d.slot]);
}

/**
 * **A screen's variations**, up to `count` in all: the honest flips not
 * already shown by a sibling (`made`), least certain first. Empty when there
 * is no honest alternative left — which, for a screen with no siblings, is
 * the screen saying *one way to draw this*.
 */
export function variations(spec: WireSpec, variantOf: string, count = DEFAULT_VARIATIONS, made: readonly WireFlip[] = []): WireSpec[] {
  const room = Math.max(0, count - made.length);
  return honestFlips(spec, made).slice(0, room).map((d) => vary(spec, d, variantOf));
}
