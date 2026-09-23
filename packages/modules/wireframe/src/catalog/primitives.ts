import { ALL_INTENTS, intentsIn, type IntentId } from "./intents.ts";
import type { Component, ElementDef, Props } from "./types.ts";
import {
  avatar, bar, bars, btn, chip, choice, count, esc, flag, glyph, heading, ibtn, icon, img, index, num, rowsOf, str, toggle, yn,
} from "./draw.ts";

/**
 * **The 22 primitives wave 1's recipes name directly** (research §1,
 * *Primitives*, and *Recommendation*). Props are transcribed from the
 * research's tables; where a prop is an intent there, it is an element here,
 * because an intent is not a free value but a choice from the vocabulary.
 *
 * Where the research leaves a prop unspecified this adds nothing: the
 * smallest typed set is the one it lists. Default values are this module's
 * choice — the first value of each enum, the low end of each count, except
 * where the low end would draw nothing honest (a list of three rows reads
 * as a list; a list of one does not).
 */

/** Elements `prefix-1 … prefix-n`, each present while `props[key] >= i` — or, when `key` names a flag, while it is on. */
export function upTo(
  n: number,
  prefix: string,
  key: string,
  accepts: readonly IntentId[],
  defaults: readonly IntentId[],
): Record<string, ElementDef> {
  const out: Record<string, ElementDef> = {};
  for (let i = 1; i <= n; i++) {
    out[`${prefix}-${i}`] = {
      accepts,
      default: defaults[(i - 1) % defaults.length]!,
      when: (p: Props) => (typeof p[key] === "boolean" ? p[key] === true : Number(p[key]) >= i),
    };
  }
  return out;
}

const NAV_JUMPS = intentsIn("jump");
const ACTIONS = [...intentsIn("form", "overlay", "jump")];
const PRIMARY = [...intentsIn("forward", "auth", "form", "jump")];

const ratio = (r: string) => r.replace(":", "/");

