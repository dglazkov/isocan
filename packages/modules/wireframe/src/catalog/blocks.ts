import { intentsIn } from "./intents.ts";
import type { Component } from "./types.ts";
import {
  avatar, avatarOf, bar, bars, btn, check, choice, count, dot, esc, field, flag, glyph, ibtn, icon, img, index, nth, num, pic, rowsOf,
  statusTag, str, thumbPic, toggle, tx, yn,
} from "./draw.ts";
import { chartSvg, listRows, sel, stepsRow, upTo, word } from "./primitives.ts";

/**
 * **Wave 1's 28 blocks — the unit Jev chooses** (research §1, *Blocks*, and
 * *Recommendation*). Props are the research's, transcribed; elements are the
 * actionable parts of each, with the intents each can take.
 *
 * Where a block's parts are text — a field's label, an error's name — the
 * words come from a typed prop (`Email` because the field's kind is email;
 * `404` because the error's kind is 404), never from a free string. Where
 * they are body copy, they are bars — until the screen is fleshed, when
 * each draw reads its slot's `fill` (design §10) and falls back to the bars
 * for anything the fill does not hold.
 */

const FORWARD = intentsIn("forward");
const BACKS = intentsIn("back");
const JUMPS = intentsIn("jump");

/** The quiet words before a link ("New here?" Sign up) — or the bar that stands in for them. */
function lead(words: string | undefined, width = 28): string {
  return words !== undefined ? `<span class="lead">${esc(words)}</span>` : bar(width, "in");
}

/** Field labels a form can name because a field's kind is typed. */
const FIELD_KINDS = ["Email", "Password", null, "Phone", null, null, "Number", null, null, null];

