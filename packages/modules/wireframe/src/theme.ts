import { contrastRatio, CONTRAST_BODY, resolveToken, type DesignDoc, type DesignTokens } from "@isocan/core";
import { chosenOption, type JevQuestion, type JevRequest, type JevResponse } from "./answerer.ts";

/**
 * **Style — the default wire, or your design system** (design §9).
 *
 * The spec says *what* is on a screen; a theme says how it looks. The wire
 * stylesheet (`render.ts`) reads eleven **roles** as CSS custom properties
 * (`var(--w-primary)`) and nothing else, so one spec draws in the default
 * greys or in a design system's colours, type and corners without a single
 * block knowing which. The blueprint never takes a theme: blue means *still
 * being drawn*, in every system.
 *
 * Mapping a system's tokens onto the roles is a typed choice — *which of
 * these colours is the primary action?* — asked of an answerer (Jev) over the
 * system's own token names. The answer is argmax; a role whose answer is
 * under 0.5 keeps the default and says so; nothing is ever a value the
 * system does not hold. The resolved mapping lives in the spec (`style`), so
 * a screen records which system and which version drew it.
 */

export const COLOR_ROLES = ["ground", "surface", "line", "ink", "ink-muted", "bar", "primary", "on-primary"] as const;
export const SCALE_ROLES = ["radius", "font", "space"] as const;
export const ROLES = [...COLOR_ROLES, ...SCALE_ROLES] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
export type ScaleRole = (typeof SCALE_ROLES)[number];
export type Role = (typeof ROLES)[number];

/**
 * **The default theme** — the IDEO greys the wires have always drawn in, as
 * values of the roles. The only place in this module a wire's colour is
 * written literally (`theme.test.ts` holds the stylesheet to that).
 */
export const DEFAULT_THEME: Readonly<Record<Role, string>> = {
  ground: "#ffffff",
  surface: "#ececec",
  line: "#c8c8c8",
  ink: "#222222",
  "ink-muted": "#555555",
  bar: "#dcdcdc",
  primary: "#222222",
  "on-primary": "#ffffff",
  radius: "8px",
  font: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  space: "8px",
};

/** What one role resolved to, and why. */
export interface RoleChoice {
  /** The system's token that supplied the value; absent when the default was kept. */
  token?: string;
  value: string;
  /** The answerer's probability for its pick; absent when there was nothing to ask. */
  p?: number;
  /**
   * - `asked`: the answerer chose `token` at `p` ≥ 0.5.
   * - `only`: the system holds one candidate, taken directly.
   * - `unsure`: the answerer's pick (`leaned`) was under 0.5 — the default is kept.
   * - `none`: the system holds no candidate for this role — the default is kept.
   * - `contrast`: on-primary was under 4.5:1 against primary; `token` is the
   *   system's ink or ground that reads better, `leaned` what was chosen.
   */
  why: "asked" | "only" | "unsure" | "none" | "contrast";
  leaned?: string;
}

export type WireStyle =
  | { source: "default" }
  | {
      source: "design-system";
      /** The DESIGN.md item. */
      itemId: string;
      /** The version of it the mapping was made from — how a wire knows it is behind. */
      versionId: string;
      /** The system's own name, for people reading the spec. */
      name?: string;
      /**
       * Who answered the mapping (`jev-1.13.0`, `stub (seed 1)`); absent when
       * every role had one candidate or none and nothing was asked. A stub's
       * mapping is never lent to a run that has Jev — it knew nothing.
       */
      by?: string;
      roles: Partial<Record<Role, RoleChoice>>;
    };

export const DEFAULT_STYLE: WireStyle = { source: "default" };

