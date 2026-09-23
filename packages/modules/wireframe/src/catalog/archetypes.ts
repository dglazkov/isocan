import type { IntentId } from "./intents.ts";
import type { Platform, Props } from "./types.ts";

/**
 * **Wave 1's 18 archetype recipes** (research §2).
 *
 * A recipe is the tree Jev cannot write. Each is transcribed below in the
 * research's own notation — `region: a → b? → (c | d)` — and parsed, rather
 * than re-typed as nested objects, so the table in the research and the
 * table here can be read side by side and disagree visibly.
 *
 * Notation: `;` separates regions; `→` sequences sections within a region;
 * `a | b` is one choice; a trailing `?` makes a section optional (one
 * yes/no); a region whose whole body is `a | b` without parentheses is one
 * choice section.
 */

export type Region = "shell" | "header" | "nav" | "main" | "aside" | "footer" | "fab" | "overlay";

export interface Section {
  /** Stable within the recipe: the region alone, or `region.n` when a region holds several. */
  slot: string;
  region: Region;
  /** Component ids — one for a fixed or optional section, two to four for a choice. */
  options: string[];
  optional: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  platforms: Platform[];
  sections: Section[];
  /** Per-archetype defaults for an element's intent, keyed by component then element. */
  intents?: Record<string, Record<string, IntentId>>;
  /**
   * Per-archetype prop defaults, keyed by component — what this screen's
   * place in a flow already settles. Home is a top-level screen, so its app
   * bar has no Back chevron; the component's own default (`back`) is right
   * for a pushed screen and wrong here. They sit under whatever a spec
   * chooses, and the composer does not ask about a prop a recipe sets.
   */
  props?: Record<string, Props>;
}

/**
 * Every archetype the research names, all three waves, so an intent can
 * point at a screen that is not built yet (`upgrade` → `pricing`). Only
 * wave 1 has recipes here.
 */
export const ARCHETYPE_IDS = [
  "welcome", "onboarding", "sign-in", "sign-up", "verify", "home", "list", "gallery", "detail", "form",
  "settings", "menu", "profile", "feed", "search", "confirm", "state", "legal",
  "storefront", "cart", "checkout", "order-placed", "pricing", "landing", "about", "contact", "blog", "master-detail",
  "chat", "notifications", "player", "map", "editor", "comments",
] as const;