export const BLOCKS: Component[] = [
  // ---- navigation
  {
    id: "navbar", kind: "block", category: "navigation", namedBy: 4, h: 64,
    props: { links: count(3, 7, 4), cta: count(0, 2, 1), search: yn(), mobile: choice(["hamburger", "links"]) },
    elements: {
      ...upTo(7, "link", "links", JUMPS, ["home", "search", "upgrade", "contact", "help", "terms", "messages"]),
      ...upTo(2, "cta", "cta", [...intentsIn("auth", "forward"), ...JUMPS], ["sign-up", "sign-in"]),
    },
    draw: ({ props, label, hot, wide, fill }) => {
      const links = wide || str(props, "mobile") === "links"
        ? `<span class="links">${rowsOf(num(props, "links"), (i) => `<span class="lnk"${hot(`link-${i + 1}`)}>${label(`link-${i + 1}`)}</span>`)}</span>`
        : "";
      return `<div class="navbar"><span class="brand">${fill?.motif ? thumbPic(fill.motif, "logo-pic") : img("1/1", "sm")}</span>${links}<span class="sp"></span>${flag(props, "search") ? ibtn("search", "Search") : ""}${
        rowsOf(num(props, "cta"), (i) => btn(label(`cta-${i + 1}`), i === 0 ? "primary" : "secondary", "s", hot(`cta-${i + 1}`)))}${!wide && str(props, "mobile") === "hamburger" ? ibtn("menu", "Menu") : ""}</div>`;
    },
  },
  // ---- layout
  {
    id: "app-shell", kind: "block", category: "layout", namedBy: 2, h: 24,
    props: { nav: choice(["top", "side", "bottom", "none"], "bottom"), aside: yn() },
    draw: ({ wide, fill }) => wide
      ? `<div class="chrome web"><i></i><i></i><i></i>${fill?.values?.[1] !== undefined ? `<span class="url-t">${esc(fill.values[1])}</span>` : bar(30, "url")}</div>`
      : `<div class="chrome app">${fill?.values?.[0] !== undefined ? `<span class="clock-t">${esc(fill.values[0])}</span>` : bar(12, "clock")}<span class="sp"></span><i></i><i></i><i></i></div>`,
  },
  {
    id: "page-header", kind: "block", category: "layout", namedBy: 1, h: 96,
    props: { breadcrumbs: yn(), actions: count(0, 3, 1), tabs: yn(), meta: yn() },
    elements: upTo(3, "action", "actions", [...intentsIn("form", "overlay", "forward"), ...JUMPS], ["add", "share", "more"]),
    draw: ({ props, label, hot, title, fill }) => `<div class="pagehead">${flag(props, "breadcrumbs") ? `<div class="crumbs">${
      fill?.values ? fill.values.map((c) => `<span class="cr">${esc(c)}</span>`).join("<span>/</span>") : `${bar(12, "in")}<span>/</span>${bar(12, "in")}<span>/</span>${bar(14, "in")}`}</div>` : ""}<div class="ph-row"><div class="h h1">${title}</div><span class="sp"></span>${
      rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "s", hot(`action-${i + 1}`)))}</div>${flag(props, "meta") ? (fill?.sub !== undefined ? tx(fill.sub, "meta") : bar(35, "meta")) : ""}${
      flag(props, "tabs") ? `<div class="tabs line${fill ? " worded" : ""}">${rowsOf(3, (i) => `<span class="${i === 0 ? "on" : ""}">${word(fill?.labels, i, bar(70, "in"))}</span>`)}</div>` : ""}</div>`,
  },
  // ---- auth
  {
    id: "sign-in-form", kind: "block", category: "auth", namedBy: 3, h: 360,
    props: { social: count(0, 3, 0), remember: yn(), forgot: yn(true), "signup-link": yn(true) },
    elements: {
      submit: { accepts: ["sign-in", "continue", "next"], default: "sign-in" },
      ...upTo(3, "social", "social", ["sign-in", "continue"], ["continue"]),
      remember: { accepts: ["remember"], default: "remember", when: (p) => p.remember === true },
      forgot: { accepts: ["forgot-password", "help"], default: "forgot-password", when: (p) => p.forgot === true },
      "signup-link": { accepts: ["sign-up"], default: "sign-up", when: (p) => p["signup-link"] === true },
    },
    draw: ({ props, label, hot, fill }) => `<div class="form">${field("Email", 0, fill?.values?.[0])}${field("Password", 1, fill?.values?.[1])}${
      flag(props, "remember") || flag(props, "forgot") ? `<div class="between">${flag(props, "remember") ? check(label("remember"), hot("remember")) : "<span></span>"}${flag(props, "forgot") ? `<span class="lnk"${hot("forgot")}>${label("forgot")}</span>` : ""}</div>` : ""}<div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div>${
      num(props, "social") > 0 ? `<div class="or">${bar(100, "rule")}</div><div class="actions stack">${rowsOf(num(props, "social"), (i) => btn(`<span class="logo-dot"></span>${label(`social-${i + 1}`)}`, "secondary", "block", hot(`social-${i + 1}`)))}</div>` : ""}${
      flag(props, "signup-link") ? `<div class="link-row">${lead(fill?.lines?.[0])}<span class="lnk"${hot("signup-link")}>${label("signup-link")}</span></div>` : ""}</div>`,
  },
  {
    id: "sign-up-form", kind: "block", category: "auth", namedBy: 3, h: 420,
    props: { fields: count(2, 6, 3), social: count(0, 3, 0), terms: yn(true), "signin-link": yn(true) },
    elements: {
      submit: { accepts: ["sign-up", "continue", "next", "submit"], default: "sign-up" },
      ...upTo(3, "social", "social", ["sign-up", "continue"], ["continue"]),
      terms: { accepts: ["terms", "accept"], default: "terms", when: (p) => p.terms === true },
      "signin-link": { accepts: ["sign-in"], default: "sign-in", when: (p) => p["signin-link"] === true },
    },
    draw: ({ props, label, hot, fill }) => `<div class="form">${rowsOf(num(props, "fields"), (i) => field(fill?.labels?.[i] !== undefined ? esc(fill.labels[i]) : i === 0 ? null : FIELD_KINDS[i - 1] ?? null, i, fill?.values?.[i]))}${
      flag(props, "terms") ? `<div class="chk"><span class="cb"></span>${lead(fill?.lines?.[0], 30)}<span class="lnk"${hot("terms")}>${label("terms")}</span></div>` : ""}<div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div>${
      num(props, "social") > 0 ? `<div class="actions stack">${rowsOf(num(props, "social"), (i) => btn(`<span class="logo-dot"></span>${label(`social-${i + 1}`)}`, "secondary", "block", hot(`social-${i + 1}`)))}</div>` : ""}${
      flag(props, "signin-link") ? `<div class="link-row">${lead(fill?.lines?.[1])}<span class="lnk"${hot("signin-link")}>${label("signin-link")}</span></div>` : ""}</div>`,
  },
  {
    id: "verify-code", kind: "block", category: "auth", namedBy: 2, h: 260,
    props: { digits: count(4, 8, 6), resend: yn(true) },
    elements: {
      submit: { accepts: FORWARD, default: "confirm" },
      resend: { accepts: ["retry"], default: "retry", when: (p) => p.resend === true },
    },
    draw: ({ props, label, hot, fill }) => `<div class="form center">${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}<div class="code">${rowsOf(num(props, "digits"), (i) => `<span>${i < 2 && fill?.values ? esc(nth(fill.values, i)!) : ""}</span>`)}</div><div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div>${
      flag(props, "resend") ? `<div class="link-row">${lead(fill?.sub, 24)}<span class="lnk"${hot("resend")}>${label("resend")}</span></div>` : ""}</div>`,
  },
  {
    id: "forgot-password", kind: "block", category: "auth", namedBy: 1, h: 240,
    props: { step: choice(["request", "sent"]) },
    elements: {
      submit: { accepts: FORWARD, default: "continue", when: (p) => p.step === "request" },
      back: { accepts: ["sign-in", "back"], default: "sign-in" },
    },
    draw: ({ props, label, hot, fill }) => str(props, "step") === "request"
      ? `<div class="form">${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}${field("Email", 0, fill?.values?.[0])}<div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div><div class="link-row"><span class="lnk"${hot("back")}>${label("back")}</span></div></div>`
      : `<div class="form center"><div class="glyph">✉</div>${fill?.heading !== undefined ? tx(fill.heading, "title") : ""}${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}<div class="actions">${btn(label("back"), "secondary", "block", hot("back"))}</div></div>`,
  },
  // ---- onboarding
  {
    id: "onboarding-step", kind: "block", category: "onboarding", namedBy: 4, h: 480,
    props: { media: choice(["illustration", "image", "none"]), steps: count(2, 5, 3), current: index(5), skip: yn(true) },
    elements: {
      next: { accepts: FORWARD, default: "next" },
      skip: { accepts: ["skip"], default: "skip", when: (p) => p.skip === true },
    },
    draw: ({ props, label, hot, fill }) => `<div class="onb">${flag(props, "skip") ? `<div class="right"><span class="lnk"${hot("skip")}>${label("skip")}</span></div>` : ""}${
      str(props, "media") === "none" ? "" : fill?.motif ? pic(fill.motif, str(props, "media") === "image" ? "4/3" : "1/1", str(props, "media")) : img(str(props, "media") === "image" ? "4/3" : "1/1", str(props, "media"))}<div class="center">${
      fill?.heading !== undefined ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(60, "k")}${bars(2)}`}</div><div class="dots">${
      rowsOf(num(props, "steps"), (i) => `<i class="${i + 1 === sel(props, "current", "steps") ? "on" : ""}"></i>`)}</div><div class="actions">${btn(label("next"), "primary", "block", hot("next"))}</div></div>`,
  },
  // ---- input
  {
    id: "wizard", kind: "block", category: "input", namedBy: 3, h: 420,
    props: { steps: count(2, 6, 3), current: index(6), summary: yn() },
    elements: {
      next: { accepts: FORWARD, default: "next" },
      back: { accepts: BACKS, default: "back" },
    },
    draw: ({ props, label, hot, fill }) => `<div class="wizard">${stepsRow(num(props, "steps"), sel(props, "current", "steps"), true, fill?.groups)}${
      flag(props, "summary") ? `<div class="card">${fill?.lines ? `${tx(fill.lines[0]!, "k")}${fill.lines[1] ? tx(fill.lines[1], "meta") : ""}` : bars(2)}</div>` : ""}${
      rowsOf(3, (i) => field(fill?.labels?.[i] !== undefined ? esc(fill.labels[i]) : null, i, fill?.values?.[i]))}<div class="actions row">${btn(label("back"), "secondary", "", hot("back"))}${btn(label("next"), "primary", "", hot("next"))}</div></div>`,
  },
  {
    id: "form-block", kind: "block", category: "input", namedBy: 5, h: 400,
    props: { fields: count(2, 10, 4), sections: count(1, 3, 1), actions: choice(["submit", "submit+cancel"]) },
    elements: {
      submit: { accepts: FORWARD, default: "save" },
      cancel: { accepts: BACKS, default: "cancel", when: (p) => p.actions === "submit+cancel" },
    },
    draw: ({ props, label, hot, fill }) => {
      const perSection = Math.ceil(num(props, "fields") / num(props, "sections"));
      let i = 0;
      const sections = rowsOf(num(props, "sections"), (s) => {
        let out = num(props, "sections") > 1 ? `<div class="sec">${fill?.groups?.[s] !== undefined ? tx(fill.groups[s], "sec-t") : bar(35, "k")}</div>` : "";
        for (let j = 0; j < perSection && i < num(props, "fields"); j++, i++) {
          const l = nth(fill?.labels, i);
          out += field(l !== undefined ? esc(l) : null, i + s, nth(fill?.values, i));
        }
        return out;
      });
      return `<div class="form">${sections}<div class="actions row">${str(props, "actions") === "submit+cancel" ? btn(label("cancel"), "secondary", "", hot("cancel")) : ""}${btn(label("submit"), "primary", "", hot("submit"))}</div></div>`;
    },
  },
  {
    id: "filter-panel", kind: "block", category: "input", namedBy: 3, h: 360,
    props: { groups: count(2, 6, 3), apply: yn(true) },
    elements: {
      apply: { accepts: ["apply", "done"], default: "apply", when: (p) => p.apply === true },
      reset: { accepts: BACKS, default: "cancel", when: (p) => p.apply === true },
    },
    draw: ({ props, label, hot, fill }) => `<div class="filters">${fill ? tx("Filters", "sec-t") : bar(35, "k")}${rowsOf(num(props, "groups"), (g) =>
      `<div class="grp">${fill?.groups?.[g] !== undefined ? tx(fill.groups[g], "lbl") : bar(30 + (g % 3) * 8, "k")}${rowsOf(3, (i) => `<div class="chk"><span class="cb${(i + g) % 3 === 0 ? " on" : ""}"></span>${word(fill?.labels?.slice(g * 3, g * 3 + 3), i, bar(50 + i * 10, "in"))}</div>`)}</div>`)}${
      flag(props, "apply") ? `<div class="actions row">${btn(label("reset"), "secondary", "", hot("reset"))}${btn(label("apply"), "primary", "", hot("apply"))}</div>` : ""}</div>`,
  },
  {
    id: "settings-group", kind: "block", category: "input", namedBy: 5, h: 420,
    props: { groups: count(1, 4, 2), rows: count(2, 8, 4), row: choice(["switch", "chevron", "value", "mixed"], "mixed") },
    draw: ({ props, fill }) => {
      const kind = str(props, "row");
      const rows = num(props, "rows");
      const trail = (i: number, at: number) => {
        const k = kind === "mixed" ? ["switch", "chevron", "value"][i % 3]! : kind;
        const v = nth(fill?.values, at);
        return k === "switch" ? toggle(i % 2 === 0) : k === "chevron" ? `<span class="chev">›</span>` : v ? tx(v, "meta r", "span") : bar(18, "meta");
      };
      return `<div class="settings">${rowsOf(num(props, "groups"), (g) => `<div class="sec">${fill?.groups?.[g] !== undefined ? tx(fill.groups[g], "sec-t") : bar(25 + g * 5, "k")}</div><div class="list div inset">${
        rowsOf(rows, (i) => `<div class="row">${icon()}<div class="row-t">${word(fill?.labels, g * rows + i, bar(40 + ((i + g) % 4) * 10))}</div>${trail(i, g * rows + i)}</div>`)}</div>`)}</div>`;
    },
  },
  // ---- data
  {
    id: "stats-row", kind: "block", category: "data", namedBy: 4, h: 104,
    props: { count: count(2, 4, 3), trend: yn(true), chart: yn() },
    draw: ({ props, fill }) => `<div class="stats c${num(props, "count")}">${rowsOf(num(props, "count"), (i) => {
      const st = nth(fill?.stats, i);
      const spark = flag(props, "chart") ? chartSvg("sparkline", 1, false, fill?.series ? { series: [nth(fill.series, i)!] } : undefined) : "";
      if (!st) {
        return `<div class="stat">${bar(60, "k")}<div class="big">${bar(50 + (i % 3) * 12, "fat")}</div>${flag(props, "trend") ? `<span class="trend">${i % 2 ? "▼" : "▲"} ${bar(30, "in")}</span>` : ""}${spark}</div>`;
      }
      const trend = flag(props, "trend") && st.delta ? `<span class="trend">${st.down ? "▼" : "▲"} ${esc(st.delta)}</span>` : "";
      return `<div class="stat">${tx(st.label, "lbl")}<div class="big">${tx(st.value, "big", "span")}</div>${trend}${spark}</div>`;
    })}</div>`,
  },
  {
    id: "stacked-list", kind: "block", category: "data", namedBy: 3, h: 360,
    props: {
      rows: count(3, 12, 6),
      leading: choice(["icon", "avatar", "thumbnail", "none"], "avatar"),
      trailing: choice(["chevron", "meta", "action", "none"]),
      sections: count(0, 3, 0),
    },
    elements: { "row-action": { accepts: [...intentsIn("in-place", "overlay")], default: "follow", when: (p) => p.trailing === "action" } },
    draw: ({ props, label, hot, fill }) => {
      const sections = num(props, "sections");
      const rows = num(props, "rows");
      const per = sections > 0 ? Math.ceil(rows / sections) : rows;
      const body = (n: number, from: number) => listRows({ rows: n, leading: str(props, "leading"), trailing: str(props, "trailing") === "action" ? "none" : str(props, "trailing"), lines: 2, dividers: true }, str(props, "trailing") === "action" ? btn(label("row-action"), "secondary", "s", hot("row-action")) : "", hot("row"),
        fill?.items ? Array.from({ length: n }, (_, i) => nth(fill.items, from + i)!) : undefined);
      if (sections === 0) return body(rows, 0);
      return rowsOf(sections, (s) => `<div class="sec">${fill?.groups?.[s] !== undefined ? tx(fill.groups[s], "sec-t") : bar(22 + s * 6, "k")}</div>${body(Math.min(per, rows - s * per), s * per)}`);
    },
  },
  {
    id: "card-grid", kind: "block", category: "data", namedBy: 3, h: 400,
    props: { items: count(3, 12, 6), columns: count(2, 4, 2), media: yn(true) },
    draw: ({ props, hot, wide, fill }) => `<div class="grid" style="grid-template-columns:repeat(${wide ? num(props, "columns") : Math.min(2, num(props, "columns"))},1fr)">${rowsOf(num(props, "items"), (i) => {
      const it = nth(fill?.items, i);
      if (!it) return `<div class="card"${hot("row")}>${flag(props, "media") ? img("4/3") : ""}${bar(70 - (i % 3) * 10, "k")}${bar(45)}</div>`;
      return `<div class="card"${hot("row")}>${flag(props, "media") && it.motif ? pic(it.motif, "4/3") : ""}${tx(it.title, "k")}${tx(dot(it.sub ?? it.meta), "meta")}${!flag(props, "media") && it.status ? `<div>${statusTag(it.status)}</div>` : ""}</div>`;
    })}</div>`,
  },
  {
    id: "data-table", kind: "block", category: "data", namedBy: 4, h: 420,
    props: { columns: count(3, 8, 4), rows: count(5, 15, 6), toolbar: yn(true), pagination: yn(), select: yn() },
    elements: upTo(3, "tool", "toolbar", [...intentsIn("overlay", "form"), "search"], ["filter", "sort", "add"]),
    draw: ({ props, label, intent, hot, wide, fill }) => {
      const cols = wide ? num(props, "columns") : Math.min(3, num(props, "columns"));
      // On a phone the three columns that fit are the name, its status and its trailing value.
      const pickCol = (j: number) => (wide ? j : [0, 2, 3][j]!);
      const cell = (i: number, j: number) => {
        const c = nth(fill?.items, i)?.cells?.[pickCol(j)];
        if (c === undefined) return `<td>${bar(40 + ((i + j) % 5) * 12, j === 0 ? "k" : "")}</td>`;
        return `<td>${pickCol(j) === 2 ? statusTag(c) : tx(c, j === 0 ? "k" : "", "span")}</td>`;
      };
      return `<div class="table">${flag(props, "toolbar") ? `<div class="toolbar"><div class="search sm"><span class="ico-t">${glyph("search")}</span><span class="ph-t">Search</span></div><span class="sp"></span>${
        rowsOf(3, (i) => (i === 2 ? btn(label("tool-3"), "primary", "s", hot("tool-3")) : ibtn(intent(`tool-${i + 1}`), label(`tool-${i + 1}`), hot(`tool-${i + 1}`))))}</div>` : ""}<table><thead><tr>${flag(props, "select") ? `<th class="sel"><span class="cb"></span></th>` : ""}${
        rowsOf(cols, (j) => `<th>${word(fill?.labels ? [fill.labels[pickCol(j)] ?? ""] : undefined, 0, bar(50, "k"))}</th>`)}</tr></thead><tbody>${rowsOf(num(props, "rows"), (i) => `<tr${hot("row")}>${flag(props, "select") ? `<td class="sel"><span class="cb${i === 1 ? " on" : ""}"></span></td>` : ""}${rowsOf(cols, (j) => cell(i, j))}</tr>`)}</tbody></table>${
        flag(props, "pagination") ? `<div class="pager">${fill ? `<span class="count">1–${num(props, "rows")} of ${num(props, "rows") * 7}</span>` : ""}<span>‹</span><span class="on">1</span><span>2</span><span>3</span><span>›</span></div>` : ""}</div>`;
    },
  },
  // ---- content
  {
    id: "blog-list", kind: "block", category: "content", namedBy: 3, h: 420,
    props: { posts: count(3, 9, 4), layout: choice(["list", "grid", "featured"]) },
    draw: ({ props, wide, fill }) => {
      const layout = str(props, "layout");
      const media = (it: { motif?: string } | undefined, ratio: string, cls: string) => (it?.motif ? pic(it.motif, ratio, cls) : img(ratio, cls));
      const post = (i: number) => {
        const it = nth(fill?.items, i);
        const words = it ? `${tx(it.sub ?? "", "meta")}${tx(it.title, "k wrap")}${tx(it.text ?? "", "body clamp")}` : `${bar(35, "meta")}${bar(85 - (i % 3) * 10, "k")}${bars(2, i)}`;
        return `<div class="post ${layout}">${media(it, layout === "list" ? "1/1" : "16/9", layout === "list" ? "thumb-img" : "")}<div>${words}</div></div>`;
      };
      if (layout === "grid") return `<div class="grid" style="grid-template-columns:repeat(${wide ? 3 : 2},1fr)">${rowsOf(num(props, "posts"), post)}</div>`;
      const top = nth(fill?.items, 0);
      return `<div class="posts">${rowsOf(num(props, "posts"), (i) => (layout === "featured" && i === 0
        ? `<div class="post featured-top">${media(top, "16/9", "")}${top ? `${tx(top.title, "title")}${tx(top.text ?? "", "body")}` : `${bar(90, "k")}${bars(2)}`}</div>` : post(i)))}</div>`;
    },
  },
  {
    id: "long-form", kind: "block", category: "content", namedBy: 3, h: 480,
    props: { sections: count(1, 6, 3), toc: yn() },
    draw: ({ props, fill }) => `<div class="long">${flag(props, "toc") ? `<div class="toc">${rowsOf(num(props, "sections"), (i) => (fill?.groups ? tx(nth(fill.groups, i)!, "meta") : bar(40 + (i % 3) * 12, "in")))}</div>` : ""}${
      rowsOf(num(props, "sections"), (s) => fill?.groups
        ? `<div class="sec">${tx(nth(fill.groups, s)!, "sec-t")}</div>${tx([0, 1, 2].map((k) => nth(fill.lines, s * 3 + k) ?? "").join(" "), "body")}`
        : `<div class="sec">${bar(45 + (s % 3) * 10, "k")}</div>${bars(4, s)}`)}</div>`,
  },
  {
    id: "detail-header", kind: "block", category: "content", namedBy: 2, h: 320,
    props: { media: choice(["none", "hero", "carousel"], "hero"), meta: count(0, 4, 2), actions: count(0, 3, 2) },
    elements: upTo(3, "action", "actions", [...intentsIn("form", "overlay", "in-place"), "buy", "cart", "messages"], ["edit", "share", "like"]),
    draw: ({ props, label, hot, fill }) => `<div class="detail">${str(props, "media") === "none" ? "" : `${fill?.motif ? pic(fill.motif, "16/9") : img("16/9")}${str(props, "media") === "carousel" ? `<div class="dots">${rowsOf(4, (i) => `<i class="${i === 0 ? "on" : ""}"></i>`)}</div>` : ""}`}${
      fill?.heading !== undefined ? `${tx(fill.heading, "title")}${fill.sub ? tx(fill.sub, "meta") : ""}` : bar(75, "title")}<div class="metas">${
      rowsOf(num(props, "meta"), (i) => {
        const m = nth(fill?.labels, i);
        return m === undefined ? `<span class="meta-i">${icon()}${bar(60 + (i % 2) * 20, "in")}</span>` : i === 0 ? statusTag(m) : `<span class="meta-i">${tx(m, "meta", "span")}</span>`;
      })}</div><div class="actions row">${rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`,
  },
  // ---- social
  {
    id: "comment-list", kind: "block", category: "social", namedBy: 1, h: 360,
    props: { comments: count(2, 10, 3), nested: yn(), composer: yn(true) },
    elements: { post: { accepts: ["submit", "done", "save"], default: "submit", when: (p) => p.composer === true } },
    draw: ({ props, label, hot, fill }) => `<div class="comments">${fill?.heading !== undefined ? tx(fill.heading, "sec-t") : bar(25, "k")}${rowsOf(num(props, "comments"), (i) => {
      const it = nth(fill?.items, i);
      const words = it ? `<div class="by">${tx(it.person ?? it.title, "k", "span")}${it.meta ? tx(it.meta, "meta", "span") : ""}</div>${tx(it.text ?? "", "body")}` : `${bar(30, "k")}${bars(2, i)}`;
      return `<div class="comment${flag(props, "nested") && i % 2 === 1 ? " nested" : ""}">${avatarOf(it?.person, "s")}<div class="row-t">${words}</div></div>`;
    })}${
      flag(props, "composer") ? `<div class="composer"><div class="box">${fill ? `<span class="ph-t">Add a comment…</span>` : bar(40, "ph")}</div>${btn(label("post"), "primary", "s", hot("post"))}</div>` : ""}</div>`,
  },
  {
    id: "profile-header", kind: "block", category: "social", namedBy: 2, h: 240,
    props: { avatar: choice(["s", "l"], "l"), stats: count(0, 3, 3), actions: count(0, 2, 1), cover: yn() },
    elements: upTo(2, "action", "actions", ["follow", "messages", "edit", "share", "settings", "more"], ["edit", "share"]),
    draw: ({ props, label, hot, fill }) => `<div class="profile${flag(props, "cover") ? " covered" : ""}">${flag(props, "cover") ? img("3/1", "cover") : ""}${avatarOf(fill?.person, str(props, "avatar") === "l" ? "l" : "m")}${
      fill?.person ? `${tx(fill.person, "title")}${fill.sub ? tx(fill.sub, "meta") : ""}` : `${bar(40, "title")}${bar(28, "meta")}`}${
      num(props, "stats") > 0 ? `<div class="pstats">${rowsOf(num(props, "stats"), (i) => {
        const st = nth(fill?.stats, i);
        return st ? `<span>${tx(st.value, "big", "span")}${tx(st.label, "meta", "span")}</span>` : `<span>${bar(50, "fat")}${bar(70, "in")}</span>`;
      })}</div>` : ""}<div class="actions row">${
      rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`,
  },
  {
    id: "feed-post", kind: "block", category: "social", namedBy: 2, h: 440,
    props: { media: choice(["none", "image", "video", "link"], "image"), actions: count(2, 4, 3), count: count(1, 6, 2) },
    elements: upTo(4, "action", "actions", [...intentsIn("in-place", "overlay"), "messages"], ["like", "messages", "share", "more"]),
    draw: ({ props, label, intent, hot, fill }) => rowsOf(num(props, "count"), (p) => {
      const media = str(props, "media");
      const it = nth(fill?.items, p);
      const m = (ratio: string, cls = "") => (it?.motif ? pic(it.motif, ratio, cls) : img(ratio, cls));
      const head = it ? `${tx(it.person ?? it.title, "k")}${tx(it.meta ?? "", "meta")}` : `${bar(35, "k")}${bar(20, "meta")}`;
      return `<div class="fpost"${hot("row")}><div class="fhead">${avatarOf(it?.person, "s")}<div class="row-t">${head}</div></div>${it ? tx(it.text ?? "", "body") : bars(2, p)}${
        media === "image" ? m("4/3") : media === "video" ? `<div class="video">${m("16/9")}<span class="play">▶</span></div>` : media === "link" ? `<div class="linkcard">${m("1/1", "thumb-img")}<div>${it ? `${tx(it.title, "k")}${tx(it.sub ?? "", "meta")}` : `${bar(70, "k")}${bar(40, "meta")}`}</div></div>` : ""}<div class="factions">${
        rowsOf(num(props, "actions"), (i) => `<span class="fa"${hot(`action-${i + 1}`)}>${glyph(intent(`action-${i + 1}`))} ${label(`action-${i + 1}`)}</span>`)}</div></div>`;
    }),
  },
  // ---- media
  {
    id: "gallery-section", kind: "block", category: "media", namedBy: 3, h: 440,
    props: { items: count(4, 12, 9), layout: choice(["grid", "masonry", "carousel"]) },
    draw: ({ props, wide, fill }) => {
      const layout = str(props, "layout");
      const m = (i: number, ratio: string) => {
        const it = nth(fill?.items, i);
        return it?.motif ? pic(it.motif, ratio) : img(ratio);
      };
      if (layout === "carousel") return `<div class="carousel">${m(0, "4/3")}<div class="dots">${rowsOf(Math.min(6, num(props, "items")), (i) => `<i class="${i === 0 ? "on" : ""}"></i>`)}</div></div>`;
      const ratios = layout === "masonry" ? ["3/4", "1/1", "4/3", "1/1", "3/4", "4/3"] : ["1/1"];
      return `<div class="${layout === "masonry" ? "masonry" : "grid tight"}" style="${layout === "masonry" ? `column-count:${wide ? 4 : 2}` : `grid-template-columns:repeat(${wide ? 4 : 3},1fr)`}">${
        rowsOf(num(props, "items"), (i) => m(i, ratios[i % ratios.length]!))}</div>`;
    },
  },
  // ---- commerce
  {
    id: "product-card-list", kind: "block", category: "commerce", namedBy: 2, h: 440,
    props: { items: count(3, 12, 6), layout: choice(["grid", "list"]), price: yn(true), rating: yn() },
    draw: ({ props, hot, wide, fill }) => {
      const list = str(props, "layout") === "list";
      const card = (i: number) => {
        const it = nth(fill?.items, i);
        if (!it) {
          return `<div class="card product"${hot("row")}>${img("1/1", list ? "thumb-img" : "")}<div>${bar(75 - (i % 3) * 10, "k")}${
            flag(props, "rating") ? `<span class="stars">★★★★☆</span>` : ""}${flag(props, "price") ? bar(30, "fat") : ""}</div></div>`;
        }
        const r = it.rating ?? 4;
        return `<div class="card product"${hot("row")}>${it.motif ? pic(it.motif, "1/1", list ? "thumb-img" : "") : img("1/1", list ? "thumb-img" : "")}<div>${tx(it.title, "k")}${
          flag(props, "rating") ? `<span class="stars">${"★".repeat(r)}${"☆".repeat(5 - r)}</span>` : ""}${flag(props, "price") && it.meta ? tx(it.meta, "price") : ""}</div></div>`;
      };
      return str(props, "layout") === "list"
        ? `<div class="plist">${rowsOf(num(props, "items"), card)}</div>`
        : `<div class="grid" style="grid-template-columns:repeat(${wide ? 4 : 2},1fr)">${rowsOf(num(props, "items"), card)}</div>`;
    },
  },
  // ---- feedback
  {
    id: "empty-state", kind: "block", category: "feedback", namedBy: 2, h: 320,
    props: { media: yn(true), action: count(0, 2, 1), cause: choice(["first-use", "no-results", "cleared"]) },
    elements: upTo(2, "action", "action", [...intentsIn("form", "forward", "jump"), "retry", "upload"], ["add", "search"]),
    draw: ({ props, label, hot, fill }) => `<div class="state">${flag(props, "media") ? (fill?.motif ? pic(fill.motif, "1/1", "sm round") : img("1/1", "sm")) : ""}${
      fill?.heading !== undefined ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(55, "title")}${bars(2)}`}<div class="actions stack">${
      rowsOf(num(props, "action"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`,
  },
  {
    id: "error-state", kind: "block", category: "feedback", namedBy: 1, h: 320,
    props: { kind: choice(["404", "offline", "generic", "permission"]), retry: yn(true) },
    elements: { retry: { accepts: ["retry", "back", "home"], default: "retry", when: (p) => p.retry === true } },
    draw: ({ props, label, hot, fill }) => {
      const name = ({ "404": "404", offline: "Offline", generic: "Error", permission: "No access" } as Record<string, string>)[str(props, "kind")]!;
      return `<div class="state"><div class="glyph big">${name}</div>${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}<div class="actions stack">${flag(props, "retry") ? btn(label("retry"), "primary", "", hot("retry")) : ""}</div></div>`;
    },
  },
  {
    id: "success-state", kind: "block", category: "feedback", namedBy: 2, h: 320,
    props: { summary: yn(), actions: count(1, 2, 1) },
    elements: upTo(2, "action", "actions", [...FORWARD, ...JUMPS], ["done", "home"]),
    draw: ({ props, label, hot, fill }) => `<div class="state"><div class="glyph">✓</div>${fill?.heading !== undefined ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(50, "title")}${bars(2)}`}${
      flag(props, "summary") ? `<div class="card summary">${fill?.values ? `${tx(fill.values[0] ?? "", "k")}${tx(dot(fill.values[1], fill.values[2]), "meta")}` : bars(3)}</div>` : ""}<div class="actions stack">${
      rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`,
  },
  // ---- overlay
  {
    id: "confirm-dialog", kind: "block", category: "overlay", namedBy: 3, h: 220,
    props: { destructive: yn(), input: yn() },
    elements: {
      confirm: { accepts: ["confirm", "delete", "accept", "done", "submit", "log-out"], default: "confirm" },
      cancel: { accepts: BACKS, default: "cancel" },
    },
    draw: ({ props, label, hot, fill }) => `<div class="dialog">${fill?.heading !== undefined ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(60, "title")}${bars(2)}`}${flag(props, "input") ? field(null) : ""}<div class="actions row">${btn(label("cancel"), "secondary", "", hot("cancel"))}${
      btn(label("confirm"), flag(props, "destructive") ? "destructive" : "primary", "", hot("confirm"))}</div></div>`,
  },
];

