import { INTENT_BY_ID, RECIPE_BY_ID, component, type IntentId, type Transition } from "./catalog/index.ts";
import { defaultIntent, presentElements, propsFor, recipe, type WireSpec } from "./spec.ts";

/**
 * **Links — computed, never stored** (design §7; research §3, *The obvious
 * transitions, as rules*).
 *
 * `inferLinks(kept)` reads the kept screens, in reading order, and says where
 * every hotspot on each goes. Nothing it returns is written anywhere: move a
 * screen, keep another, and the next call says something different, so the
 * links cannot drift from the screens. What a person decides is the one
 * exception, and it is kept as the decision, not as a link — `wireLinks` on
 * the source screen, a map from hotspot key to a screen's item id or `none`.
 *
 * The rules, in priority order:
 *
 * 1. **An intent with a target** goes to the first kept screen of that
 *    archetype (`sign-in` → the first post-auth screen, `settings` → settings;
 *    `next` and its kin → the next kept screen; an overlay intent → the kept
 *    screen that draws that overlay).
 * 2. **`back`** (and cancel, close, dismiss, and an app bar's chevron) → the
 *    previous screen in the prototype's own history, so it is `LINK_BACK`
 *    rather than a screen.
 * 3. **A row** of a list, grid, table or feed → the first kept `detail` after
 *    it in reading order (before it, when none is after).
 * 4. **Tab *i*** of a tab bar, side nav, navbar or drawer whose intent found
 *    no screen → the *i*-th top-level screen that no other item of the same
 *    nav already reaches. Top-level is a kept screen that draws a nav.
 * 5. **Anything else that navigates and found nothing** is a *missing* link:
 *    `to: null`, and `needs` names what it wants ("Settings") — drawn dashed.
 *
 * An in-place intent (like, remember me, retry) is no link at all.
 */

/** A kept screen as the rules see it: its item, its name, its spec, and a person's overrides. */
export interface WireScreen {
  id: string;
  title: string;
  spec: WireSpec;
  /** `wireLinks`, parsed: hotspot key → a screen's item id, or `LINK_NONE`. */
  overrides?: Readonly<Record<string, string>>;
}

export type LinkRule = "intent" | "back" | "row" | "tab" | "missing" | "override";

export interface WireLink {
  /** The source screen's item id. */
  from: string;
  /** The hotspot: `<slot>#<element>` — `header#action-1`, `main.3#row`, `nav#tab-2`. */
  key: string;
  /** What the hotspot says: its intent's label, or "Row" / "Back". */
  label: string;
  intent?: IntentId;
  /** A kept screen's item id; `LINK_BACK`; or null — missing (with `needs`), or switched off by a person. */
  to: string | null;
  /** On a missing link: what it needs, in words — "Settings", "Filter panel", "a next screen". */
  needs?: string;
  transition: Transition;
  rule: LinkRule;
  /**
   * **The hotspot is a nav item** — a tab, a side-nav or drawer item, a
   * navbar link (`Hotspot.tab`). Chrome rather than flow: a tab bar is on
   * every top-level screen and reaches every other one, so the canvas draws
   * these only while you point at their screen (research: *Flow arrows*,
   * "every both-ways pair exists only because of a tab bar"). Not the same as
   * `rule: "tab"` — a nav item placed by its intent is rule 1 and still chrome.
   */
  nav?: true;
}

/** A link's `to` for back: whatever the prototype showed before. */
export const LINK_BACK = "back";
/** An override that switches a hotspot off. */
export const LINK_NONE = "none";
/** The property on a source screen that holds a person's overrides, as JSON. */
export const LINKS_PROP = "wireLinks";

/** A hotspot's key: the slot and the element, so it is the same every time the spec is drawn. */
export function hotKey(slot: string, element: string): string {
  return `${slot}#${element}`;
}

/** Blocks whose rows (or cards, or posts) each open the detail screen — rule 3. */
export const ROW_BLOCKS: readonly string[] = ["stacked-list", "card-grid", "data-table", "feed-post", "product-card-list"];

/** Navs whose items are tabs — rule 4 — and the element prefix each numbers its items with. */
const NAV_ITEMS: Readonly<Record<string, string>> = { "tab-bar": "tab", "side-nav": "item", navbar: "link", drawer: "item" };

/** Archetypes a signed-in person lands on (`sign-in`'s target). */
const POST_AUTH: readonly string[] = ["home", "list", "feed"];

/** The run `skip` jumps past. */
const ONBOARDING_RUN: readonly string[] = ["welcome", "onboarding"];

/** Archetypes that are an overlay over the screen before them: their forward answer returns there. */
const OVERLAY_ARCHETYPES: readonly string[] = ["confirm", "menu"];

