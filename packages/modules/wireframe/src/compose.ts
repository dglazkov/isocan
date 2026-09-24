import { ARCHETYPE_WORDS, RECIPES, component, type Platform, type Props, type Recipe, type Section } from "./catalog/index.ts";
import { JEV_MODEL, chosenOption, readResponse, type JevAnswer, type JevQuestion, type JevRequest, type JevResponse } from "./answerer.ts";
import { LEAVE_OUT, PLATFORMS, blueprint, presentElements, recipe, resolveSlot, type WireChrome, type WireDeclined, type WireSlot, type WireSpec } from "./spec.ts";

/**
 * **The composer's three rounds** (design §4; research §4, *The question
 * plan*), as pure functions: each round is a request in Jev's shape built
 * from the catalog, and an `apply` that writes its answers into specs.
 *
 * 1. **Flow**, once per request — one yes/no per wave-1 archetype, the
 *    platform, the nav pattern, the header. It fixes the chrome for every
 *    screen, so a flow is coherent: the header and nav slots it can decide
 *    are decided here, identically, and never asked again per screen.
 * 2. **Structure**, per screen — each optional section's yes/no and each
 *    choice among blocks, for the slots round 1 left open.
 * 3. **Props and intents**, per screen — each chosen block's props and each
 *    actionable element's intent, filtered to the intents it can take.
 *
 * Every probability is kept (`p`, `alternatives`) for phase 2's variations;
 * nothing is sampled. Argmax only.
 */

/** A screen's place in a flow before round 1: the one blueprint a request makes at once. */
export function requestBlueprint(request: string, flow: string): WireSpec {
  // Nothing is known but the words, so the skeleton is Home's — the screen
  // most requests have — titled with the request itself. Round 1 rewrites it.
  return { ...blueprint("home", { request, flow, title: request }), round: 0 };
}

/** The platform a recipe is drawn on in a flow of `platform`, or null when it cannot be. */
export function platformFor(r: Recipe, platform: Platform): Platform | null {
  if (r.platforms.includes(platform)) return platform;
  // `web` and `site` are both 1280 wide; a sign-in that is `app | site` draws on a web app's desk.
  const twin: Platform | null = platform === "web" ? "site" : platform === "site" ? "web" : null;
  return twin && r.platforms.includes(twin) ? twin : null;
}

/** The header blocks recipes offer as alternatives — what round 1's `header` question chooses among. */
export const HEADER_OPTIONS: readonly string[] = [
  ...new Set(RECIPES.flatMap((r) => r.sections.filter((s) => s.region === "header" && s.options.length > 1).flatMap((s) => s.options))),
];

/** Nav patterns: every nav-region block, the top navbar, or none. */
export const NAV_OPTIONS: readonly string[] = [
  ...new Set([...RECIPES.flatMap((r) => r.sections.filter((s) => s.region === "nav").flatMap((s) => s.options)), "navbar", "none"]),
];

const PLATFORM_WORDS: Record<Platform, string> = {
  app: "a phone app",
  web: "a web app used at a desk",
  site: "a public, scrolling website",
};

const CHROME_WORDS: Record<string, string> = {
  "tab-bar": "tabs along the bottom of the screen",
  "side-nav": "a navigation column down the side",
  navbar: "a navigation bar across the top",
  none: "no persistent navigation",
  "app-bar": "a compact bar: a title and icon actions",
  "page-header": "a large page title with actions",
};

/** What a recipe is made of, in its own ids — the archetype described by the catalog, not by hand. */
export function describeRecipe(r: Recipe): string {
  return r.sections.map((s) => `${s.options.join(" or ")}${s.optional ? " (optional)" : ""}`).join(", ");
}

// ---------- round 1: the flow