export const PRIMITIVES: Component[] = [
  // ---- display
  {
    id: "image", kind: "primitive", category: "display", namedBy: 10, h: 180,
    props: { kind: choice(["photo", "illustration", "logo"]), ratio: choice(["1:1", "4:3", "16:9", "3:4"], "4:3"), caption: yn() },
    draw: ({ props }) => {
      const logo = str(props, "kind") === "logo";
      return `<div class="${logo ? "logo" : ""}">${img(logo ? "1/1" : ratio(str(props, "ratio")), logo ? "sm" : "")}${flag(props, "caption") ? bar(40, "cap") : ""}</div>`;
    },
  },
  {
    id: "heading", kind: "primitive", category: "display", namedBy: 6, h: 44,
    props: { level: count(1, 4, 1), align: choice(["start", "center"]) },
    draw: ({ props, title }) => `<div style="text-align:${str(props, "align") === "center" ? "center" : "left"}">${heading(title, num(props, "level"))}</div>`,
  },
  {
    id: "text", kind: "primitive", category: "display", namedBy: 8, h: 72,
    props: { lines: count(1, 8, 3), size: choice(["s", "m", "l"], "m"), style: choice(["body", "caption", "quote"]), redacted: yn(true) },
    draw: ({ props }) => `<div class="txt ${str(props, "size")} ${str(props, "style")}">${bars(num(props, "lines"))}</div>`,
  },
  {
    id: "description-list", kind: "primitive", category: "display", namedBy: 2, h: 160,
    props: { pairs: count(2, 10, 4), layout: choice(["stacked", "inline"]) },
    draw: ({ props }) => `<dl class="dlist ${str(props, "layout")}">${rowsOf(num(props, "pairs"), (i) => `<div>${bar(30 + (i % 3) * 6, "k")}${bar(50 + (i % 4) * 9)}</div>`)}</dl>`,
  },
  {
    id: "chip", kind: "primitive", category: "display", namedBy: 3, h: 40,
    props: { count: count(1, 8, 4), selectable: yn(true), removable: yn() },
    draw: ({ props }) => `<div class="chips">${rowsOf(num(props, "count"), (i) => chip(flag(props, "selectable") && i === 0))}</div>`,
  },
  {
    id: "list", kind: "primitive", category: "display", namedBy: 7, h: 320,
    props: {
      rows: count(3, 12, 6),
      leading: choice(["none", "icon", "avatar", "thumbnail", "checkbox"], "icon"),
      trailing: choice(["none", "chevron", "switch", "meta", "badge"], "chevron"),
      lines: count(1, 3, 1),
      dividers: yn(true),
    },
    draw: ({ props }) => listRows(props),
  },
  // ---- input
  {
    id: "button", kind: "primitive", category: "input", namedBy: 9, h: 48,
    props: {
      variant: choice(["primary", "secondary", "tertiary", "destructive"]),
      size: choice(["s", "m", "l"], "m"),
      icon: choice(["none", "leading", "only"]),
      state: choice(["default", "disabled", "loading"]),
    },
    elements: { action: { accepts: ALL_INTENTS, default: "continue" } },
    draw: ({ props, label, intent, hot }) => {
      const only = str(props, "icon") === "only";
      const lead = str(props, "icon") === "leading" ? `${glyph(intent("action"))} ` : "";
      const inner = only ? glyph(intent("action")) : `${lead}${label("action")}`;
      return `<div class="actions">${btn(inner, str(props, "variant") as never, `${str(props, "size")} ${str(props, "state")} block`, hot("action"))}</div>`;
    },
  },
  {
    id: "button-group", kind: "primitive", category: "input", namedBy: 4, h: 104,
    props: { count: count(2, 4, 2), variant: choice(["primary-first", "equal"]) },
    elements: upTo(4, "button", "count", PRIMARY.concat(intentsIn("back", "overlay", "in-place")), ["continue", "cancel", "more", "help"]),
    draw: ({ props, label, hot }) => `<div class="actions stack">${rowsOf(num(props, "count"), (i) =>
      btn(label(`button-${i + 1}`), i === 0 || str(props, "variant") === "equal" ? (i === 0 ? "primary" : "secondary") : "tertiary", "block", hot(`button-${i + 1}`)))}</div>`,
  },
  {
    id: "link", kind: "primitive", category: "navigation", namedBy: 5, h: 32,
    props: {},
    elements: { action: { accepts: ALL_INTENTS, default: "help" } },
    draw: ({ label, hot }) => `<div class="link-row"><span class="lnk"${hot("action")}>${label("action")}</span></div>`,
  },
  {
    id: "search-field", kind: "primitive", category: "navigation", namedBy: 6, h: 56,
    props: { scope: yn(), state: choice(["empty", "typing", "filled"]) },
    draw: ({ props }) =>
      `<div class="search"><span class="ico-t">${glyph("search")}</span>${str(props, "state") === "empty" ? `<span class="ph-t">Search</span>` : bar(45, "in")}${flag(props, "scope") ? `<span class="scope">${bar(100, "in")}</span>` : ""}</div>`,
  },
  {
    id: "segmented-control", kind: "primitive", category: "input", namedBy: 4, h: 44,
    props: { count: count(2, 5, 3), selected: index(5) },
    draw: ({ props }) => `<div class="seg">${rowsOf(num(props, "count"), (i) => `<span class="${i + 1 === sel(props, "selected", "count") ? "on" : ""}">${bar(60, "in")}</span>`)}</div>`,
  },
  {
    id: "fab", kind: "primitive", category: "input", namedBy: 2, h: 64,
    props: { extended: yn() },
    elements: { action: { accepts: [...intentsIn("form"), "upload", "share", "messages", "search"], default: "add" } },
    draw: ({ props, label, intent, hot }) => `<div class="fab-wrap"><span class="fab${flag(props, "extended") ? " ext" : ""}"${hot("action")}>${glyph(intent("action"))}${flag(props, "extended") ? ` ${label("action")}` : ""}</span></div>`,
  },
  // ---- navigation
  {
    id: "app-bar", kind: "primitive", category: "navigation", namedBy: 3, h: 56,
    props: { title: yn(true), leading: choice(["none", "back", "menu", "close"], "back"), actions: count(0, 3, 1), search: yn() },
    elements: upTo(3, "action", "actions", ACTIONS, ["more", "share", "add"]),
    draw: ({ props, label, intent, hot, title }) => {
      const lead = str(props, "leading");
      return `<div class="appbar">${lead === "none" ? "" : ibtn(lead, lead === "back" ? "Back" : lead === "menu" ? "Menu" : "Close", hot("leading"))}<span class="t">${flag(props, "title") ? title : ""}</span>${
        flag(props, "search") ? ibtn("search", "Search") : ""}${rowsOf(num(props, "actions"), (i) => ibtn(intent(`action-${i + 1}`), label(`action-${i + 1}`), hot(`action-${i + 1}`)))}</div>`;
    },
  },
  {
    id: "tab-bar", kind: "primitive", category: "navigation", namedBy: 4, h: 64,
    props: { items: count(3, 5, 4), selected: index(5), labels: yn(true) },
    elements: upTo(5, "tab", "items", NAV_JUMPS, ["home", "search", "notifications", "profile", "settings"]),
    draw: ({ props, label, intent, hot }) => `<nav class="tabbar">${rowsOf(num(props, "items"), (i) =>
      `<span class="tab${i + 1 === sel(props, "selected", "items") ? " on" : ""}"${hot(`tab-${i + 1}`)}><b>${glyph(intent(`tab-${i + 1}`))}</b>${flag(props, "labels") ? `<small>${label(`tab-${i + 1}`)}</small>` : ""}</span>`)}</nav>`,
  },
  {
    id: "side-nav", kind: "primitive", category: "navigation", namedBy: 4, h: 400,
    props: { items: count(3, 10, 5), selected: index(10), groups: count(0, 3, 0), collapsed: yn() },
    elements: upTo(10, "item", "items", NAV_JUMPS, ["home", "search", "notifications", "messages", "settings", "profile", "help", "contact", "terms", "upgrade"]),
    draw: ({ props, label, intent, hot }) => {
      const collapsed = flag(props, "collapsed");
      const groups = num(props, "groups");
      return `<nav class="sidenav${collapsed ? " collapsed" : ""}">${rowsOf(num(props, "items"), (i) =>
        `${groups > 0 && i > 0 && i % Math.ceil(num(props, "items") / (groups + 1)) === 0 ? `<hr>` : ""}<span class="nav-i${i + 1 === sel(props, "selected", "items") ? " on" : ""}"${hot(`item-${i + 1}`)}><b>${glyph(intent(`item-${i + 1}`))}</b>${collapsed ? "" : label(`item-${i + 1}`)}</span>`)}</nav>`;
    },
  },
  {
    id: "tabs", kind: "primitive", category: "navigation", namedBy: 9, h: 44,
    props: { count: count(2, 6, 3), selected: index(6), style: choice(["line", "pill", "vertical"]) },
    draw: ({ props }) => `<div class="tabs ${str(props, "style")}">${rowsOf(num(props, "count"), (i) => `<span class="${i + 1 === sel(props, "selected", "count") ? "on" : ""}">${bar(70, "in")}</span>`)}</div>`,
  },
  {
    id: "page-indicator", kind: "primitive", category: "navigation", namedBy: 2, h: 24,
    props: { count: count(2, 6, 3), current: index(6) },
    draw: ({ props }) => `<div class="dots">${rowsOf(num(props, "count"), (i) => `<i class="${i + 1 === sel(props, "current", "count") ? "on" : ""}"></i>`)}</div>`,
  },
  {
    id: "steps", kind: "primitive", category: "navigation", namedBy: 2, h: 40,
    props: { count: count(2, 6, 3), current: index(6), labels: yn() },
    draw: ({ props }) => stepsRow(num(props, "count"), sel(props, "current", "count"), flag(props, "labels")),
  },
  // ---- data
  {
    id: "chart", kind: "primitive", category: "data", namedBy: 3, h: 200,
    props: { kind: choice(["bar", "column", "line", "area", "pie", "donut", "sparkline"]), series: count(1, 4, 1), legend: yn() },
    draw: ({ props }) => chartSvg(str(props, "kind"), num(props, "series"), flag(props, "legend")),
  },
  // ---- overlay
  {
    id: "drawer", kind: "primitive", category: "overlay", namedBy: 4, h: 480,
    props: { edge: choice(["left", "right"]), items: count(3, 10, 6) },
    elements: upTo(10, "item", "items", NAV_JUMPS, ["home", "profile", "notifications", "messages", "settings", "help", "terms", "contact", "search", "upgrade"]),
    draw: ({ props, label, intent, hot }) => `<div class="drawer ${str(props, "edge")}"><div class="drawer-head">${avatar("m")}${bar(50)}</div>${rowsOf(num(props, "items"), (i) =>
      `<span class="nav-i"${hot(`item-${i + 1}`)}><b>${glyph(intent(`item-${i + 1}`))}</b>${label(`item-${i + 1}`)}</span>`)}</div>`,
  },
  {
    id: "sheet", kind: "primitive", category: "overlay", namedBy: 2, h: 300,
    props: { edge: choice(["bottom", "side"]), detent: choice(["half", "full"]), kind: choice(["sheet", "action-sheet"], "action-sheet") },
    elements: {
      ...Object.fromEntries((["share", "copy", "delete"] as const).map((dflt, i) => [`action-${i + 1}`, {
        accepts: [...intentsIn("overlay", "form", "in-place")], default: dflt, when: (p: Props) => p.kind === "action-sheet",
      } satisfies ElementDef])),
      primary: { accepts: ALL_INTENTS, default: "done", when: (p) => p.kind === "sheet" },
      cancel: { accepts: intentsIn("back"), default: "cancel" },
    },
    draw: ({ props, label, hot }) => {
      const action = str(props, "kind") === "action-sheet";
      const body = action
        ? `<div class="sheet-actions">${rowsOf(3, (i) => `<span class="sheet-a${i === 2 ? " destructive" : ""}"${hot(`action-${i + 1}`)}>${label(`action-${i + 1}`)}</span>`)}</div>`
        : `<div class="grab"></div>${bar(40, "k")}${bars(4)}<div class="actions">${btn(label("primary"), "primary", "block", hot("primary"))}</div>`;
      return `<div class="sheet ${str(props, "edge")} ${str(props, "detent")}">${body}<div class="actions">${btn(label("cancel"), "secondary", "block", hot("cancel"))}</div></div>`;
    },
  },
  {
    id: "modal", kind: "primitive", category: "overlay", namedBy: 9, h: 260,
    props: { kind: choice(["dialog", "alert", "fullscreen"]), actions: count(1, 3, 2), destructive: yn(), dismiss: yn(true) },
    elements: upTo(3, "action", "actions", [...intentsIn("forward", "back", "overlay")], ["confirm", "cancel", "more"]),
    draw: ({ props, label, hot }) => `<div class="dialog ${str(props, "kind")}">${flag(props, "dismiss") ? `<span class="x">${glyph("close")}</span>` : ""}${bar(55, "k")}${bars(3)}<div class="actions row">${rowsOf(num(props, "actions"), (i) =>
      btn(label(`action-${i + 1}`), i === 0 ? (flag(props, "destructive") ? "destructive" : "primary") : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`,
  },
];