// ---------- values that may reach a stylesheet

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FN_COLOR = /^(?:rgba?|hsla?|oklch|oklab|lab|lch)\([\d.,%\s/+\-a-z]*\)$/i;
const LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em)$/;
const FONT = /^[\w\s,'"\-.]+$/;

/**
 * Is this value safe to write as a role? A DESIGN.md is a collaborator's
 * file, and its values land in a `<style>`: a colour is a hex or a colour
 * function, a length is a number with a unit, a font is a family list —
 * nothing that could close a rule or a tag.
 */
export function safeRoleValue(role: Role, value: unknown): value is string {
  if (typeof value !== "string" || value.length > 200) return false;
  if (role === "radius" || role === "space") return LENGTH.test(value);
  if (role === "font") return FONT.test(value) && !value.includes("--");
  return HEX.test(value) || FN_COLOR.test(value);
}

/** Every way a `style` can be wrong, in words — empty when it draws. */
export function styleProblems(input: unknown): string[] {
  const s = input as Partial<WireStyle> & Record<string, unknown> | null;
  if (!s || typeof s !== "object") return ["style must be { source: \"default\" } or { source: \"design-system\", … }"];
  if (s.source === "default") return [];
  if (s.source !== "design-system") return [`style.source must be "default" or "design-system"`];
  const problems: string[] = [];
  if (typeof s.itemId !== "string" || !s.itemId) problems.push("style.itemId must be the DESIGN.md item's id");
  if (typeof s.versionId !== "string" || !s.versionId) problems.push("style.versionId must be the DESIGN.md version it was mapped from");
  if (s.name !== undefined && typeof s.name !== "string") problems.push("style.name must be a string");
  if (s.by !== undefined && typeof s.by !== "string") problems.push("style.by must be a string");
  const roles = s.roles as Record<string, unknown> | undefined;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return [...problems, "style.roles must be an object"];
  for (const [role, choice] of Object.entries(roles)) {
    if (!(ROLES as readonly string[]).includes(role)) {
      problems.push(`style.roles: "${role}" is not a role (${ROLES.join(", ")})`);
      continue;
    }
    const c = choice as Partial<RoleChoice> | null;
    if (!c || typeof c !== "object") problems.push(`style.roles.${role} must be { value, why }`);
    else if (!safeRoleValue(role as Role, c.value)) problems.push(`style.roles.${role}.value is not a ${role === "font" ? "font family list" : role === "radius" || role === "space" ? "length" : "colour"} a stylesheet can hold`);
    else if (c.p !== undefined && !(typeof c.p === "number" && c.p >= 0 && c.p <= 1)) problems.push(`style.roles.${role}.p must be 0–1`);
  }
  return problems;
}

/** The value every role draws with under this style: the default, under whatever the style resolved. */
export function themeValues(style: WireStyle | undefined): Record<Role, string> {
  const out = { ...DEFAULT_THEME };
  if (style?.source === "design-system") {
    for (const role of ROLES) {
      const v = style.roles[role]?.value;
      if (v !== undefined && safeRoleValue(role, v)) out[role] = v;
    }
  }
  return out;
}

/**
 * **Derived roles** — computed from the roles, never mapped. `link` is the
 * colour of words drawn in the primary's voice straight on the ground (a text
 * link, a secondary or tertiary button's label, the on-tab): the primary where
 * it reads on the ground at 4.5:1, else the ink (Porchlight's amber on cream
 * was 2.05:1, the pair `design check` itself flags). The on-primary guard
 * covers words ON the primary; this covers words IN it.
 */
export const DERIVED_ROLES = ["link"] as const;

/** The colour of primary-voiced words on the ground: the primary if it reads there (≥ 4.5:1), else the ink. */
export function linkColor(values: Pick<Record<Role, string>, "primary" | "ground" | "ink">): string {
  const ratio = contrastRatio(values.primary, values.ground);
  return ratio === null || ratio >= CONTRAST_BODY ? values.primary : values.ink;
}

/** The custom properties a style sets, as declarations: `--w-primary:#d10a72;…`, then the derived ones. */
export function themeDecls(style: WireStyle | undefined): string {
  const values = themeValues(style);
  return [...ROLES.map((role) => `--w-${role}:${values[role]}`), `--w-link:${linkColor(values)}`].join(";");
}

/** Two styles draw identically: every role, and so every derived one, resolves to the same value. */
export function sameLook(a: WireStyle | undefined, b: WireStyle | undefined): boolean {
  return themeDecls(a) === themeDecls(b);
}

/** Two styles draw the same and record the same system version. Absent is the default. */
export function sameStyle(a: WireStyle | undefined, b: WireStyle | undefined): boolean {
  return canonical(a ?? DEFAULT_STYLE) === canonical(b ?? DEFAULT_STYLE);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
}

// ---------- the mapping question

/** One thing a role could be: a token of the system, and the value it holds. */
export interface Candidate {
  token: string;
  value: string;
  /** Where in the system it lives: `colors`, `typography`, `rounded`, `spacing`. */
  group: string;
}

/** Per role, what the system offers — only values a stylesheet can safely hold. */
export type Candidates = Record<Role, Candidate[]>;

function resolved(tokens: DesignTokens, value: unknown): unknown {
  return typeof value === "string" && /^\{[^}]+\}$/.test(value.trim()) ? resolveToken(tokens, value) : value;
}