export function flowRequest(request: string): JevRequest {
  const questions: Record<string, JevQuestion> = {};
  for (const r of RECIPES) {
    questions[`needs:${r.id}`] = {
      type: "noul",
      // Plain words, not the recipe's component ids: on Enrico they read 1–3 points more accurately for ~20% fewer tokens (24 Sep 2026).
      instructions: `Does the product in the request need this screen: ${ARCHETYPE_WORDS[r.id as keyof typeof ARCHETYPE_WORDS]}? Yes only if the request implies one.`,
    };
  }
  questions.platform = {
    type: "choice",
    instructions: "Which platform is this product for?",
    criteria: Object.fromEntries(PLATFORMS.map((p) => [p, PLATFORM_WORDS[p]])),
  };
  questions.nav = {
    type: "choice",
    instructions: "Which persistent navigation should every screen of this product share?",
    criteria: Object.fromEntries(NAV_OPTIONS.map((n) => [n, CHROME_WORDS[n] ?? null])),
  };
  questions.header = {
    type: "choice",
    instructions: "Which header should every screen of this product share?",
    criteria: Object.fromEntries(HEADER_OPTIONS.map((h) => [h, CHROME_WORDS[h] ?? null])),
  };
  return { model: JEV_MODEL, state: { request }, questions };
}

/**
 * **Round 1's cut: over-include, and let keep prune** (phase 6's reading).
 *
 * Jev's P(yes) ranks screens but is overconfident by ~0.4, so it can order
 * them and cannot exclude them. An archetype at or over `NEEDS_YES` is a
 * screen the flow needs; one at or over `MAYBE_FLOOR` and under it is still
 * drawn, in its running place in the row, but marked **maybe** (`maybe` on
 * the spec: a dashed blue outline and a *maybe* tag) — the person's keep
 * (📐) decides whether it is in the flow, as it already decides for every
 * other screen. Under the floor, declined.
 *
 * The floor is set from phase 6's recorded answers (Enrico's 1,318 screens,
 * the 20-option run with whole distributions): an option Jev gave 0.3–0.5
 * was the screen's true archetype 25–34% of the time (lenient 32–42%), no
 * worse than one it gave 0.5–0.7 (31%, lenient 38%); under 0.3 the rate
 * falls off (0.2–0.3: 23%, 0.1–0.2: 17%). Moving the cut from 0.5 to 0.3
 * admitted the true archetype on 45.5% of screens instead of 36.6%, for
 * 0.31 more options per screen. That is a choice over archetypes for one
 * screen, not round 1's yes/no over a request, so the transfer is an
 * assumption, and the number is the one the data could support rather than
 * one it measured for this question.
 *
 * Re-measured 24 Sep 2026 with the options in plain words
 * (`ARCHETYPE_WORDS`, 350 of the same screens, 20 and 34 options): 0.3–0.5
 * was the truth 28–37% of the time against 29–30% for 0.5–0.7, and under
 * 0.3 it fell to 15–24%. The floor stands.
 */
export const NEEDS_YES = 0.5;
export const MAYBE_FLOOR = 0.3;

export interface FlowDecision {
  platform: Platform;
  chrome: WireChrome;
  /** Chosen archetypes in running order, each with P(yes); `maybe` between `MAYBE_FLOOR` and `NEEDS_YES`. */
  archetypes: Array<{ id: string; p: number; maybe?: true }>;
  /** Asked and answered no, or answered yes for a platform the recipe cannot draw. */
  declined: Array<{ id: string; p: number; why: "no" | "platform" }>;
  distributions: { platform: Record<string, number>; nav: Record<string, number>; header: Record<string, number> };
}

