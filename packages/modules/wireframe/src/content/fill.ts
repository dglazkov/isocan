import { component } from "../catalog/index.ts";
import { INTENT_BY_ID } from "../catalog/intents.ts";
import { defaultIntent, presentElements, recipe } from "../spec.ts";
import type { Props } from "../catalog/types.ts";
import { DAYS, FIRST_NAMES, GENERIC, INITIALS, MONTHS, SETTINGS_ROWS, type Pack } from "./pack.ts";
import { GENERIC_PACK, PACK_BY_ID } from "./packs.ts";

/**
 * **Filling a slot — deterministically** (design §10, *Filling is
 * deterministic*).
 *
 * A pack's items are **entities**: entity *k* of a flow is the same parcel —
 * the same number, status and weight — on every screen of that flow, because
 * it is expanded from the flow's id and *k* alone. What a slot shows is a
 * pick of entities by a seed of the screen and the slot: the item id (a
 * variation's is its screen's) and the slot's name. So the list and the
 * detail agree about "Parcel 4471", a re-render draws the same words, and a
 * restyle, a variation or the prototype never re-rolls anything.
 *
 * The result is plain data written into the spec — `fill` on each slot,
 * `content` on the spec — which is what lets `wire copy` replace the words
 * and a screen outlive this module.
 */

// ---------- the data a slot carries

export interface FillItem {
  title: string;
  sub?: string;
  status?: string;
  meta?: string;
  /** A person's name, for an avatar and a byline. */
  person?: string;
  /** A sentence: a comment, a post, a teaser. */
  text?: string;
  /** A pictogram id — not words. */
  motif?: string;
  /** A table row, in the column order of `labels`. */
  cells?: string[];
  /** 1–5 — not words. */
  rating?: number;
}

export interface FillStat {
  label: string;
  value: string;
  delta?: string;
  down?: boolean;
}

/** What one slot draws instead of bars. Every string in it is a word `wire copy` can replace. */
export interface SlotFill {
  heading?: string;
  sub?: string;
  person?: string;
  lines?: string[];
  labels?: string[];
  values?: string[];
  groups?: string[];
  items?: FillItem[];
  stats?: FillStat[];
  motif?: string;
  /** Chart series, 0–100 — not words. */
  series?: number[][];
  /** A lone action's words by element ("action-1" → "Edit delivery") — `objectLabel`; the intent's own label otherwise. */
  actions?: Record<string, string>;
}

/**
 * On the spec: where its content came from. `pack` — sample content from a
 * pack Jev (or `--pack`) chose, with the probability it was chosen at;
 * `copy` — exact words an agent or a person wrote. `title` is the heading
 * the frame draws in place of the archetype's ("Deliveries", not "List");
 * `bar`, where the body draws that heading, what the app bar says instead
 * ("Delivery" over a detail titled "Parcel 4471").
 */
export type WireContent =
  | { source: "pack"; pack: string; p?: number; by?: string; title?: string; bar?: string }
  | { source: "copy"; by: string; pack?: string; title?: string; bar?: string };

// ---------- seeds

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "1 items" → "1 item", "1 replies" → "1 reply": a drawn 1 takes the singular. */
export function singular(text: string): string {
  return text.replace(/(^|[^\d.,])1 ([a-z]+?)(ies|s)\b/g, (whole, pre: string, stem: string, end: string) =>
    stem.length < 2 || /ss$/.test(stem + end) ? whole : `${pre}1 ${stem}${end === "ies" ? "y" : ""}`);
}

/** Expands a pack template with one stream of draws. */
export class Ink {
  private next: () => number;
  constructor(seed: number) {
    this.next = rng(seed);
  }

  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]!;
  }

  name(): string {
    return `${this.pick(FIRST_NAMES)} ${this.pick(INITIALS.split(""))}.`;
  }

  x(template: string): string {
    return singular(this.expand(template));
  }

  private expand(template: string): string {
    return template.replace(/\{([^}]+)\}/g, (whole, token: string) => {
      const range = /^#(\d+)-(\d+)$/.exec(token);
      if (range) {
        const [lo, hi] = [range[1]!, range[2]!];
        const n = this.int(Number(lo), Number(hi));
        return lo.length > 1 && lo.startsWith("0") ? String(n).padStart(lo.length, "0") : String(n);
      }
      const letters = /^([A-Z])-([A-Z])$/.exec(token);
      if (letters) return String.fromCharCode(this.int(letters[1]!.charCodeAt(0), letters[2]!.charCodeAt(0)));
      switch (token) {
        case "name": return this.name();
        case "first": return this.pick(FIRST_NAMES);
        case "lower": return this.pick(FIRST_NAMES).toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
        case "time": return `${this.int(7, 19)}:${String(this.int(0, 11) * 5).padStart(2, "0")}`;
        case "day": return this.pick(DAYS);
        case "date": return `${this.pick(MONTHS)} ${this.int(1, 28)}`;
        case "ago": return this.next() < 0.5 ? `${this.int(2, 55)} min ago` : `${this.int(1, 9)} h ago`;
        default: return whole;
      }
    });
  }
}