/** A one-based selected index, clamped to what is drawn. */
export function sel(props: Props, key: string, of: string): number {
  return Math.min(num(props, key), num(props, of));
}

export function listRows(props: Props, action = "", hot = ""): string {
  const lead = str(props, "leading");
  const trail = str(props, "trailing");
  const leading = (i: number) =>
    lead === "icon" ? icon() : lead === "avatar" ? avatar("m") : lead === "thumbnail" ? `<span class="thumb"></span>` : lead === "checkbox" ? `<span class="cb${i === 0 ? " on" : ""}"></span>` : "";
  const trailing = (i: number) =>
    trail === "chevron" || trail === "action" ? `<span class="chev">›</span>` : trail === "switch" ? toggle(i % 2 === 0) : trail === "meta" ? bar(14, "meta") : trail === "badge" ? `<span class="badge"></span>` : "";
  return `<div class="list${props.dividers === false ? "" : " div"}">${rowsOf(num(props, "rows"), (i) =>
    `<div class="row"${hot}>${leading(i)}<div class="row-t">${bars(Number(props.lines ?? 1), i)}</div>${trailing(i)}${action}</div>`)}</div>`;
}

export function stepsRow(n: number, current: number, labels: boolean): string {
  return `<div class="steps">${rowsOf(n, (i) => `<span class="step${i + 1 < current ? " done" : i + 1 === current ? " on" : ""}"><b>${i + 1}</b>${labels ? bar(70, "in") : ""}</span>`)}</div>`;
}