export function decideFlow(req: JevRequest, res: JevResponse): FlowDecision {
  const answer = (id: string) => chosenOption(req.questions[id]!, res.answers[id] as JevAnswer);
  const platform = answer("platform");
  const nav = answer("nav");
  const header = answer("header");
  const archetypes: FlowDecision["archetypes"] = [];
  const declined: FlowDecision["declined"] = [];
  let best: { id: string; p: number } | null = null;
  for (const r of RECIPES) {
    const yes = (res.answers[`needs:${r.id}`] as Extract<JevAnswer, { type: "noul" }>).noul;
    if (!best || yes > best.p) best = { id: r.id, p: yes };
    if (yes < MAYBE_FLOOR) declined.push({ id: r.id, p: yes, why: "no" });
    else if (!platformFor(r, platform.value as Platform)) declined.push({ id: r.id, p: yes, why: "platform" });
    else archetypes.push({ id: r.id, p: yes, ...(yes < NEEDS_YES ? { maybe: true as const } : {}) });
  }
  // A flow of nothing is not an answer: the most likely archetype stands alone — still a maybe, if that is what it is.
  if (archetypes.length === 0 && best) {
    const r = recipe(best.id);
    if (platformFor(r, platform.value as Platform)) {
      archetypes.push({ ...best, ...(best.p < NEEDS_YES ? { maybe: true as const } : {}) });
      declined.splice(declined.findIndex((d) => d.id === best!.id), 1);
    }
  }
  if (archetypes.length === 0) throw new Error(`no wave-1 archetype draws on ${platform.value} for this request`);
  return {
    platform: platform.value as Platform,
    chrome: { nav: nav.value, header: header.value },
    archetypes,
    declined,
    distributions: { platform: platform.distribution, nav: nav.distribution, header: header.distribution },
  };
}

/** Runners-up from a distribution, restricted to a section's options, most likely first, zeros left out. */
function alternativesOf(distribution: Record<string, number>, options: readonly string[], chosen: string): Array<{ block: string; p: number }> {
  return options
    .filter((o) => o !== chosen && (distribution[o] ?? 0) > 0)
    .map((o) => ({ block: o, p: distribution[o]! }))
    .sort((a, b) => b.p - a.p);
}

/**
 * What round 1's chrome settles for one section: a header slot that offers
 * the flow's header takes it; a nav slot that offers the flow's nav takes it;
 * an optional nav slot in a flow with no nav is declined. Anything else is
 * round 2's to ask.
 */
export function chromeFor(section: Section, chrome: WireChrome): { block: string } | "declined" | null {
  if (section.region === "header" && section.options.includes(chrome.header)) return { block: chrome.header };
  if (section.region === "nav") {
    if (section.options.includes(chrome.nav)) return { block: chrome.nav };
    if (chrome.nav === "none" && section.optional) return "declined";
  }
  return null;
}

/** One round-1 blueprint: the chrome resolved and the same on every screen, everything else blue. */
export function flowScreen(archetype: string, request: string, flow: string, decision: FlowDecision): WireSpec {
  const r = recipe(archetype);
  const platform = platformFor(r, decision.platform)!;
  const spec = blueprint(archetype, { request, flow, platform });
  const slots: WireSlot[] = [];
  for (const section of r.sections) {
    const fixed = chromeFor(section, decision.chrome);
    if (fixed === "declined") continue;
    if (fixed === null) {
      slots.push({ slot: section.slot, block: null, props: {} });
      continue;
    }
    const distribution = section.region === "header" ? decision.distributions.header : decision.distributions.nav;
    const alternatives = alternativesOf(distribution, section.options, fixed.block);
    slots.push({
      ...resolveSlot(r.id, section.slot, fixed.block),
      p: distribution[fixed.block] ?? 0,
      ...(alternatives.length ? { alternatives } : {}),
    });
  }
  // Round 1's P(yes) rides on every screen (phase 6: a kept screen labels the decision), and a maybe says so.
  const asked = decision.archetypes.find((a) => a.id === archetype);
  return {
    ...spec, slots, round: 1, chrome: decision.chrome,
    ...(asked ? { need: asked.p } : {}),
    ...(asked?.maybe ? { maybe: true as const } : {}),
  };
}

// ---------- round 2: structure