// ---------- entities

export interface Entity {
  title: string;
  sub: string;
  status: string;
  meta: string;
  category: string;
  person: string;
  date: string;
  amount: string;
  motif: string;
}

/** Entity k of a flow: the same thing on every screen of it. */
export function entity(pack: Pack, flow: string, k: number): Entity {
  const n = pack.titles.length;
  const i = ((k % n) + n) % n;
  const ink = new Ink(hash(`${pack.id}|${flow}|entity|${i}`));
  return {
    title: ink.x(pack.titles[i]!),
    sub: ink.x(ink.pick(pack.subs)),
    status: ink.pick(pack.statuses),
    // The first meta is the one a table's column names, so every row says the same kind of thing.
    meta: ink.x(pack.meta[0]!),
    category: ink.pick(pack.categories),
    person: ink.name(),
    date: ink.x(ink.pick(["{day}", "{date}", "{date}"])),
    amount: ink.x(ink.pick(pack.amount)),
    // A thing's picture is one of the domain's own objects — the pack's first three motifs.
    motif: pack.motifs[(i + hash(flow)) % Math.min(3, pack.motifs.length)]!,
  };
}


// ---------- the picker a filler draws with

const STEPS = [1, 3, 5, 7, 11, 13];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export class Picker {
  readonly ink: Ink;
  private start: number;
  private step: number;
  private n: number;

  constructor(readonly pack: Pack, readonly flow: string, readonly key: string, readonly slot: string, readonly lead: boolean) {
    const seed = hash(`${key}|${slot}`);
    this.ink = new Ink(seed);
    this.n = pack.titles.length;
    this.start = seed % this.n;
    this.step = STEPS.filter((s) => gcd(s, this.n) === 1)[seed % 3] ?? 1;
  }

  /** The flow's focus: the entity its detail screen shows, and the first row of every lead list. */
  get focusIndex(): number {
    return hash(`${this.pack.id}|${this.flow}|focus`) % this.n;
  }

  focus(): Entity {
    return entity(this.pack, this.flow, this.focusIndex);
  }

  /** n entities for this slot: the focus first in a lead slot, then a seeded walk that skips it. */
  entities(count: number): Entity[] {
    const out: Entity[] = [];
    const seen = new Set<number>();
    if (this.lead) {
      out.push(this.focus());
      seen.add(this.focusIndex);
    }
    for (let j = 0; out.length < count && j < count + this.n; j++) {
      const k = (this.start + j * this.step) % this.n;
      if (seen.has(k) && seen.size < this.n) continue;
      seen.add(k);
      out.push(entity(this.pack, this.flow, k));
    }
    return out;
  }

  /** n from a list, cycling from a seeded offset (or from the start when `from0`). */
  cycle<T>(list: readonly T[], count: number, from0 = false): T[] {
    const off = from0 ? 0 : this.start % list.length;
    return Array.from({ length: count }, (_, i) => list[(off + i) % list.length]!);
  }

  x(template: string): string {
    return this.ink.x(template);
  }

  sentences(count: number): string[] {
    return this.cycle(this.pack.lines, count).map((l) => this.x(l));
  }
}

// ---------- per block

/** What a filler is handed about the screen around the slot. */
export interface FillContext {
  p: Picker;
  props: Props;
  archetype: string;
  /** The label of an element's intent, as the button draws it. */
  label: (element: string) => string;
}

const num = (props: Props, key: string) => Number(props[key]);
const lower = (s: string) => s.toLowerCase();