/** What a design system offers each role: its colours to every colour role, its families, radii and spacing. */
export function candidatesOf(doc: DesignDoc): Candidates {
  const t = doc.tokens;
  const colors: Candidate[] = [];
  for (const [token, raw] of Object.entries(t.colors ?? {})) {
    const value = resolved(t, raw);
    if (typeof value === "string" && safeRoleValue("primary", value.trim())) colors.push({ token, value: value.trim(), group: "colors" });
  }
  const fonts: Candidate[] = [];
  for (const [token, type] of Object.entries(t.typography ?? {})) {
    const value = resolved(t, type?.fontFamily);
    if (typeof value !== "string" || !safeRoleValue("font", value.trim())) continue;
    // One option per family: a system of seven type styles in one face offers one face.
    if (!fonts.some((f) => f.value === value.trim())) fonts.push({ token, value: value.trim(), group: "typography" });
  }
  const lengths = (group: "rounded" | "spacing", role: "radius" | "space"): Candidate[] => {
    const out: Candidate[] = [];
    for (const [token, raw] of Object.entries((t[group] ?? {}) as Record<string, unknown>)) {
      const r = resolved(t, raw);
      const value = typeof r === "number" ? `${r}px` : typeof r === "string" ? r.trim() : null;
      if (value && safeRoleValue(role, value)) out.push({ token, value, group });
    }
    return out;
  };
  const out = {} as Candidates;
  for (const role of COLOR_ROLES) out[role] = colors;
  out.font = fonts;
  out.radius = lengths("rounded", "radius");
  out.space = lengths("spacing", "space");
  return out;
}

/** What each role is for, in the words the answerer is asked. */
export const ROLE_QUESTIONS: Readonly<Record<Role, string>> = {
  ground: "Which of this design system's colours is the background a screen sits on — the ground behind everything else?",
  surface: "Which colour fills quiet areas inside a screen, one step off the background: image placeholders, avatars, an inactive toggle, a selected navigation row, dividers between list rows?",
  line: "Which colour draws borders and outlines: the edge of a text field, a card, a chip, an image placeholder?",
  ink: "Which colour is body text and headings?",
  "ink-muted": "Which colour is secondary text: field labels, captions, metadata, inactive tab labels?",
  bar: "Which colour stands for a line of placeholder copy in a wireframe — a quiet bar that reads as text without being text: lighter than secondary text, darker than the background?",
  primary: "Which colour is the primary action: the filled primary button, the floating action button, the selected tab?",
  "on-primary": "Which colour is the text and icon drawn ON the primary action colour — the label of the filled primary button?",
  radius: "Which corner radius do buttons, text fields and cards use?",
  font: "Which typeface is body text and interface labels set in?",
  space: "Which spacing token is the base unit — the small gap between related elements that larger spacing is built from?",
};