/**
 * A chart's series shades: the theme's primary, stepped toward the ground —
 * roles only (design §9), so a chart takes the system's colour with the rest
 * of the screen. In the default theme they are the old greys, near enough.
 */
const SHADES = [77, 53, 36, 22].map((pct) => `color-mix(in srgb, var(--w-primary) ${pct}%, var(--w-ground))`);

export function chartSvg(kind: string, series: number, legend: boolean): string {
  const shades = SHADES;
  const fill = (c: string) => `style="fill:${c}"`;
  const stroke = (c: string) => `fill="none" style="stroke:${c}"`;
  let marks = "";
  if (kind === "pie" || kind === "donut") {
    marks = `<circle cx="100" cy="60" r="48" ${fill(shades[3]!)}/><path d="M100 60 L100 12 A48 48 0 0 1 145 76 Z" ${fill(shades[0]!)}/>${kind === "donut" ? `<circle cx="100" cy="60" r="24" ${fill("var(--w-ground)")}/>` : ""}`;
  } else if (kind === "bar" || kind === "column") {
    const vals = [40, 70, 55, 90, 65, 80];
    marks = vals.map((v, i) => rowsOf(series, (s) => kind === "column"
      ? `<rect x="${12 + i * 31 + s * (24 / series)}" y="${110 - v * (1 - s * 0.15)}" width="${24 / series - 1}" height="${v * (1 - s * 0.15)}" ${fill(shades[s]!)}/>`
      : `<rect x="10" y="${8 + i * 17 + s * (14 / series)}" width="${v * 1.9 * (1 - s * 0.15)}" height="${14 / series - 1}" ${fill(shades[s]!)}/>`)).join("");
  } else {
    marks = rowsOf(series, (s) => {
      const pts = [70, 55, 62, 35, 48, 22, 30].map((v, i) => `${10 + i * 30},${v + s * 14}`).join(" ");
      return kind === "area" ? `<polygon points="10,110 ${pts} 190,110" ${fill(shades[s + 1] ?? shades[3]!)}/><polyline points="${pts}" ${stroke(shades[s]!)} stroke-width="2"/>`
        : `<polyline points="${pts}" ${stroke(shades[s]!)} stroke-width="2"/>`;
    });
  }
  const axis = kind === "pie" || kind === "donut" || kind === "sparkline" ? "" : `<line x1="8" y1="110" x2="194" y2="110" style="stroke:var(--w-line)"/>`;
  return `<div class="chart k-${esc(kind)}"><svg viewBox="0 0 200 ${kind === "sparkline" ? 90 : 116}" preserveAspectRatio="none">${axis}${marks}</svg>${legend ? `<div class="legend">${rowsOf(series, (s) => `<span><i style="background:${shades[s]}"></i>${bar(100, "in")}</span>`)}</div>` : ""}</div>`;
}