function rowItems(c: FillContext, n: number, opts: { lines?: number } = {}): FillItem[] {
  return c.p.entities(n).map((e) => ({
    title: e.title,
    ...(opts.lines === undefined || opts.lines >= 2 ? { sub: e.sub } : {}),
    status: e.status,
    meta: e.meta,
    person: e.person,
    motif: e.motif,
  }));
}

function stats(c: FillContext, n: number): FillStat[] {
  return c.p.cycle(c.p.pack.metrics, n, true).map((m) => ({
    label: m.label,
    value: c.p.x(m.value),
    ...(m.delta ? { delta: c.p.x(m.delta) } : {}),
    ...(m.down ? { down: true } : {}),
  }));
}

/** A person's own fields — what a sign-up or a settings form asks, whatever the domain. */
const ACCOUNT_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["Full name", "{name}"], ["Email", GENERIC.email], ["Phone", GENERIC.phone], ["Language", "English"], ["Time zone", "GMT+{#1-9}"], ["Password", GENERIC.password],
];
const ACCOUNT_ARCHETYPES = new Set(["sign-up", "settings"]);

function fieldPairs(c: FillContext, n: number, skipFirst = 0): { labels: string[]; values: string[] } {
  const pairs = c.p.cycle(ACCOUNT_ARCHETYPES.has(c.archetype) ? ACCOUNT_FIELDS : c.p.pack.fields, n + skipFirst, true).slice(skipFirst);
  return { labels: pairs.map(([l]) => l), values: pairs.map(([, v]) => c.p.x(v)) };
}

function series(c: FillContext, count: number): number[][] {
  return Array.from({ length: count }, () => Array.from({ length: 7 }, () => c.p.ink.int(25, 95)));
}

const LEGAL_HEADS = ["Your account", "Using the service", "Payments and refunds", "Your content", "Privacy", "Ending this agreement"];

type Filler = (c: FillContext) => SlotFill | undefined;

/**
 * **Every block and primitive that draws bars, and what it draws instead.**
 * Absent ids (a button, a tab bar, an app bar) carry only intents and a
 * title already — nothing to fill. `content.test.ts` holds this table to
 * every component that draws a bar.
 */