/** A component's rules, where they name a token — the evidence a person reading the system would use. */
function componentUsage(t: DesignTokens): string[] {
  return Object.entries(t.components ?? {}).map(([name, rules]) =>
    `${name}: ${Object.entries(rules ?? {}).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}

/**
 * **The mapping, as one request in Jev's shape.** One `choice` per role
 * that has more than one candidate, over the system's own token names; the
 * state carries each token's name, value and group, the system's name and
 * description, and how its components use the tokens. A role with one
 * candidate or none asks nothing.
 */
export function mappingRequest(doc: DesignDoc, candidates: Candidates = candidatesOf(doc)): JevRequest {
  const t = doc.tokens;
  const questions: Record<string, JevQuestion> = {};
  for (const role of ROLES) {
    const options = candidates[role];
    if (options.length < 2) continue;
    questions[role] = {
      type: "choice",
      instructions: ROLE_QUESTIONS[role],
      criteria: Object.fromEntries(options.map((c) => [c.token, `${c.value} (${c.group}.${c.token})`])),
    };
  }
  const state = {
    task: "Map a design system's tokens onto the roles a greyscale wireframe draws with, so every wire can be restyled in this system. Choose only among the tokens offered.",
    system: t.name ?? "(unnamed)",
    ...(t.description ? { description: t.description.length > 600 ? `${t.description.slice(0, 599)}…` : t.description } : {}),
    tokens: [
      ...candidates.primary.map(({ token, value, group }) => ({ token, value, group })),
      ...candidates.font.map(({ token, value, group }) => ({ token, value, group })),
      ...candidates.radius.map(({ token, value, group }) => ({ token, value, group })),
      ...candidates.space.map(({ token, value, group }) => ({ token, value, group })),
    ],
    components: componentUsage(t),
  };
  return { model: "jev-latest", state, questions };
}

/** The answer's pick is honest when it is at least this likely; under it, the default stays. */
export const ROLE_CONFIDENCE = 0.5;

/**
 * **Apply the answers.** Argmax per role; under 0.5 (or tied with another
 * token) the default is kept and the pick recorded as `leaned`; a role with one candidate takes it; a role
 * with none keeps the default. Then the contrast guard: on-primary under
 * 4.5:1 against primary becomes whichever of ink or ground reads better.
 * Throws if an answer names a token the request never offered — never a
 * value outside the system.
 */
export function applyMapping(request: JevRequest, response: JevResponse, candidates: Candidates): Partial<Record<Role, RoleChoice>> {
  const roles: Partial<Record<Role, RoleChoice>> = {};
  for (const role of ROLES) {
    const options = candidates[role];
    if (options.length === 0) {
      roles[role] = { value: DEFAULT_THEME[role], why: "none" };
      continue;
    }
    if (options.length === 1) {
      roles[role] = { token: options[0]!.token, value: options[0]!.value, why: "only" };
      continue;
    }
    const q = request.questions[role];
    const a = response.answers[role];
    if (!q || !a) throw new Error(`the mapping has no answer for ${role}`);
    const { value: token, p, distribution } = chosenOption(q, a);
    const picked = options.find((c) => c.token === token);
    if (!picked) throw new Error(`the answer for ${role} is "${token}", which this system does not offer (${options.map((c) => c.token).join(", ")})`);
    const rounded = Math.round(p * 1000) / 1000;
    // A tie is not a choice: two tokens at 0.5 each is a coin, however the threshold reads.
    const tied = Object.entries(distribution).some(([k, v]) => k !== token && v >= p);
    roles[role] = rounded >= ROLE_CONFIDENCE && !tied
      ? { token, value: picked.value, p: rounded, why: "asked" }
      : { value: DEFAULT_THEME[role], p: rounded, why: "unsure", leaned: token };
  }
  return guardContrast(roles);
}

/** On-primary must read on primary: under 4.5:1 it becomes the better of ink and ground, if either is better. */
export function guardContrast(roles: Partial<Record<Role, RoleChoice>>): Partial<Record<Role, RoleChoice>> {
  const value = (role: Role) => roles[role]?.value ?? DEFAULT_THEME[role];
  const primary = value("primary");
  const on = value("on-primary");
  const now = contrastRatio(primary, on);
  if (now === null || now >= CONTRAST_BODY) return roles;
  const better = (["ink", "ground"] as const)
    .map((role) => ({ role, ratio: contrastRatio(primary, value(role)) ?? 0 }))
    .sort((a, b) => b.ratio - a.ratio)[0]!;
  if (better.ratio <= now) return roles;
  const from = roles[better.role];
  const was = roles["on-primary"];
  return {
    ...roles,
    "on-primary": {
      ...(from?.token ? { token: from.token } : {}),
      value: value(better.role),
      ...(was?.p !== undefined ? { p: was.p } : {}),
      why: "contrast",
      ...(was?.token ? { leaned: was.token } : was?.leaned ? { leaned: was.leaned } : {}),
    },
  };
}

/** One role's line, for a person: `primary     accent        #d10a72  p 0.91`. */
export function roleLine(role: Role, c: RoleChoice | undefined): string {
  if (!c) return `${role.padEnd(11)} (default) ${DEFAULT_THEME[role]}`;
  const p = c.p === undefined ? "" : `p ${c.p.toFixed(2)}`;
  const note =
    c.why === "only" ? "the only one" :
    c.why === "none" ? "the system has none — default kept" :
    c.why === "unsure" ? `unsure (leaned ${c.leaned}) — default kept` :
    c.why === "contrast" ? `raised for contrast (chosen: ${c.leaned ?? "default"})` : "";
  return `${role.padEnd(11)} ${(c.token ?? "(default)").padEnd(16)} ${c.value.length > 40 ? `${c.value.slice(0, 39)}…` : c.value}  ${[p, note].filter(Boolean).join(" · ")}`;
}