/** One place a person can click, before the rules say where it goes. */
export interface Hotspot {
  key: string;
  slot: string;
  block: string;
  element: string;
  /** Absent on a row, which navigates by where it is rather than what it says. */
  intent?: IntentId;
  kind: "element" | "row" | "leading";
  /** On a nav item: its 1-based position. */
  tab?: number;
}

/**
 * **Every hotspot a spec draws**, in slot order — each present actionable
 * element with its intent, each row block's rows (one key for all its rows:
 * every row goes to the one detail, as hand-made prototypes do), and an app
 * bar's leading chevron. The renderer stamps each with `data-hot="<key>"`
 * (`DrawContext.hot`), and a test holds the two lists equal.
 */
export function hotspots(spec: WireSpec): Hotspot[] {
  const r = recipe(spec.archetype);
  const out: Hotspot[] = [];
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const c = component(slot.block);
    const props = propsFor(c, slot.props);
    if (slot.block === "app-bar" && props.leading !== "none") {
      const intent: IntentId = props.leading === "menu" ? "menu" : props.leading === "close" ? "close" : "back";
      out.push({ key: hotKey(slot.slot, "leading"), slot: slot.slot, block: c.id, element: "leading", intent, kind: "leading" });
    }
    const prefix = NAV_ITEMS[c.id];
    // A phone's navbar folds its links behind the hamburger: present in the spec, not on the screen.
    const folded = c.id === "navbar" && spec.platform === "app" && props.mobile !== "links";
    for (const element of presentElements(c, props)) {
      if (folded && element.startsWith("link-")) continue;
      const intent = (slot.intents?.[element] ?? defaultIntent(r, c, element)) as IntentId;
      const tab = prefix && element.startsWith(`${prefix}-`) ? Number(element.slice(prefix.length + 1)) : undefined;
      out.push({ key: hotKey(slot.slot, element), slot: slot.slot, block: c.id, element, intent, kind: "element", ...(tab ? { tab } : {}) });
    }
    if (ROW_BLOCKS.includes(c.id)) out.push({ key: hotKey(slot.slot, "row"), slot: slot.slot, block: c.id, element: "row", kind: "row" });
  }
  return out;
}

/** Does this screen draw a nav — a tab bar or side nav in its nav region? Then it is top-level. */
export function isTopLevel(spec: WireSpec): boolean {
  const r = RECIPE_BY_ID.get(spec.archetype);
  return spec.slots.some((s) => s.block !== null && r?.sections.find((x) => x.slot === s.slot)?.region === "nav");
}

/** An archetype's name as a person reads it: its recipe's title, or the id for a later wave's. */
export function archetypeName(id: string): string {
  return RECIPE_BY_ID.get(id)?.title ?? words(id);
}