export const FILLERS: Record<string, Filler> = {
  // ---- primitives
  image: ({ p, props }) => ({ motif: p.pack.motifs[0]!, ...(props.caption === true ? { lines: [p.focus().title] } : {}) }),
  text: ({ p, props, archetype }) => ({ lines: archetype === "welcome" ? [p.pack.pitch[1]] : p.sentences(Math.max(1, Math.ceil(num(props, "lines") * 0.6))) }),
  "description-list": ({ p, props }) => {
    // The focus entity's own fields first, under the table's column names — so a detail agrees with the row it opened.
    const e = p.focus();
    const c = p.pack.columns;
    const own: Array<readonly [string, string]> = [[c[1], e.sub], [c[4], e.category], [c[5], e.person], [c[6], e.date], [c[7], e.amount]];
    const more = p.pack.details.filter(([l]) => !own.some(([o]) => o === l)).map(([l, v]) => [l, p.x(v)] as const);
    const pairs = [...own, ...more].slice(0, num(props, "pairs"));
    return { labels: pairs.map(([l]) => l), values: pairs.map(([, v]) => v) };
  },
  chip: ({ p, props }) => ({ labels: ["All", ...p.pack.categories].slice(0, num(props, "count")) }),
  list: (c) => ({ items: rowItems(c, num(c.props, "rows"), { lines: num(c.props, "lines") }) }),
  "search-field": ({ p }) => ({ labels: [`Search ${lower(p.pack.noun[1])}`], values: [lower(p.focus().category)] }),
  "segmented-control": ({ p, props }) => ({ labels: ["All", ...p.pack.statuses].slice(0, num(props, "count")) }),
  tabs: ({ p, props }) => ({ labels: ["All", ...p.pack.categories].slice(0, num(props, "count")) }),
  steps: ({ props }) => ({ labels: GENERIC.steps.slice(0, num(props, "count")) }),
  chart: (c) => ({ series: series(c, num(c.props, "series")), labels: c.p.pack.categories.slice(0, num(c.props, "series")), values: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }),
  drawer: ({ p }) => {
    const e = p.focus();
    return { person: e.person, sub: p.x(p.pack.roles[0]!) };
  },
  sheet: ({ p, props }) => (props.kind === "sheet" ? { heading: p.focus().title, lines: p.sentences(2) } : undefined),
  modal: ({ p, label }) => ({ heading: `${label("action-1")} ${p.focus().title}?`, lines: p.sentences(1) }),
  // ---- blocks
  navbar: ({ p }) => ({ motif: p.pack.motifs[0]! }),
  "app-shell": ({ p }) => ({ values: ["9:41", `app.example.com/${lower(p.pack.noun[1]).replace(/[^a-z]+/g, "-")}`] }),
  "page-header": ({ p }) => ({
    values: [...GENERIC.crumbs, p.pack.noun[1]],
    sub: `${p.ink.int(8, 60)} ${lower(p.pack.noun[1])} · updated ${p.x("{ago}")}`,
    labels: ["All", ...p.pack.categories].slice(0, 3),
  }),
  "sign-in-form": ({ p }) => ({ values: [p.x(GENERIC.email), GENERIC.password], lines: ["New here?"] }),
  "sign-up-form": ({ p, props }) => {
    const labels = ["Full name", "Email", "Password", "Phone", "Date of birth", "Postcode"].slice(0, num(props, "fields"));
    const values = [p.ink.name(), p.x(GENERIC.email), GENERIC.password, p.x(GENERIC.phone), p.x("{date}, 19{#70-99}"), p.x("{A-F}{#1-9} {#1-9}{A-F}{A-F}")].slice(0, labels.length);
    return { labels, values, lines: ["I agree to the", "Already have an account?"] };
  },
  "verify-code": ({ p }) => ({ lines: [p.x(GENERIC.verifyLead[1])], values: p.x(GENERIC.code).split(""), sub: "Didn't get it?" }),
  "forgot-password": ({ p, props }) => (props.step === "request"
    ? { lines: [GENERIC.forgotLead[1]], values: [p.x(GENERIC.email)] }
    : { heading: GENERIC.sentLead[0], lines: [GENERIC.sentLead[1]] }),
  "onboarding-step": ({ p }) => ({ motif: p.pack.motifs[0]!, heading: p.pack.pitch[0], lines: [p.pack.pitch[1]] }),
  wizard: (c) => ({ groups: (c.archetype === "sign-up" ? ["Account", "Profile", "Preferences", "Review", "Verify", "Done"] : GENERIC.steps).slice(0, num(c.props, "steps")), ...fieldPairs(c, 3), lines: [c.p.focus().title, c.p.focus().sub] }),
  "form-block": (c) => ({ ...fieldPairs(c, num(c.props, "fields")), groups: ["Details", "More", "Notes"].slice(0, num(c.props, "sections")) }),
  "filter-panel": ({ p, props }) => {
    const groups = [...GENERIC.filterGroups, "Owner", "Price", "More"].slice(0, num(props, "groups"));
    const options = [p.pack.statuses, p.pack.categories, ["Today", "This week", "This month"], FIRST_NAMES.slice(0, 3), ["Under $50", "$50–$200", "Over $200"], ["Saved", "Shared", "Archived"]];
    return { groups, labels: groups.flatMap((_, g) => options[g]!.slice(0, 3)) };
  },
  "settings-group": ({ p, props }) => {
    const rows = p.cycle(SETTINGS_ROWS, num(props, "groups") * num(props, "rows"), true);
    return { groups: ["General", "Account", "Privacy", "About"].slice(0, num(props, "groups")), labels: rows.map(([l]) => l), values: rows.map(([, v]) => p.x(v)) };
  },
  "stats-row": (c) => ({ stats: stats(c, num(c.props, "count")), ...(c.props.chart === true ? { series: series(c, num(c.props, "count")) } : {}) }),
  "stacked-list": (c) => ({ items: rowItems(c, num(c.props, "rows")), ...(num(c.props, "sections") > 0 ? { groups: GENERIC.sectionHeads.slice(0, num(c.props, "sections")) } : {}) }),
  "card-grid": (c) => ({ items: c.p.entities(num(c.props, "items")).map((e) => ({ title: e.title, sub: e.sub, meta: e.meta, status: e.status, motif: e.motif })) }),
  "data-table": (c) => ({
    labels: [...c.p.pack.columns],
    items: c.p.entities(num(c.props, "rows")).map((e) => ({ title: e.title, cells: [e.title, e.sub, e.status, e.meta, e.category, e.person, e.date, e.amount] })),
  }),
  "blog-list": (c) => ({ items: c.p.entities(num(c.props, "posts")).map((e, i) => ({ title: e.title, sub: `${e.category} · ${e.date}`, text: c.p.x(c.p.pack.lines[i % c.p.pack.lines.length]!), person: e.person, motif: e.motif })) }),
  "long-form": ({ p, props, archetype }) => {
    const n = num(props, "sections");
    return { groups: archetype === "legal" ? LEGAL_HEADS.slice(0, n).map((h, i) => `${i + 1}. ${h}`) : ["About", "Details", "Notes", "More", "History", "Related"].slice(0, n), lines: p.sentences(n * 3) };
  },
  "detail-header": ({ p, props }) => {
    const e = p.focus();
    return { heading: e.title, sub: e.sub, motif: e.motif, labels: [e.status, e.category, e.date, e.amount].slice(0, num(props, "meta")) };
  },
  "comment-list": ({ p, props }) => {
    const n = num(props, "comments");
    return {
      heading: `${n} comments`,
      items: p.entities(n).map((e, i) => ({ title: e.person, person: e.person, text: p.x(p.pack.remarks[(i + p.focusIndex) % p.pack.remarks.length]!), meta: p.x("{ago}") })),
    };
  },
  "profile-header": ({ p }) => {
    const e = p.focus();
    return { person: e.person, sub: p.x(p.pack.roles[0]!), stats: p.pack.profile.map(([label, value]) => ({ label, value: p.x(value) })) };
  },
  "feed-post": ({ p, props }) => ({
    items: p.entities(num(props, "count")).map((e, i) => ({
      title: e.title,
      person: e.person,
      meta: p.x("{ago}"),
      text: p.x(i % 2 === 0 ? p.pack.lines[(i + p.focusIndex) % p.pack.lines.length]! : p.pack.remarks[i % p.pack.remarks.length]!),
      sub: e.sub,
      motif: e.motif,
    })),
  }),
  "gallery-section": ({ p, props }) => ({ items: p.entities(num(props, "items")).map((e) => ({ title: e.title, motif: e.motif })) }),
  "product-card-list": ({ p, props }) => ({ items: p.entities(num(props, "items")).map((e, i) => ({ title: e.title, meta: e.amount, sub: e.sub, motif: e.motif, rating: 3 + ((i + p.focusIndex) % 3) })) }),
  "empty-state": ({ p, props }) => {
    const [heading, line] = props.cause === "no-results" ? GENERIC.noResults : props.cause === "cleared" ? GENERIC.cleared : p.pack.empty;
    return { motif: p.pack.motifs[0]!, heading, lines: [p.x(line)] };
  },
  "error-state": ({ props }) => ({ lines: [GENERIC.errors[String(props.kind)] ?? GENERIC.errors.generic!] }),
  "success-state": ({ p }) => {
    const e = p.focus();
    return { heading: p.pack.success[0], lines: [p.x(p.pack.success[1])], values: [e.title, e.sub, e.amount] };
  },
  "confirm-dialog": ({ p, label }) => ({ heading: `${label("confirm")} ${p.focus().title}?`, lines: p.sentences(1) }),
};