export function structureRequest(spec: WireSpec, flowTitles: readonly string[]): JevRequest {
  const r = recipe(spec.archetype);
  const questions: Record<string, JevQuestion> = {};
  for (const slot of spec.slots) {
    if (slot.block !== null) continue;
    const section = r.sections.find((s) => s.slot === slot.slot)!;
    if (section.optional) {
      questions[`${section.slot}:include`] = {
        type: "noul",
        instructions: `Does the ${spec.title} screen need ${section.options.join(" or ")} in its ${section.region}?`,
      };
    }
    if (section.options.length > 1) {
      questions[section.slot] = {
        type: "choice",
        instructions: `Which block fills the ${section.region} of the ${spec.title} screen here?`,
        criteria: Object.fromEntries(section.options.map((o) => [o, `a ${component(o).category} block`])),
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: { request: spec.request, platform: spec.platform, screens: flowTitles, screen: spec.title, chrome: spec.chrome },
    questions,
  };
}

/**
 * Round 2's answers written into a screen. **Every probability is kept**,
 * including the include decision's: an optional section on the screen carries
 * `LEAVE_OUT` among its alternatives at P(no), and one left off is recorded in
 * `declined` at P(no) with the block that would fill it — so phase 2's
 * variations can flip a section in or out, not only swap a block.
 */
export function applyStructure(spec: WireSpec, req: JevRequest, res: JevResponse): WireSpec {
  const r = recipe(spec.archetype);
  const slots: WireSlot[] = [];
  const declined: WireDeclined[] = [...(spec.declined ?? [])];
  for (const slot of spec.slots) {
    if (slot.block !== null) {
      slots.push(slot);
      continue;
    }
    const section = r.sections.find((s) => s.slot === slot.slot)!;
    const pick = section.options.length > 1 ? chosenOption(req.questions[section.slot]!, res.answers[section.slot]!) : null;
    const block = pick?.value ?? section.options[0]!;
    let pOut = 0;
    if (section.optional) {
      const include = chosenOption(req.questions[`${section.slot}:include`]!, res.answers[`${section.slot}:include`]!);
      pOut = include.distribution.false!;
      if (include.value === "false") {
        declined.push({ slot: section.slot, p: pOut, block });
        continue;
      }
    }
    const alternatives = [
      ...(pick ? alternativesOf(pick.distribution, section.options, block) : []),
      ...(pOut > 0 ? [{ block: LEAVE_OUT, p: pOut }] : []),
    ].sort((a, b) => b.p - a.p);
    const p = pick ? pick.p : section.optional ? 1 - pOut : undefined;
    slots.push({ ...resolveSlot(r.id, section.slot, block), ...(p !== undefined ? { p } : {}), ...(alternatives.length ? { alternatives } : {}) });
  }
  return { ...spec, slots, round: 2, ...(declined.length ? { declined } : {}) };
}

// ---------- round 3: props and intents

/** A prop's question and how its answer reads back as a value. */
function propQuestion(label: string, def: import("./catalog/index.ts").PropDef): { q: JevQuestion; read: (v: string) => string | number | boolean } | null {
  switch (def.kind) {
    case "choice":
      if (def.values.length < 2) return null;
      return { q: { type: "choice", instructions: `${label}: which?`, criteria: Object.fromEntries(def.values.map((v) => [v, null])) }, read: (v) => v };
    case "flag":
      return { q: { type: "noul", instructions: `${label}: yes or no?` }, read: (v) => v === "true" };
    case "count": {
      const levels = Array.from({ length: def.max - def.min + 1 }, (_, i) => String(def.min + i));
      if (levels.length < 2) return null;
      // Jev's score takes 2–10 ordered levels; a longer range is a choice over the same numbers.
      const q: JevQuestion = levels.length <= 10
        ? { type: "score", instructions: `${label}: how many?`, criteria: levels }
        : { type: "choice", instructions: `${label}: how many?`, criteria: Object.fromEntries(levels.map((l) => [l, null])) };
      return { q, read: (v) => Number(v) };
    }
    case "index": {
      if (def.max < 2) return null;
      const levels = Array.from({ length: def.max }, (_, i) => String(i + 1));
      return { q: { type: "choice", instructions: `${label}: which one, counted from 1?`, criteria: Object.fromEntries(levels.map((l) => [l, null])) }, read: (v) => Number(v) };
    }
  }
}

/**
 * **The nav is one bar, not one per screen.** Round 1 fixes which nav block
 * a flow has; the first real Jev run (23 Sep 2026) showed that asking its
 * props and intents per screen gives Home "Home · Search · Home" and List
 * "Home · Search · Search" — the same bar, drawn differently on every
 * screen. So the first screen in running order that carries a nav block is
 * asked about it, the others are asked only which of its items they are
 * (`selected`), and `shareNav` copies the rest across.
 */
const PER_SCREEN_NAV_PROPS = new Set(["selected"]);

function isNavChrome(r: Recipe, slot: WireSlot): boolean {
  return r.sections.find((s) => s.slot === slot.slot)?.region === "nav";
}

/** `sharedNav`: nav block ids whose props and intents another screen of the flow is asked for. */
export function propsRequest(spec: WireSpec, sharedNav: ReadonlySet<string> = new Set()): JevRequest {
  const r = recipe(spec.archetype);
  const questions: Record<string, JevQuestion> = {};
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const c = component(slot.block);
    const settled = r.props?.[c.id] ?? {};
    const shared = isNavChrome(r, slot) && sharedNav.has(c.id);
    for (const [key, def] of Object.entries(c.props)) {
      if (key in settled || (shared && !PER_SCREEN_NAV_PROPS.has(key))) continue;
      const pq = propQuestion(`The ${c.id} in the ${slot.slot} of the ${spec.title} screen — ${key}`, def);
      if (pq) questions[`${slot.slot}:${c.id}.${key}`] = pq.q;
    }
    for (const [element, el] of Object.entries(c.elements ?? {})) {
      if (el.accepts.length < 2 || shared) continue;
      questions[`${slot.slot}:${c.id}#${element}`] = {
        type: "choice",
        instructions: `What does ${element} of the ${c.id} on the ${spec.title} screen do?`,
        criteria: Object.fromEntries(el.accepts.map((i) => [i, null])),
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: {
      request: spec.request,
      platform: spec.platform,
      screen: spec.title,
      blocks: Object.fromEntries(spec.slots.filter((s) => s.block).map((s) => [s.slot, s.block])),
    },
    questions,
  };
}

export function applyProps(spec: WireSpec, req: JevRequest, res: JevResponse): WireSpec {
  const r = recipe(spec.archetype);
  const slots = spec.slots.map((slot): WireSlot => {
    if (slot.block === null) return slot;
    const c = component(slot.block);
    const settled = r.props?.[c.id] ?? {};
    const props: Props = {};
    for (const [key, def] of Object.entries(c.props)) {
      if (key in settled) continue;
      const id = `${slot.slot}:${c.id}.${key}`;
      const pq = propQuestion("", def);
      if (!pq || !req.questions[id]) continue;
      props[key] = pq.read(chosenOption(req.questions[id]!, res.answers[id]!).value);
    }
    const resolved = resolveSlot(r.id, slot.slot, slot.block, props);
    const present = presentElements(c, resolved.props);
    const intents = { ...(resolved.intents ?? {}) };
    // One block does not carry the same intent twice — a tab bar of "Home ·
    // Search · Home" is two doors to one room. Still argmax, under that one
    // constraint: an element whose first choice a sibling already took gets
    // its most probable intent nobody has.
    const used = new Set<string>();
    for (const element of present) {
      const id = `${slot.slot}:${c.id}#${element}`;
      if (req.questions[id]) {
        const pick = chosenOption(req.questions[id]!, res.answers[id]!);
        const ranked = [pick.value, ...Object.entries(pick.distribution).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
        intents[element] = (ranked.find((k) => !used.has(k)) ?? pick.value) as never;
      }
      used.add(intents[element]!);
    }
    const out: WireSlot = { ...resolved };
    if (present.length > 0) out.intents = intents;
    if (slot.p !== undefined) out.p = slot.p;
    if (slot.alternatives) out.alternatives = slot.alternatives;
    return out;
  });
  return { ...spec, slots, round: 3 };
}

/** For each nav block in a flow, the first screen in running order that carries it — the one asked about it. */
export function navOwners(specs: readonly WireSpec[]): Map<string, number> {
  const owners = new Map<string, number>();
  specs.forEach((spec, i) => {
    const r = recipe(spec.archetype);
    for (const slot of spec.slots) if (slot.block && isNavChrome(r, slot) && !owners.has(slot.block)) owners.set(slot.block, i);
  });
  return owners;
}

/** Round 3's requests for a whole flow: every nav block asked about once, on the screen that owns it. */
export function propsRequests(specs: readonly WireSpec[]): JevRequest[] {
  const owners = navOwners(specs);
  return specs.map((spec, i) => propsRequest(spec, new Set([...owners].filter(([, owner]) => owner !== i).map(([block]) => block))));
}

/** Copy each nav block's props and intents from the screen that was asked to every other screen with it; `selected` stays each screen's own. */
export function shareNav(specs: readonly WireSpec[]): WireSpec[] {
  const owners = navOwners(specs);
  return specs.map((spec, i) => {
    const r = recipe(spec.archetype);
    const slots = spec.slots.map((slot) => {
      if (!slot.block || !isNavChrome(r, slot)) return slot;
      const owner = owners.get(slot.block)!;
      if (owner === i) return slot;
      const from = specs[owner]!.slots.find((s) => s.block === slot.block && isNavChrome(recipe(specs[owner]!.archetype), s))!;
      const props = { ...from.props, ...Object.fromEntries([...PER_SCREEN_NAV_PROPS].filter((k) => k in slot.props).map((k) => [k, slot.props[k]!])) };
      const c = component(slot.block);
      const present = presentElements(c, props);
      const out: WireSlot = { ...slot, props };
      if (present.length > 0) out.intents = Object.fromEntries(present.map((e) => [e, from.intents![e]!]));
      else delete out.intents;
      // `selected` is counted within the items the bar now has.
      for (const key of PER_SCREEN_NAV_PROPS) {
        const def = c.props[key];
        const cap = typeof props.items === "number" ? props.items : def?.kind === "index" ? def.max : undefined;
        if (typeof out.props[key] === "number" && cap !== undefined && (out.props[key] as number) > cap) out.props = { ...out.props, [key]: cap };
      }
      return out;
    });
    return { ...spec, slots };
  });
}

/** Round 3 for a whole flow: each screen's answers, then one nav bar across them. */
export function applyPropsRound(specs: readonly WireSpec[], requests: readonly JevRequest[], responses: readonly JevResponse[]): WireSpec[] {
  return shareNav(specs.map((spec, i) => applyProps(spec, requests[i]!, responses[i]!)));
}

// ---------- the question file, for an agent

/** One call in a round: which screen it is for, what it asks, and — once answered — the answers. */
export interface RoundCall {
  /** The item the answers are written into. */
  item: string;
  request: JevRequest;
  response?: JevResponse;
}

/** `isocan wire questions` prints this; `isocan wire answer` reads it back with each `response` filled in. */
export interface RoundFile {
  flow: string;
  round: 1 | 2 | 3;
  calls: RoundCall[];
}

/** The round a flow's screens are waiting on, or null when every screen is drawn. */
export function pendingRound(specs: readonly WireSpec[]): 1 | 2 | 3 | null {
  const rounds = specs.map((s) => s.round ?? 3);
  const lowest = Math.min(...rounds);
  return lowest >= 3 ? null : ((lowest + 1) as 1 | 2 | 3);
}

/** The requests a round asks, one per screen (one in all for round 1). */
export function roundCalls(round: 1 | 2 | 3, screens: ReadonlyArray<{ item: string; spec: WireSpec }>): RoundCall[] {
  if (round === 1) return [{ item: screens[0]!.item, request: flowRequest(screens[0]!.spec.request) }];
  const titles = screens.map((s) => s.spec.title);
  if (round === 3) {
    const requests = propsRequests(screens.map((s) => s.spec));
    return screens.map(({ item }, i) => ({ item, request: requests[i]! }));
  }
  return screens.map(({ item, spec }) => ({ item, request: structureRequest(spec, titles) }));
}

/** Check an answered call against the question it answers — the refusal an agent's file gets. */
export function answeredResponse(call: RoundCall, from: string): JevResponse {
  return readResponse(call.request, call.response, from);
}
