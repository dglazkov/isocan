import {
  ARCHETYPE_IDS, COMPONENTS, INTENT_BY_ID, RECIPES, RECIPE_BY_ID, component,
  type Component, type IntentId, type Platform, type PropDef, type Props, type Recipe, type Section,
} from "./catalog/index.ts";

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
  /** Item id of the screen this varies. */
  variantOf?: string;
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
  /** Runners-up, for variations. */
  alternatives?: Array<{ block: string; p: number }>;
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
  const resolved = { ...defaultProps(c), ...(props ?? {}) };
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
    if (slot.block === null) {
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
      if (!section.options.includes(alt.block)) problems.push(`${where}: alternative ${alt.block} is not one of ${section.options.join(", ")}`);
    }
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