/** The heading a fleshed screen draws in place of its archetype's, or undefined to keep it. */
export function contentTitle(archetype: string, pack: Pack, flow: string, blocks: readonly (string | null)[] = []): string | undefined {
  if (blocks.includes("forgot-password")) return GENERIC.forgotLead[0];
  const focus = () => new Picker(pack, flow, flow, "title", true).focus();
  switch (archetype) {
    case "home": return pack.home;
    case "list": case "gallery": return pack.noun[1];
    case "detail": return focus().title;
    case "form": return `New ${lower(pack.noun[0])}`;
    case "profile": return focus().person;
    case "search": return `Search ${lower(pack.noun[1])}`;
    case "feed": return "Activity";
    case "welcome": return pack.pitch[0];
    case "sign-in": return GENERIC.signInLead[0];
    case "sign-up": return GENERIC.signUpLead[0];
    case "verify": return GENERIC.verifyLead[0];
    default: return undefined;
  }
}

/**
 * **A screen's name in the pack's words** (24 Sep 2026): what the item is
 * called once it is fleshed — "Deliveries" rather than "List", "Delivery"
 * rather than "Detail". Only where the archetype names a kind of thing the
 * pack has a noun for; a home, a sign-in or a status keeps its archetype's
 * name, which already says what it is. The heading inside the screen is
 * `contentTitle`'s, and may be more particular ("Box 230").
 */
