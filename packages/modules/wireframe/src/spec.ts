import {
  ARCHETYPE_IDS, COMPONENTS, INTENT_BY_ID, RECIPES, RECIPE_BY_ID, component,
  type Component, type IntentId, type Platform, type PropDef, type Props, type Recipe, type Section,
} from "./catalog/index.ts";
import { styleProblems, type WireStyle } from "./theme.ts";
import type { SlotFill, WireContent } from "./content/fill.ts";
import { contentProblems, fillProblems } from "./content/validate.ts";

/**
 * **What a screen is** (design §1).
 *
 * A screen is an HTML item whose file carries this, so it renders anywhere an
 * HTML item renders and a CLI can read it back with no DOM. `block: null` is
 * the skeleton state; a spec with every slot null is a blueprint, one with
 * every slot chosen is a wireframe, and anything between is a wire being
 * drawn.
 *
 * **A declined optional slot is absent.** An optional section someone
 * answered "no" to is not in `slots` at all; one nobody has answered yet is
 * present with `block: null` (and drawn dashed). So a blueprint lists every
 * section, and the composer removes the ones it declines.
 */
export interface WireSpec {
  v: 1;
  /** The words that asked for it. */
  request: string;
  /** Shared by every screen of one request. */
  flow: string;
  archetype: string;
  title: string;
  platform: Platform;
  /** In recipe order. */
  slots: WireSlot[];
  /** Item id of the screen this varies (a sibling placed under it — design §5). */
  variantOf?: string;
  /** On a variation: the one decision flipped from its screen's argmax. */
  flip?: WireFlip;
  /**
   * `"none"` on a screen whose answerer was certain everywhere — no decision's
   * runner-up reached the floor — so it draws *one way to draw this* rather
   * than a variation nobody's distribution offered.
   */
  varied?: "none";
  /**
   * Optional sections an answerer declined, with the probability it gave
   * leaving them out and the block that would have filled them. Absent from
   * `slots` still means declined; this is what lets a variation put one back.
   */
  declined?: WireDeclined[];
  /**
   * How many of the composer's three rounds have answered this screen: 0 is
   * the single blueprint a request makes before any model has spoken, 1 a
   * screen whose archetype the flow round chose, 2 one whose blocks are
   * chosen, 3 one whose props and intents are. Absent on a hand-drawn spec.
   * It is what lets `wire questions` find the pending round on the canvas
   * alone, with no state kept anywhere else.
   */
  round?: 0 | 1 | 2 | 3;
  /** The flow's chrome, fixed once in round 1 and the same on every screen. */
  chrome?: WireChrome;
  /**
   * How it looks (design §9): absent or `{ source: "default" }` draws the
   * default greys; `design-system` names the DESIGN.md item and version whose
   * tokens were mapped onto the roles, and the mapping itself. A blueprint
   * draws blue whatever this says.
   */
  style?: WireStyle;
  /**
   * What fills it (design §10): absent draws bars where copy goes; `pack` is
   * sample content from a pack, `copy` exact words an agent or a person
   * wrote. The words themselves are each slot's `fill`. A blueprint takes
   * none: blue means still being drawn.
   */
  content?: WireContent;
}

/** In `alternatives`, `from` and `to`: the optional section left off the screen. */
export const LEAVE_OUT = "omit";

/** One decision flipped to its runner-up: a block for another, or a section in ↔ out (`LEAVE_OUT`). */
export interface WireFlip {
  slot: string;
  from: string;
  to: string;
}

export interface WireDeclined {
  slot: string;
  /** P(leave out) — the probability the declined answer carried. */
  p: number;
  /** The block that fills the section if it is put back: the answerer's argmax among its options. */
  block: string;
}

/** Words for a block id: `data-table` → "data table". */
export function blockWords(block: string): string {
  return block.replace(/-/g, " ");
}

/** What a flip changed, in the words a title carries: "data table instead of card grid". */
export function flipWords(flip: WireFlip): string {
  if (flip.to === LEAVE_OUT) return `without ${blockWords(flip.from)}`;
  if (flip.from === LEAVE_OUT) return `with ${blockWords(flip.to)}`;
  return `${blockWords(flip.to)} instead of ${blockWords(flip.from)}`;
}

/**
 * The name a screen's item and caption carry: its title, and on a variation
 * what it flipped — "List · data table instead of stacked list". The heading
 * inside the frame stays `spec.title`: a variation is the same screen.
 */
export function wireTitle(spec: WireSpec): string {
  return spec.flip ? `${spec.title} · ${flipWords(spec.flip)}` : spec.title;
}

/** What round 1 fixes for a whole flow, so its screens agree. */
export interface WireChrome {
  /** A nav block id (`tab-bar`, `side-nav`, `navbar`) or `none`. */
  nav: string;
  /** A header block id (`app-bar`, `page-header`, `navbar`). */
  header: string;
}

