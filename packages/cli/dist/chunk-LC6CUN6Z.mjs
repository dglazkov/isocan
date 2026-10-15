import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  chosenOption
} from "./chunk-TTS2OUSZ.mjs";
import {
  CONTRAST_BODY,
  contrastRatio,
  resolveToken
} from "./chunk-K4TDP4L5.mjs";

// packages/modules/wireframe/src/catalog/intents.ts
var next = { to: "next", transition: "push" };
var history = { to: "history", transition: "pop" };
var none = { to: "none", transition: "none" };
var arch = (archetype, transition = "push") => ({ to: "archetype", archetype, transition });
var overlay = (component2) => ({ to: "overlay", component: component2, transition: "overlay" });
var INTENTS = [
  // forward (10)
  { id: "continue", label: "Continue", group: "forward", nav: next },
  { id: "next", label: "Next", group: "forward", nav: next },
  { id: "get-started", label: "Get started", group: "forward", nav: next },
  { id: "done", label: "Done", group: "forward", nav: next },
  { id: "submit", label: "Submit", group: "forward", nav: next },
  { id: "save", label: "Save", group: "forward", nav: next },
  { id: "apply", label: "Apply", group: "forward", nav: next },
  { id: "confirm", label: "Confirm", group: "forward", nav: next },
  { id: "accept", label: "Accept", group: "forward", nav: next },
  { id: "skip", label: "Skip", group: "forward", nav: { to: "after-run", transition: "dissolve" } },
  // auth (4)
  { id: "sign-in", label: "Sign in", group: "auth", nav: { to: "post-auth", transition: "dissolve" } },
  { id: "sign-up", label: "Sign up", group: "auth", nav: arch("sign-up") },
  { id: "forgot-password", label: "Forgot password?", group: "auth", nav: arch("verify") },
  { id: "log-out", label: "Log out", group: "auth", nav: arch("sign-in", "dissolve") },
  // back (4)
  { id: "back", label: "Back", group: "back", nav: history },
  { id: "cancel", label: "Cancel", group: "back", nav: history },
  { id: "close", label: "Close", group: "back", nav: history },
  { id: "dismiss", label: "Dismiss", group: "back", nav: history },
  // detail (1)
  { id: "open", label: "Open", group: "detail", nav: arch("detail") },
  // form (2)
  { id: "add", label: "Add", group: "form", nav: arch("form") },
  { id: "edit", label: "Edit", group: "form", nav: arch("form") },
  // overlay (7)
  { id: "filter", label: "Filter", group: "overlay", nav: overlay("filter-panel") },
  { id: "sort", label: "Sort", group: "overlay", nav: overlay("sheet") },
  { id: "share", label: "Share", group: "overlay", nav: overlay("sheet") },
  { id: "delete", label: "Delete", group: "overlay", nav: arch("confirm", "overlay") },
  { id: "more", label: "More", group: "overlay", nav: overlay("dropdown-menu") },
  { id: "menu", label: "Menu", group: "overlay", nav: overlay("drawer") },
  { id: "info", label: "Info", group: "overlay", nav: overlay("popover") },
  // jump to an archetype (16: the research's 13, and three tab targets)
  { id: "search", label: "Search", group: "jump", nav: arch("search") },
  { id: "settings", label: "Settings", group: "jump", nav: arch("settings") },
  { id: "profile", label: "Profile", group: "jump", nav: arch("profile") },
  { id: "notifications", label: "Notifications", group: "jump", nav: arch("notifications") },
  { id: "cart", label: "Cart", group: "jump", nav: arch("cart") },
  { id: "checkout", label: "Checkout", group: "jump", nav: arch("checkout") },
  { id: "buy", label: "Buy", group: "jump", nav: arch("order-placed") },
  { id: "home", label: "Home", group: "jump", nav: arch("home", "none") },
  { id: "terms", label: "Terms", group: "jump", nav: arch("legal") },
  { id: "contact", label: "Contact", group: "jump", nav: arch("contact") },
  { id: "upgrade", label: "Upgrade", group: "jump", nav: arch("pricing") },
  { id: "help", label: "Help", group: "jump", nav: arch("contact") },
  { id: "messages", label: "Messages", group: "jump", nav: arch("chat") },
  // A tab that IS one of the flow's screens (24 Sep 2026, wireframes phase 3's Open): Jev labelled a
  // tab "Profile" and the tab rule sent it to the list, because nothing here could say "this tab is
  // the list". These three can. A fleshed one reads in the pack's words ("Deliveries").
  { id: "open-list", label: "List", group: "jump", nav: arch("list", "none") },
  { id: "open-feed", label: "Feed", group: "jump", nav: arch("feed", "none") },
  { id: "open-gallery", label: "Gallery", group: "jump", nav: arch("gallery", "none") },
  // in place (8)
  { id: "like", label: "Like", group: "in-place", nav: none },
  { id: "follow", label: "Follow", group: "in-place", nav: none },
  { id: "play", label: "Play", group: "in-place", nav: none },
  { id: "select", label: "Select", group: "in-place", nav: none },
  { id: "copy", label: "Copy", group: "in-place", nav: none },
  { id: "retry", label: "Retry", group: "in-place", nav: none },
  { id: "upload", label: "Upload", group: "in-place", nav: none },
  { id: "remember", label: "Remember me", group: "in-place", nav: none }
];
var INTENT_BY_ID = new Map(INTENTS.map((i) => [i.id, i]));
function intentsIn(...groups) {
  return INTENTS.filter((i) => groups.includes(i.group)).map((i) => i.id);
}
var ALL_INTENTS = INTENTS.map((i) => i.id);