export function domainTitle(archetype: string, pack: Pack): string | undefined {
  switch (archetype) {
    case "list": case "gallery": return pack.noun[1];
    case "detail": return pack.noun[0];
    case "form": return `New ${lower(pack.noun[0])}`;
    case "search": return `Search ${lower(pack.noun[1])}`;
    default: return undefined;
  }
}

/**
 * **A lone action's label in the pack's words**: a bare verb on the only
 * button of its block ("Edit") says what it acts on ("Edit delivery") once
 * the screen is fleshed. Only the verbs that take an object; "Done",
 * "Next" or "Sign in" stay as they are.
 */
function objectLabel(intent: string, label: string, noun: string): string | undefined {
  return OBJECT_VERBS.has(intent) ? `${label} ${lower(noun)}` : undefined;
}

const OBJECT_VERBS: ReadonlySet<string> = new Set(["edit", "delete", "share", "save", "add", "submit", "upload"]);

/**
 * The words for a block's ONE actionable element, when it is a bare verb
 * that takes an object — or nothing. Header and nav bars are left alone
 * (their actions are icons), and a profile's object is the profile, not
 * the pack's thing.
 */
function loneAction(
  pack: Pack, archetype: string, slot: { slot: string; block: string; props: Props; intents?: Record<string, string> },
): Record<string, string> | undefined {
  const r = recipe(archetype);
  const region = r.sections.find((s) => s.slot === slot.slot)?.region;
  if (region === "header" || region === "nav") return undefined;
  const c = component(slot.block);
  const present = presentElements(c, { ...Object.fromEntries(Object.entries(c.props).map(([k, d]) => [k, d.default])), ...slot.props });
  if (present.length !== 1) return undefined;
  const element = present[0]!;
  const intent = slot.intents?.[element] ?? defaultIntent(r, c, element);
  const label = INTENT_BY_ID.get(intent as never)?.label ?? intent;
  const words = objectLabel(intent, label, c.id === "profile-header" || archetype === "profile" ? "profile" : pack.noun[0]);
  return words ? { [element]: words } : undefined;
}

export function packOf(id: string | undefined): Pack {
  return PACK_BY_ID.get(id ?? GENERIC_PACK) ?? PACK_BY_ID.get(GENERIC_PACK)!;
}

/** Whether a component has content to fill — anything else draws only intents and titles. */
export function fillable(block: string): boolean {
  return block in FILLERS;
}

/**
 * **One slot's fill**, or undefined for a block with nothing to fill. `key`
 * is the screen's seed — its item id, or its screen's for a variation — so
 * the same slot on the same screen always fills the same way.
 */
export function fillSlot(
  pack: Pack, spec: { flow: string; archetype: string }, key: string,
  slot: { slot: string; block: string | null; props: Props; intents?: Record<string, string> },
): SlotFill | undefined {
  if (!slot.block) return undefined;
  const actions = loneAction(pack, spec.archetype, { ...slot, block: slot.block });
  const filled = fillWords(pack, spec, key, { ...slot, block: slot.block });
  if (!actions) return filled;
  return { ...(filled ?? {}), actions };
}

function fillWords(
  pack: Pack, spec: { flow: string; archetype: string }, key: string,
  slot: { slot: string; block: string; props: Props; intents?: Record<string, string> },
): SlotFill | undefined {
  const filler = FILLERS[slot.block];
  if (!filler) return undefined;
  const c = component(slot.block);
  const props: Props = { ...Object.fromEntries(Object.entries(c.props).map(([k, d]) => [k, d.default])), ...slot.props };
  const lead = slot.slot.startsWith("main");
  const p = new Picker(pack, spec.flow || key, key, slot.slot, lead);
  const label = (element: string) => {
    const intent = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(recipe(spec.archetype), c, element) : element);
    return INTENT_BY_ID.get(intent)?.label ?? intent;
  };
  return filler({ p, props, archetype: spec.archetype, label });
}