export interface WireSlot {
  /** The recipe section's id: `header`, `main.2`, `nav`… */
  slot: string;
  /** A component id from the section's options, or null while undecided. */
  block: string | null;
  props: Props;
  /** Actionable element → intent. */
  intents?: Record<string, IntentId>;
  /** The probability the answerer gave the chosen block. */
  p?: number;
  /**
   * Runners-up, most likely first, for variations. On an optional section,
   * one of them may be `LEAVE_OUT` — the probability it should not be here.
   */
  alternatives?: Array<{ block: string; p: number }>;
  /** The words, numbers and pictograms this slot draws instead of bars — plain data, from `content`. */
  fill?: SlotFill;
}

export const PLATFORMS: readonly Platform[] = ["app", "web", "site"];

export const PLATFORM_SIZE: Record<Platform, { width: number; height: number }> = {
  app: { width: 390, height: 844 },
  web: { width: 1280, height: 800 },
  site: { width: 1280, height: 800 },
};

/** The strip above the frame that carries the screen's name. */
export const CAPTION_HEIGHT = 32;

export function recipe(archetype: string): Recipe {
  const found = RECIPE_BY_ID.get(archetype);
  if (!found) {
    const known = (ARCHETYPE_IDS as readonly string[]).includes(archetype);
    throw new Error(
      known
        ? `"${archetype}" is a later wave's archetype and has no recipe yet — wave 1 is: ${RECIPES.map((r) => r.id).join(", ")}`
        : `no archetype "${archetype}" — wave 1 is: ${RECIPES.map((r) => r.id).join(", ")}`,
    );
  }
  return found;
}

export function sectionOf(r: Recipe, slot: string): Section {
  const found = r.sections.find((s) => s.slot === slot);
  if (!found) throw new Error(`${r.id} has no slot "${slot}" — it has ${r.sections.map((s) => s.slot).join(", ")}`);
  return found;
}

export function defaultProps(c: Component): Props {
  const out: Props = {};
  for (const [key, def] of Object.entries(c.props)) out[key] = def.default;
  return out;
}

/** The elements drawn under these props. */
export function presentElements(c: Component, props: Props): string[] {
  return Object.entries(c.elements ?? {})
    .filter(([, el]) => !el.when || el.when(props))
    .map(([id]) => id);
}

/** The intent an element takes when nothing chose: the archetype's default, then the component's. */
export function defaultIntent(r: Recipe, c: Component, element: string): IntentId {
  const el = c.elements?.[element];
  if (!el) throw new Error(`${c.id} has no actionable element "${element}"`);
  return r.intents?.[c.id]?.[element] ?? el.default;
}

/** A blueprint: every section of the recipe, nothing chosen. */
export function blueprint(
  archetype: string,
  opts: { platform?: Platform; request?: string; flow?: string; title?: string } = {},
): WireSpec {
  const r = recipe(archetype);
  return {
    v: 1,
    request: opts.request ?? "",
    flow: opts.flow ?? "",
    archetype: r.id,
    title: opts.title ?? r.title,
    platform: opts.platform ?? r.platforms[0]!,
    slots: r.sections.map((s) => ({ slot: s.slot, block: null, props: {} })),
  };
}

/** A slot resolved to one of its options, with that component's default props and intents. */
export function resolveSlot(archetype: string, slot: string, block: string, props?: Props): WireSlot {
  const r = recipe(archetype);
  const section = sectionOf(r, slot);
  if (!section.options.includes(block)) {
    throw new Error(`${r.id}'s ${slot} offers ${section.options.join(" | ")}, not ${block}`);
  }
  const c = component(block);
  const resolved = { ...defaultProps(c), ...(r.props?.[c.id] ?? {}), ...(props ?? {}) };
  const elements = presentElements(c, resolved);
  const out: WireSlot = { slot, block, props: resolved };
  if (elements.length > 0) out.intents = Object.fromEntries(elements.map((e) => [e, defaultIntent(r, c, e)]));
  return out;
}

/**
 * Resolve every section, choosing with `pick` (default: each section's first
 * option). `pick` returning null leaves that slot undecided; returning
 * `"omit"` declines an optional one.
 */
export function wireframe(
  archetype: string,
  opts: { platform?: Platform; request?: string; flow?: string; title?: string } = {},
  pick: (section: Section, index: number) => string | null | "omit" = (s) => s.options[0]!,
): WireSpec {
  const spec = blueprint(archetype, opts);
  const r = recipe(archetype);
  const slots: WireSlot[] = [];
  r.sections.forEach((section, i) => {
    const choice = pick(section, i);
    if (choice === "omit") {
      if (!section.optional) throw new Error(`${r.id}'s ${section.slot} is not optional`);
      return;
    }
    slots.push(choice === null ? { slot: section.slot, block: null, props: {} } : resolveSlot(r.id, section.slot, choice));
  });
  return { ...spec, slots };
}

