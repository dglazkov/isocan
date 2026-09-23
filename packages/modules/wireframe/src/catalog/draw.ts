import type { PropDef, Props } from "./types.ts";

/**
 * **The renderer's pen** — the few marks every primitive and block is drawn
 * with. Greyscale only: the classes here are styled by `WIRE_CSS` in
 * `render.ts`, which holds no blue, so a resolved slot cannot come out in the
 * skeleton palette by accident.
 *
 * Body copy is a bar, never words. The only words a wireframe carries are an
 * intent's label, the screen's title, and the name of a typed thing (a
 * field's kind, an error's kind) — each of which somebody chose from a list.
 */

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Widths that look like lines of text, cycled so a block is stable from one render to the next. */
const WIDTHS = [92, 78, 86, 64, 95, 72, 58, 88, 70, 82];

export function bar(width: number, cls = ""): string {
  return `<i class="bar${cls ? ` ${cls}` : ""}" style="width:${width}%"></i>`;
}

export function bars(n: number, offset = 0, cls = ""): string {
  let out = "";
  for (let i = 0; i < n; i++) out += bar(WIDTHS[(i + offset) % WIDTHS.length]!, cls);
  return out;
}

export type Variant = "primary" | "secondary" | "tertiary" | "destructive";

export function btn(label: string, variant: Variant = "primary", cls = ""): string {
  return `<span class="btn ${variant}${cls ? ` ${cls}` : ""}">${label}</span>`;
}

const GLYPHS: Record<string, string> = {
  home: "⌂", search: "⌕", notifications: "◔", messages: "✉", profile: "◯", settings: "⚙", cart: "⊞",
  help: "?", contact: "☏", terms: "§", upgrade: "↑", checkout: "✓", buy: "✓", like: "♡", share: "↗",
  more: "⋯", menu: "≡", info: "i", filter: "▽", add: "+", edit: "✎", delete: "✕", close: "✕", back: "‹",
  cancel: "✕", dismiss: "✕", follow: "+", play: "▶", copy: "⧉", upload: "↑", retry: "↻", sort: "⇅",
  select: "✓", open: "›",
};

export function glyph(intent: string): string {
  return GLYPHS[intent] ?? "•";
}

/** An icon button: the intent's glyph, with its label for anyone reading rather than looking. */
export function ibtn(intent: string, label: string): string {
  return `<span class="ibtn" title="${label}" aria-label="${label}">${glyph(intent)}</span>`;
}

/** The crossed-box image placeholder the IDEO pack names. */
export function img(ratio = "4/3", cls = ""): string {
  return `<div class="img${cls ? ` ${cls}` : ""}" style="aspect-ratio:${ratio}"></div>`;
}

export function avatar(size: "s" | "m" | "l" = "m"): string {
  return `<span class="av ${size}"></span>`;
}

export function icon(): string {
  return `<span class="ico"></span>`;
}

/** A labelled field. `label` is a typed name (Email, Password) or null for a bar. */
export function field(label: string | null, offset = 0): string {
  return `<div class="fld">${label ? `<span class="lbl">${label}</span>` : bar(30 + (offset % 3) * 8, "lbl-bar")}<div class="box">${bar(40 + (offset % 4) * 10, "ph")}</div></div>`;
}

export function check(label: string): string {
  return `<div class="chk"><span class="cb"></span>${label}</div>`;
}

export function chip(on = false): string {
  return `<span class="chip${on ? " on" : ""}">${bar(100, "in")}</span>`;
}

export function toggle(on: boolean): string {
  return `<span class="tg${on ? " on" : ""}"></span>`;
}

export function heading(title: string, level = 1): string {
  return `<div class="h h${level}">${title}</div>`;
}

export function rowsOf(n: number, fn: (i: number) => string): string {
  let out = "";
  for (let i = 0; i < n; i++) out += fn(i);
  return out;
}

export function num(props: Props, key: string): number {
  return Number(props[key]);
}

export function str(props: Props, key: string): string {
  return String(props[key]);
}

export function flag(props: Props, key: string): boolean {
  return props[key] === true;
}

/** Prop constructors, so the tables below read like the research's tables. */
export const choice = (values: readonly string[], dflt?: string): PropDef => ({ kind: "choice", values, default: dflt ?? values[0]! });
export const yn = (dflt = false): PropDef => ({ kind: "flag", default: dflt });
export const count = (min: number, max: number, dflt?: number): PropDef => ({ kind: "count", min, max, default: dflt ?? min });
export const index = (max: number, dflt = 1): PropDef => ({ kind: "index", max, default: dflt });
