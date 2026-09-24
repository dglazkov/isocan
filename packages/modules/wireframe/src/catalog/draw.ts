import type { PropDef, Props } from "./types.ts";
import { pictogram } from "../content/pictograms.ts";

/**
 * **The renderer's pen** — the few marks every primitive and block is drawn
 * with. Greyscale only: the classes here are styled by `WIRE_CSS` in
 * `render.ts`, which holds no blue, so a resolved slot cannot come out in the
 * skeleton palette by accident.
 *
 * Body copy is a bar until the screen is fleshed. Unfleshed, the only words
 * a wireframe carries are an intent's label, the screen's title, and the
 * name of a typed thing (a field's kind, an error's kind) — each of which
 * somebody chose from a list. Fleshed (design §10), the slot's `fill` draws
 * through the text helpers at the end of this file: sample words from a
 * pack, or an agent's exact copy — escaped here, never markup.
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

/** `hot` is a `DrawContext.hot(...)` attribute, when the button is an actionable element. */
export function btn(label: string, variant: Variant = "primary", cls = "", hot = ""): string {
  return `<span class="btn ${variant}${cls ? ` ${cls}` : ""}"${hot}>${label}</span>`;
}

const GLYPHS: Record<string, string> = {
  home: "⌂", search: "⌕", notifications: "◔", messages: "✉", profile: "◯", settings: "⚙", cart: "⊞",
  help: "?", contact: "☏", terms: "§", upgrade: "↑", checkout: "✓", buy: "✓", like: "♡", share: "↗",
  more: "⋯", menu: "≡", info: "i", filter: "▽", add: "+", edit: "✎", delete: "✕", close: "✕", back: "‹",
  cancel: "✕", dismiss: "✕", follow: "+", play: "▶", copy: "⧉", upload: "↑", retry: "↻", sort: "⇅",
  select: "✓", open: "›", "open-list": "▤", "open-feed": "◫", "open-gallery": "▦",
};

export function glyph(intent: string): string {
  return GLYPHS[intent] ?? "•";
}

/** An icon button: the intent's glyph, with its label for anyone reading rather than looking. */
export function ibtn(intent: string, label: string, hot = ""): string {
  return `<span class="ibtn" title="${label}" aria-label="${label}"${hot}>${glyph(intent)}</span>`;
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

/**
 * A labelled field. `label` is a typed name (Email, Password) or null for a
 * bar; `value`, when the screen is fleshed, is its sample value (escaped
 * here) in place of the placeholder bar.
 */
export function field(label: string | null, offset = 0, value?: string): string {
  return `<div class="fld">${label ? `<span class="lbl">${label}</span>` : bar(30 + (offset % 3) * 8, "lbl-bar")}<div class="box">${value !== undefined ? `<span class="val">${esc(value)}</span>` : bar(40 + (offset % 4) * 10, "ph")}</div></div>`;
}

export function check(label: string, hot = ""): string {
  return `<div class="chk"${hot}><span class="cb"></span>${label}</div>`;
}

export function chip(on = false, label?: string): string {
  return `<span class="chip${on ? " on" : ""}">${label !== undefined ? esc(label) : bar(100, "in")}</span>`;
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

// ---------- fleshed content (design §10) — every string escaped here

/** Words: `k` a key line, `meta` a quiet one, `body` wrapping copy, `title`, `big`, `lbl`. */
export function tx(text: string, cls = "", tag: "span" | "div" = "div"): string {
  return `<${tag} class="tx${cls ? ` ${cls}` : ""}">${esc(text)}</${tag}>`;
}

/** An image slot with a pictogram in it instead of the crossed box. */
export function pic(motif: string, ratio = "4/3", cls = ""): string {
  return `<div class="img pic${cls ? ` ${cls}` : ""}" style="aspect-ratio:${ratio}">${pictogram(motif)}</div>`;
}

/** A small square with a pictogram: a list's thumbnail or icon. */
export function thumbPic(motif: string, cls = "thumb"): string {
  return `<span class="${cls} pic">${pictogram(motif)}</span>`;
}

/** A person's initials, from their name: "Priya S." → "PS". */
export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** An avatar that carries a person's initials. */
export function avatarOf(name: string | undefined, size: "s" | "m" | "l" = "m"): string {
  return name ? `<span class="av ${size} ini">${esc(initialsOf(name))}</span>` : avatar(size);
}

/** A status, drawn as a small tag. */
export function statusTag(status: string): string {
  return `<span class="st">${esc(status)}</span>`;
}

/** The i-th of a list, cycling — a fill written for fewer rows than the props now draw still fills them all. */
export function nth<T>(list: readonly T[] | undefined, i: number): T | undefined {
  return list && list.length > 0 ? list[i % list.length] : undefined;
}

/** `a · b`, leaving out what is missing. */
export function dot(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => Boolean(p)).join(" · ");
}