/** The document size an item needs to show this screen whole. */
export function wireSize(spec: WireSpec): { width: number; height: number } {
  const base = PLATFORM_SIZE[spec.platform];
  if (spec.platform !== "site") return { width: base.width, height: base.height + CAPTION_HEIGHT };
  // A site is as tall as its sections; the hints are the skeleton's heights.
  const r = recipe(spec.archetype);
  const tall = spec.slots.reduce((sum, s) => {
    const section = r.sections.find((x) => x.slot === s.slot);
    const id = s.block ?? section?.options[0];
    return sum + (id ? (COMPONENTS.get(id)?.h ?? 0) + 24 : 0);
  }, 48);
  return { width: base.width, height: Math.max(base.height, tall) + CAPTION_HEIGHT };
}

function propProblem(def: PropDef, value: unknown): string | null {
  switch (def.kind) {
    case "choice":
      return typeof value === "string" && def.values.includes(value) ? null : `must be one of ${def.values.join(", ")}`;
    case "flag":
      return typeof value === "boolean" ? null : "must be true or false";
    case "count":
      return Number.isInteger(value) && (value as number) >= def.min && (value as number) <= def.max ? null : `must be a whole number ${def.min}–${def.max}`;
    case "index":
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= def.max ? null : `must be a whole number 1–${def.max}`;
  }
}

/**
 * **Every way a spec can be wrong, in words.** Empty means the spec draws.
 * The CLI refuses a spec with any of these, so a hand-written spec cannot
 * put a free-text label, an unknown block or a missing required slot on a
 * canvas.
 */
export function validateWire(input: unknown): string[] {
  const problems: string[] = [];
  const spec = input as Partial<WireSpec> | null;
  if (!spec || typeof spec !== "object") return ["a spec is a JSON object"];
  if (spec.v !== 1) problems.push(`v must be 1`);
  for (const key of ["request", "flow", "title"] as const) {
    if (typeof spec[key] !== "string") problems.push(`${key} must be a string`);
  }
  if (!PLATFORMS.includes(spec.platform as Platform)) problems.push(`platform must be one of ${PLATFORMS.join(", ")}`);
  if (spec.round !== undefined && ![0, 1, 2, 3].includes(spec.round)) problems.push("round must be 0, 1, 2 or 3");
  if (spec.chrome !== undefined && (typeof spec.chrome !== "object" || typeof spec.chrome?.nav !== "string" || typeof spec.chrome?.header !== "string")) {
    problems.push("chrome must be { nav, header }");
  }
  if (spec.style !== undefined) problems.push(...styleProblems(spec.style));
  if (spec.content !== undefined) problems.push(...contentProblems(spec.content));
  let r: Recipe;
  try {
    r = recipe(String(spec.archetype));
  } catch (error) {
    return [...problems, (error as Error).message];
  }
  if (!Array.isArray(spec.slots)) return [...problems, "slots must be an array"];
  let last = -1;
  const seen = new Set<string>();
  for (const slot of spec.slots as WireSlot[]) {
    const where = `slot ${JSON.stringify(slot?.slot)}`;
    const at = r.sections.findIndex((s) => s.slot === slot?.slot);
    if (at < 0) {
      problems.push(`${where}: ${r.id} has no such slot (it has ${r.sections.map((s) => s.slot).join(", ")})`);
      continue;
    }
    if (seen.has(slot.slot)) problems.push(`${where}: appears twice`);
    if (at < last) problems.push(`${where}: out of recipe order`);
    seen.add(slot.slot);
    last = Math.max(last, at);
    const section = r.sections[at]!;
    const props = slot.props;
    if (!props || typeof props !== "object" || Array.isArray(props)) {
      problems.push(`${where}: props must be an object`);
      continue;
    }
    if (slot.fill !== undefined) problems.push(...fillProblems(slot.fill, where));
    if (slot.block === null) {
      if (slot.fill !== undefined) problems.push(`${where}: an undecided slot has no fill`);
      if (Object.keys(props).length > 0) problems.push(`${where}: an undecided slot has no props`);
      if (slot.intents && Object.keys(slot.intents).length > 0) problems.push(`${where}: an undecided slot has no intents`);
      continue;
    }
    if (typeof slot.block !== "string" || !section.options.includes(slot.block)) {
      problems.push(`${where}: block must be null or one of ${section.options.join(", ")}`);
      continue;
    }
    const c = component(slot.block);
    for (const [key, value] of Object.entries(props)) {
      const def = c.props[key];
      if (!def) problems.push(`${where}: ${c.id} has no prop "${key}"`);
      else {
        const problem = propProblem(def, value);
        if (problem) problems.push(`${where}: ${c.id}.${key} ${problem}`);
      }
    }
    for (const [element, intent] of Object.entries(slot.intents ?? {})) {
      const el = c.elements?.[element];
      if (!el) problems.push(`${where}: ${c.id} has no actionable element "${element}"`);
      else if (!INTENT_BY_ID.has(intent)) problems.push(`${where}: "${intent}" is not an intent`);
      else if (!el.accepts.includes(intent)) problems.push(`${where}: ${c.id}'s ${element} cannot take "${intent}"`);
    }
    if (slot.p !== undefined && !(typeof slot.p === "number" && slot.p >= 0 && slot.p <= 1)) problems.push(`${where}: p must be 0–1`);
    for (const alt of slot.alternatives ?? []) {
      if (alt.block === LEAVE_OUT && section.optional) continue;
      if (!section.options.includes(alt.block)) problems.push(`${where}: alternative ${alt.block} is not one of ${section.options.join(", ")}${section.optional ? ` or ${LEAVE_OUT}` : ""}`);
    }
  }
  if (spec.varied !== undefined && spec.varied !== "none") problems.push(`varied must be "none" when present`);
  if (spec.variantOf !== undefined && typeof spec.variantOf !== "string") problems.push("variantOf must be an item id");
  if (spec.flip !== undefined && (typeof spec.flip !== "object" || !spec.flip || ![spec.flip.slot, spec.flip.from, spec.flip.to].every((v) => typeof v === "string"))) {
    problems.push("flip must be { slot, from, to }");
  }
  for (const d of spec.declined ?? []) {
    const section = r.sections.find((s) => s.slot === d?.slot);
    if (!section) problems.push(`declined ${JSON.stringify(d?.slot)}: ${r.id} has no such slot`);
    else if (!section.optional) problems.push(`declined "${d.slot}": the section is not optional`);
    else if (seen.has(d.slot)) problems.push(`declined "${d.slot}": the section is on the screen`);
    else if (!section.options.includes(d.block)) problems.push(`declined "${d.slot}": block must be one of ${section.options.join(", ")}`);
    if (d && !(typeof d.p === "number" && d.p >= 0 && d.p <= 1)) problems.push(`declined ${JSON.stringify(d.slot)}: p must be 0–1`);
  }
  for (const section of r.sections) {
    if (!section.optional && !seen.has(section.slot)) problems.push(`slot "${section.slot}" is required by ${r.id}`);
  }
  return problems;
}