const WAVE_1: Array<Omit<Recipe, "sections"> & { recipe: string }> = [
  {
    id: "welcome", title: "Welcome", platforms: ["app"],
    recipe: "main: image → heading → text? → (button | button-group) → link?",
    intents: { button: { action: "get-started" }, "button-group": { "button-1": "get-started", "button-2": "sign-in" }, link: { action: "sign-in" } },
  },
  {
    id: "onboarding", title: "Onboarding", platforms: ["app"],
    recipe: "main: onboarding-step | wizard; footer: (page-indicator | steps) → (button | button-group)",
    intents: { button: { action: "next" }, "button-group": { "button-1": "next", "button-2": "skip" } },
  },
  {
    id: "sign-in", title: "Sign in", platforms: ["app", "site"],
    recipe: "header: (app-bar | navbar)?; main: image? → heading → sign-in-form; footer: link?",
    intents: { link: { action: "sign-up" } },
  },
  {
    id: "sign-up", title: "Sign up", platforms: ["app", "site"],
    recipe: "header: app-bar?; main: heading → (sign-up-form | wizard); footer: link?",
    intents: { link: { action: "sign-in" }, wizard: { next: "continue" } },
  },
  {
    id: "verify", title: "Verify", platforms: ["app", "site"],
    recipe: "header: app-bar; main: verify-code | forgot-password",
  },
  {
    id: "home", title: "Home", platforms: ["app", "web"],
    recipe: "shell: app-shell; header: app-bar | page-header; nav: tab-bar | side-nav; main: stats-row? → chart? → (data-table | stacked-list | card-grid | feed-post); aside: (filter-panel | stacked-list)?",
    intents: { "app-bar": { "action-1": "notifications", "action-2": "search", "action-3": "add" } },
    props: { "app-bar": { leading: "none" } },
  },
  {
    id: "list", title: "List", platforms: ["app", "web"],
    recipe: "header: app-bar | page-header; nav: (tab-bar | side-nav)?; main: search-field? → (chip | segmented-control | tabs)? → (stacked-list | card-grid | data-table); fab: fab?",
    intents: { "app-bar": { "action-1": "filter", "action-2": "sort", "action-3": "add" } },
  },
  {
    id: "gallery", title: "Gallery", platforms: ["app", "site"],
    recipe: "header: app-bar | navbar; main: chip? → (card-grid | gallery-section | product-card-list)",
    intents: { "app-bar": { "action-1": "search", "action-2": "filter", "action-3": "share" } },
  },
  {
    id: "detail", title: "Detail", platforms: ["app", "web"],
    recipe: "header: app-bar; main: detail-header → (text | long-form | description-list) → (comment-list | card-grid)?; footer: (button | button-group)?",
    intents: { "app-bar": { "action-1": "share", "action-2": "more", "action-3": "edit" }, button: { action: "edit" }, "button-group": { "button-1": "edit", "button-2": "delete" } },
  },
  {
    id: "form", title: "Form", platforms: ["app", "web"],
    recipe: "header: app-bar | page-header; main: form-block | wizard; footer: button | button-group",
    intents: { "app-bar": { "action-1": "info", "action-2": "more", "action-3": "help" }, button: { action: "save" }, "button-group": { "button-1": "save", "button-2": "cancel" } },
  },
  {
    id: "settings", title: "Settings", platforms: ["app", "web"],
    recipe: "header: app-bar | page-header; nav: side-nav?; main: profile-header? → (settings-group | form-block)",
    intents: { "app-bar": { "action-1": "help", "action-2": "more", "action-3": "info" }, "page-header": { "action-1": "save", "action-2": "help", "action-3": "more" } },
  },
  {
    id: "menu", title: "Menu", platforms: ["app"],
    recipe: "main: profile-header? → list; overlay: drawer | sheet",
  },
  {
    id: "profile", title: "Profile", platforms: ["app", "web"],
    recipe: "header: app-bar; main: profile-header → (tabs | segmented-control)? → (card-grid | stacked-list | feed-post)",
    intents: { "app-bar": { "action-1": "settings", "action-2": "share", "action-3": "more" } },
  },
  {
    id: "feed", title: "Feed", platforms: ["app"],
    recipe: "header: app-bar; nav: tab-bar; main: (tabs | chip)? → (feed-post | blog-list); fab: fab?",
    intents: { "app-bar": { "action-1": "messages", "action-2": "notifications", "action-3": "search" } },
    props: { "app-bar": { leading: "none" } },
  },
  {
    id: "search", title: "Search", platforms: ["app", "web"],
    recipe: "header: search-field; main: chip? → (stacked-list | card-grid | empty-state); aside: filter-panel?",
  },
  {
    id: "confirm", title: "Confirm", platforms: ["app", "web"],
    recipe: "overlay: confirm-dialog | sheet | modal",
  },
  {
    id: "state", title: "Status", platforms: ["app", "web"],
    recipe: "main: empty-state | error-state | success-state",
  },
  {
    id: "legal", title: "Terms", platforms: ["app", "site"],
    recipe: "header: app-bar; main: long-form; footer: button?",
    intents: { button: { action: "accept" }, "app-bar": { "action-1": "share", "action-2": "info", "action-3": "more" } },
  },
];

const REGIONS: readonly string[] = ["shell", "header", "nav", "main", "aside", "footer", "fab", "overlay"];

/** Parse one recipe line. Throws on anything the notation does not say, so a typo is a failing import, not a silent section. */
export function parseRecipe(text: string): Section[] {
  const sections: Section[] = [];
  for (const part of text.split(";")) {
    const m = /^\s*([a-z]+):\s*(.+?)\s*$/.exec(part);
    if (!m) throw new Error(`recipe part does not read as "region: sequence": ${part}`);
    const region = m[1]!;
    if (!REGIONS.includes(region)) throw new Error(`unknown region "${region}"`);
    const body = m[2]!;
    // A whole-region choice without parentheses: `main: onboarding-step | wizard`.
    const items = body.includes("→") || !body.includes("|") || body.startsWith("(") ? body.split("→") : [body];
    const inRegion: Array<Omit<Section, "slot">> = items.map((raw) => {
      let item = raw.trim();
      const optional = item.endsWith("?");
      if (optional) item = item.slice(0, -1).trim();
      if (item.startsWith("(") && item.endsWith(")")) item = item.slice(1, -1);
      const options = item.split("|").map((o) => o.trim());
      for (const o of options) if (!/^[a-z][a-z-]*$/.test(o)) throw new Error(`"${o}" is not a component id`);
      return { region: region as Region, options, optional };
    });
    inRegion.forEach((s, i) => sections.push({ slot: inRegion.length === 1 ? region : `${region}.${i + 1}`, ...s }));
  }
  return sections;
}

export const RECIPES: Recipe[] = WAVE_1.map(({ recipe, ...rest }) => ({ ...rest, sections: parseRecipe(recipe) }));

export const RECIPE_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));