// packages/modules/wireframe/src/content/pictograms.ts
var P = {
  parcel: `<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6"/>`,
  box: `<path d="M3 8h18v12H3zM3 8l2-4h14l2 4M9.5 12h5"/>`,
  truck: `<path d="M5 16.5H2V6h11v10.5H9M13 9h4.5l3.5 3.5v4h-1.5M13 16.5h2"/><circle cx="7" cy="16.5" r="2"/><circle cx="17.5" cy="16.5" r="2"/>`,
  scan: `<path d="M3 7.5V4h3.5M17.5 4H21v3.5M21 16.5V20h-3.5M6.5 20H3v-3.5M7 8v8M10 8v8M13.5 8v8M17 8v8"/>`,
  pan: `<circle cx="10" cy="12" r="6.5"/><path d="M16.5 12H22M7.5 10c.8-1 2-1.4 3.2-1.1"/>`,
  bowl: `<path d="M3 11h18a9 8 0 0 1-18 0zM7.5 21h9M9 7.5c0-1.5 1.5-1.7 1.5-3.5M13.5 7.5c0-1.5 1.5-1.7 1.5-3.5"/>`,
  cup: `<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5c0 1.5 1 1.5 1 3M12.5 3.5c0 1.5 1 1.5 1 3"/>`,
  shirt: `<path d="M8.5 3 3 6l2 4.5 2.5-1.2V21h9V9.3l2.5 1.2 2-4.5-5.5-3c-.3 1.8-1.6 3-3.5 3s-3.2-1.2-3.5-3z"/>`,
  shoe: `<path d="M2 18V9h4.5l2 3.5h4l7 2.2a3 3 0 0 1 2.5 3V18zM2 15h20M9.5 12.5v-2M12.5 12.5v-2"/>`,
  gift: `<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9C11 6 8 4.2 6.8 5.4S8 9 12 9zM12 9c1-3 4-4.8 5.2-3.6S16 9 12 9z"/>`,
  dumbbell: `<path d="M7 12h10M3 8.5h4v7H3zM17 8.5h4v7h-4zM1.5 10.5v3M22.5 10.5v3"/>`,
  bike: `<circle cx="5.5" cy="16" r="3.8"/><circle cx="18.5" cy="16" r="3.8"/><path d="M5.5 16 9.5 8h6l3 8M9.5 8l3 8H5.5M8 5.5h3.5M15.5 8l1-3H19"/>`,
  "heart-pulse": `<path d="M12 20.5 4 12.7A4.9 4.9 0 0 1 12 6.4a4.9 4.9 0 0 1 8 6.3z"/><path d="M3 12.5h4.5l1.5-3 3 6 1.5-3H21"/>`,
  chart: `<path d="M3 3v18h18M7.5 16.5v-4M11.5 16.5v-8M15.5 16.5v-6M19.5 16.5V6"/>`,
  plane: `<path d="M12 2.5c.9 0 1.4 1 1.4 2.4v4.3l7.6 4.6v2l-7.6-2.3v4.8l2.3 1.9v1.3L12 20.6l-3.7.9v-1.3l2.3-1.9v-4.8L3 15.8v-2l7.6-4.6V4.9c0-1.4.5-2.4 1.4-2.4z"/>`,
  suitcase: `<path d="M3 8h18v12H3zM9 8V5.5c0-.6.4-1 1-1h4c.6 0 1 .4 1 1V8M7.5 8v12M16.5 8v12"/>`,
  ticket: `<path d="M3 7h18v3.2a1.8 1.8 0 0 0 0 3.6V17H3v-3.2a1.8 1.8 0 0 0 0-3.6z"/><path d="M14.5 7.5v1.5M14.5 11.2v1.6M14.5 15v1.5"/>`,
  calendar: `<path d="M3 5.5h18V21H3zM3 10h18M8 3v4.5M16 3v4.5M7 14h2M11 14h2M15 14h2M7 17.5h2M11 17.5h2"/>`,
  coin: `<circle cx="12" cy="12" r="9"/><path d="M14.6 9.6c-.5-.9-1.4-1.4-2.6-1.4-1.5 0-2.5.8-2.5 1.9 0 2.6 5.1 1.3 5.1 4 0 1.1-1 2-2.6 2-1.2 0-2.1-.5-2.6-1.4M12 6.5v1.7M12 15.8v1.7"/>`,
  checklist: `<path d="M4.5 3h15v18h-15zM7.5 8l1.5 1.5L12 6.5M7.5 14l1.5 1.5 3-3M14 8.3h3M14 14.3h3"/>`,
  drill: `<path d="M3 5h11.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3zM16.5 8H22M7 11l-1.5 9.5h4.8l1.2-9.5M3 8h2"/>`,
  hammer: `<path d="M5 4h9.5L18 6.5V9h-4.5v1.5h-4V9H5zM9.5 10.5h4V20a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"/>`,
  wrench: `<path d="M14.8 3.3a5 5 0 0 0-5.2 6.9L3.4 16.4a2.1 2.1 0 0 0 3 3l6.2-6.2a5 5 0 0 0 6.9-5.2l-3 3-2.6-.5-.5-2.6z"/>`,
  ladder: `<path d="M7 2.5v19M17 2.5v19M7 6.5h10M7 10.5h10M7 14.5h10M7 18.5h10"/>`,
  paw: `<path d="M12 12.5c2.6 0 5 2.4 5 4.8 0 1.7-1.3 2.7-2.9 2.7-.9 0-1.4-.4-2.1-.4s-1.2.4-2.1.4C8.3 20 7 19 7 17.3c0-2.4 2.4-4.8 5-4.8z"/><circle cx="5.5" cy="10.5" r="1.8"/><circle cx="9.3" cy="6.3" r="1.8"/><circle cx="14.7" cy="6.3" r="1.8"/><circle cx="18.5" cy="10.5" r="1.8"/>`,
  house: `<path d="M3 11.5 12 3.5l9 8M5 9.8V21h14V9.8M10 21v-6h4v6"/>`,
  key: `<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M16.5 6.5l2.5 2.5M14 9l2 2"/>`,
  briefcase: `<path d="M3 7.5h18V20H3zM9 7.5v-2c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v2M3 12.5h18M11 11.5v2.5h2v-2.5"/>`,
  newspaper: `<path d="M4 4h13v14.5a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5zM17 8h3v10.5a1.5 1.5 0 0 1-3 0M7 7.5h7M7 11h7M7 14.5h4"/>`,
  book: `<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M8 7h8"/>`,
  cap: `<path d="m2 9 10-5 10 5-10 5zM6 11v5c2.5 2.3 9.5 2.3 12 0v-5M22 9v6"/>`,
  laptop: `<path d="M4.5 5h15v11h-15zM2 19.5h20"/>`,
  music: `<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`,
  pin: `<path d="M12 21.5s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  camera: `<path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>`,
  leaf: `<path d="M5 19C5 10.5 10 5.2 20 4c-1 10-6 15-15 15zM5 19l8-8"/>`,
  plant: `<path d="M7 14h10l-1.5 7h-7zM12 14V8.5M12 8.5c0-3 2-5 5-5 0 3-2 5-5 5zM12 11c0-2.5-2-4-4.5-4 0 2.5 2 4 4.5 4z"/>`,
  pill: `<path d="M4.6 14.1 14.1 4.6a4.5 4.5 0 0 1 6.4 6.4l-9.5 9.5a4.5 4.5 0 0 1-6.4-6.4zM9.3 9.3l5.4 5.4"/>`,
  car: `<path d="M5 17H3v-5l2.5-5h13l2.5 5v5h-2M9.5 17h5M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>`,
  phone: `<path d="M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5zM10.5 18.5h3"/>`,
  star: `<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`,
  chat: `<path d="M4 5h16v11H9.5L4 20zM8 9h8M8 12.5h5"/>`,
  headset: `<path d="M4 14.5V12a8 8 0 0 1 16 0v2.5M3 14h4v6H3zM17 14h4v6h-4zM19 20c0 1-1 1.5-3 1.5h-2.5"/>`,
  image: `<path d="M3 4h18v16H3z"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m3 17 5-5 4 4 3-3 6 6"/>`
};
var PICTOGRAM_IDS = Object.keys(P);
function pictogram(id, cls = "pg") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[id] ?? P.image}</svg>`;
}

// packages/modules/wireframe/src/catalog/draw.ts
function esc(text) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
var WIDTHS = [92, 78, 86, 64, 95, 72, 58, 88, 70, 82];
function bar(width, cls = "") {
  return `<i class="bar${cls ? ` ${cls}` : ""}" style="width:${width}%"></i>`;
}
function bars(n, offset = 0, cls = "") {
  let out = "";
  for (let i = 0; i < n; i++) {
    const lineCls = cls || (n >= 3 && i === n - 1 ? "emp-subtle" : "");
    out += bar(WIDTHS[(i + offset) % WIDTHS.length], lineCls);
  }
  return out;
}
function btn(label, variant = "primary", cls = "", hot = "") {
  return `<span class="btn ${variant}${cls ? ` ${cls}` : ""}"${hot}>${label}</span>`;
}
var GLYPHS = {
  home: "\u2302",
  search: "\u2315",
  notifications: "\u25D4",
  messages: "\u2709",
  profile: "\u25EF",
  settings: "\u2699",
  cart: "\u229E",
  help: "?",
  contact: "\u260F",
  terms: "\xA7",
  upgrade: "\u2191",
  checkout: "\u2713",
  buy: "\u2713",
  like: "\u2661",
  share: "\u2197",
  more: "\u22EF",
  menu: "\u2261",
  info: "i",
  filter: "\u25BD",
  add: "+",
  edit: "\u270E",
  delete: "\u2715",
  close: "\u2715",
  back: "\u2039",
  cancel: "\u2715",
  dismiss: "\u2715",
  follow: "+",
  play: "\u25B6",
  copy: "\u29C9",
  upload: "\u2191",
  retry: "\u21BB",
  sort: "\u21C5",
  select: "\u2713",
  open: "\u203A",
  "open-list": "\u25A4",
  "open-feed": "\u25EB",
  "open-gallery": "\u25A6"
};
function glyph(intent) {
  return GLYPHS[intent] ?? "\u2022";
}
function ibtn(intent, label, hot = "") {
  return `<span class="ibtn" title="${label}" aria-label="${label}"${hot}>${glyph(intent)}</span>`;
}
function img(ratio2 = "4/3", cls = "") {
  return `<div class="img${cls ? ` ${cls}` : ""}" style="aspect-ratio:${ratio2}"></div>`;
}
function avatar(size = "m") {
  return `<span class="av ${size}"></span>`;
}
function icon() {
  return `<span class="ico"></span>`;
}
function field(label, offset = 0, value) {
  return `<div class="fld">${label ? `<span class="lbl">${label}</span>` : bar(30 + offset % 3 * 8, "lbl-bar")}<div class="box">${value !== void 0 ? `<span class="val">${esc(value)}</span>` : bar(40 + offset % 4 * 10, "ph")}</div></div>`;
}
function check(label, hot = "") {
  return `<div class="chk"${hot}><span class="cb"></span>${label}</div>`;
}
function chip(on = false, label) {
  return `<span class="chip${on ? " on" : ""}">${label !== void 0 ? esc(label) : bar(100, "in")}</span>`;
}
function toggle(on) {
  return `<span class="tg${on ? " on" : ""}"></span>`;
}
function heading(title, level = 1) {
  return `<div class="h h${level}">${title}</div>`;
}
function rowsOf(n, fn) {
  let out = "";
  for (let i = 0; i < n; i++) out += fn(i);
  return out;
}
function num(props, key) {
  return Number(props[key]);
}
function str(props, key) {
  return String(props[key]);
}
function flag(props, key) {
  return props[key] === true;
}
var choice = (values, dflt) => ({ kind: "choice", values, default: dflt ?? values[0] });
var yn = (dflt = false) => ({ kind: "flag", default: dflt });
var count = (min, max, dflt) => ({ kind: "count", min, max, default: dflt ?? min });
var index = (max, dflt = 1) => ({ kind: "index", max, default: dflt });
function tx(text, cls = "", tag = "div") {
  return `<${tag} class="tx${cls ? ` ${cls}` : ""}">${esc(text)}</${tag}>`;
}
function pic(motif, ratio2 = "4/3", cls = "") {
  return `<div class="img pic${cls ? ` ${cls}` : ""}" style="aspect-ratio:${ratio2}">${pictogram(motif)}</div>`;
}
function thumbPic(motif, cls = "thumb") {
  return `<span class="${cls} pic">${pictogram(motif)}</span>`;
}
function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
function avatarOf(name, size = "m") {
  return name ? `<span class="av ${size} ini">${esc(initialsOf(name))}</span>` : avatar(size);
}
function statusTag(status) {
  return `<span class="st">${esc(status)}</span>`;
}
function nth(list, i) {
  return list && list.length > 0 ? list[i % list.length] : void 0;
}
function dot(...parts) {
  return parts.filter((p) => Boolean(p)).join(" \xB7 ");
}

// packages/modules/wireframe/src/catalog/primitives.ts
function upTo(n, prefix, key, accepts, defaults) {
  const out = {};
  for (let i = 1; i <= n; i++) {
    out[`${prefix}-${i}`] = {
      accepts,
      default: defaults[(i - 1) % defaults.length],
      when: (p) => typeof p[key] === "boolean" ? p[key] === true : Number(p[key]) >= i
    };
  }
  return out;
}
var NAV_JUMPS = intentsIn("jump");
var ACTIONS = [...intentsIn("form", "overlay", "jump")];
var PRIMARY = [...intentsIn("forward", "auth", "form", "jump")];
var ratio = (r) => r.replace(":", "/");
var PRIMITIVES = [
  // ---- display
  {
    id: "image",
    kind: "primitive",
    category: "display",
    namedBy: 10,
    h: 180,
    props: { kind: choice(["photo", "illustration", "logo"]), ratio: choice(["1:1", "4:3", "16:9", "3:4"], "4:3"), caption: yn() },
    draw: ({ props, fill }) => {
      const kind = str(props, "kind");
      const logo = kind === "logo";
      const r = logo ? "1/1" : ratio(str(props, "ratio"));
      const cls = logo ? "sm" : kind === "illustration" ? "illustration" : "";
      const wireCls = logo ? "sm pat-crosshatch" : kind === "illustration" ? "illustration pat-dotted" : "";
      const caption = flag(props, "caption") ? fill?.lines?.[0] !== void 0 ? tx(fill.lines[0], "meta cap-t") : bar(40, "cap") : "";
      return `<div class="${logo ? "logo" : ""}">${fill?.motif ? pic(fill.motif, r, cls) : img(r, wireCls)}${caption}</div>`;
    }
  },
  {
    id: "heading",
    kind: "primitive",
    category: "display",
    namedBy: 6,
    h: 44,
    props: { level: count(1, 4, 1), align: choice(["start", "center"]) },
    draw: ({ props, title }) => `<div style="text-align:${str(props, "align") === "center" ? "center" : "left"}">${heading(title, num(props, "level"))}</div>`
  },
  {
    id: "text",
    kind: "primitive",
    category: "display",
    namedBy: 8,
    h: 72,
    props: { lines: count(1, 8, 3), size: choice(["s", "m", "l"], "m"), style: choice(["body", "caption", "quote"]), redacted: yn(true) },
    draw: ({ props, fill }) => `<div class="txt ${str(props, "size")} ${str(props, "style")}">${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(num(props, "lines"))}</div>`
  },
  {
    id: "description-list",
    kind: "primitive",
    category: "display",
    namedBy: 2,
    h: 160,
    props: { pairs: count(2, 10, 4), layout: choice(["stacked", "inline"]) },
    draw: ({ props, fill }) => `<dl class="dlist ${str(props, "layout")}">${rowsOf(num(props, "pairs"), (i) => fill?.labels ? `<div>${tx(nth(fill.labels, i), "lbl")}${tx(nth(fill.values, i) ?? "", "v")}</div>` : `<div>${bar(30 + i % 3 * 6, "k")}${bar(50 + i % 4 * 9)}</div>`)}</dl>`
  },
  {
    id: "chip",
    kind: "primitive",
    category: "display",
    namedBy: 3,
    h: 40,
    props: { count: count(1, 8, 4), selectable: yn(true), removable: yn() },
    draw: ({ props, fill }) => `<div class="chips">${rowsOf(num(props, "count"), (i) => chip(flag(props, "selectable") && i === 0, nth(fill?.labels, i)))}</div>`
  },
  {
    id: "list",
    kind: "primitive",
    category: "display",
    namedBy: 7,
    h: 320,
    props: {
      rows: count(3, 12, 6),
      leading: choice(["none", "icon", "avatar", "thumbnail", "checkbox"], "icon"),
      trailing: choice(["none", "chevron", "switch", "meta", "badge"], "chevron"),
      lines: count(1, 3, 1),
      dividers: yn(true)
    },
    draw: ({ props, fill }) => listRows(props, "", "", fill?.items)
  },
  // ---- input
  {
    id: "button",
    kind: "primitive",
    category: "input",
    namedBy: 9,
    h: 48,
    props: {
      variant: choice(["primary", "secondary", "tertiary", "destructive"]),
      size: choice(["s", "m", "l"], "m"),
      icon: choice(["none", "leading", "only"]),
      state: choice(["default", "disabled", "loading"])
    },
    elements: { action: { accepts: ALL_INTENTS, default: "continue" } },
    draw: ({ props, label, intent, hot }) => {
      const only = str(props, "icon") === "only";
      const lead2 = str(props, "icon") === "leading" ? `${glyph(intent("action"))} ` : "";
      const inner = only ? glyph(intent("action")) : `${lead2}${label("action")}`;
      return `<div class="actions">${btn(inner, str(props, "variant"), `${str(props, "size")} ${str(props, "state")} block`, hot("action"))}</div>`;
    }
  },
  {
    id: "button-group",
    kind: "primitive",
    category: "input",
    namedBy: 4,
    h: 104,
    props: { count: count(2, 4, 2), variant: choice(["primary-first", "equal"]) },
    elements: upTo(4, "button", "count", PRIMARY.concat(intentsIn("back", "overlay", "in-place")), ["continue", "cancel", "more", "help"]),
    draw: ({ props, label, hot }) => `<div class="actions stack">${rowsOf(num(props, "count"), (i) => btn(label(`button-${i + 1}`), i === 0 || str(props, "variant") === "equal" ? i === 0 ? "primary" : "secondary" : "tertiary", "block", hot(`button-${i + 1}`)))}</div>`
  },
  {
    id: "link",
    kind: "primitive",
    category: "navigation",
    namedBy: 5,
    h: 32,
    props: {},
    elements: { action: { accepts: ALL_INTENTS, default: "help" } },
    draw: ({ label, hot }) => `<div class="link-row"><span class="lnk"${hot("action")}>${label("action")}</span></div>`
  },
  {
    id: "search-field",
    kind: "primitive",
    category: "navigation",
    namedBy: 6,
    h: 56,
    props: { scope: yn(), state: choice(["empty", "typing", "filled"]) },
    draw: ({ props, fill }) => {
      const empty = str(props, "state") === "empty";
      const words2 = empty ? `<span class="ph-t">${esc(fill?.labels?.[0] ?? "Search")}</span>` : fill?.values?.[0] !== void 0 ? `<span class="q">${esc(fill.values[0])}${str(props, "state") === "typing" ? `<i class="caret"></i>` : ""}</span>` : bar(45, "in");
      const scope = flag(props, "scope") ? `<span class="scope">${fill ? tx("All", "meta", "span") : bar(100, "in")}</span>` : "";
      return `<div class="search"><span class="ico-t">${glyph("search")}</span>${words2}${scope}</div>`;
    }
  },
  {
    id: "segmented-control",
    kind: "primitive",
    category: "input",
    namedBy: 4,
    h: 44,
    props: { count: count(2, 5, 3), selected: index(5) },
    draw: ({ props, fill }) => `<div class="seg">${rowsOf(num(props, "count"), (i) => `<span class="${i + 1 === sel(props, "selected", "count") ? "on" : ""}">${word(fill?.labels, i, bar(60, "in"))}</span>`)}</div>`
  },
  {
    id: "fab",
    kind: "primitive",
    category: "input",
    namedBy: 2,
    h: 64,
    props: { extended: yn() },
    elements: { action: { accepts: [...intentsIn("form"), "upload", "share", "messages", "search"], default: "add" } },
    draw: ({ props, label, intent, hot }) => `<div class="fab-wrap"><span class="fab${flag(props, "extended") ? " ext" : ""}"${hot("action")}>${glyph(intent("action"))}${flag(props, "extended") ? ` ${label("action")}` : ""}</span></div>`
  },
  // ---- navigation
  {
    id: "app-bar",
    kind: "primitive",
    category: "navigation",
    namedBy: 3,
    h: 56,
    props: { title: yn(true), leading: choice(["none", "back", "menu", "close"], "back"), actions: count(0, 3, 1), search: yn() },
    elements: upTo(3, "action", "actions", ACTIONS, ["more", "share", "add"]),
    draw: ({ props, label, intent, hot, title }) => {
      const lead2 = str(props, "leading");
      return `<div class="appbar">${lead2 === "none" ? "" : ibtn(lead2, lead2 === "back" ? "Back" : lead2 === "menu" ? "Menu" : "Close", hot("leading"))}<span class="t">${flag(props, "title") ? title : ""}</span>${flag(props, "search") ? ibtn("search", "Search") : ""}${rowsOf(num(props, "actions"), (i) => ibtn(intent(`action-${i + 1}`), label(`action-${i + 1}`), hot(`action-${i + 1}`)))}</div>`;
    }
  },
  {
    id: "tab-bar",
    kind: "primitive",
    category: "navigation",
    namedBy: 4,
    h: 64,
    props: { items: count(3, 5, 4), selected: index(5), labels: yn(true) },
    elements: upTo(5, "tab", "items", NAV_JUMPS, ["home", "search", "notifications", "profile", "settings"]),
    draw: ({ props, label, intent, hot }) => `<nav class="tabbar">${rowsOf(num(props, "items"), (i) => `<span class="tab${i + 1 === sel(props, "selected", "items") ? " on" : ""}"${hot(`tab-${i + 1}`)}><b>${glyph(intent(`tab-${i + 1}`))}</b>${flag(props, "labels") ? `<small>${label(`tab-${i + 1}`)}</small>` : ""}</span>`)}</nav>`
  },
  {
    id: "side-nav",
    kind: "primitive",
    category: "navigation",
    namedBy: 4,
    h: 400,
    props: { items: count(3, 10, 5), selected: index(10), groups: count(0, 3, 0), collapsed: yn() },
    elements: upTo(10, "item", "items", NAV_JUMPS, ["home", "search", "notifications", "messages", "settings", "profile", "help", "contact", "terms", "upgrade"]),
    draw: ({ props, label, intent, hot }) => {
      const collapsed = flag(props, "collapsed");
      const groups = num(props, "groups");
      return `<nav class="sidenav${collapsed ? " collapsed" : ""}">${rowsOf(num(props, "items"), (i) => `${groups > 0 && i > 0 && i % Math.ceil(num(props, "items") / (groups + 1)) === 0 ? `<hr>` : ""}<span class="nav-i${i + 1 === sel(props, "selected", "items") ? " on" : ""}"${hot(`item-${i + 1}`)}><b>${glyph(intent(`item-${i + 1}`))}</b>${collapsed ? "" : label(`item-${i + 1}`)}</span>`)}</nav>`;
    }
  },
  {
    id: "tabs",
    kind: "primitive",
    category: "navigation",
    namedBy: 9,
    h: 44,
    props: { count: count(2, 6, 3), selected: index(6), style: choice(["line", "pill", "vertical"]) },
    draw: ({ props, fill }) => `<div class="tabs ${str(props, "style")}${fill ? " worded" : ""}">${rowsOf(num(props, "count"), (i) => `<span class="${i + 1 === sel(props, "selected", "count") ? "on" : ""}">${word(fill?.labels, i, bar(70, "in"))}</span>`)}</div>`
  },
  {
    id: "page-indicator",
    kind: "primitive",
    category: "navigation",
    namedBy: 2,
    h: 24,
    props: { count: count(2, 6, 3), current: index(6) },
    draw: ({ props }) => `<div class="dots">${rowsOf(num(props, "count"), (i) => `<i class="${i + 1 === sel(props, "current", "count") ? "on" : ""}"></i>`)}</div>`
  },
  {
    id: "steps",
    kind: "primitive",
    category: "navigation",
    namedBy: 2,
    h: 40,
    props: { count: count(2, 6, 3), current: index(6), labels: yn() },
    draw: ({ props, fill }) => stepsRow(num(props, "count"), sel(props, "current", "count"), flag(props, "labels"), fill?.labels)
  },
  // ---- data
  {
    id: "chart",
    kind: "primitive",
    category: "data",
    namedBy: 3,
    h: 200,
    props: { kind: choice(["bar", "column", "line", "area", "pie", "donut", "sparkline"]), series: count(1, 4, 1), legend: yn() },
    draw: ({ props, fill }) => chartSvg(str(props, "kind"), num(props, "series"), flag(props, "legend"), fill)
  },
  // ---- overlay
  {
    id: "drawer",
    kind: "primitive",
    category: "overlay",
    namedBy: 4,
    h: 480,
    props: { edge: choice(["left", "right"]), items: count(3, 10, 6) },
    elements: upTo(10, "item", "items", NAV_JUMPS, ["home", "profile", "notifications", "messages", "settings", "help", "terms", "contact", "search", "upgrade"]),
    draw: ({ props, label, intent, hot, fill }) => `<div class="drawer ${str(props, "edge")}"><div class="drawer-head">${avatarOf(fill?.person, "m")}${fill?.person ? `<div class="row-t">${tx(fill.person, "k")}${fill.sub ? tx(fill.sub, "meta") : ""}</div>` : bar(50)}</div>${rowsOf(num(props, "items"), (i) => `<span class="nav-i"${hot(`item-${i + 1}`)}><b>${glyph(intent(`item-${i + 1}`))}</b>${label(`item-${i + 1}`)}</span>`)}</div>`
  },
  {
    id: "sheet",
    kind: "primitive",
    category: "overlay",
    namedBy: 2,
    h: 300,
    props: { edge: choice(["bottom", "side"]), detent: choice(["half", "full"]), kind: choice(["sheet", "action-sheet"], "action-sheet") },
    elements: {
      ...Object.fromEntries(["share", "copy", "delete"].map((dflt, i) => [`action-${i + 1}`, {
        accepts: [...intentsIn("overlay", "form", "in-place")],
        default: dflt,
        when: (p) => p.kind === "action-sheet"
      }])),
      primary: { accepts: ALL_INTENTS, default: "done", when: (p) => p.kind === "sheet" },
      cancel: { accepts: intentsIn("back"), default: "cancel" }
    },
    draw: ({ props, label, hot, fill }) => {
      const action = str(props, "kind") === "action-sheet";
      const words2 = fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(40, "k")}${bars(4)}`;
      const body = action ? `<div class="sheet-actions">${rowsOf(3, (i) => `<span class="sheet-a${i === 2 ? " destructive" : ""}"${hot(`action-${i + 1}`)}>${label(`action-${i + 1}`)}</span>`)}</div>` : `<div class="grab"></div>${words2}<div class="actions">${btn(label("primary"), "primary", "block", hot("primary"))}</div>`;
      return `<div class="sheet ${str(props, "edge")} ${str(props, "detent")}">${body}<div class="actions">${btn(label("cancel"), "secondary", "block", hot("cancel"))}</div></div>`;
    }
  },
  {
    id: "modal",
    kind: "primitive",
    category: "overlay",
    namedBy: 9,
    h: 260,
    props: { kind: choice(["dialog", "alert", "fullscreen"]), actions: count(1, 3, 2), destructive: yn(), dismiss: yn(true) },
    elements: upTo(3, "action", "actions", [...intentsIn("forward", "back", "overlay")], ["confirm", "cancel", "more"]),
    draw: ({ props, label, hot, fill }) => `<div class="dialog ${str(props, "kind")}">${flag(props, "dismiss") ? `<span class="x">${glyph("close")}</span>` : ""}${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(55, "k")}${bars(3)}`}<div class="actions row">${rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? flag(props, "destructive") ? "destructive" : "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`
  }
];
function sel(props, key, of) {
  return Math.min(num(props, key), num(props, of));
}
function word(list, i, fallback) {
  const w = nth(list, i);
  return w === void 0 ? fallback : esc(w);
}
function listRows(props, action = "", hot = "", items) {
  const lead2 = str(props, "leading");
  const trail = str(props, "trailing");
  const lines = Number(props.lines ?? 2);
  const leading = (i, it) => lead2 === "icon" ? it?.motif ? thumbPic(it.motif, "ico") : icon() : lead2 === "avatar" ? avatarOf(it?.person, "m") : lead2 === "thumbnail" ? it?.motif ? thumbPic(it.motif) : `<span class="thumb"></span>` : lead2 === "checkbox" ? `<span class="cb${i === 0 ? " on" : ""}"></span>` : "";
  const trailing = (i, it) => trail === "chevron" || trail === "action" ? `<span class="chev">\u203A</span>` : trail === "switch" ? toggle(i % 2 === 0) : trail === "meta" ? it?.meta !== void 0 ? tx(it.meta, "meta r", "span") : bar(14, "meta") : trail === "badge" ? it ? `<span class="badge n">${1 + i * 3 % 7}</span>` : `<span class="badge"></span>` : "";
  const text = (i, it) => {
    if (!it) return bars(Number(props.lines ?? 1), i);
    const second = trail === "meta" ? dot(it.sub, it.status) : dot(it.sub, it.status, it.meta);
    return `${tx(it.title, "k")}${lines >= 2 && second ? tx(second, "meta") : ""}${lines >= 3 && it.text ? tx(it.text, "meta") : ""}`;
  };
  return `<div class="list${props.dividers === false ? "" : " div"}">${rowsOf(num(props, "rows"), (i) => {
    const it = nth(items, i);
    return `<div class="row"${hot}>${leading(i, it)}<div class="row-t">${text(i, it)}</div>${trailing(i, it)}${action}</div>`;
  })}</div>`;
}
function stepsRow(n, current, labels, names) {
  return `<div class="steps">${rowsOf(n, (i) => `<span class="step${i + 1 < current ? " done" : i + 1 === current ? " on" : ""}"><b>${i + 1}</b>${labels ? names && names.length > 0 ? `<small>${word(names, i, "")}</small>` : bar(70, "in") : ""}</span>`)}</div>`;
}
var SHADES = [77, 53, 36, 22].map((pct) => `color-mix(in srgb, var(--w-primary) ${pct}%, var(--w-ground))`);
function valuesOf(fill, s, fallback, lo, hi) {
  const v = fill?.series?.[s % (fill.series.length || 1)];
  if (!v || v.length === 0) return [...fallback];
  return fallback.map((_, i) => Math.round(lo + v[i % v.length] / 100 * (hi - lo)));
}
function chartSvg(kind, series, legend, data) {
  const shades = SHADES;
  const fill = (c) => `style="fill:${c}"`;
  const stroke = (c) => `fill="none" style="stroke:${c}"`;
  let marks = "";
  if (kind === "pie" || kind === "donut") {
    marks = `<circle cx="100" cy="60" r="48" ${fill(shades[3])}/><path d="M100 60 L100 12 A48 48 0 0 1 145 76 Z" ${fill(shades[0])}/>${kind === "donut" ? `<circle cx="100" cy="60" r="24" ${fill("var(--w-ground)")}/>` : ""}`;
  } else if (kind === "bar" || kind === "column") {
    const vals = valuesOf(data, 0, [40, 70, 55, 90, 65, 80], 20, 95);
    marks = vals.map((v, i) => rowsOf(series, (s) => kind === "column" ? `<rect x="${12 + i * 31 + s * (24 / series)}" y="${110 - v * (1 - s * 0.15)}" width="${24 / series - 1}" height="${v * (1 - s * 0.15)}" ${fill(shades[s])}/>` : `<rect x="10" y="${8 + i * 17 + s * (14 / series)}" width="${v * 1.9 * (1 - s * 0.15)}" height="${14 / series - 1}" ${fill(shades[s])}/>`)).join("");
  } else {
    marks = rowsOf(series, (s) => {
      const pts = valuesOf(data, s, [70, 55, 62, 35, 48, 22, 30], 78, 12).map((v, i) => `${10 + i * 30},${Math.min(108, v + (data?.series ? 0 : s * 14))}`).join(" ");
      return kind === "area" ? `<polygon points="10,110 ${pts} 190,110" ${fill(shades[s + 1] ?? shades[3])}/><polyline points="${pts}" ${stroke(shades[s])} stroke-width="2"/>` : `<polyline points="${pts}" ${stroke(shades[s])} stroke-width="2"/>`;
    });
  }
  const axis = kind === "pie" || kind === "donut" || kind === "sparkline" ? "" : `<line x1="8" y1="110" x2="194" y2="110" style="stroke:var(--w-line)"/>`;
  const ticks = data?.values && axis && kind !== "bar" ? `<div class="ticks">${data.values.slice(0, kind === "column" ? 6 : 7).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "";
  return `<div class="chart k-${esc(kind)}"><svg viewBox="0 0 200 ${kind === "sparkline" ? 90 : 116}" preserveAspectRatio="none">${axis}${marks}</svg>${ticks}${legend ? `<div class="legend">${rowsOf(series, (s) => `<span><i style="background:${shades[s]}"></i>${word(data?.labels, s, bar(100, "in"))}</span>`)}</div>` : ""}</div>`;
}

// packages/modules/wireframe/src/catalog/blocks.ts
var FORWARD = intentsIn("forward");
var BACKS = intentsIn("back");
var JUMPS = intentsIn("jump");
function lead(words2, width = 28) {
  return words2 !== void 0 ? `<span class="lead">${esc(words2)}</span>` : bar(width, "in");
}
var FIELD_KINDS = ["Email", "Password", null, "Phone", null, null, "Number", null, null, null];
var BLOCKS = [
  // ---- navigation
  {
    id: "navbar",
    kind: "block",
    category: "navigation",
    namedBy: 4,
    h: 64,
    props: { links: count(3, 7, 4), cta: count(0, 2, 1), search: yn(), mobile: choice(["hamburger", "links"]) },
    elements: {
      ...upTo(7, "link", "links", JUMPS, ["home", "search", "upgrade", "contact", "help", "terms", "messages"]),
      ...upTo(2, "cta", "cta", [...intentsIn("auth", "forward"), ...JUMPS], ["sign-up", "sign-in"])
    },
    draw: ({ props, label, hot, wide, fill }) => {
      const links = wide || str(props, "mobile") === "links" ? `<span class="links">${rowsOf(num(props, "links"), (i) => `<span class="lnk"${hot(`link-${i + 1}`)}>${label(`link-${i + 1}`)}</span>`)}</span>` : "";
      return `<div class="navbar"><span class="brand">${fill?.motif ? thumbPic(fill.motif, "logo-pic") : img("1/1", "sm")}</span>${links}<span class="sp"></span>${flag(props, "search") ? ibtn("search", "Search") : ""}${rowsOf(num(props, "cta"), (i) => btn(label(`cta-${i + 1}`), i === 0 ? "primary" : "secondary", "s", hot(`cta-${i + 1}`)))}${!wide && str(props, "mobile") === "hamburger" ? ibtn("menu", "Menu") : ""}</div>`;
    }
  },
  // ---- layout
  {
    id: "app-shell",
    kind: "block",
    category: "layout",
    namedBy: 2,
    h: 24,
    props: { nav: choice(["top", "side", "bottom", "none"], "bottom"), aside: yn() },
    draw: ({ wide, fill }) => wide ? `<div class="chrome web"><i></i><i></i><i></i>${fill?.values?.[1] !== void 0 ? `<span class="url-t">${esc(fill.values[1])}</span>` : bar(30, "url")}</div>` : `<div class="chrome app">${fill?.values?.[0] !== void 0 ? `<span class="clock-t">${esc(fill.values[0])}</span>` : bar(12, "clock")}<span class="sp"></span><i></i><i></i><i></i></div>`
  },
  {
    id: "page-header",
    kind: "block",
    category: "layout",
    namedBy: 1,
    h: 96,
    props: { breadcrumbs: yn(), actions: count(0, 3, 1), tabs: yn(), meta: yn() },
    elements: upTo(3, "action", "actions", [...intentsIn("form", "overlay", "forward"), ...JUMPS], ["add", "share", "more"]),
    draw: ({ props, label, hot, title, fill }) => `<div class="pagehead">${flag(props, "breadcrumbs") ? `<div class="crumbs">${fill?.values ? fill.values.map((c) => `<span class="cr">${esc(c)}</span>`).join("<span>/</span>") : `${bar(12, "in")}<span>/</span>${bar(12, "in")}<span>/</span>${bar(14, "in")}`}</div>` : ""}<div class="ph-row"><div class="h h1">${title}</div><span class="sp"></span>${rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "s", hot(`action-${i + 1}`)))}</div>${flag(props, "meta") ? fill?.sub !== void 0 ? tx(fill.sub, "meta") : bar(35, "meta") : ""}${flag(props, "tabs") ? `<div class="tabs line${fill ? " worded" : ""}">${rowsOf(3, (i) => `<span class="${i === 0 ? "on" : ""}">${word(fill?.labels, i, bar(70, "in"))}</span>`)}</div>` : ""}</div>`
  },
  // ---- auth
  {
    id: "sign-in-form",
    kind: "block",
    category: "auth",
    namedBy: 3,
    h: 360,
    props: { social: count(0, 3, 0), remember: yn(), forgot: yn(true), "signup-link": yn(true) },
    elements: {
      submit: { accepts: ["sign-in", "continue", "next"], default: "sign-in" },
      ...upTo(3, "social", "social", ["sign-in", "continue"], ["continue"]),
      remember: { accepts: ["remember"], default: "remember", when: (p) => p.remember === true },
      forgot: { accepts: ["forgot-password", "help"], default: "forgot-password", when: (p) => p.forgot === true },
      "signup-link": { accepts: ["sign-up"], default: "sign-up", when: (p) => p["signup-link"] === true }
    },
    draw: ({ props, label, hot, fill }) => `<div class="form">${field("Email", 0, fill?.values?.[0])}${field("Password", 1, fill?.values?.[1])}${flag(props, "remember") || flag(props, "forgot") ? `<div class="between">${flag(props, "remember") ? check(label("remember"), hot("remember")) : "<span></span>"}${flag(props, "forgot") ? `<span class="lnk"${hot("forgot")}>${label("forgot")}</span>` : ""}</div>` : ""}<div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div>${num(props, "social") > 0 ? `<div class="or">${bar(100, "rule")}</div><div class="actions stack">${rowsOf(num(props, "social"), (i) => btn(`<span class="logo-dot"></span>${label(`social-${i + 1}`)}`, "secondary", "block", hot(`social-${i + 1}`)))}</div>` : ""}${flag(props, "signup-link") ? `<div class="link-row">${lead(fill?.lines?.[0])}<span class="lnk"${hot("signup-link")}>${label("signup-link")}</span></div>` : ""}</div>`
  },
  {
    id: "sign-up-form",
    kind: "block",
    category: "auth",
    namedBy: 3,
    h: 420,
    props: { fields: count(2, 6, 3), social: count(0, 3, 0), terms: yn(true), "signin-link": yn(true) },
    elements: {
      submit: { accepts: ["sign-up", "continue", "next", "submit"], default: "sign-up" },
      ...upTo(3, "social", "social", ["sign-up", "continue"], ["continue"]),
      terms: { accepts: ["terms", "accept"], default: "terms", when: (p) => p.terms === true },
      "signin-link": { accepts: ["sign-in"], default: "sign-in", when: (p) => p["signin-link"] === true }
    },
    draw: ({ props, label, hot, fill }) => `<div class="form">${rowsOf(num(props, "fields"), (i) => field(fill?.labels?.[i] !== void 0 ? esc(fill.labels[i]) : i === 0 ? null : FIELD_KINDS[i - 1] ?? null, i, fill?.values?.[i]))}${flag(props, "terms") ? `<div class="chk"><span class="cb"></span>${lead(fill?.lines?.[0], 30)}<span class="lnk"${hot("terms")}>${label("terms")}</span></div>` : ""}<div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div>${num(props, "social") > 0 ? `<div class="actions stack">${rowsOf(num(props, "social"), (i) => btn(`<span class="logo-dot"></span>${label(`social-${i + 1}`)}`, "secondary", "block", hot(`social-${i + 1}`)))}</div>` : ""}${flag(props, "signin-link") ? `<div class="link-row">${lead(fill?.lines?.[1])}<span class="lnk"${hot("signin-link")}>${label("signin-link")}</span></div>` : ""}</div>`
  },
  {
    id: "verify-code",
    kind: "block",
    category: "auth",
    namedBy: 2,
    h: 260,
    props: { digits: count(4, 8, 6), resend: yn(true) },
    elements: {
      submit: { accepts: FORWARD, default: "confirm" },
      resend: { accepts: ["retry"], default: "retry", when: (p) => p.resend === true }
    },
    draw: ({ props, label, hot, fill }) => `<div class="form center">${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}<div class="code">${rowsOf(num(props, "digits"), (i) => `<span>${i < 2 && fill?.values ? esc(nth(fill.values, i)) : ""}</span>`)}</div><div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div>${flag(props, "resend") ? `<div class="link-row">${lead(fill?.sub, 24)}<span class="lnk"${hot("resend")}>${label("resend")}</span></div>` : ""}</div>`
  },
  {
    id: "forgot-password",
    kind: "block",
    category: "auth",
    namedBy: 1,
    h: 240,
    props: { step: choice(["request", "sent"]) },
    elements: {
      submit: { accepts: FORWARD, default: "continue", when: (p) => p.step === "request" },
      back: { accepts: ["sign-in", "back"], default: "sign-in" }
    },
    draw: ({ props, label, hot, fill }) => str(props, "step") === "request" ? `<div class="form">${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}${field("Email", 0, fill?.values?.[0])}<div class="actions">${btn(label("submit"), "primary", "block", hot("submit"))}</div><div class="link-row"><span class="lnk"${hot("back")}>${label("back")}</span></div></div>` : `<div class="form center"><div class="glyph">\u2709</div>${fill?.heading !== void 0 ? tx(fill.heading, "title") : ""}${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}<div class="actions">${btn(label("back"), "secondary", "block", hot("back"))}</div></div>`
  },
  // ---- onboarding
  {
    id: "onboarding-step",
    kind: "block",
    category: "onboarding",
    namedBy: 4,
    h: 480,
    props: { media: choice(["illustration", "image", "none"]), steps: count(2, 5, 3), current: index(5), skip: yn(true) },
    elements: {
      next: { accepts: FORWARD, default: "next" },
      skip: { accepts: ["skip"], default: "skip", when: (p) => p.skip === true }
    },
    draw: ({ props, label, hot, fill }) => `<div class="onb">${flag(props, "skip") ? `<div class="right"><span class="lnk"${hot("skip")}>${label("skip")}</span></div>` : ""}${str(props, "media") === "none" ? "" : fill?.motif ? pic(fill.motif, str(props, "media") === "image" ? "4/3" : "1/1", str(props, "media")) : img(str(props, "media") === "image" ? "4/3" : "1/1", str(props, "media") === "illustration" ? "illustration pat-dotted" : str(props, "media"))}<div class="center">${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(60, "k")}${bars(2)}`}</div><div class="dots">${rowsOf(num(props, "steps"), (i) => `<i class="${i + 1 === sel(props, "current", "steps") ? "on" : ""}"></i>`)}</div><div class="actions">${btn(label("next"), "primary", "block", hot("next"))}</div></div>`
  },
  // ---- input
  {
    id: "wizard",
    kind: "block",
    category: "input",
    namedBy: 3,
    h: 420,
    props: { steps: count(2, 6, 3), current: index(6), summary: yn() },
    elements: {
      next: { accepts: FORWARD, default: "next" },
      back: { accepts: BACKS, default: "back" }
    },
    draw: ({ props, label, hot, fill }) => `<div class="wizard">${stepsRow(num(props, "steps"), sel(props, "current", "steps"), true, fill?.groups)}${flag(props, "summary") ? `<div class="card">${fill?.lines ? `${tx(fill.lines[0], "k")}${fill.lines[1] ? tx(fill.lines[1], "meta") : ""}` : bars(2)}</div>` : ""}${rowsOf(3, (i) => field(fill?.labels?.[i] !== void 0 ? esc(fill.labels[i]) : null, i, fill?.values?.[i]))}<div class="actions row">${btn(label("back"), "secondary", "", hot("back"))}${btn(label("next"), "primary", "", hot("next"))}</div></div>`
  },
  {
    id: "form-block",
    kind: "block",
    category: "input",
    namedBy: 5,
    h: 400,
    props: { fields: count(2, 10, 4), sections: count(1, 3, 1), actions: choice(["submit", "submit+cancel"]) },
    elements: {
      submit: { accepts: FORWARD, default: "save" },
      cancel: { accepts: BACKS, default: "cancel", when: (p) => p.actions === "submit+cancel" }
    },
    draw: ({ props, label, hot, fill }) => {
      const perSection = Math.ceil(num(props, "fields") / num(props, "sections"));
      let i = 0;
      const sections = rowsOf(num(props, "sections"), (s) => {
        let out = num(props, "sections") > 1 ? `<div class="sec">${fill?.groups?.[s] !== void 0 ? tx(fill.groups[s], "sec-t") : bar(35, "k")}</div>` : "";
        for (let j = 0; j < perSection && i < num(props, "fields"); j++, i++) {
          const l = nth(fill?.labels, i);
          out += field(l !== void 0 ? esc(l) : null, i + s, nth(fill?.values, i));
        }
        return out;
      });
      return `<div class="form">${sections}<div class="actions row">${str(props, "actions") === "submit+cancel" ? btn(label("cancel"), "secondary", "", hot("cancel")) : ""}${btn(label("submit"), "primary", "", hot("submit"))}</div></div>`;
    }
  },
  {
    id: "filter-panel",
    kind: "block",
    category: "input",
    namedBy: 3,
    h: 360,
    props: { groups: count(2, 6, 3), apply: yn(true) },
    elements: {
      apply: { accepts: ["apply", "done"], default: "apply", when: (p) => p.apply === true },
      reset: { accepts: BACKS, default: "cancel", when: (p) => p.apply === true }
    },
    draw: ({ props, label, hot, fill }) => `<div class="filters">${fill ? tx("Filters", "sec-t") : bar(35, "k")}${rowsOf(num(props, "groups"), (g) => `<div class="grp">${fill?.groups?.[g] !== void 0 ? tx(fill.groups[g], "lbl") : bar(30 + g % 3 * 8, "k")}${rowsOf(3, (i) => `<div class="chk"><span class="cb${(i + g) % 3 === 0 ? " on" : ""}"></span>${word(fill?.labels?.slice(g * 3, g * 3 + 3), i, bar(50 + i * 10, "in"))}</div>`)}</div>`)}${flag(props, "apply") ? `<div class="actions row">${btn(label("reset"), "secondary", "", hot("reset"))}${btn(label("apply"), "primary", "", hot("apply"))}</div>` : ""}</div>`
  },
  {
    id: "settings-group",
    kind: "block",
    category: "input",
    namedBy: 5,
    h: 420,
    props: { groups: count(1, 4, 2), rows: count(2, 8, 4), row: choice(["switch", "chevron", "value", "mixed"], "mixed") },
    draw: ({ props, fill }) => {
      const kind = str(props, "row");
      const rows = num(props, "rows");
      const trail = (i, at) => {
        const k = kind === "mixed" ? ["switch", "chevron", "value"][i % 3] : kind;
        const v = nth(fill?.values, at);
        return k === "switch" ? toggle(i % 2 === 0) : k === "chevron" ? `<span class="chev">\u203A</span>` : v ? tx(v, "meta r", "span") : bar(18, "meta");
      };
      return `<div class="settings">${rowsOf(num(props, "groups"), (g) => `<div class="sec">${fill?.groups?.[g] !== void 0 ? tx(fill.groups[g], "sec-t") : bar(25 + g * 5, "k")}</div><div class="list div inset">${rowsOf(rows, (i) => `<div class="row">${icon()}<div class="row-t">${word(fill?.labels, g * rows + i, bar(40 + (i + g) % 4 * 10))}</div>${trail(i, g * rows + i)}</div>`)}</div>`)}</div>`;
    }
  },
  // ---- data
  {
    id: "stats-row",
    kind: "block",
    category: "data",
    namedBy: 4,
    h: 104,
    props: { count: count(2, 4, 3), trend: yn(true), chart: yn() },
    draw: ({ props, fill }) => `<div class="stats c${num(props, "count")}">${rowsOf(num(props, "count"), (i) => {
      const st = nth(fill?.stats, i);
      const spark = flag(props, "chart") ? chartSvg("sparkline", 1, false, fill?.series ? { series: [nth(fill.series, i)] } : void 0) : "";
      if (!st) {
        return `<div class="stat">${bar(60, "k")}<div class="big">${bar(50 + i % 3 * 12, "fat")}</div>${flag(props, "trend") ? `<span class="trend">${i % 2 ? "\u25BC" : "\u25B2"} ${bar(30, "in")}</span>` : ""}${spark}</div>`;
      }
      const trend = flag(props, "trend") && st.delta ? `<span class="trend">${st.down ? "\u25BC" : "\u25B2"} ${esc(st.delta)}</span>` : "";
      return `<div class="stat">${tx(st.label, "lbl")}<div class="big">${tx(st.value, "big", "span")}</div>${trend}${spark}</div>`;
    })}</div>`
  },
  {
    id: "stacked-list",
    kind: "block",
    category: "data",
    namedBy: 3,
    h: 360,
    props: {
      rows: count(3, 12, 6),
      leading: choice(["icon", "avatar", "thumbnail", "none"], "avatar"),
      trailing: choice(["chevron", "meta", "action", "none"]),
      sections: count(0, 3, 0)
    },
    elements: { "row-action": { accepts: [...intentsIn("in-place", "overlay")], default: "follow", when: (p) => p.trailing === "action" } },
    draw: ({ props, label, hot, fill }) => {
      const sections = num(props, "sections");
      const rows = num(props, "rows");
      const per = sections > 0 ? Math.ceil(rows / sections) : rows;
      const body = (n, from) => listRows(
        { rows: n, leading: str(props, "leading"), trailing: str(props, "trailing") === "action" ? "none" : str(props, "trailing"), lines: 2, dividers: true },
        str(props, "trailing") === "action" ? btn(label("row-action"), "secondary", "s", hot("row-action")) : "",
        hot("row"),
        fill?.items ? Array.from({ length: n }, (_, i) => nth(fill.items, from + i)) : void 0
      );
      if (sections === 0) return body(rows, 0);
      return rowsOf(sections, (s) => `<div class="sec">${fill?.groups?.[s] !== void 0 ? tx(fill.groups[s], "sec-t") : bar(22 + s * 6, "k")}</div>${body(Math.min(per, rows - s * per), s * per)}`);
    }
  },
  {
    id: "card-grid",
    kind: "block",
    category: "data",
    namedBy: 3,
    h: 400,
    props: { items: count(3, 12, 6), columns: count(2, 4, 2), media: yn(true) },
    draw: ({ props, hot, wide, fill }) => `<div class="grid" style="grid-template-columns:repeat(${wide ? num(props, "columns") : Math.min(2, num(props, "columns"))},1fr)">${rowsOf(num(props, "items"), (i) => {
      const it = nth(fill?.items, i);
      if (!it) return `<div class="card"${hot("row")}>${flag(props, "media") ? img("4/3") : ""}${bar(70 - i % 3 * 10, "k")}${bar(45)}</div>`;
      return `<div class="card"${hot("row")}>${flag(props, "media") && it.motif ? pic(it.motif, "4/3") : ""}${tx(it.title, "k")}${tx(dot(it.sub ?? it.meta), "meta")}${!flag(props, "media") && it.status ? `<div>${statusTag(it.status)}</div>` : ""}</div>`;
    })}</div>`
  },
  {
    id: "data-table",
    kind: "block",
    category: "data",
    namedBy: 4,
    h: 420,
    props: { columns: count(3, 8, 4), rows: count(5, 15, 6), toolbar: yn(true), pagination: yn(), select: yn() },
    elements: upTo(3, "tool", "toolbar", [...intentsIn("overlay", "form"), "search"], ["filter", "sort", "add"]),
    draw: ({ props, label, intent, hot, wide, fill }) => {
      const cols = wide ? num(props, "columns") : Math.min(3, num(props, "columns"));
      const pickCol = (j) => wide ? j : [0, 2, 3][j];
      const cell = (i, j) => {
        const c = nth(fill?.items, i)?.cells?.[pickCol(j)];
        if (c === void 0) return `<td>${bar(40 + (i + j) % 5 * 12, j === 0 ? "k" : "")}</td>`;
        return `<td>${pickCol(j) === 2 ? statusTag(c) : tx(c, j === 0 ? "k" : "", "span")}</td>`;
      };
      return `<div class="table">${flag(props, "toolbar") ? `<div class="toolbar"><div class="search sm"><span class="ico-t">${glyph("search")}</span><span class="ph-t">Search</span></div><span class="sp"></span>${rowsOf(3, (i) => i === 2 ? btn(label("tool-3"), "primary", "s", hot("tool-3")) : ibtn(intent(`tool-${i + 1}`), label(`tool-${i + 1}`), hot(`tool-${i + 1}`)))}</div>` : ""}<table><thead><tr>${flag(props, "select") ? `<th class="sel"><span class="cb"></span></th>` : ""}${rowsOf(cols, (j) => `<th>${word(fill?.labels ? [fill.labels[pickCol(j)] ?? ""] : void 0, 0, bar(50, "k"))}</th>`)}</tr></thead><tbody>${rowsOf(num(props, "rows"), (i) => `<tr${hot("row")}>${flag(props, "select") ? `<td class="sel"><span class="cb${i === 1 ? " on" : ""}"></span></td>` : ""}${rowsOf(cols, (j) => cell(i, j))}</tr>`)}</tbody></table>${flag(props, "pagination") ? `<div class="pager">${fill ? `<span class="count">1\u2013${num(props, "rows")} of ${num(props, "rows") * 7}</span>` : ""}<span>\u2039</span><span class="on">1</span><span>2</span><span>3</span><span>\u203A</span></div>` : ""}</div>`;
    }
  },
  // ---- content
  {
    id: "blog-list",
    kind: "block",
    category: "content",
    namedBy: 3,
    h: 420,
    props: { posts: count(3, 9, 4), layout: choice(["list", "grid", "featured"]) },
    draw: ({ props, wide, fill }) => {
      const layout = str(props, "layout");
      const media = (it, ratio2, cls) => it?.motif ? pic(it.motif, ratio2, cls) : img(ratio2, cls);
      const post = (i) => {
        const it = nth(fill?.items, i);
        const words2 = it ? `${tx(it.sub ?? "", "meta")}${tx(it.title, "k wrap")}${tx(it.text ?? "", "body clamp")}` : `${bar(35, "meta")}${bar(85 - i % 3 * 10, "k")}${bars(2, i)}`;
        return `<div class="post ${layout}">${media(it, layout === "list" ? "1/1" : "16/9", layout === "list" ? "thumb-img" : "")}<div>${words2}</div></div>`;
      };
      if (layout === "grid") return `<div class="grid" style="grid-template-columns:repeat(${wide ? 3 : 2},1fr)">${rowsOf(num(props, "posts"), post)}</div>`;
      const top = nth(fill?.items, 0);
      return `<div class="posts">${rowsOf(num(props, "posts"), (i) => layout === "featured" && i === 0 ? `<div class="post featured-top">${media(top, "16/9", "")}${top ? `${tx(top.title, "title")}${tx(top.text ?? "", "body")}` : `${bar(90, "k")}${bars(2)}`}</div>` : post(i))}</div>`;
    }
  },
  {
    id: "long-form",
    kind: "block",
    category: "content",
    namedBy: 3,
    h: 480,
    props: { sections: count(1, 6, 3), toc: yn() },
    draw: ({ props, fill }) => `<div class="long">${flag(props, "toc") ? `<div class="toc">${rowsOf(num(props, "sections"), (i) => fill?.groups ? tx(nth(fill.groups, i), "meta") : bar(40 + i % 3 * 12, "in"))}</div>` : ""}${rowsOf(num(props, "sections"), (s) => fill?.groups ? `<div class="sec">${tx(nth(fill.groups, s), "sec-t")}</div>${tx([0, 1, 2].map((k) => nth(fill.lines, s * 3 + k) ?? "").join(" "), "body")}` : `<div class="sec">${bar(45 + s % 3 * 10, "k")}</div>${bars(4, s)}`)}</div>`
  },
  {
    id: "detail-header",
    kind: "block",
    category: "content",
    namedBy: 2,
    h: 320,
    props: { media: choice(["none", "hero", "carousel"], "hero"), meta: count(0, 4, 2), actions: count(0, 3, 2) },
    elements: upTo(3, "action", "actions", [...intentsIn("form", "overlay", "in-place"), "buy", "cart", "messages"], ["edit", "share", "like"]),
    draw: ({ props, label, hot, fill }) => `<div class="detail">${str(props, "media") === "none" ? "" : `${fill?.motif ? pic(fill.motif, "16/9") : img("16/9")}${str(props, "media") === "carousel" ? `<div class="dots">${rowsOf(4, (i) => `<i class="${i === 0 ? "on" : ""}"></i>`)}</div>` : ""}`}${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${fill.sub ? tx(fill.sub, "meta") : ""}` : bar(75, "title")}<div class="metas">${rowsOf(num(props, "meta"), (i) => {
      const m = nth(fill?.labels, i);
      return m === void 0 ? `<span class="meta-i">${icon()}${bar(60 + i % 2 * 20, "in")}</span>` : i === 0 ? statusTag(m) : `<span class="meta-i">${tx(m, "meta", "span")}</span>`;
    })}</div><div class="actions row">${rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`
  },
  {
    id: "hero-banner",
    kind: "block",
    category: "content",
    namedBy: 2,
    h: 360,
    props: { media: choice(["image", "illustration", "video", "none"], "image"), badge: yn(true), bullets: count(0, 4, 3), cta: count(1, 2, 2) },
    elements: upTo(2, "cta", "cta", [...intentsIn("auth", "forward"), ...JUMPS], ["get-started", "sign-in"]),
    draw: ({ props, label, hot, wide, fill }) => {
      const mKind = str(props, "media");
      const mWireCls = mKind === "illustration" ? "illustration pat-dotted" : mKind === "video" ? "pat-striped" : "";
      const mBox = fill?.motif ? pic(fill.motif, "4/3", mKind === "illustration" ? "illustration" : "") : img("4/3", mWireCls);
      const mediaEl = mKind === "none" ? "" : mKind === "video" ? `<div class="video hero-media">${mBox}<span class="play">\u25B6</span></div>` : `<div class="hero-media">${mBox}</div>`;
      const badgeEl = flag(props, "badge") ? fill?.sub !== void 0 ? `<div>${statusTag(fill.sub)}</div>` : `<span class="chip">${bar(48, "in emp-primary")}</span>` : "";
      const headEl = fill?.heading !== void 0 ? tx(fill.heading, "title hero-h") : bar(82, "title emp-primary");
      const bodyEl = fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2, 0, "emp-secondary");
      const bulletsEl = num(props, "bullets") > 0 ? `<div class="hero-bullets">${rowsOf(num(props, "bullets"), (i) => `<div class="chk"><span class="cb on"></span>${word(fill?.labels, i, bar(55 + i % 3 * 10, "in emp-tertiary"))}</div>`)}</div>` : "";
      const ctaEl = `<div class="actions row hero-cta">${rowsOf(num(props, "cta"), (i) => btn(label(`cta-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`cta-${i + 1}`)))}</div>`;
      return `<div class="hero${wide && mKind !== "none" ? " split" : ""}"><div class="hero-copy">${badgeEl}${headEl}${bodyEl}${bulletsEl}${ctaEl}</div>${mediaEl}</div>`;
    }
  },
  {
    id: "accordion",
    kind: "block",
    category: "content",
    namedBy: 3,
    h: 360,
    props: { items: count(3, 8, 5), open: index(8, 1) },
    draw: ({ props, fill }) => {
      const items = num(props, "items");
      const openIdx = sel(props, "open", "items");
      return `<div class="accordion">${rowsOf(items, (i) => {
        const expanded = i + 1 === openIdx;
        const it = nth(fill?.items, i);
        const head = it ? tx(it.title, "k wrap", "span") : bar(68 - i % 3 * 8, "k emp-primary");
        const body = expanded ? `<div class="acc-body">${it?.text ? tx(it.text, "body") : bars(2, i, "emp-secondary")}</div>` : "";
        return `<div class="acc-item${expanded ? " open" : ""}"><div class="acc-head">${head}<span class="chev">${expanded ? "\u2212" : "+"}</span></div>${body}</div>`;
      })}</div>`;
    }
  },
  // ---- social
  {
    id: "comment-list",
    kind: "block",
    category: "social",
    namedBy: 1,
    h: 360,
    props: { comments: count(2, 10, 3), nested: yn(), composer: yn(true) },
    elements: { post: { accepts: ["submit", "done", "save"], default: "submit", when: (p) => p.composer === true } },
    draw: ({ props, label, hot, fill }) => `<div class="comments">${fill?.heading !== void 0 ? tx(fill.heading, "sec-t") : bar(25, "k")}${rowsOf(num(props, "comments"), (i) => {
      const it = nth(fill?.items, i);
      const words2 = it ? `<div class="by">${tx(it.person ?? it.title, "k", "span")}${it.meta ? tx(it.meta, "meta", "span") : ""}</div>${tx(it.text ?? "", "body")}` : `${bar(30, "k")}${bars(2, i)}`;
      return `<div class="comment${flag(props, "nested") && i % 2 === 1 ? " nested" : ""}">${avatarOf(it?.person, "s")}<div class="row-t">${words2}</div></div>`;
    })}${flag(props, "composer") ? `<div class="composer"><div class="box">${fill ? `<span class="ph-t">Add a comment\u2026</span>` : bar(40, "ph")}</div>${btn(label("post"), "primary", "s", hot("post"))}</div>` : ""}</div>`
  },
  {
    id: "profile-header",
    kind: "block",
    category: "social",
    namedBy: 2,
    h: 240,
    props: { avatar: choice(["s", "l"], "l"), stats: count(0, 3, 3), actions: count(0, 2, 1), cover: yn() },
    elements: upTo(2, "action", "actions", ["follow", "messages", "edit", "share", "settings", "more"], ["edit", "share"]),
    draw: ({ props, label, hot, fill }) => `<div class="profile${flag(props, "cover") ? " covered" : ""}">${flag(props, "cover") ? img("3/1", "cover") : ""}${avatarOf(fill?.person, str(props, "avatar") === "l" ? "l" : "m")}${fill?.person ? `${tx(fill.person, "title")}${fill.sub ? tx(fill.sub, "meta") : ""}` : `${bar(40, "title")}${bar(28, "meta")}`}${num(props, "stats") > 0 ? `<div class="pstats">${rowsOf(num(props, "stats"), (i) => {
      const st = nth(fill?.stats, i);
      return st ? `<span>${tx(st.value, "big", "span")}${tx(st.label, "meta", "span")}</span>` : `<span>${bar(50, "fat")}${bar(70, "in")}</span>`;
    })}</div>` : ""}<div class="actions row">${rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`
  },
  {
    id: "feed-post",
    kind: "block",
    category: "social",
    namedBy: 2,
    h: 440,
    props: { media: choice(["none", "image", "video", "link"], "image"), actions: count(2, 4, 3), count: count(1, 6, 2) },
    elements: upTo(4, "action", "actions", [...intentsIn("in-place", "overlay"), "messages"], ["like", "messages", "share", "more"]),
    draw: ({ props, label, intent, hot, fill }) => rowsOf(num(props, "count"), (p) => {
      const media = str(props, "media");
      const it = nth(fill?.items, p);
      const m = (ratio2, cls = "") => it?.motif ? pic(it.motif, ratio2, cls) : img(ratio2, cls);
      const head = it ? `${tx(it.person ?? it.title, "k")}${tx(it.meta ?? "", "meta")}` : `${bar(35, "k")}${bar(20, "meta")}`;
      return `<div class="fpost"${hot("row")}><div class="fhead">${avatarOf(it?.person, "s")}<div class="row-t">${head}</div></div>${it ? tx(it.text ?? "", "body") : bars(2, p)}${media === "image" ? m("4/3") : media === "video" ? `<div class="video">${m("16/9", "pat-striped")}<span class="play">\u25B6</span></div>` : media === "link" ? `<div class="linkcard">${m("1/1", "thumb-img")}<div>${it ? `${tx(it.title, "k")}${tx(it.sub ?? "", "meta")}` : `${bar(70, "k")}${bar(40, "meta")}`}</div></div>` : ""}<div class="factions">${rowsOf(num(props, "actions"), (i) => `<span class="fa"${hot(`action-${i + 1}`)}>${glyph(intent(`action-${i + 1}`))} ${label(`action-${i + 1}`)}</span>`)}</div></div>`;
    })
  },
  // ---- media
  {
    id: "gallery-section",
    kind: "block",
    category: "media",
    namedBy: 3,
    h: 440,
    props: { items: count(4, 12, 9), layout: choice(["grid", "masonry", "carousel"]) },
    draw: ({ props, wide, fill }) => {
      const layout = str(props, "layout");
      const m = (i, ratio2) => {
        const it = nth(fill?.items, i);
        return it?.motif ? pic(it.motif, ratio2) : img(ratio2);
      };
      if (layout === "carousel") return `<div class="carousel">${m(0, "4/3")}<div class="dots">${rowsOf(Math.min(6, num(props, "items")), (i) => `<i class="${i === 0 ? "on" : ""}"></i>`)}</div></div>`;
      const ratios = layout === "masonry" ? ["3/4", "1/1", "4/3", "1/1", "3/4", "4/3"] : ["1/1"];
      return `<div class="${layout === "masonry" ? "masonry" : "grid tight"}" style="${layout === "masonry" ? `column-count:${wide ? 4 : 2}` : `grid-template-columns:repeat(${wide ? 4 : 3},1fr)`}">${rowsOf(num(props, "items"), (i) => m(i, ratios[i % ratios.length]))}</div>`;
    }
  },
  // ---- commerce
  {
    id: "product-card-list",
    kind: "block",
    category: "commerce",
    namedBy: 2,
    h: 440,
    props: { items: count(3, 12, 6), layout: choice(["grid", "list"]), price: yn(true), rating: yn() },
    draw: ({ props, hot, wide, fill }) => {
      const list = str(props, "layout") === "list";
      const card = (i) => {
        const it = nth(fill?.items, i);
        if (!it) {
          return `<div class="card product"${hot("row")}>${img("1/1", list ? "thumb-img" : "")}<div>${bar(75 - i % 3 * 10, "k")}${flag(props, "rating") ? `<span class="stars">\u2605\u2605\u2605\u2605\u2606</span>` : ""}${flag(props, "price") ? bar(30, "fat") : ""}</div></div>`;
        }
        const r = it.rating ?? 4;
        return `<div class="card product"${hot("row")}>${it.motif ? pic(it.motif, "1/1", list ? "thumb-img" : "") : img("1/1", list ? "thumb-img" : "")}<div>${tx(it.title, "k")}${flag(props, "rating") ? `<span class="stars">${"\u2605".repeat(r)}${"\u2606".repeat(5 - r)}</span>` : ""}${flag(props, "price") && it.meta ? tx(it.meta, "price") : ""}</div></div>`;
      };
      return str(props, "layout") === "list" ? `<div class="plist">${rowsOf(num(props, "items"), card)}</div>` : `<div class="grid" style="grid-template-columns:repeat(${wide ? 4 : 2},1fr)">${rowsOf(num(props, "items"), card)}</div>`;
    }
  },
  {
    id: "pricing-cards",
    kind: "block",
    category: "commerce",
    namedBy: 2,
    h: 440,
    props: { tiers: count(2, 4, 3), features: count(3, 6, 4), highlight: index(4, 2), billing: yn(true) },
    elements: upTo(4, "plan", "tiers", [...FORWARD, ...intentsIn("auth"), ...JUMPS], ["get-started", "upgrade", "contact", "continue"]),
    draw: ({ props, label, hot, wide, fill }) => {
      const tiers = num(props, "tiers");
      const hi = sel(props, "highlight", "tiers");
      const feats = num(props, "features");
      const billing = flag(props, "billing") ? `<div class="billing-row"><div class="seg">${rowsOf(2, (i) => `<span class="${i === 1 ? "on" : ""}">${word(fill?.groups, i, bar(55, "in"))}</span>`)}</div></div>` : "";
      const cards = rowsOf(tiers, (i) => {
        const popular = i + 1 === hi;
        const it = nth(fill?.items, i);
        const badge = popular ? it?.status ? `<div>${statusTag(it.status)}</div>` : `<span class="st tier-badge">${bar(40, "in emp-primary")}</span>` : "";
        const head = it ? `${tx(it.title, "k")}${tx(it.meta ?? "", "big")}${it.sub ? tx(it.sub, "meta") : ""}` : `${bar(45, "k emp-primary")}${bar(55, "fat emp-primary")}${bar(70, "meta emp-subtle")}`;
        const list = `<div class="tier-feats">${rowsOf(feats, (f) => `<div class="chk"><span class="cb on"></span>${word(it?.cells, f, bar(60 + (i + f) % 3 * 10, "in emp-tertiary"))}</div>`)}</div>`;
        const action = `<div class="actions">${btn(label(`plan-${i + 1}`), popular ? "primary" : "secondary", "block", hot(`plan-${i + 1}`))}</div>`;
        return `<div class="card tier${popular ? " popular" : ""}">${badge}${head}${list}${action}</div>`;
      });
      return `<div class="pricing">${billing}<div class="grid pricing-grid" style="grid-template-columns:repeat(${wide ? tiers : 1},1fr)">${cards}</div></div>`;
    }
  },
  // ---- feedback
  {
    id: "empty-state",
    kind: "block",
    category: "feedback",
    namedBy: 2,
    h: 320,
    props: { media: yn(true), action: count(0, 2, 1), cause: choice(["first-use", "no-results", "cleared"]) },
    elements: upTo(2, "action", "action", [...intentsIn("form", "forward", "jump"), "retry", "upload"], ["add", "search"]),
    draw: ({ props, label, hot, fill }) => `<div class="state">${flag(props, "media") ? fill?.motif ? pic(fill.motif, "1/1", "sm round") : img("1/1", "sm") : ""}${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(55, "title")}${bars(2)}`}<div class="actions stack">${rowsOf(num(props, "action"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`
  },
  {
    id: "error-state",
    kind: "block",
    category: "feedback",
    namedBy: 1,
    h: 320,
    props: { kind: choice(["404", "offline", "generic", "permission"]), retry: yn(true) },
    elements: { retry: { accepts: ["retry", "back", "home"], default: "retry", when: (p) => p.retry === true } },
    draw: ({ props, label, hot, fill }) => {
      const name = { "404": "404", offline: "Offline", generic: "Error", permission: "No access" }[str(props, "kind")];
      return `<div class="state"><div class="glyph big">${name}</div>${fill?.lines ? tx(fill.lines.join(" "), "body") : bars(2)}<div class="actions stack">${flag(props, "retry") ? btn(label("retry"), "primary", "", hot("retry")) : ""}</div></div>`;
    }
  },
  {
    id: "success-state",
    kind: "block",
    category: "feedback",
    namedBy: 2,
    h: 320,
    props: { summary: yn(), actions: count(1, 2, 1) },
    elements: upTo(2, "action", "actions", [...FORWARD, ...JUMPS], ["done", "home"]),
    draw: ({ props, label, hot, fill }) => `<div class="state"><div class="glyph">\u2713</div>${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(50, "title")}${bars(2)}`}${flag(props, "summary") ? `<div class="card summary">${fill?.values ? `${tx(fill.values[0] ?? "", "k")}${tx(dot(fill.values[1], fill.values[2]), "meta")}` : bars(3)}</div>` : ""}<div class="actions stack">${rowsOf(num(props, "actions"), (i) => btn(label(`action-${i + 1}`), i === 0 ? "primary" : "secondary", "", hot(`action-${i + 1}`)))}</div></div>`
  },
  // ---- overlay
  {
    id: "confirm-dialog",
    kind: "block",
    category: "overlay",
    namedBy: 3,
    h: 220,
    props: { destructive: yn(), input: yn() },
    elements: {
      confirm: { accepts: ["confirm", "delete", "accept", "done", "submit", "log-out"], default: "confirm" },
      cancel: { accepts: BACKS, default: "cancel" }
    },
    draw: ({ props, label, hot, fill }) => `<div class="dialog">${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(60, "title")}${bars(2)}`}${flag(props, "input") ? field(null) : ""}<div class="actions row">${btn(label("cancel"), "secondary", "", hot("cancel"))}${btn(label("confirm"), flag(props, "destructive") ? "destructive" : "primary", "", hot("confirm"))}</div></div>`
  }
];

// packages/modules/wireframe/src/catalog/archetypes.ts
var ARCHETYPE_IDS = [
  "welcome",
  "onboarding",
  "sign-in",
  "sign-up",
  "verify",
  "home",
  "list",
  "gallery",
  "detail",
  "form",
  "settings",
  "menu",
  "profile",
  "feed",
  "search",
  "confirm",
  "state",
  "legal",
  "storefront",
  "cart",
  "checkout",
  "order-placed",
  "pricing",
  "landing",
  "about",
  "contact",
  "blog",
  "master-detail",
  "chat",
  "notifications",
  "player",
  "map",
  "editor",
  "comments"
];
var WAVE_1 = [
  {
    id: "welcome",
    title: "Welcome",
    platforms: ["app"],
    recipe: "main: (image | hero-banner) \u2192 heading \u2192 text? \u2192 (button | button-group) \u2192 link?",
    intents: { button: { action: "get-started" }, "button-group": { "button-1": "get-started", "button-2": "sign-in" }, link: { action: "sign-in" } }
  },
  {
    id: "onboarding",
    title: "Onboarding",
    platforms: ["app"],
    recipe: "main: onboarding-step | wizard; footer: (page-indicator | steps) \u2192 (button | button-group)",
    intents: { button: { action: "next" }, "button-group": { "button-1": "next", "button-2": "skip" } }
  },
  {
    id: "sign-in",
    title: "Sign in",
    platforms: ["app", "site"],
    recipe: "header: (app-bar | navbar)?; main: image? \u2192 heading \u2192 sign-in-form; footer: link?",
    intents: { link: { action: "sign-up" } }
  },
  {
    id: "sign-up",
    title: "Sign up",
    platforms: ["app", "site"],
    recipe: "header: app-bar?; main: heading \u2192 (sign-up-form | wizard); footer: link?",
    intents: { link: { action: "sign-in" }, wizard: { next: "continue" } }
  },
  {
    id: "verify",
    title: "Verify",
    platforms: ["app", "site"],
    recipe: "header: app-bar; main: verify-code | forgot-password"
  },
  {
    id: "home",
    title: "Home",
    platforms: ["app", "web"],
    recipe: "shell: app-shell; header: app-bar | page-header; nav: tab-bar | side-nav; main: stats-row? \u2192 chart? \u2192 (data-table | stacked-list | card-grid | feed-post); aside: (filter-panel | stacked-list)?",
    intents: { "app-bar": { "action-1": "notifications", "action-2": "search", "action-3": "add" } },
    props: { "app-bar": { leading: "none" } }
  },
  {
    id: "list",
    title: "List",
    platforms: ["app", "web"],
    recipe: "header: app-bar | page-header; nav: (tab-bar | side-nav)?; main: search-field? \u2192 (chip | segmented-control | tabs)? \u2192 (stacked-list | card-grid | data-table); fab: fab?",
    intents: { "app-bar": { "action-1": "filter", "action-2": "sort", "action-3": "add" } }
  },
  {
    id: "gallery",
    title: "Gallery",
    platforms: ["app", "site"],
    recipe: "header: app-bar | navbar; main: chip? \u2192 (card-grid | gallery-section | product-card-list | pricing-cards)",
    intents: { "app-bar": { "action-1": "search", "action-2": "filter", "action-3": "share" } }
  },
  {
    id: "detail",
    title: "Detail",
    platforms: ["app", "web"],
    recipe: "header: app-bar; main: detail-header \u2192 (text | long-form | description-list | accordion) \u2192 (comment-list | card-grid)?; footer: (button | button-group)?",
    intents: { "app-bar": { "action-1": "share", "action-2": "more", "action-3": "edit" }, button: { action: "edit" }, "button-group": { "button-1": "edit", "button-2": "delete" } }
  },
  {
    id: "form",
    title: "Form",
    platforms: ["app", "web"],
    recipe: "header: app-bar | page-header; main: form-block | wizard; footer: button | button-group",
    intents: { "app-bar": { "action-1": "info", "action-2": "more", "action-3": "help" }, button: { action: "save" }, "button-group": { "button-1": "save", "button-2": "cancel" } }
  },
  {
    id: "settings",
    title: "Settings",
    platforms: ["app", "web"],
    recipe: "header: app-bar | page-header; nav: side-nav?; main: profile-header? \u2192 (settings-group | form-block | accordion)",
    intents: { "app-bar": { "action-1": "help", "action-2": "more", "action-3": "info" }, "page-header": { "action-1": "save", "action-2": "help", "action-3": "more" } }
  },
  {
    id: "menu",
    title: "Menu",
    platforms: ["app"],
    recipe: "main: profile-header? \u2192 list; overlay: drawer | sheet"
  },
  {
    id: "profile",
    title: "Profile",
    platforms: ["app", "web"],
    recipe: "header: app-bar; main: profile-header \u2192 (tabs | segmented-control)? \u2192 (card-grid | stacked-list | feed-post)",
    intents: { "app-bar": { "action-1": "settings", "action-2": "share", "action-3": "more" } }
  },
  {
    id: "feed",
    title: "Feed",
    platforms: ["app"],
    recipe: "header: app-bar; nav: tab-bar; main: (tabs | chip)? \u2192 (feed-post | blog-list); fab: fab?",
    intents: { "app-bar": { "action-1": "messages", "action-2": "notifications", "action-3": "search" } },
    props: { "app-bar": { leading: "none" } }
  },
  {
    id: "search",
    title: "Search",
    platforms: ["app", "web"],
    recipe: "header: search-field; main: chip? \u2192 (stacked-list | card-grid | empty-state); aside: filter-panel?"
  },
  {
    id: "confirm",
    title: "Confirm",
    platforms: ["app", "web"],
    recipe: "overlay: confirm-dialog | sheet | modal"
  },
  {
    id: "state",
    title: "Status",
    platforms: ["app", "web"],
    recipe: "main: empty-state | error-state | success-state"
  },
  {
    id: "legal",
    title: "Terms",
    platforms: ["app", "site"],
    recipe: "header: app-bar; main: long-form | accordion; footer: button?",
    intents: { button: { action: "accept" }, "app-bar": { "action-1": "share", "action-2": "info", "action-3": "more" } }
  }
];
var REGIONS = ["shell", "header", "nav", "main", "aside", "footer", "fab", "overlay"];
function parseRecipe(text) {
  const sections = [];
  for (const part of text.split(";")) {
    const m = /^\s*([a-z]+):\s*(.+?)\s*$/.exec(part);
    if (!m) throw new Error(`recipe part does not read as "region: sequence": ${part}`);
    const region = m[1];
    if (!REGIONS.includes(region)) throw new Error(`unknown region "${region}"`);
    const body = m[2];
    const items = body.includes("\u2192") || !body.includes("|") || body.startsWith("(") ? body.split("\u2192") : [body];
    const inRegion = items.map((raw) => {
      let item = raw.trim();
      const optional = item.endsWith("?");
      if (optional) item = item.slice(0, -1).trim();
      if (item.startsWith("(") && item.endsWith(")")) item = item.slice(1, -1);
      const options = item.split("|").map((o) => o.trim());
      for (const o of options) if (!/^[a-z][a-z-]*$/.test(o)) throw new Error(`"${o}" is not a component id`);
      return { region, options, optional };
    });
    inRegion.forEach((s, i) => sections.push({ slot: inRegion.length === 1 ? region : `${region}.${i + 1}`, ...s }));
  }
  return sections;
}
var RECIPES = WAVE_1.map(({ recipe: recipe2, ...rest }) => ({ ...rest, sections: parseRecipe(recipe2) }));
var RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

// packages/modules/wireframe/src/catalog/templates.ts
var TEMPLATE_IDS = [
  "single",
  "split",
  "master_detail",
  "grid",
  "bento",
  "hero_then_grid",
  "dashboard"
];
var DENSITY_LEVELS = ["compact", "default", "spacious"];
var DENSITY_SPACE = {
  compact: "8px",
  default: "12px",
  spacious: "16px"
};
function densityFromScore(score) {
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return "default";
  if (n <= 1) return "compact";
  if (n >= 3) return "spacious";
  return "default";
}
var TEMPLATES = [
  {
    id: "single",
    label: "Single column",
    description: "One vertical column of sections in reading order",
    platforms: ["app", "web", "site"],
    archetypes: ARCHETYPE_IDS,
    regions: ["main"]
  },
  {
    id: "split",
    label: "Two-column split",
    description: "Primary content on the left (60%) and secondary context or summary on the right (40%)",
    platforms: ["web", "site"],
    archetypes: ["home", "detail", "form", "settings", "profile", "checkout", "pricing"],
    regions: ["primary", "secondary"]
  },
  {
    id: "master_detail",
    label: "Master / detail",
    description: "Selectable list or index on the left (40%) with an inline detail or preview pane on the right (60%)",
    platforms: ["web", "site"],
    archetypes: ["list", "search", "feed", "detail", "master-detail"],
    regions: ["master", "detail"]
  },
  {
    id: "grid",
    label: "Responsive grid",
    description: "Multi-column responsive grid of peer sections or cards",
    platforms: ["web", "site"],
    archetypes: ["list", "gallery", "search", "home", "pricing", "feed", "storefront"],
    regions: ["grid"]
  },
  {
    id: "bento",
    label: "Bento grid",
    description: "Asymmetric multi-span bento grid highlighting the lead section alongside compact peers",
    platforms: ["web", "site"],
    archetypes: ["home", "profile", "pricing", "gallery"],
    regions: ["bento"]
  },
  {
    id: "hero_then_grid",
    label: "Hero then grid",
    description: "Full-width lead banner or hero section above a multi-column grid below",
    platforms: ["app", "web", "site"],
    archetypes: ["home", "welcome", "pricing", "search", "list", "gallery", "landing", "storefront"],
    regions: ["hero", "grid"]
  },
  {
    id: "dashboard",
    label: "KPI + 2-column dashboard",
    description: "Full-width KPI summary row across the top above a 2:1 primary and secondary column split",
    platforms: ["web", "site"],
    archetypes: ["home", "profile", "detail"],
    regions: ["kpi", "primary", "secondary"]
  }
];
var TEMPLATE_BY_ID = new Map(
  TEMPLATES.map((t) => [t.id, t])
);
function template(id) {
  const found = TEMPLATE_BY_ID.get(id);
  if (!found) throw new Error(`no layout template "${id}" in the wireframe catalog`);
  return found;
}
function templatesFor(archetype, platform) {
  return TEMPLATES.filter(
    (t) => t.platforms.includes(platform) && t.archetypes.includes(archetype)
  );
}
function defaultSlotRegion(templateId, slot, index2, totalMain) {
  switch (templateId) {
    case "single":
      return "main";
    case "grid":
      return "grid";
    case "bento":
      return "bento";
    case "hero_then_grid":
      return index2 === 0 ? "hero" : "grid";
    case "split":
      return index2 < Math.ceil(totalMain / 2) ? "primary" : "secondary";
    case "master_detail":
      return index2 === 0 ? "master" : "detail";
    case "dashboard":
      if (slot.block === "stat-row" || index2 === 0 && totalMain >= 3) return "kpi";
      return index2 < Math.ceil((totalMain + 1) / 2) ? "primary" : "secondary";
  }
}

// packages/modules/wireframe/src/catalog/words.ts
var ARCHETYPE_WORDS = {
  welcome: "the first screen a new person sees: a big picture, the app's name and a button to get started",
  onboarding: "one step of a short tour before using the app: a picture, a sentence, dots for the steps, Next or Skip",
  "sign-in": "signing in to an account that exists: email or username, password, a sign-in button",
  "sign-up": "creating a new account: name, email, password and more fields, a button to create it",
  verify: "checking who you are: typing a code that was sent, or an email to reset a password",
  home: "the main screen after signing in: a summary of what matters, with the way to every other part",
  list: "a list of things you can scroll: rows of text, one under another, each opening one thing",
  gallery: "a grid of pictures or thumbnails to browse",
  detail: "one thing shown in full: its title, picture, facts and what you can do with it",
  form: "a form to fill in and submit that is not about an account: fields, choices and a save or send button",
  settings: "settings: rows of options with switches and choices that change how the app behaves",
  menu: "a menu of places to go: a drawer or sheet listing the sections of the app",
  profile: "one person's page: their photo, name and what they have posted or done",
  feed: "a stream of posts or stories from people or sources, newest first",
  search: "searching: a search field with results or suggestions under it",
  confirm: "a small dialog over the screen asking to confirm or pick one thing",
  state: "a message where content would be: nothing here yet, something went wrong, or done",
  legal: "long text to read and accept: terms, a privacy policy or licences",
  storefront: "a shop's front page: featured products, categories and offers",
  cart: "a shopping cart: the things chosen to buy, quantities, a total and a checkout button",
  checkout: "paying for an order: delivery, payment and a review before buying",
  "order-placed": "the confirmation that a purchase went through",
  pricing: "plans side by side with their prices and a button to upgrade",
  landing: "a marketing page: a big headline, features and a call to action",
  about: "about the app: who made it, what it is, the version and credits",
  contact: "getting in touch: ways to reach someone, a message form, an address",
  blog: "articles to read: a list of articles or one article",
  "master-detail": "a list beside the selected thing's details, both at once",
  chat: "a conversation: message bubbles and a field to type a reply",
  notifications: "a list of alerts and recent activity",
  player: "playing music or video: artwork, a progress bar, play and pause",
  map: "a map with places marked on it",
  editor: "making or changing something: a picture, drawing or document with a toolbar of tools",
  comments: "a thread of replies with a field to add one"
};

// packages/modules/wireframe/src/catalog/index.ts
var COMPONENTS = new Map([...PRIMITIVES, ...BLOCKS].map((c) => [c.id, c]));
function component(id) {
  const found = COMPONENTS.get(id);
  if (!found) throw new Error(`no component "${id}" in the wireframe catalog`);
  return found;
}

// packages/modules/wireframe/src/theme.ts
var COLOR_ROLES = ["ground", "surface", "line", "ink", "ink-muted", "bar", "primary", "on-primary"];
var SCALE_ROLES = ["radius", "font", "space"];
var ROLES = [...COLOR_ROLES, ...SCALE_ROLES];
var DEFAULT_THEME = {
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
  space: "8px"
};
var WIRE_SURFACES = ["raised", "glass", "bold"];
function surfaceOf(style) {
  return style?.source === "design-system" && style.surface && WIRE_SURFACES.includes(style.surface) ? style.surface : "flat";
}
var DEFAULT_STYLE = { source: "default" };
var HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
var FN_COLOR = /^(?:rgba?|hsla?|oklch|oklab|lab|lch)\([\d.,%\s/+\-a-z]*\)$/i;
var LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em)$/;
var FONT = /^[\w\s,'"\-.]+$/;
function safeRoleValue(role, value) {
  if (typeof value !== "string" || value.length > 200) return false;
  if (role === "radius" || role === "space") return LENGTH.test(value);
  if (role === "font") return FONT.test(value) && !value.includes("--");
  return HEX.test(value) || FN_COLOR.test(value);
}
function styleProblems(input) {
  const s = input;
  if (!s || typeof s !== "object") return ['style must be { source: "default" } or { source: "design-system", \u2026 }'];
  if (s.source === "default") return [];
  if (s.source !== "design-system") return [`style.source must be "default" or "design-system"`];
  const problems = [];
  if (typeof s.itemId !== "string" || !s.itemId) problems.push("style.itemId must be the DESIGN.md item's id");
  if (typeof s.versionId !== "string" || !s.versionId) problems.push("style.versionId must be the DESIGN.md version it was mapped from");
  if (s.name !== void 0 && typeof s.name !== "string") problems.push("style.name must be a string");
  if (s.by !== void 0 && typeof s.by !== "string") problems.push("style.by must be a string");
  if (s.surface !== void 0 && !WIRE_SURFACES.includes(s.surface)) problems.push(`style.surface must be one of ${WIRE_SURFACES.join(", ")} (absent is flat)`);
  const roles = s.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return [...problems, "style.roles must be an object"];
  for (const [role, choice2] of Object.entries(roles)) {
    if (!ROLES.includes(role)) {
      problems.push(`style.roles: "${role}" is not a role (${ROLES.join(", ")})`);
      continue;
    }
    const c = choice2;
    if (!c || typeof c !== "object") problems.push(`style.roles.${role} must be { value, why }`);
    else if (!safeRoleValue(role, c.value)) problems.push(`style.roles.${role}.value is not a ${role === "font" ? "font family list" : role === "radius" || role === "space" ? "length" : "colour"} a stylesheet can hold`);
    else if (c.p !== void 0 && !(typeof c.p === "number" && c.p >= 0 && c.p <= 1)) problems.push(`style.roles.${role}.p must be 0\u20131`);
  }
  return problems;
}
function themeValues(style, density) {
  const out = { ...DEFAULT_THEME };
  if (style?.source === "design-system") {
    for (const role of ROLES) {
      const v = style.roles[role]?.value;
      if (v !== void 0 && safeRoleValue(role, v)) out[role] = v;
    }
  }
  if (density && DENSITY_SPACE[density]) out.space = DENSITY_SPACE[density];
  return out;
}
function linkColor(values) {
  const ratio2 = contrastRatio(values.primary, values.ground);
  return ratio2 === null || ratio2 >= CONTRAST_BODY ? values.primary : values.ink;
}
function themeDecls(style, density) {
  const values = themeValues(style, density);
  return [...ROLES.map((role) => `--w-${role}:${values[role]}`), `--w-link:${linkColor(values)}`].join(";");
}
function sameLook(a, b) {
  return themeDecls(a) === themeDecls(b) && surfaceOf(a) === surfaceOf(b);
}
function sameStyle(a, b) {
  return canonical(a ?? DEFAULT_STYLE) === canonical(b ?? DEFAULT_STYLE);
}
function canonical(value) {
  return JSON.stringify(value, (_k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
}
function resolved(tokens, value) {
  return typeof value === "string" && /^\{[^}]+\}$/.test(value.trim()) ? resolveToken(tokens, value) : value;
}
function candidatesOf(doc) {
  const t = doc.tokens;
  const colors = [];
  for (const [token, raw] of Object.entries(t.colors ?? {})) {
    const value = resolved(t, raw);
    if (typeof value === "string" && safeRoleValue("primary", value.trim())) colors.push({ token, value: value.trim(), group: "colors" });
  }
  const fonts = [];
  for (const [token, type] of Object.entries(t.typography ?? {})) {
    const value = resolved(t, type?.fontFamily);
    if (typeof value !== "string" || !safeRoleValue("font", value.trim())) continue;
    if (!fonts.some((f) => f.value === value.trim())) fonts.push({ token, value: value.trim(), group: "typography" });
  }
  const lengths = (group, role) => {
    const out2 = [];
    for (const [token, raw] of Object.entries(t[group] ?? {})) {
      const r = resolved(t, raw);
      const value = typeof r === "number" ? `${r}px` : typeof r === "string" ? r.trim() : null;
      if (value && safeRoleValue(role, value)) out2.push({ token, value, group });
    }
    return out2;
  };
  const out = {};
  for (const role of COLOR_ROLES) out[role] = colors;
  out.font = fonts;
  out.radius = lengths("rounded", "radius");
  out.space = lengths("spacing", "space");
  const named = namedRoles(doc);
  const body = resolved(t, t.typography?.[NAMED_TOKENS.font.token]?.fontFamily);
  for (const role of ROLES) {
    if (named[role] === void 0) continue;
    const found = role === "font" ? typeof body === "string" && safeRoleValue("font", body.trim()) ? { token: named.font, value: body.trim(), group: "typography" } : void 0 : out[role].find((c) => c.group === NAMED_TOKENS[role].group && c.token === named[role]);
    if (found) out[role] = [{ ...found, named: true }];
  }
  return out;
}
var NAMED_TOKENS = {
  ...Object.fromEntries(COLOR_ROLES.map((role) => [role, { group: "colors", token: role }])),
  font: { group: "typography", token: "body" },
  radius: { group: "rounded", token: "base" },
  space: { group: "spacing", token: "base" }
};
function namedRoles(doc) {
  const t = doc.tokens;
  const has = (group, token) => Object.prototype.hasOwnProperty.call(t[group] ?? {}, token);
  if (!COLOR_ROLES.every((role) => has("colors", role))) return {};
  const out = {};
  for (const role of ROLES) {
    const { group, token } = NAMED_TOKENS[role];
    if (has(group, token)) out[role] = token;
  }
  return out;
}
var ROLE_QUESTIONS = {
  ground: "Which of this design system's colours is the background a screen sits on \u2014 the ground behind everything else?",
  surface: "Which colour fills quiet areas inside a screen, one step off the background: image placeholders, avatars, an inactive toggle, a selected navigation row, dividers between list rows?",
  line: "Which colour draws borders and outlines: the edge of a text field, a card, a chip, an image placeholder?",
  ink: "Which colour is body text and headings?",
  "ink-muted": "Which colour is secondary text: field labels, captions, metadata, inactive tab labels?",
  bar: "Which colour stands for a line of placeholder copy in a wireframe \u2014 a quiet bar that reads as text without being text: lighter than secondary text, darker than the background?",
  primary: "Which colour is the primary action: the filled primary button, the floating action button, the selected tab?",
  "on-primary": "Which colour is the text and icon drawn ON the primary action colour \u2014 the label of the filled primary button?",
  radius: "Which corner radius do buttons, text fields and cards use?",
  font: "Which typeface is body text and interface labels set in?",
  space: "Which spacing token is the base unit \u2014 the small gap between related elements that larger spacing is built from?"
};
function componentUsage(t) {
  return Object.entries(t.components ?? {}).map(([name, rules]) => `${name}: ${Object.entries(rules ?? {}).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}
function mappingRequest(doc, candidates = candidatesOf(doc)) {
  const t = doc.tokens;
  const questions = {};
  for (const role of ROLES) {
    const options = candidates[role];
    if (options.length < 2) continue;
    questions[role] = {
      type: "choice",
      instructions: ROLE_QUESTIONS[role],
      criteria: Object.fromEntries(options.map((c) => [c.token, `${c.value} (${c.group}.${c.token})`]))
    };
  }
  const state = {
    task: "Map a design system's tokens onto the roles a greyscale wireframe draws with, so every wire can be restyled in this system. Choose only among the tokens offered.",
    system: t.name ?? "(unnamed)",
    ...t.description ? { description: t.description.length > 600 ? `${t.description.slice(0, 599)}\u2026` : t.description } : {},
    tokens: [
      ...candidates.primary.map(({ token, value, group }) => ({ token, value, group })),
      ...candidates.font.map(({ token, value, group }) => ({ token, value, group })),
      ...candidates.radius.map(({ token, value, group }) => ({ token, value, group })),
      ...candidates.space.map(({ token, value, group }) => ({ token, value, group }))
    ],
    components: componentUsage(t)
  };
  return { model: "jev-latest", state, questions };
}
var ROLE_CONFIDENCE = 0.5;
function applyMapping(request, response, candidates) {
  const roles = {};
  for (const role of ROLES) {
    const options = candidates[role];
    if (options.length === 0) {
      roles[role] = { value: DEFAULT_THEME[role], why: "none" };
      continue;
    }
    if (options.length === 1) {
      roles[role] = { token: options[0].token, value: options[0].value, why: options[0].named ? "named" : "only" };
      continue;
    }
    const q = request.questions[role];
    const a = response.answers[role];
    if (!q || !a) throw new Error(`the mapping has no answer for ${role}`);
    const { value: token, p, distribution } = chosenOption(q, a);
    const picked = options.find((c) => c.token === token);
    if (!picked) throw new Error(`the answer for ${role} is "${token}", which this system does not offer (${options.map((c) => c.token).join(", ")})`);
    const rounded = Math.round(p * 1e3) / 1e3;
    const tied = Object.entries(distribution).some(([k, v]) => k !== token && v >= p);
    roles[role] = rounded >= ROLE_CONFIDENCE && !tied ? { token, value: picked.value, p: rounded, why: "asked" } : { value: DEFAULT_THEME[role], p: rounded, why: "unsure", leaned: token };
  }
  return guardContrast(roles);
}
function guardContrast(roles) {
  const value = (role) => roles[role]?.value ?? DEFAULT_THEME[role];
  const primary = value("primary");
  const on = value("on-primary");
  const now = contrastRatio(primary, on);
  if (now === null || now >= CONTRAST_BODY) return roles;
  const better = ["ink", "ground"].map((role) => ({ role, ratio: contrastRatio(primary, value(role)) ?? 0 })).sort((a, b) => b.ratio - a.ratio)[0];
  if (better.ratio <= now) return roles;
  const from = roles[better.role];
  const was = roles["on-primary"];
  return {
    ...roles,
    "on-primary": {
      ...from?.token ? { token: from.token } : {},
      value: value(better.role),
      ...was?.p !== void 0 ? { p: was.p } : {},
      why: "contrast",
      ...was?.token ? { leaned: was.token } : was?.leaned ? { leaned: was.leaned } : {}
    }
  };
}
function roleLine(role, c) {
  if (!c) return `${role.padEnd(11)} (default) ${DEFAULT_THEME[role]}`;
  const p = c.p === void 0 ? "" : `p ${c.p.toFixed(2)}`;
  const note = c.why === "only" ? "the only one" : c.why === "named" ? "named for the role" : c.why === "none" ? "the system has none \u2014 default kept" : c.why === "unsure" ? `unsure (leaned ${c.leaned}) \u2014 default kept` : c.why === "contrast" ? `raised for contrast (chosen: ${c.leaned ?? "default"})` : "";
  return `${role.padEnd(11)} ${(c.token ?? "(default)").padEnd(16)} ${c.value.length > 40 ? `${c.value.slice(0, 39)}\u2026` : c.value}  ${[p, note].filter(Boolean).join(" \xB7 ")}`;
}

// packages/modules/wireframe/src/content/validate.ts
var MAX_WORDS = 400;
var WORD_KEYS = ["heading", "sub", "person", "motif"];
var LIST_KEYS = ["lines", "labels", "values", "groups"];
var ITEM_KEYS = ["title", "sub", "status", "meta", "person", "text", "motif"];
var KNOWN = /* @__PURE__ */ new Set([...WORD_KEYS, ...LIST_KEYS, "items", "stats", "series", "actions"]);
var isWord = (v) => typeof v === "string" && v.length <= MAX_WORDS;
function contentProblems(input) {
  const c = input;
  if (!c || typeof c !== "object" || Array.isArray(c)) return ['content must be { source: "pack", pack } or { source: "copy", by }'];
  const problems = [];
  if (c.source === "pack") {
    if (typeof c.pack !== "string" || !c.pack) problems.push("content.pack must be a pack id");
    if (c.p !== void 0 && !(typeof c.p === "number" && c.p >= 0 && c.p <= 1)) problems.push("content.p must be 0\u20131");
    if (c.by !== void 0 && typeof c.by !== "string") problems.push("content.by must be a string");
  } else if (c.source === "copy") {
    if (typeof c.by !== "string" || !c.by) problems.push("content.by must say who wrote the copy");
    if (c.pack !== void 0 && typeof c.pack !== "string") problems.push("content.pack must be a pack id");
  } else {
    problems.push(`content.source must be "pack" or "copy"`);
  }
  if (c.title !== void 0 && !isWord(c.title)) problems.push(`content.title must be a string of at most ${MAX_WORDS} characters`);
  if (c.bar !== void 0 && !isWord(c.bar)) problems.push(`content.bar must be a string of at most ${MAX_WORDS} characters`);
  return problems;
}
function fillProblems(input, where) {
  const f = input;
  if (!f || typeof f !== "object" || Array.isArray(f)) return [`${where}: fill must be an object`];
  const problems = [];
  for (const key of Object.keys(f)) if (!KNOWN.has(key)) problems.push(`${where}: fill has no "${key}" (it has ${[...KNOWN].join(", ")})`);
  for (const key of WORD_KEYS) if (f[key] !== void 0 && !isWord(f[key])) problems.push(`${where}: fill.${key} must be a string`);
  for (const key of LIST_KEYS) {
    const v = f[key];
    if (v !== void 0 && !(Array.isArray(v) && v.length <= 64 && v.every(isWord))) problems.push(`${where}: fill.${key} must be a list of strings`);
  }
  if (f.items !== void 0) {
    if (!Array.isArray(f.items) || f.items.length > 64) problems.push(`${where}: fill.items must be a list`);
    else {
      f.items.forEach((raw, i) => {
        const it = raw;
        if (!it || typeof it !== "object" || !isWord(it.title)) return problems.push(`${where}: fill.items[${i}] needs a title`);
        for (const key of ITEM_KEYS) if (it[key] !== void 0 && !isWord(it[key])) problems.push(`${where}: fill.items[${i}].${key} must be a string`);
        if (it.cells !== void 0 && !(Array.isArray(it.cells) && it.cells.length <= 16 && it.cells.every(isWord))) problems.push(`${where}: fill.items[${i}].cells must be a list of strings`);
        if (it.rating !== void 0 && !(Number.isInteger(it.rating) && it.rating >= 0 && it.rating <= 5)) problems.push(`${where}: fill.items[${i}].rating must be 0\u20135`);
      });
    }
  }
  if (f.stats !== void 0) {
    if (!Array.isArray(f.stats) || f.stats.length > 8) problems.push(`${where}: fill.stats must be a list`);
    else f.stats.forEach((raw, i) => {
      const s = raw;
      if (!s || !isWord(s.label) || !isWord(s.value)) problems.push(`${where}: fill.stats[${i}] needs a label and a value`);
      else if (s.delta !== void 0 && !isWord(s.delta) || s.down !== void 0 && typeof s.down !== "boolean") problems.push(`${where}: fill.stats[${i}].delta must be a string`);
    });
  }
  if (f.series !== void 0 && !(Array.isArray(f.series) && f.series.length <= 8 && f.series.every((s) => Array.isArray(s) && s.length <= 31 && s.every((n) => typeof n === "number" && n >= 0 && n <= 100)))) {
    problems.push(`${where}: fill.series must be lists of numbers 0\u2013100`);
  }
  if (f.actions !== void 0 && !(typeof f.actions === "object" && f.actions !== null && !Array.isArray(f.actions) && Object.values(f.actions).every(isWord))) {
    problems.push(`${where}: fill.actions must map elements to words`);
  }
  return problems;
}

// packages/modules/wireframe/src/spec.ts
var WIRE_LAYER_IDS = ["system", "copy", "lofi", "hifi"];
var WIRE_FIDELITY_TIERS = ["wire", "system", "lofi", "hifi"];
var POLISH_TOKENS = [
  "wf-elevated",
  "wf-bordered",
  "wf-subtle",
  "wf-emphasis",
  "wf-compact-pad",
  "wf-spacious-pad",
  "wf-rounded-lg",
  "wf-accent-ring"
];
function wireBy(model, actor) {
  const home = / via the home$/.test(model);
  const bare = model.replace(/ via the home$/, "");
  return {
    ...actor ? { actor: { id: actor.id, name: actor.name } } : {},
    answerer: bare === "agent" ? "agent" : /^stub/.test(bare) ? "stub" : "jev",
    ...home ? { via: "home" } : {},
    ...bare !== "agent" ? { model: bare } : {}
  };
}
var LEAVE_OUT = "omit";
function blockWords(block) {
  return block.replace(/-/g, " ");
}
function flipWords(flip) {
  if (flip.to === LEAVE_OUT) return `without ${blockWords(flip.from)}`;
  if (flip.from === LEAVE_OUT) return `with ${blockWords(flip.to)}`;
  return `${blockWords(flip.to)} instead of ${blockWords(flip.from)}`;
}
function wireTitle(spec) {
  return spec.flip ? `${spec.title} \xB7 ${flipWords(spec.flip)}` : spec.title;
}
var PLATFORMS = ["app", "web", "site"];
var PLATFORM_SIZE = {
  app: { width: 390, height: 844 },
  web: { width: 1280, height: 800 },
  site: { width: 1280, height: 800 }
};
var CAPTION_HEIGHT = 0;
function recipe(archetype) {
  const found = RECIPE_BY_ID.get(archetype);
  if (!found) {
    const known = ARCHETYPE_IDS.includes(archetype);
    throw new Error(
      known ? `"${archetype}" is a later wave's archetype and has no recipe yet \u2014 wave 1 is: ${RECIPES.map((r) => r.id).join(", ")}` : `no archetype "${archetype}" \u2014 wave 1 is: ${RECIPES.map((r) => r.id).join(", ")}`
    );
  }
  return found;
}
function sectionOf(r, slot) {
  const found = r.sections.find((s) => s.slot === slot);
  if (!found) throw new Error(`${r.id} has no slot "${slot}" \u2014 it has ${r.sections.map((s) => s.slot).join(", ")}`);
  return found;
}
function defaultProps(c) {
  const out = {};
  for (const [key, def] of Object.entries(c.props)) out[key] = def.default;
  return out;
}
function presentElements(c, props) {
  return Object.entries(c.elements ?? {}).filter(([, el]) => !el.when || el.when(props)).map(([id]) => id);
}
function defaultIntent(r, c, element) {
  const el = c.elements?.[element];
  if (!el) throw new Error(`${c.id} has no actionable element "${element}"`);
  return r.intents?.[c.id]?.[element] ?? el.default;
}
function blueprint(archetype, opts = {}) {
  const r = recipe(archetype);
  const tpl = opts.template !== void 0 ? TEMPLATE_BY_ID.get(opts.template) : void 0;
  if (opts.template !== void 0 && !tpl) {
    throw new Error(`--template must be one of ${TEMPLATE_IDS.join(", ")} \u2014 got: ${opts.template}`);
  }
  const platform = opts.platform ?? tpl?.platforms[0] ?? r.platforms[0];
  if (tpl && !tpl.platforms.includes(platform)) {
    throw new Error(`template "${tpl.id}" is not available on platform "${platform}" (allowed on ${tpl.platforms.join(", ")})`);
  }
  return {
    v: 1,
    request: opts.request ?? "",
    flow: opts.flow ?? "",
    archetype: r.id,
    title: opts.title ?? r.title,
    platform,
    ...opts.template ? { template: opts.template } : {},
    slots: r.sections.map((s) => ({ slot: s.slot, block: null, props: {} }))
  };
}
function resolveSlot(archetype, slot, block, props) {
  const r = recipe(archetype);
  const section = sectionOf(r, slot);
  if (!section.options.includes(block)) {
    throw new Error(`${r.id}'s ${slot} offers ${section.options.join(" | ")}, not ${block}`);
  }
  const c = component(block);
  const resolved2 = { ...defaultProps(c), ...r.props?.[c.id] ?? {}, ...props ?? {} };
  const elements = presentElements(c, resolved2);
  const out = { slot, block, props: resolved2 };
  if (elements.length > 0) out.intents = Object.fromEntries(elements.map((e) => [e, defaultIntent(r, c, e)]));
  return out;
}
function wireframe(archetype, opts = {}, pick = (s) => s.options[0]) {
  const spec = blueprint(archetype, opts);
  const r = recipe(archetype);
  const slots = [];
  r.sections.forEach((section, i) => {
    const choice2 = pick(section, i);
    if (choice2 === "omit") {
      if (!section.optional) throw new Error(`${r.id}'s ${section.slot} is not optional`);
      return;
    }
    slots.push(choice2 === null ? { slot: section.slot, block: null, props: {} } : resolveSlot(r.id, section.slot, choice2));
  });
  if (spec.template && spec.template !== "single") {
    const mainSlots = slots.filter((s) => r.sections.find((sec) => sec.slot === s.slot)?.region === "main");
    mainSlots.forEach((s, idx) => {
      s.region = defaultSlotRegion(spec.template, s, idx, mainSlots.length);
    });
  }
  return { ...spec, slots };
}
function wireSize(spec) {
  const base = PLATFORM_SIZE[spec.platform];
  if (spec.platform !== "site") return { width: base.width, height: base.height };
  const r = recipe(spec.archetype);
  const tall = spec.slots.reduce((sum, s) => {
    const section = r.sections.find((x) => x.slot === s.slot);
    const id = s.block ?? section?.options[0];
    return sum + (id ? (COMPONENTS.get(id)?.h ?? 0) + 24 : 0);
  }, 48);
  return { width: base.width, height: Math.max(base.height, tall) };
}
function propProblem(def, value) {
  switch (def.kind) {
    case "choice":
      return typeof value === "string" && def.values.includes(value) ? null : `must be one of ${def.values.join(", ")}`;
    case "flag":
      return typeof value === "boolean" ? null : "must be true or false";
    case "count":
      return Number.isInteger(value) && value >= def.min && value <= def.max ? null : `must be a whole number ${def.min}\u2013${def.max}`;
    case "index":
      return Number.isInteger(value) && value >= 1 && value <= def.max ? null : `must be a whole number 1\u2013${def.max}`;
  }
}
function validateWire(input) {
  const problems = [];
  const spec = input;
  if (!spec || typeof spec !== "object") return ["a spec is a JSON object"];
  if (spec.v !== 1) problems.push(`v must be 1`);
  for (const key of ["request", "flow", "title"]) {
    if (typeof spec[key] !== "string") problems.push(`${key} must be a string`);
  }
  if (!PLATFORMS.includes(spec.platform)) problems.push(`platform must be one of ${PLATFORMS.join(", ")}`);
  if (spec.template !== void 0) {
    const tpl2 = TEMPLATE_BY_ID.get(spec.template);
    if (!tpl2) {
      problems.push(`template must be one of ${TEMPLATE_IDS.join(", ")}`);
    } else if (PLATFORMS.includes(spec.platform) && !tpl2.platforms.includes(spec.platform)) {
      problems.push(`template "${spec.template}" is not available on platform "${spec.platform}" (allowed on ${tpl2.platforms.join(", ")})`);
    }
  }
  if (spec.density !== void 0 && !DENSITY_LEVELS.includes(spec.density)) {
    problems.push(`density must be one of ${DENSITY_LEVELS.join(", ")}`);
  }
  if (spec.round !== void 0 && ![0, 1, 2, 3].includes(spec.round)) problems.push("round must be 0, 1, 2 or 3");
  if (spec.chrome !== void 0 && (typeof spec.chrome !== "object" || typeof spec.chrome?.nav !== "string" || typeof spec.chrome?.header !== "string")) {
    problems.push("chrome must be { nav, header }");
  }
  if (spec.style !== void 0) problems.push(...styleProblems(spec.style));
  if (spec.content !== void 0) problems.push(...contentProblems(spec.content));
  if (spec.by !== void 0 && (typeof spec.by !== "object" || !["jev", "stub", "agent"].includes(spec.by?.answerer))) {
    problems.push("by must be { answerer: jev | stub | agent, actor?, via?, model? }");
  }
  if (spec.pinned !== void 0) {
    if (!spec.pinned || typeof spec.pinned !== "object" || Array.isArray(spec.pinned)) {
      problems.push("pinned must be an object of string key-value pairs");
    } else {
      for (const [k, v] of Object.entries(spec.pinned)) {
        if (typeof v !== "string" || !k) problems.push(`pinned.${k} must be a string`);
      }
    }
  }
  let r;
  try {
    r = recipe(String(spec.archetype));
  } catch (error) {
    return [...problems, error.message];
  }
  if (!Array.isArray(spec.slots)) return [...problems, "slots must be an array"];
  const tpl = spec.template ? TEMPLATE_BY_ID.get(spec.template) : void 0;
  let last = -1;
  const seen = /* @__PURE__ */ new Set();
  for (const slot of spec.slots) {
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
    const section = r.sections[at];
    const props = slot.props;
    if (!props || typeof props !== "object" || Array.isArray(props)) {
      problems.push(`${where}: props must be an object`);
      continue;
    }
    if (slot.region !== void 0) {
      if (typeof slot.region !== "string" || !slot.region) {
        problems.push(`${where}: region must be a non-empty string`);
      } else if (tpl && !tpl.regions.includes(slot.region) && slot.region !== "main") {
        problems.push(`${where}: region "${slot.region}" is not one of ${tpl.id}'s regions (${tpl.regions.join(", ")})`);
      }
    }
    if (slot.fill !== void 0) problems.push(...fillProblems(slot.fill, where));
    if (slot.block === null) {
      if (slot.fill !== void 0) problems.push(`${where}: an undecided slot has no fill`);
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
    if (slot.p !== void 0 && !(typeof slot.p === "number" && slot.p >= 0 && slot.p <= 1)) problems.push(`${where}: p must be 0\u20131`);
    for (const alt of slot.alternatives ?? []) {
      if (alt.block === LEAVE_OUT && section.optional) continue;
      if (!section.options.includes(alt.block)) problems.push(`${where}: alternative ${alt.block} is not one of ${section.options.join(", ")}${section.optional ? ` or ${LEAVE_OUT}` : ""}`);
    }
  }
  if (spec.varied !== void 0 && spec.varied !== "none") problems.push(`varied must be "none" when present`);
  if (spec.need !== void 0 && !(typeof spec.need === "number" && spec.need >= 0 && spec.need <= 1)) problems.push("need must be 0\u20131");
  if (spec.maybe !== void 0 && spec.maybe !== true) problems.push("maybe must be true when present");
  if (spec.variantOf !== void 0 && typeof spec.variantOf !== "string") problems.push("variantOf must be an item id");
  if (spec.flip !== void 0 && (typeof spec.flip !== "object" || !spec.flip || ![spec.flip.slot, spec.flip.from, spec.flip.to].every((v) => typeof v === "string"))) {
    problems.push("flip must be { slot, from, to }");
  }
  for (const d of spec.declined ?? []) {
    const section = r.sections.find((s) => s.slot === d?.slot);
    if (!section) problems.push(`declined ${JSON.stringify(d?.slot)}: ${r.id} has no such slot`);
    else if (!section.optional) problems.push(`declined "${d.slot}": the section is not optional`);
    else if (seen.has(d.slot)) problems.push(`declined "${d.slot}": the section is on the screen`);
    else if (!section.options.includes(d.block)) problems.push(`declined "${d.slot}": block must be one of ${section.options.join(", ")}`);
    if (d && !(typeof d.p === "number" && d.p >= 0 && d.p <= 1)) problems.push(`declined ${JSON.stringify(d.slot)}: p must be 0\u20131`);
  }
  for (const section of r.sections) {
    if (!section.optional && !seen.has(section.slot)) problems.push(`slot "${section.slot}" is required by ${r.id}`);
  }
  if (spec.decisions !== void 0) {
    if (typeof spec.decisions !== "object" || spec.decisions === null || Array.isArray(spec.decisions)) {
      problems.push("decisions must be an object mapping question ids to probability maps");
    } else {
      for (const [qId, dist] of Object.entries(spec.decisions)) {
        if (typeof dist !== "object" || dist === null || Array.isArray(dist)) {
          problems.push(`decisions["${qId}"] must be an object mapping options to probabilities`);
          continue;
        }
        for (const [opt, prob] of Object.entries(dist)) {
          if (!(typeof prob === "number" && prob >= 0 && prob <= 1)) {
            problems.push(`decisions["${qId}"]["${opt}"] must be 0\u20131`);
          }
        }
      }
    }
  }
  if (spec.polish !== void 0) {
    if (!Array.isArray(spec.polish)) {
      problems.push("polish must be an array of { target, add?, remove? } patches");
    } else {
      const allowedTokens = new Set(POLISH_TOKENS);
      for (const patch of spec.polish) {
        if (!patch || typeof patch !== "object" || typeof patch.target !== "string" || !patch.target.trim()) {
          problems.push("polish patch must have a non-empty string target");
          continue;
        }
        for (const t of patch.add ?? []) {
          if (!allowedTokens.has(t)) problems.push(`polish["${patch.target}"]: unknown add token "${t}"`);
        }
        for (const t of patch.remove ?? []) {
          if (!allowedTokens.has(t)) problems.push(`polish["${patch.target}"]: unknown remove token "${t}"`);
        }
      }
    }
  }
  if (spec.layers !== void 0) {
    if (!spec.layers || typeof spec.layers !== "object" || Array.isArray(spec.layers)) {
      problems.push("layers must be an object of boolean flags (system, copy, lofi, hifi)");
    } else {
      const allowedLayers = new Set(WIRE_LAYER_IDS);
      for (const [k, v] of Object.entries(spec.layers)) {
        if (!allowedLayers.has(k)) problems.push(`layers: unknown layer "${k}"`);
        else if (typeof v !== "boolean") problems.push(`layers.${k} must be a boolean`);
      }
    }
  }
  return problems;
}
function propsFor(c, props) {
  return { ...defaultProps(c), ...props };
}

// packages/modules/wireframe/src/links.ts
var LINK_BACK = "back";
var LINK_NONE = "none";
var LINKS_PROP = "wireLinks";
function hotKey(slot, element) {
  return `${slot}#${element}`;
}
var ROW_BLOCKS = ["stacked-list", "card-grid", "data-table", "feed-post", "product-card-list"];
var NAV_ITEMS = { "tab-bar": "tab", "side-nav": "item", navbar: "link", drawer: "item" };
var POST_AUTH = ["home", "list", "feed"];
var ONBOARDING_RUN = ["welcome", "onboarding"];
var OVERLAY_ARCHETYPES = ["confirm", "menu"];
function hotspots(spec) {
  const r = recipe(spec.archetype);
  const out = [];
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const c = component(slot.block);
    const props = propsFor(c, slot.props);
    if (slot.block === "app-bar" && props.leading !== "none") {
      const intent = props.leading === "menu" ? "menu" : props.leading === "close" ? "close" : "back";
      out.push({ key: hotKey(slot.slot, "leading"), slot: slot.slot, block: c.id, element: "leading", intent, kind: "leading" });
    }
    const prefix = NAV_ITEMS[c.id];
    const folded = c.id === "navbar" && spec.platform === "app" && props.mobile !== "links";
    for (const element of presentElements(c, props)) {
      if (folded && element.startsWith("link-")) continue;
      const intent = slot.intents?.[element] ?? defaultIntent(r, c, element);
      const tab = prefix && element.startsWith(`${prefix}-`) ? Number(element.slice(prefix.length + 1)) : void 0;
      out.push({ key: hotKey(slot.slot, element), slot: slot.slot, block: c.id, element, intent, kind: "element", ...tab ? { tab } : {} });
    }
    if (ROW_BLOCKS.includes(c.id)) out.push({ key: hotKey(slot.slot, "row"), slot: slot.slot, block: c.id, element: "row", kind: "row" });
  }
  return out;
}
function isTopLevel(spec) {
  const r = RECIPE_BY_ID.get(spec.archetype);
  return spec.slots.some((s) => s.block !== null && r?.sections.find((x) => x.slot === s.slot)?.region === "nav");
}
function archetypeName(id) {
  return RECIPE_BY_ID.get(id)?.title ?? words(id);
}
function words(id) {
  const s = id.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function readOverrides(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((e) => typeof e[1] === "string"));
  } catch {
    return {};
  }
}
function inferLinks(kept, opts = {}) {
  const ids = new Set(kept.map((s) => s.id));
  const topLevel = kept.filter((s) => isTopLevel(s.spec)).map((s) => s.id);
  const firstOf = (archetypes) => kept.find((s) => archetypes.includes(s.spec.archetype))?.id ?? null;
  const out = [];
  kept.forEach((screen, at) => {
    const spots = hotspots(screen.spec);
    const overlayScreen = OVERLAY_ARCHETYPES.includes(screen.spec.archetype);
    const decide = (h) => {
      if (h.kind === "row") {
        const after = kept.slice(at + 1).find((s) => s.spec.archetype === "detail") ?? kept.slice(0, at).reverse().find((s) => s.spec.archetype === "detail");
        return after ? { to: after.id, transition: "push", rule: "row" } : { to: null, needs: "Detail", transition: "push", rule: "missing" };
      }
      const intent = INTENT_BY_ID.get(h.intent);
      const nav = intent.nav;
      switch (nav.to) {
        case "none":
          return "inert";
        case "history":
          return { to: LINK_BACK, transition: overlayScreen ? "overlay" : "pop", rule: "back" };
        case "next": {
          if (overlayScreen) return { to: LINK_BACK, transition: "overlay", rule: "back" };
          const next2 = kept[at + 1];
          return next2 ? { to: next2.id, transition: nav.transition, rule: "intent" } : { to: null, needs: "a next screen", transition: nav.transition, rule: "missing" };
        }
        case "after-run": {
          let i = at + 1;
          while (i < kept.length && ONBOARDING_RUN.includes(kept[i].spec.archetype)) i++;
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
          const target = kept.find((s) => nav.component === "drawer" && s.spec.archetype === "menu" || s.spec.slots.some((x) => x.block === nav.component && x.slot === "overlay"));
          const needs = nav.component === "drawer" ? archetypeName("menu") : words(nav.component);
          return target ? { to: target.id, transition: "overlay", rule: "intent" } : { to: null, needs, transition: "overlay", rule: "missing" };
        }
      }
    };
    const decided = spots.map((h) => ({ h, d: decide(h) }));
    for (const slot of new Set(decided.filter(({ h, d }) => h.tab && d === null).map(({ h }) => h.slot))) {
      const items = decided.filter(({ h }) => h.slot === slot && h.tab).sort((a, b) => a.h.tab - b.h.tab);
      const claimed = new Set(items.map(({ d }) => d && d !== "inert" ? d.to : null).filter(Boolean));
      const free = topLevel.filter((id) => !claimed.has(id));
      for (const entry of items) {
        if (entry.d !== null) continue;
        const target = free.shift();
        const nav = INTENT_BY_ID.get(entry.h.intent).nav;
        entry.d = target ? { to: target, transition: "none", rule: "tab" } : { to: null, needs: nav.to === "archetype" ? archetypeName(nav.archetype) : words(entry.h.intent), transition: "none", rule: "missing" };
      }
    }
    for (const { h, d } of decided) {
      const label = h.kind === "row" ? "Row" : h.kind === "leading" ? INTENT_BY_ID.get(h.intent)?.label ?? "Back" : INTENT_BY_ID.get(h.intent)?.label ?? h.element;
      const base = { from: screen.id, key: h.key, label, ...h.intent ? { intent: h.intent } : {}, ...h.tab ? { nav: true } : {} };
      const override = screen.overrides?.[h.key];
      if (override !== void 0) {
        if (override === LINK_NONE) {
          if (opts.withNone) out.push({ ...base, to: null, transition: "none", rule: "override" });
          continue;
        }
        if (override === LINK_BACK) {
          out.push({ ...base, to: LINK_BACK, transition: "pop", rule: "override" });
          continue;
        }
        out.push(ids.has(override) ? { ...base, to: override, transition: "push", rule: "override" } : { ...base, to: null, needs: `a screen not in the prototype (${override})`, transition: "push", rule: "override" });
        continue;
      }
      if (d === "inert" || d === null) continue;
      out.push({ ...base, ...d });
    }
  });
  return out;
}
function startScreen(kept) {
  return (kept.find((s) => ["welcome", "sign-in"].includes(s.spec.archetype)) ?? kept[0])?.id ?? null;
}

// packages/modules/wireframe/src/render.ts
var WIRE_MARKER = "<!-- isocan:wireframe -->";
var WIRE_SCRIPT_ID = "isocan-wireframe";
var SKELETON_COLORS = ["#2f6fed", "#7fa3f3", "#f3f7fe"];
var [BLUE, BLUE_SOFT, BLUE_GROUND] = SKELETON_COLORS;
var S = (n) => `calc(var(--w-space) * ${n})`;
var R = (cap, scale = 1) => scale === 1 ? `min(var(--w-radius), ${cap}px)` : `min(calc(var(--w-radius) * ${scale}), ${cap}px)`;
var PAGE = "color-mix(in srgb, var(--w-surface) 25%, var(--w-ground))";
var BAR_KEY = "color-mix(in srgb, var(--w-bar) 83%, var(--w-ink))";
var BAR_SOFT = "color-mix(in srgb, var(--w-bar) 70%, var(--w-ground))";
var SELECTED = "color-mix(in srgb, var(--w-primary) 80%, var(--w-ground))";
var SCRIM = "color-mix(in srgb, var(--w-ink) 28%, transparent)";
var WIRE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:${PAGE}}
body{font:14px/1.4 var(--w-font);color:var(--w-ink);padding:0}
.frame{position:relative;display:flex;flex-direction:column;background:var(--w-ground);border:1.5px solid var(--w-line);border-radius:4px;overflow:hidden}
.frame.app{border-radius:28px}
.frame.site{overflow:visible}
body.screen>.frame{border:0;border-radius:0}
.frame>.body{flex:1;display:flex;min-height:0}
.frame>.body>.main{flex:1;display:flex;flex-direction:column;gap:${S(1.5)};padding:${S(2)};min-width:0;overflow:hidden}
.frame.site>.body>.main{overflow:visible}
.frame>.body>.side{width:232px;border-right:1px solid var(--w-surface);display:flex;flex-direction:column}
.frame.app>.body>.side{width:84px}
.frame>.body>.aside{width:300px;border-left:1px solid var(--w-surface);padding:${S(2)};display:flex;flex-direction:column;gap:${S(1.5)}}
.frame>.foot{padding:${S(1.5)} ${S(2)};border-top:1px solid var(--w-surface);display:flex;flex-direction:column;gap:${S(1)}}
.fabs{position:absolute;right:20px;bottom:88px}
.frame.web .fabs,.frame.site .fabs{bottom:24px}
.layer{position:absolute;inset:0;background:${SCRIM};display:flex;flex-direction:column;justify-content:flex-end}
.layer.center{justify-content:center;align-items:center;padding:24px}
.layer.left{justify-content:flex-start;align-items:stretch;flex-direction:row}
.layer>.slot{width:100%}
.layer.center>.slot{max-width:340px}
.layer.left>.slot{width:78%;max-width:320px}
.slot{min-width:0}
.bar{display:block;height:8px;border-radius:4px;background:var(--w-bar);margin:5px 0;max-width:100%}
.bar.k{background:${BAR_KEY};height:10px}
.bar.title{background:var(--w-ink-muted);height:16px;margin:8px 0}
.bar.fat{background:var(--w-ink-muted);height:18px}
.bar.meta{background:${BAR_SOFT};height:7px}
.bar.in{display:inline-block;margin:0;vertical-align:middle}
.bar.ph{background:${BAR_SOFT};margin:0}
.bar.lbl-bar{height:7px;margin:0 0 6px}
.bar.cap{margin-top:8px}
.bar.rule{height:1px;background:var(--w-surface)}
.bar.emp-primary{background:color-mix(in srgb,var(--w-ink) 74%,var(--w-ground))}
.bar.emp-secondary{background:color-mix(in srgb,var(--w-bar) 90%,var(--w-ink))}
.bar.emp-tertiary{background:var(--w-bar)}
.bar.emp-subtle{background:${BAR_SOFT}}
.h{font-weight:700;color:var(--w-ink);line-height:1.2}
.h1{font-size:26px}.h2{font-size:22px}.h3{font-size:18px}.h4{font-size:16px}
.txt.s .bar{height:6px}.txt.l .bar{height:10px}.txt.quote{border-left:3px solid var(--w-line);padding-left:10px}.txt.caption .bar{background:${BAR_SOFT}}
.img{width:100%;border:1.5px solid var(--w-line);border-radius:${R(12)};background:var(--w-surface) linear-gradient(to top right,transparent calc(50% - 1px),var(--w-line) calc(50% - 1px),var(--w-line) calc(50% + 1px),transparent calc(50% + 1px)),linear-gradient(to bottom right,transparent calc(50% - 1px),var(--w-line) calc(50% - 1px),var(--w-line) calc(50% + 1px),transparent calc(50% + 1px))}
.pat-striped,.img.pat-striped{background:var(--w-surface) repeating-linear-gradient(45deg,var(--w-line) 0,var(--w-line) 1px,transparent 1px,transparent 7px)}
.pat-dotted,.img.pat-dotted{background:var(--w-surface) radial-gradient(circle,var(--w-line) 1.25px,transparent 1.25px) 0 0/10px 10px}
.pat-crosshatch,.img.pat-crosshatch{background:var(--w-surface) linear-gradient(var(--w-line) 1px,transparent 1px) 0 0/10px 10px,linear-gradient(90deg,var(--w-line) 1px,transparent 1px) 0 0/10px 10px}
.pat-wave,.img.pat-wave{background:var(--w-surface) repeating-radial-gradient(circle at 0 100%,transparent 0,transparent 5px,var(--w-line) 5px,var(--w-line) 6px,transparent 6px,transparent 12px) 0 0/16px 12px}
.img.sm{width:72px}
.logo{display:flex;justify-content:center}
.img.illustration{border-radius:50%;width:70%;margin:0 auto}
.img.cover{height:auto;border-radius:0}
.img.thumb-img{width:64px;flex:none}
.actions{display:flex;gap:8px}
.actions.stack{flex-direction:column}
.actions.row{justify-content:flex-end;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:44px;padding:0 18px;border-radius:var(--w-radius);font-weight:700;font-size:15px;border:1.5px solid var(--w-primary);white-space:nowrap}
.btn.block{flex:1;width:100%}
.btn.primary{background:var(--w-primary);color:var(--w-on-primary)}
.btn.secondary{background:var(--w-ground);color:var(--w-link)}
.btn.tertiary{background:transparent;border-color:transparent;color:var(--w-link);text-decoration:underline}
.btn.destructive{background:var(--w-ground);color:var(--w-ink);border-color:var(--w-ink);border-width:3px}
.btn.s{height:32px;padding:0 12px;font-size:13px}
.btn.l{height:52px}
.btn.disabled{background:var(--w-surface);border-color:var(--w-line);color:var(--w-ink-muted)}
.btn.loading::after{content:"\u2026"}
.ibtn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;font-size:18px;color:var(--w-ink);flex:none}
.lnk{color:var(--w-link);font-weight:600;text-decoration:underline;font-size:14px}
.link-row{display:flex;gap:8px;justify-content:center;align-items:center;padding:6px 0}
.link-row .bar{width:90px!important}
.av{display:inline-block;border-radius:50%;background:var(--w-surface);border:1.5px solid var(--w-line);flex:none}
.av.s{width:28px;height:28px}.av.m{width:40px;height:40px}.av.l{width:88px;height:88px}
.ico{display:inline-block;width:24px;height:24px;border-radius:6px;background:var(--w-surface);border:1.5px solid var(--w-line);flex:none}
.fld{display:flex;flex-direction:column;gap:6px}
.lbl{font-size:13px;font-weight:600;color:var(--w-ink-muted)}
.fld .box,.composer .box{height:44px;border:1.5px solid var(--w-line);border-radius:var(--w-radius);display:flex;align-items:center;padding:0 12px;background:var(--w-ground)}
.fld .box .bar{width:45%!important}
.form{display:flex;flex-direction:column;gap:${S(1.75)}}
.form.center,.center{text-align:center;align-items:center}
.between{display:flex;justify-content:space-between;align-items:center}
.chk{display:flex;align-items:center;gap:8px;font-size:14px}
.chk .bar{width:90px!important}
.cb{display:inline-block;width:18px;height:18px;border:1.5px solid var(--w-ink-muted);border-radius:3px;flex:none}
.cb.on{background:${SELECTED};border-color:${SELECTED}}
.or{padding:4px 0}
.logo-dot{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--w-line)}
.code{display:flex;gap:8px;justify-content:center}
.code span{width:40px;height:48px;border:1.5px solid var(--w-line);border-radius:${R(12)}}
.glyph{font-size:40px;color:var(--w-ink-muted);line-height:1.2}
.glyph.big{font-size:44px;font-weight:800;color:var(--w-ink)}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;height:30px;padding:0 14px;border-radius:15px;border:1.5px solid var(--w-line)}
.chip .bar{width:36px!important}
.chip.on{background:${SELECTED};border-color:${SELECTED}}
.chip.on .bar{background:var(--w-on-primary)}
.tg{display:inline-block;width:40px;height:24px;border-radius:12px;background:var(--w-surface);border:1.5px solid var(--w-line);position:relative;flex:none}
.tg::after{content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:var(--w-ground);border:1px solid var(--w-line)}
.tg.on{background:${SELECTED};border-color:${SELECTED}}.tg.on::after{left:18px}
.list .row,.settings .row{display:flex;align-items:center;gap:12px;padding:10px 0;min-height:52px}
.list.div .row+.row{border-top:1px solid var(--w-surface)}
.list.inset{border:1px solid var(--w-surface);border-radius:${R(16)};padding:0 12px}
.row-t{flex:1;min-width:0}
.chev{color:var(--w-ink-muted);font-size:22px}
.thumb{width:48px;height:48px;border-radius:${R(12)};background:var(--w-surface);border:1.5px solid var(--w-line);flex:none}
.badge{width:22px;height:18px;border-radius:9px;background:${SELECTED}}
.sec{padding-top:6px}
.search{display:flex;align-items:center;gap:8px;height:44px;border:1.5px solid var(--w-line);border-radius:22px;padding:0 14px}
.search.sm{height:34px;width:220px}
.ico-t{font-size:18px;color:var(--w-ink-muted)}
.ph-t{color:var(--w-ink-muted)}
.scope{margin-left:auto;border-left:1px solid var(--w-line);padding-left:10px}
.seg{display:flex;border:1.5px solid var(--w-line);border-radius:${R(16)};overflow:hidden}
.seg span{flex:1;display:flex;justify-content:center;align-items:center;height:36px}
.seg span+span{border-left:1.5px solid var(--w-line)}
.seg span.on{background:${SELECTED}}.seg span.on .bar{background:var(--w-on-primary)}
.seg .bar{width:50%!important}
.tabs{display:flex;gap:18px;border-bottom:1px solid var(--w-surface)}
.tabs span{padding:10px 0;min-width:56px}
.tabs .bar{width:100%!important}
.tabs span.on{border-bottom:3px solid var(--w-primary)}
.tabs span.on .bar{background:var(--w-ink-muted)}
.tabs.pill{border:0;gap:8px}.tabs.pill span{padding:8px 14px;border-radius:18px;border:1.5px solid var(--w-line)}.tabs.pill span.on{background:${SELECTED};border-color:${SELECTED}}.tabs.pill span.on .bar{background:var(--w-on-primary)}
.tabs.vertical{flex-direction:column;gap:0;border-bottom:0;border-left:1px solid var(--w-surface)}.tabs.vertical span{padding:8px 12px}
.fab-wrap{display:flex;justify-content:flex-end}
.fab{display:inline-flex;align-items:center;justify-content:center;min-width:56px;height:56px;border-radius:28px;background:var(--w-primary);color:var(--w-on-primary);font-size:24px;font-weight:700;padding:0 18px}
.fab.ext{font-size:15px;gap:6px}
.appbar{display:flex;align-items:center;gap:4px;height:56px;padding:0 8px;border-bottom:1px solid var(--w-surface)}
.appbar .t{flex:1;font-weight:700;font-size:17px;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tabbar{display:flex;height:64px;border-top:1px solid var(--w-surface)}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--w-ink-muted)}
.tab b{font-size:20px;font-weight:400}.tab small{font-size:11px;font-weight:600}
.tab.on{color:var(--w-link)}.tab.on small{text-decoration:underline}
.sidenav{display:flex;flex-direction:column;gap:2px;padding:12px 8px;flex:1}
.sidenav hr{border:0;border-top:1px solid var(--w-surface);width:100%}
.nav-i{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:${R(12)};font-weight:600;color:var(--w-ink-muted);font-size:14px}
.nav-i b{font-weight:400;font-size:17px;width:22px;text-align:center}
.nav-i.on{background:var(--w-surface);color:var(--w-ink)}
.frame.app .sidenav .nav-i{flex-direction:column;gap:2px;font-size:10px;padding:8px 2px;text-align:center}
.dots{display:flex;gap:8px;justify-content:center;padding:8px 0}
.dots i{width:8px;height:8px;border-radius:50%;background:var(--w-line)}
.dots i.on{background:var(--w-primary);width:20px;border-radius:4px}
.steps{display:flex;gap:8px;align-items:flex-start}
.step{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.step b{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--w-line);font-size:12px;color:var(--w-ink-muted)}
.step.on b{border-color:var(--w-primary);color:var(--w-link)}
.step.done b{background:${SELECTED};border-color:${SELECTED};color:var(--w-on-primary)}
.step .bar{width:70%!important}
.chart{border:1px solid var(--w-surface);border-radius:${R(16)};padding:12px}
.chart svg{width:100%;height:150px;display:block}
.chart.k-sparkline svg{height:40px}
.stat .chart{border:0;padding:0}
.legend{display:flex;gap:14px;padding-top:8px}
.legend span{display:flex;align-items:center;gap:6px}
.legend i{width:10px;height:10px;border-radius:2px}
.legend .bar{width:48px!important}
.drawer{height:100%;background:var(--w-ground);padding:16px 10px;display:flex;flex-direction:column;gap:2px}
.drawer-head{display:flex;align-items:center;gap:12px;padding:8px 8px 16px;border-bottom:1px solid var(--w-surface);margin-bottom:8px}
.drawer-head .bar{flex:1}
.sheet{background:var(--w-ground);border-radius:${R(24, 2)} ${R(24, 2)} 0 0;padding:14px 16px 20px;display:flex;flex-direction:column;gap:10px}
.sheet.full{min-height:78%}
.sheet.side{border-radius:0;height:100%}
.grab{width:40px;height:5px;border-radius:3px;background:var(--w-line);margin:0 auto 6px}
.sheet-actions{display:flex;flex-direction:column;border:1px solid var(--w-surface);border-radius:${R(16)}}
.sheet-a{padding:14px;text-align:center;font-weight:600;font-size:16px}
.sheet-a+.sheet-a{border-top:1px solid var(--w-surface)}
.sheet-a.destructive{font-weight:800;text-decoration:underline}
.dialog{position:relative;background:var(--w-ground);border-radius:${R(24, 1.5)};padding:20px;display:flex;flex-direction:column;gap:10px;border:1.5px solid var(--w-line)}
.dialog.fullscreen{border-radius:0;min-height:100%}
.dialog .x{position:absolute;right:14px;top:10px;color:var(--w-ink-muted)}
.navbar{display:flex;align-items:center;gap:18px;height:64px;padding:0 20px;border-bottom:1px solid var(--w-surface)}
.navbar .brand .img{width:32px}
.navbar .links{display:flex;gap:18px}
.sp{flex:1}
.chrome{display:flex;align-items:center;gap:6px;height:24px;padding:0 20px;background:var(--w-ground)}
.chrome i{width:14px;height:8px;border-radius:2px;background:var(--w-line)}
.chrome.web{height:32px;background:var(--w-surface);padding:0 12px}
.chrome.web i{width:10px;height:10px;border-radius:50%}
.chrome.web .url{margin-left:12px;background:var(--w-ground);height:16px}
.chrome .clock{width:36px!important;background:var(--w-ink-muted)}
.pagehead{display:flex;flex-direction:column;gap:6px;padding:16px 20px;border-bottom:1px solid var(--w-surface)}
.ph-row{display:flex;align-items:center;gap:8px}
.crumbs{display:flex;gap:6px;align-items:center;color:var(--w-line)}
.crumbs .bar{width:48px!important}
.onb{display:flex;flex-direction:column;gap:18px;justify-content:center;flex:1}
.right{text-align:right}
.wizard,.filters,.settings,.comments,.long,.posts,.plist{display:flex;flex-direction:column;gap:12px}
.card{border:1.5px solid var(--w-line);border-radius:${R(16)};padding:${S(1.25)};display:flex;flex-direction:column;gap:4px;background:var(--w-ground)}
.card .img{border:0;border-radius:${R(12, 0.5)}}
.grp{display:flex;flex-direction:column;gap:6px;padding-bottom:6px;border-bottom:1px solid var(--w-surface)}
.stats{display:grid;gap:10px}
.stats.c2{grid-template-columns:repeat(2,1fr)}.stats.c3{grid-template-columns:repeat(3,1fr)}.stats.c4{grid-template-columns:repeat(4,1fr)}
.stat{border:1.5px solid var(--w-line);border-radius:${R(16)};padding:${S(1.25)}}
.stat .big{padding:4px 0}
.trend{font-size:11px;color:var(--w-ink-muted);display:flex;gap:4px;align-items:center}
.trend .bar{width:40px!important}
.grid{display:grid;gap:10px}
.grid.tight{gap:4px}
.grid.tight .img{border-radius:2px}
.masonry{column-gap:6px}.masonry .img{margin-bottom:6px;break-inside:avoid}
.table{border:1px solid var(--w-surface);border-radius:${R(16)};overflow:hidden}
.toolbar{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--w-surface)}
.table table{width:100%;border-collapse:collapse;table-layout:fixed}
.table th,.table td{padding:9px 10px;border-bottom:1px solid var(--w-surface);text-align:left}
.table th{background:${PAGE}}
.table .sel{width:36px}
.pager{display:flex;gap:6px;justify-content:flex-end;padding:8px;font-size:13px;color:var(--w-ink-muted)}
.pager span{min-width:24px;text-align:center;padding:2px 4px;border-radius:4px}
.pager .on{background:var(--w-primary);color:var(--w-on-primary)}
.post{display:flex;gap:12px}
.post.grid,.post.featured{flex-direction:column}
.post.list .img{width:88px;flex:none}
.post>div{flex:1;min-width:0}
.featured-top{display:flex;flex-direction:column;gap:4px}
.toc{border-left:3px solid var(--w-line);padding-left:10px}
.detail{display:flex;flex-direction:column;gap:6px}
.metas{display:flex;gap:14px;flex-wrap:wrap}
.meta-i{display:flex;gap:6px;align-items:center}
.meta-i .ico{width:16px;height:16px}
.meta-i .bar{width:60px!important}
.comment{display:flex;gap:10px}
.comment.nested{margin-left:38px}
.composer{display:flex;gap:8px;align-items:center}
.composer .box{flex:1}
.profile{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.profile .bar{margin-left:auto;margin-right:auto}
.profile.covered .av{margin-top:-44px;background:var(--w-ground)}
.pstats{display:flex;gap:28px;padding:6px 0}
.pstats span{display:flex;flex-direction:column;align-items:center;width:56px}
.fpost{display:flex;flex-direction:column;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--w-surface)}
.fhead{display:flex;gap:10px;align-items:center}
.factions{display:flex;gap:18px;font-size:13px;font-weight:600;color:var(--w-ink-muted)}
.video{position:relative}
.play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34px;color:var(--w-ink)}
.linkcard{display:flex;gap:10px;border:1.5px solid var(--w-line);border-radius:${R(16)};padding:8px}
.linkcard>div{flex:1}
.carousel{display:flex;flex-direction:column;gap:4px}
.product .stars{font-size:12px;color:var(--w-ink-muted);letter-spacing:1px}
.plist .card.product{flex-direction:row;align-items:center;gap:12px}
.plist .card.product>div{flex:1}
.state{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;flex:1;padding:24px}
.state .bar{margin-left:auto;margin-right:auto}
.state .actions{margin-top:12px;min-width:200px}
.dlist{margin:0;display:flex;flex-direction:column}
.dlist>div{padding:8px 0;border-bottom:1px solid var(--w-surface)}
.dlist.inline>div{display:flex;gap:16px;align-items:center}
.dlist.inline>div .bar{flex:none}
.tx{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35}
span.tx{display:inline}
.tx.k{font-weight:650;font-size:15px;color:var(--w-ink)}
.tx.k.wrap{white-space:normal}
.tx.meta{font-size:12.5px;color:var(--w-ink-muted)}
.tx.meta.r{flex:none;margin-left:6px}
.tx.body{white-space:normal;font-size:14px;line-height:1.45;color:var(--w-ink-muted)}
.tx.body.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tx.title{white-space:normal;font-weight:700;font-size:20px;line-height:1.25;color:var(--w-ink);margin:4px 0 2px}
.tx.big{font-weight:750;font-size:24px;color:var(--w-ink);letter-spacing:-.01em}
.tx.lbl{font-size:12px;font-weight:600;color:var(--w-ink-muted)}
.tx.sec-t{font-size:13px;font-weight:700;color:var(--w-ink);letter-spacing:.02em}
.tx.price{font-weight:700;font-size:15px;color:var(--w-ink);margin-top:2px}
.tx.v{font-size:14px;color:var(--w-ink)}
.tx.cap-t{margin-top:8px}
.st{display:inline-block;font-size:11px;font-weight:650;line-height:1.5;padding:1px 8px;border-radius:10px;background:var(--w-surface);color:var(--w-ink);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.img.pic{display:flex;align-items:center;justify-content:center;background:var(--w-surface);border-color:var(--w-surface);color:var(--w-ink-muted)}
.img.pic .pg{width:34%;height:auto;aspect-ratio:1;max-width:88px;min-width:22px}
.img.pic.sm .pg,.img.pic.thumb-img .pg{width:52%}
.img.pic.round{border-radius:50%}
.img.pic.illustration .pg{width:40%}
.thumb.pic,.ico.pic,.logo-pic{display:inline-flex;align-items:center;justify-content:center;background:var(--w-surface);border-color:var(--w-surface);color:var(--w-ink-muted)}
.thumb.pic .pg{width:28px;height:28px}
.ico.pic .pg{width:16px;height:16px}
.logo-pic{width:32px;height:32px;border-radius:${R(10)};color:var(--w-ink)}
.logo-pic .pg{width:20px;height:20px}
.av.ini{display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:var(--w-ink-muted);background:var(--w-surface);border-color:var(--w-surface);letter-spacing:.02em}
.av.s.ini{font-size:11px}.av.m.ini{font-size:14px}.av.l.ini{font-size:30px}
.val{color:var(--w-ink);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lead{color:var(--w-ink-muted);font-size:14px}
.chip{font-size:13px;font-weight:600;color:var(--w-ink);white-space:nowrap}
.chip.on{color:var(--w-on-primary)}
.seg span{font-size:13px;font-weight:600;color:var(--w-ink)}
.seg span.on{color:var(--w-on-primary)}
.tabs.worded span{min-width:0;font-size:14px;font-weight:600;color:var(--w-ink-muted);white-space:nowrap}
.tabs.worded span.on{color:var(--w-ink)}
.tabs.pill.worded span.on{color:var(--w-on-primary)}
.step small{font-size:11px;font-weight:600;color:var(--w-ink-muted)}
.step.on small{color:var(--w-ink)}
.search .q{color:var(--w-ink);font-size:15px;display:inline-flex;align-items:center}
.caret{display:inline-block;width:1.5px;height:18px;background:var(--w-ink);margin-left:1px}
.search .scope .tx{font-size:13px}
.stat .tx.lbl{margin-bottom:2px}
.frame.app .stats.c3 .tx.big,.frame.app .stats.c4 .tx.big{font-size:19px}
.frame.app .stats.c3 .tx.lbl,.frame.app .stats.c4 .tx.lbl{font-size:11px}
.trend{font-size:12px;font-weight:600}
.badge.n{display:inline-flex;align-items:center;justify-content:center;width:auto;min-width:22px;padding:0 6px;font-size:11px;font-weight:700;color:var(--w-on-primary)}
.row-t .tx.meta{margin-top:2px}
.table .tx{font-size:13px}
.table .tx.k{font-size:13.5px}
.table th{font-size:12px;font-weight:650;color:var(--w-ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.table td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pager .count{margin-right:auto;padding-left:4px}
.crumbs .cr{font-size:12.5px;color:var(--w-ink-muted)}
.card .tx.meta{margin-top:1px}
.card.summary{text-align:left;min-width:240px;margin-top:8px}
.comment .by{display:flex;gap:8px;align-items:baseline}
.fpost .tx.body{color:var(--w-ink)}
.pstats span .tx{text-align:center}
.pstats span .tx.big{font-size:18px}
.metas .st{font-size:12px}
.profile .tx.title{margin-top:6px}
.state .tx.body{max-width:300px}
.dlist .tx.lbl{margin-bottom:2px}
.dlist.inline .tx.lbl{flex:none;width:40%}
.onb .center .tx.body{max-width:300px;margin:0 auto}
.ticks{display:flex;justify-content:space-between;padding:4px 6px 0;font-size:11px;color:var(--w-ink-muted)}
.drawer-head .row-t{flex:1}
.clock-t{font-size:12px;font-weight:700;color:var(--w-ink)}
.url-t{margin-left:12px;background:var(--w-ground);border-radius:8px;padding:0 10px;font-size:11px;line-height:18px;color:var(--w-ink-muted);min-width:30%}
.hero{display:flex;flex-direction:column;gap:${S(2)};padding:${S(1.5)} 0}
.hero.split{display:grid;grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:${S(2.5)};align-items:center}
.hero-copy{display:flex;flex-direction:column;gap:${S(1.25)};align-items:flex-start}
.hero-h{font-size:26px;line-height:1.18;letter-spacing:-.015em}
.hero-bullets{display:flex;flex-direction:column;gap:6px}
.hero-cta{justify-content:flex-start;padding-top:4px}
.hero-media{width:100%}
.pricing{display:flex;flex-direction:column;gap:${S(1.5)}}
.billing-row{display:flex;justify-content:center}
.billing-row .seg{min-width:220px}
.card.tier{gap:10px;padding:${S(1.75)};position:relative}
.card.tier.popular{border-color:var(--w-primary);border-width:2px}
.tier-badge{align-self:flex-start}
.tier-feats{display:flex;flex-direction:column;gap:8px;padding:6px 0;flex:1}
.accordion{display:flex;flex-direction:column;border:1.5px solid var(--w-line);border-radius:${R(16)};overflow:hidden;background:var(--w-ground)}
.acc-item+.acc-item{border-top:1px solid var(--w-surface)}
.acc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;min-height:48px}
.acc-head .bar{margin:0}
.acc-body{padding:0 14px 14px;border-top:1px dashed var(--w-surface)}
.acc-item.open .acc-head{background:color-mix(in srgb,var(--w-surface) 45%,var(--w-ground))}
`;
var INK_AT = (n) => `color-mix(in srgb,var(--w-ink) ${n}%,transparent)`;
var PRIMARY_AT = (n) => `color-mix(in srgb,var(--w-primary) ${n}%,transparent)`;
var PANE = "color-mix(in srgb,var(--w-ground) 58%,transparent)";
var BLUR = "blur(20px) saturate(1.8)";
var SURFACE_CSS = {
  raised: `
.s-raised :is(.card,.stat,.list.inset,.table,.chart,.linkcard,.sheet-actions){border-color:transparent;box-shadow:0 1px 2px ${INK_AT(16)},0 3px 10px ${INK_AT(9)}}
.s-raised :is(.appbar,.navbar,.pagehead){position:relative;z-index:1;border-bottom-color:transparent;box-shadow:0 1px 3px ${INK_AT(14)},0 4px 12px ${INK_AT(6)}}
.s-raised .tabbar{position:relative;z-index:1;border-top-color:transparent;box-shadow:0 -1px 3px ${INK_AT(10)},0 -4px 12px ${INK_AT(5)}}
.s-raised :is(.sheet,.dialog,.drawer){border-color:transparent;box-shadow:0 10px 32px ${INK_AT(24)},0 2px 8px ${INK_AT(12)}}
.s-raised :is(.fab,.btn.primary){box-shadow:0 2px 4px ${INK_AT(14)},0 4px 12px ${PRIMARY_AT(28)}}
`,
  glass: `
.frame.s-glass{background:radial-gradient(90% 55% at 0% 0%,color-mix(in srgb,var(--w-primary) 45%,var(--w-ground)),transparent 70%),radial-gradient(80% 50% at 100% 38%,color-mix(in srgb,var(--w-surface) 70%,var(--w-primary)),transparent 72%),radial-gradient(110% 60% at 15% 100%,color-mix(in srgb,var(--w-primary) 32%,var(--w-surface)),transparent 75%),linear-gradient(160deg,var(--w-ground),var(--w-surface))}
.s-glass :is(.card,.stat,.list.inset,.table,.chart,.linkcard,.sheet-actions,.appbar,.tabbar,.navbar,.pagehead,.sheet,.dialog,.drawer,.fld .box,.composer .box,.search,.seg,.chip,.btn.secondary,.btn.destructive){background:${PANE};-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR};border-color:var(--w-line)}
.s-glass :is(.card,.stat,.list.inset,.table,.chart,.linkcard,.sheet,.dialog,.fld .box,.search){box-shadow:0 8px 28px ${PRIMARY_AT(22)},inset 0 1px 0 var(--w-line)}
.s-glass :is(.appbar,.navbar,.pagehead){border-bottom-color:var(--w-line)}
.s-glass .tabbar{border-top-color:var(--w-line)}
.s-glass :is(.chrome,.table th){background:transparent}
.s-glass :is(.img,.thumb,.av,.ico){background-color:color-mix(in srgb,var(--w-surface) 55%,transparent);border-color:var(--w-line)}
.s-glass :is(.fab,.btn.primary){box-shadow:0 6px 18px ${PRIMARY_AT(34)}}
.s-glass .layer{background:${INK_AT(16)};-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
`,
  bold: `
.s-bold :is(.card,.stat,.list.inset,.table,.chart,.linkcard,.sheet-actions,.fld .box,.composer .box,.search,.seg,.chip,.btn:not(.tertiary),.img,.av,.thumb,.ico,.tg,.cb,.code span,.dialog,.sheet,.fab){border:3px solid var(--w-ink)}
.s-bold :is(.card,.stat,.list.inset,.table,.linkcard,.fld .box,.search,.btn:not(.tertiary),.dialog,.fab){box-shadow:4px 4px 0 var(--w-ink)}
.s-bold :is(.appbar,.navbar,.pagehead){border-bottom:3px solid var(--w-ink)}
.s-bold .tabbar{border-top:3px solid var(--w-ink)}
.s-bold :is(.search,.chip,.seg,.tabs.pill span,.badge,.st){border-radius:0}
`
};
function surfaceCss(surfaces) {
  return [...new Set(surfaces)].map((s) => SURFACE_CSS[s] ?? "").join("");
}
var TEMPLATE_CSS = `
body.screen>.frame{max-width:100%}
.frame:has(.main[data-template]),.main[data-template]{container-type:inline-size}
.tpl-region{display:flex;flex-direction:column;gap:var(--w-space);min-width:0}
@media (max-width: 639px){
body.screen>.frame{width:100%!important;height:auto!important;min-height:100vh}
.frame.web .body{flex-direction:column}
.frame.web .body>.side{width:100%;border-right:0;border-bottom:1px solid var(--w-line)}
.tabbar .item{min-width:0;padding:8px 6px;flex:1 1 0}
}
@container (max-width: 639px){
.stats.c3,.stats.c4{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
.table{overflow-x:auto;min-width:0}
.chart{min-width:0;overflow:hidden}
}
@container (min-width: 640px){
.frame>.body>.main.tpl-split{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:calc(var(--w-space)*1.5);align-items:start}
.frame>.body>.main.tpl-master_detail{display:grid;grid-template-columns:minmax(220px,2fr) minmax(0,3fr);gap:calc(var(--w-space)*1.5);align-items:start}
.main.tpl-master_detail .tpl-r-master{border-right:1px solid var(--w-line);padding-right:var(--w-space)}
.main.tpl-grid .tpl-r-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--w-space);align-items:start}
.main.tpl-bento .tpl-r-bento{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--w-space);align-items:stretch}
.main.tpl-bento .tpl-r-bento>.slot{grid-column:span 3}
.main.tpl-bento .tpl-r-bento>.slot:first-child{grid-column:span 4}
.main.tpl-bento .tpl-r-bento>.slot:nth-child(2){grid-column:span 2}
.main.tpl-hero_then_grid .tpl-r-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--w-space);align-items:start}
.frame>.body>.main.tpl-dashboard{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:calc(var(--w-space)*1.5);align-items:start}
.main.tpl-dashboard .tpl-r-kpi{grid-column:1/-1}
}
`;
function templateCss(id) {
  return id && id !== "single" ? TEMPLATE_CSS : "";
}
var POLISH_CSS = `
.wf-elevated{background:var(--w-ground);border:1px solid var(--w-line);border-radius:var(--w-radius);padding:var(--w-space);box-shadow:0 4px 14px ${INK_AT(8)}}
.wf-bordered{border:1.5px solid var(--w-line);border-radius:var(--w-radius);padding:var(--w-space)}
.wf-subtle{background:var(--w-surface);border-radius:var(--w-radius);padding:var(--w-space)}
.wf-emphasis{border-left:3px solid var(--w-primary);padding-left:var(--w-space)}
.wf-compact-pad{padding:calc(var(--w-space)*0.5)}
.wf-spacious-pad{padding:calc(var(--w-space)*1.5)}
.wf-rounded-lg{border-radius:calc(var(--w-radius)*1.5)}
.wf-accent-ring{outline:2px solid var(--w-primary);outline-offset:2px}
`;
var LOFI_CSS = `
.frame.lofi{border-color:transparent;background:var(--w-ground)}
.frame.lofi .slot.w{border-color:transparent;background:transparent}
.frame.lofi :is(.card,.stat,.list.inset,.table,.accordion,.linkcard){background:var(--w-ground);border:1px solid color-mix(in srgb,var(--w-line) 65%,transparent);border-radius:var(--w-radius);box-shadow:0 2px 8px ${INK_AT(6)}}
.frame.lofi .card.tier.popular{border-color:var(--w-primary);box-shadow:0 4px 14px ${PRIMARY_AT(16)}}
.frame.lofi :is(.fld .box,.composer .box,.search){background:color-mix(in srgb,var(--w-surface) 55%,var(--w-ground));border:1px solid color-mix(in srgb,var(--w-line) 70%,transparent)}
.frame.lofi .btn{border-radius:min(calc(var(--w-radius)*1.5),999px);font-weight:600;border-width:1px}
.frame.lofi .btn.secondary{border-color:color-mix(in srgb,var(--w-line) 80%,transparent);color:var(--w-ink)}
.frame.lofi :is(.chip,.tabs.pill span){border-width:1px;border-color:color-mix(in srgb,var(--w-line) 75%,transparent)}
.frame.lofi .table th{background:color-mix(in srgb,var(--w-surface) 60%,var(--w-ground));border-bottom-color:color-mix(in srgb,var(--w-line) 60%,transparent)}
.frame.lofi .bar{border-radius:999px}
`;
var HIFI_CSS = `
.frame.hifi{background:radial-gradient(120% 80% at 50% 0%,${PRIMARY_AT(12)},transparent 65%),radial-gradient(90% 60% at 100% 100%,color-mix(in srgb,var(--w-surface) 50%,transparent),transparent 70%),var(--w-ground)}
.frame.hifi :is(.appbar,.navbar,.tabbar,.pagehead){background:${PANE};backdrop-filter:${BLUR};-webkit-backdrop-filter:${BLUR};border-color:${INK_AT(10)}}
.frame.hifi :is(.card,.stat,.list.inset,.table,.accordion,.dialog,.sheet){box-shadow:0 10px 28px ${INK_AT(10)},0 2px 6px ${INK_AT(5)},inset 0 1px 0 color-mix(in srgb,var(--w-ground) 70%,transparent);border-color:${INK_AT(10)}}
.frame.hifi .card.tier.popular{border-color:var(--w-primary);box-shadow:0 12px 32px ${PRIMARY_AT(22)},0 2px 8px ${INK_AT(8)}}
.frame.hifi .hero{padding:${S(2)};border-radius:${R(20, 1.5)};background:linear-gradient(145deg,color-mix(in srgb,var(--w-surface) 55%,var(--w-ground)),var(--w-ground));border:1px solid ${INK_AT(8)};box-shadow:0 8px 24px ${INK_AT(7)}}
.frame.hifi :is(.btn.primary,.fab){box-shadow:0 4px 14px ${PRIMARY_AT(28)},0 1px 3px ${INK_AT(12)}}
.frame.hifi :is(.fld .box,.composer .box,.search){background:var(--w-ground);border-color:${INK_AT(14)};box-shadow:inset 0 1px 2px ${INK_AT(5)}}
`;
function polishCss(patches, layers) {
  if (layers?.lofi === false) return "";
  const base = patches && patches.length > 0 ? POLISH_CSS : "";
  const lofi = layers?.lofi || layers?.hifi ? LOFI_CSS : "";
  const hifi = layers?.hifi ? HIFI_CSS : "";
  return `${base}${lofi}${hifi}`;
}
function resolvePolishTokens(patches, target, layers) {
  if (layers?.lofi === false || !patches || patches.length === 0) return [];
  const active = /* @__PURE__ */ new Set();
  for (const p of patches) {
    if (p.target !== target) continue;
    for (const r of p.remove ?? []) active.delete(r);
    for (const a of p.add ?? []) active.add(a);
  }
  return [...active];
}
var SKELETON_CSS = `
.sk-frame{border-color:${BLUE}!important;background:#ffffff linear-gradient(${BLUE_GROUND} 1px,transparent 1px) 0 0/100% 24px}
.sk{display:flex;flex-direction:column}
.sk .sk-box{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;border:1px solid ${BLUE};border-radius:3px;background:#ffffff;padding:8px;text-align:center}
.sk.opt .sk-box{border-style:dashed}
.sk .sk-name{font:600 11px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${BLUE}}
.sk .sk-opts{font:500 10px/1.3 system-ui,-apple-system,sans-serif;color:${BLUE_SOFT}}
.sk.grow{flex:1}
`;
var SITE_MIN = PLATFORM_SIZE.site.height;
function humanize(id) {
  return id.replace(/-/g, " ");
}
function slotName(section) {
  return section.options.length === 1 ? humanize(section.options[0]) : humanize(section.region);
}
function navPlacement(slot, section, spec) {
  if (slot.block) return slot.block === "side-nav" ? "side" : "bottom";
  if (!section.options.includes("tab-bar")) return "side";
  if (!section.options.includes("side-nav")) return "bottom";
  return spec.platform === "app" ? "bottom" : "side";
}
function overlayPlacement(slot, section) {
  const id = slot.block ?? section.options[0];
  if (id === "drawer") return "left";
  if (id === "sheet") return "bottom";
  return "center";
}
function drawSlot(spec, slot, section, grow) {
  const attrs = `data-slot="${esc(slot.slot)}" data-region="${section.region}" data-sec="${esc(slot.slot)}" data-wf="${esc(slot.slot)}"`;
  if (slot.block === null) {
    const c2 = component(section.options[0]);
    const h = section.region === "nav" && navPlacement(slot, section, spec) === "side" ? 0 : c2.h;
    const classes = ["slot", "sk", section.optional ? "opt" : "", grow ? "grow" : ""].filter(Boolean).join(" ");
    return `<section class="${classes}" ${attrs} data-block="" data-state="skeleton"><div class="sk-box" style="min-height:${h}px"><span class="sk-name">${esc(slotName(section))}</span>${section.options.length > 1 ? `<span class="sk-opts">${section.options.map((o) => esc(humanize(o))).join(" \xB7 ")}</span>` : ""}${section.optional ? `<span class="sk-opts">optional</span>` : ""}</div></section>`;
  }
  const r = recipe(spec.archetype);
  const c = component(slot.block);
  const props = propsFor(c, slot.props);
  const intentOf = (element) => slot.intents?.[element] ?? defaultIntent(r, c, element);
  const slotPolish = resolvePolishTokens(spec.polish, slot.slot, spec.layers);
  const copyOn = spec.layers?.copy !== false;
  const activeFill = copyOn ? slot.fill : void 0;
  const ctx = {
    props,
    intent: intentOf,
    // A fleshed lone action says what it acts on ("Edit delivery"); anything else, its intent's own word.
    label: (element) => esc(activeFill?.actions?.[element] ?? INTENT_BY_ID.get(intentOf(element))?.label ?? intentOf(element)),
    hot: (element) => {
      const intentId = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(r, c, element) : void 0);
      const elPolish = resolvePolishTokens(spec.polish, `${slot.slot}.${element}`, spec.layers);
      const polishAttr = elPolish.length > 0 ? ` data-polish="${esc(elPolish.join(" "))}"` : "";
      return ` data-hot="${esc(hotKey(slot.slot, element))}" data-wf="${esc(`${slot.slot}.${element}`)}"${intentId ? ` data-intent="${esc(intentId)}"` : ""}${polishAttr}`;
    },
    title: esc(c.id === "app-bar" ? barTitleOf(spec) : headingOf(spec)),
    platform: spec.platform,
    wide: spec.platform !== "app",
    ...activeFill ? { fill: activeFill } : {}
  };
  const slotClass = ["slot", "w", ...slotPolish].join(" ");
  return `<section class="${esc(slotClass)}" ${attrs} data-block="${esc(c.id)}" data-state="wire">${c.draw(ctx)}</section>`;
}
function headingOf(spec) {
  if (spec.layers?.copy === false) return spec.title;
  return spec.content?.title ?? spec.title;
}
function barTitleOf(spec) {
  if (spec.layers?.copy === false || !spec.content) return spec.title;
  if (spec.content.bar !== void 0) return spec.content.bar;
  return spec.slots.some((s) => s.block === "heading" || s.block === "detail-header" && s.fill?.heading !== void 0) ? spec.title : headingOf(spec);
}
function specJson(spec) {
  return JSON.stringify(spec).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function renderWire(spec) {
  const frame = renderFrame(spec);
  const state = spec.slots.every((s) => s.block === null) ? "blueprint" : spec.slots.some((s) => s.block === null) ? "drawing" : "wireframe";
  const { width } = PLATFORM_SIZE[spec.platform];
  const title = esc(wireTitle(spec));
  return `<!doctype html>
${WIRE_MARKER}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}">
<title>${title}</title>
<script type="application/json" id="${WIRE_SCRIPT_ID}">${specJson(spec)}</script>
<style>${wireCss(spec)}</style>
</head>
<body class="screen" data-archetype="${esc(spec.archetype)}" data-state="${state}"${spec.varied === "none" ? ` data-varied="none" title="one way to draw this"` : ""}>
${frame}
</body>
</html>
`;
}
function styleOf(spec) {
  if (spec.slots.every((s) => s.block === null) || spec.layers?.system === false) return void 0;
  return spec.style;
}
function themeCss(style, density) {
  return `:root{${themeDecls(style, density)}}`;
}
function wireCss(spec) {
  const density = spec.slots.every((s) => s.block === null) ? void 0 : spec.density;
  return `${themeCss(styleOf(spec), density)}${WIRE_CSS}${surfaceCss([surfaceOf(styleOf(spec))])}${templateCss(spec.template)}${polishCss(spec.polish, spec.layers)}${spec.slots.some((s) => s.block === null) ? SKELETON_CSS : ""}`;
}
function renderFrame(spec) {
  const problems = validateWire(spec);
  if (problems.length > 0) throw new Error(`not a drawable wireframe spec:
  ${problems.join("\n  ")}`);
  const r = recipe(spec.archetype);
  const bySlot = new Map(spec.slots.map((s) => [s.slot, s]));
  const placed = r.sections.filter((s) => bySlot.has(s.slot)).map((section) => ({ section, slot: bySlot.get(section.slot) }));
  const undecided = spec.slots.some((s) => s.block === null);
  const regions = {
    shell: [],
    header: [],
    nav: [],
    main: [],
    aside: [],
    footer: [],
    fab: [],
    overlay: [],
    side: [],
    bottom: []
  };
  const mainSlots = placed.filter((p) => p.section.region === "main" || spec.platform === "app" && p.section.region === "aside");
  const lastMain = mainSlots[mainSlots.length - 1];
  const mainEntries = [];
  let overlayAt = "center";
  for (const p of placed) {
    const side = p.section.region === "nav" && navPlacement(p.slot, p.section, spec) === "side";
    const grow = (p === lastMain || side) && p.slot.block === null;
    const html = drawSlot(spec, p.slot, p.section, grow);
    const region = p.section.region;
    if (region === "nav") regions[navPlacement(p.slot, p.section, spec)].push(html);
    else if (region === "aside" && spec.platform === "app") {
      regions.main.push(html);
      mainEntries.push({ slot: p.slot, html });
    } else {
      if (region === "overlay") overlayAt = overlayPlacement(p.slot, p.section);
      if (region === "main") mainEntries.push({ slot: p.slot, html });
      regions[region].push(html);
    }
  }
  let mainContainer = `<div class="main">${regions.main.join("")}</div>`;
  if (spec.template && spec.template !== "single") {
    const tpl = template(spec.template);
    const grouped = new Map(tpl.regions.map((reg) => [reg, []]));
    mainEntries.forEach(({ slot, html }, idx) => {
      const sub = slot.region && tpl.regions.includes(slot.region) ? slot.region : defaultSlotRegion(tpl.id, slot, idx, mainEntries.length);
      (grouped.get(sub) ?? grouped.get(tpl.regions[0])).push(html);
    });
    const regionDivs = tpl.regions.filter((reg) => (grouped.get(reg)?.length ?? 0) > 0).map((reg) => `<div class="tpl-region tpl-r-${esc(reg)}" data-tpl-region="${esc(reg)}">${grouped.get(reg).join("")}</div>`).join("");
    mainContainer = `<div class="main tpl-${esc(spec.template)}" data-template="${esc(spec.template)}">${regionDivs}</div>`;
  }
  const { width, height } = PLATFORM_SIZE[spec.platform];
  const size = spec.platform === "site" ? `width:${width}px;min-height:${SITE_MIN}px` : `width:${width}px;height:${height}px`;
  const surface = surfaceOf(styleOf(spec));
  const lofiClass = !undecided && (spec.layers?.lofi || spec.layers?.hifi) ? " lofi" : "";
  const hifiClass = !undecided && spec.layers?.hifi ? " hifi" : "";
  return [
    `<div class="frame ${spec.platform}${undecided ? " sk-frame" : ""}${surface === "flat" ? "" : ` s-${surface}`}${lofiClass}${hifiClass}" style="${size}">`,
    ...regions.shell,
    ...regions.header,
    `<div class="body">`,
    regions.side.length ? `<div class="side">${regions.side.join("")}</div>` : "",
    mainContainer,
    regions.aside.length ? `<div class="aside">${regions.aside.join("")}</div>` : "",
    `</div>`,
    regions.footer.length ? `<div class="foot">${regions.footer.join("")}</div>` : "",
    ...regions.bottom,
    regions.fab.length ? `<div class="fabs">${regions.fab.join("")}</div>` : "",
    regions.overlay.length ? `<div class="layer ${overlayAt}">${regions.overlay.join("")}</div>` : "",
    `</div>`
  ].join("");
}
function readWire(html) {
  if (!html.includes(WIRE_MARKER)) return null;
  const m = new RegExp(`<script type="application/json" id="${WIRE_SCRIPT_ID}">([\\s\\S]*?)</script>`).exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
function embedWireSpec(html, spec) {
  const tag = `<script type="application/json" id="${WIRE_SCRIPT_ID}">${specJson(spec)}</script>`;
  const scriptRe = new RegExp(`<script type="application/json" id="${WIRE_SCRIPT_ID}">[\\s\\S]*?</script>`);
  let out = html;
  if (!out.includes(WIRE_MARKER)) {
    out = out.replace(/<!doctype html>/i, `<!doctype html>
${WIRE_MARKER}`);
    if (!out.includes(WIRE_MARKER)) out = `${WIRE_MARKER}
${out}`;
  }
  if (scriptRe.test(out)) {
    out = out.replace(scriptRe, tag);
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${tag}
</head>`);
  } else {
    out = `${tag}
${out}`;
  }
  return out;
}
var __WIRE_CSS = WIRE_CSS;
var __SURFACE_CSS = SURFACE_CSS;
var __LOFI_CSS = LOFI_CSS;
var __HIFI_CSS = HIFI_CSS;
var __SKELETON_CSS = SKELETON_CSS;