/** The props a component draws with: its defaults, under whatever the slot chose. */
export function propsFor(c: Component, props: Props): Props {
  return { ...defaultProps(c), ...props };
}

// ---------- questions

export interface Question {
  /** `slot`, `slot:include`, `slot:block.prop`, `slot:block#element`. */
  id: string;
  kind: "yes-no" | "choice" | "score";
  options: number;
  /** A structural question — whether a section is included, or which block fills it. */
  structural: boolean;
}

function propQuestion(id: string, def: PropDef): Question {
  switch (def.kind) {
    case "choice":
      return { id, kind: "choice", options: def.values.length, structural: false };
    case "flag":
      return { id, kind: "yes-no", options: 2, structural: false };
    case "count":
      return { id, kind: "score", options: def.max - def.min + 1, structural: false };
    case "index":
      return { id, kind: "choice", options: def.max, structural: false };
  }
}

/**
 * **Every question a recipe implies** (research §4, *The question plan*):
 * each optional section's yes/no, each choice among blocks, and for every
 * block a section offers, each of its props and each actionable element's
 * intent. Phase 0 asks none of them; it counts them, so the catalog's
 * promise — no structural question over 4, no question of any kind over
 * Jev's 255 — is something a test holds rather than a sentence.
 */
export function recipeQuestions(r: Recipe): Question[] {
  const out: Question[] = [];
  for (const s of r.sections) {
    if (s.optional) out.push({ id: `${s.slot}:include`, kind: "yes-no", options: 2, structural: true });
    if (s.options.length > 1) out.push({ id: s.slot, kind: "choice", options: s.options.length, structural: true });
    for (const id of s.options) {
      const c = component(id);
      for (const [key, def] of Object.entries(c.props)) out.push(propQuestion(`${s.slot}:${id}.${key}`, def));
      for (const [element, el] of Object.entries(c.elements ?? {})) {
        out.push({ id: `${s.slot}:${id}#${element}`, kind: "choice", options: el.accepts.length, structural: false });
      }
    }
  }
  return out;
}

/** The flow-level questions: which archetype, which platform. */
export function flowQuestions(): Question[] {
  return [
    { id: "archetype", kind: "choice", options: RECIPES.length, structural: true },
    { id: "platform", kind: "choice", options: PLATFORMS.length, structural: true },
  ];
}