function words(id: string): string {
  const s = id.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse `wireLinks`; anything unreadable is no override at all rather than a thrown screen. */
export function readOverrides(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

/**
 * **Where every hotspot on every kept screen goes.** `kept` is in reading
 * order (`kept()` in `keep.ts` gives it so). One link per hotspot that
 * navigates — in-place intents are left out, and so is a hotspot a person
 * switched off unless `withNone` asks for it (`wire links` shows it).
 */
export function inferLinks(kept: readonly WireScreen[], opts: { withNone?: boolean } = {}): WireLink[] {
  const ids = new Set(kept.map((s) => s.id));
  const topLevel = kept.filter((s) => isTopLevel(s.spec)).map((s) => s.id);
  const firstOf = (archetypes: readonly string[]) => kept.find((s) => archetypes.includes(s.spec.archetype))?.id ?? null;

  const out: WireLink[] = [];
  kept.forEach((screen, at) => {
    const spots = hotspots(screen.spec);
    const overlayScreen = OVERLAY_ARCHETYPES.includes(screen.spec.archetype);

    /** Rules 1, 2, 3 and 5 for one hotspot; a nav item rule 1 cannot place is left for rule 4 (`null`). */
    const decide = (h: Hotspot): Omit<WireLink, "from" | "key" | "label" | "intent"> | "inert" | null => {
      if (h.kind === "row") {
        const after = kept.slice(at + 1).find((s) => s.spec.archetype === "detail") ?? kept.slice(0, at).reverse().find((s) => s.spec.archetype === "detail");
        return after ? { to: after.id, transition: "push", rule: "row" } : { to: null, needs: "Detail", transition: "push", rule: "missing" };
      }
      const intent = INTENT_BY_ID.get(h.intent!)!;
      const nav = intent.nav;
      switch (nav.to) {
        case "none":
          return "inert";
        case "history":
          return { to: LINK_BACK, transition: overlayScreen ? "overlay" : "pop", rule: "back" };
        case "next": {
          if (overlayScreen) return { to: LINK_BACK, transition: "overlay", rule: "back" };
          const next = kept[at + 1];
          return next ? { to: next.id, transition: nav.transition, rule: "intent" } : { to: null, needs: "a next screen", transition: nav.transition, rule: "missing" };
        }
        case "after-run": {
          let i = at + 1;
          while (i < kept.length && ONBOARDING_RUN.includes(kept[i]!.spec.archetype)) i++;
          const target = kept[i];
          return target ? { to: target.id, transition: nav.transition, rule: "intent" } : { to: null, needs: "a screen after onboarding", transition: nav.transition, rule: "missing" };
        }
        case "post-auth": {
          const target = firstOf(POST_AUTH);
          return target ? { to: target, transition: nav.transition, rule: "intent" } : { to: null, needs: "Home", transition: nav.transition, rule: "missing" };
        }
        case "archetype": {
          const target = firstOf([nav.archetype]);
          if (target) return { to: target, transition: h.tab ? "none" : nav.transition, rule: "intent" };
          if (h.tab) return null;
          return { to: null, needs: archetypeName(nav.archetype), transition: nav.transition, rule: "missing" };
        }
        case "overlay": {
          // The menu archetype is the drawer; any other overlay is a kept screen that draws it.
          const target = kept.find((s) => (nav.component === "drawer" && s.spec.archetype === "menu") || s.spec.slots.some((x) => x.block === nav.component && x.slot === "overlay"));
          const needs = nav.component === "drawer" ? archetypeName("menu") : words(nav.component);
          return target ? { to: target.id, transition: "overlay", rule: "intent" } : { to: null, needs, transition: "overlay", rule: "missing" };
        }
      }
    };

    const decided = spots.map((h) => ({ h, d: decide(h) }));
    // Rule 4, per nav: its unplaced items take the top-level screens none of its items reach, in order.
    for (const slot of new Set(decided.filter(({ h, d }) => h.tab && d === null).map(({ h }) => h.slot))) {
      const items = decided.filter(({ h }) => h.slot === slot && h.tab).sort((a, b) => a.h.tab! - b.h.tab!);
      const claimed = new Set(items.map(({ d }) => (d && d !== "inert" ? d.to : null)).filter(Boolean));
      const free = topLevel.filter((id) => !claimed.has(id));
      for (const entry of items) {
        if (entry.d !== null) continue;
        const target = free.shift();
        const nav = INTENT_BY_ID.get(entry.h.intent!)!.nav;
        entry.d = target
          ? { to: target, transition: "none", rule: "tab" }
          : { to: null, needs: nav.to === "archetype" ? archetypeName(nav.archetype) : words(entry.h.intent!), transition: "none", rule: "missing" };
      }
    }

    for (const { h, d } of decided) {
      const label = h.kind === "row" ? "Row" : h.kind === "leading" ? (INTENT_BY_ID.get(h.intent!)?.label ?? "Back") : (INTENT_BY_ID.get(h.intent!)?.label ?? h.element);
      const base = { from: screen.id, key: h.key, label, ...(h.intent ? { intent: h.intent } : {}), ...(h.tab ? { nav: true as const } : {}) };
      const override = screen.overrides?.[h.key];
      if (override !== undefined) {
        if (override === LINK_NONE) {
          if (opts.withNone) out.push({ ...base, to: null, transition: "none", rule: "override" });
          continue;
        }
        if (override === LINK_BACK) {
          out.push({ ...base, to: LINK_BACK, transition: "pop", rule: "override" });
          continue;
        }
        out.push(ids.has(override)
          ? { ...base, to: override, transition: "push", rule: "override" }
          : { ...base, to: null, needs: `a screen not in the prototype (${override})`, transition: "push", rule: "override" });
        continue;
      }
      if (d === "inert" || d === null) continue;
      out.push({ ...base, ...d });
    }
  });
  return out;
}

/** The links between two kept screens — what the canvas would draw as lines, once per pair. */
export function screenEdges(links: readonly WireLink[]): Array<{ from: string; to: string }> {
  const seen = new Set<string>();
  const out: Array<{ from: string; to: string }> = [];
  for (const l of links) {
    if (!l.to || l.to === LINK_BACK || l.to === l.from) continue;
    const k = `${l.from}>${l.to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ from: l.from, to: l.to });
  }
  return out;
}

/** The screen a prototype opens on: the first kept welcome or sign-in, else the first kept screen. */
export function startScreen(kept: readonly WireScreen[]): string | null {
  return (kept.find((s) => ["welcome", "sign-in"].includes(s.spec.archetype)) ?? kept[0])?.id ?? null;
}