export {
  INTENTS,
  INTENT_BY_ID,
  esc,
  PRIMITIVES,
  BLOCKS,
  RECIPES,
  RECIPE_BY_ID,
  TEMPLATE_IDS,
  DENSITY_LEVELS,
  densityFromScore,
  TEMPLATE_BY_ID,
  template,
  templatesFor,
  defaultSlotRegion,
  ARCHETYPE_WORDS,
  COMPONENTS,
  component,
  ROLES,
  DEFAULT_THEME,
  surfaceOf,
  DEFAULT_STYLE,
  themeDecls,
  sameLook,
  sameStyle,
  candidatesOf,
  mappingRequest,
  applyMapping,
  roleLine,
  WIRE_LAYER_IDS,
  WIRE_FIDELITY_TIERS,
  POLISH_TOKENS,
  wireBy,
  LEAVE_OUT,
  flipWords,
  wireTitle,
  PLATFORMS,
  CAPTION_HEIGHT,
  recipe,
  presentElements,
  defaultIntent,
  blueprint,
  resolveSlot,
  wireframe,
  wireSize,
  validateWire,
  LINK_BACK,
  LINK_NONE,
  LINKS_PROP,
  hotspots,
  readOverrides,
  inferLinks,
  startScreen,
  WIRE_MARKER,
  WIRE_SCRIPT_ID,
  SKELETON_COLORS,
  surfaceCss,
  templateCss,
  polishCss,
  headingOf,
  barTitleOf,
  renderWire,
  styleOf,
  themeCss,
  wireCss,
  renderFrame,
  readWire,
  embedWireSpec,
  __WIRE_CSS,
  __SURFACE_CSS,
  __LOFI_CSS,
  __HIFI_CSS,
  __SKELETON_CSS
};
