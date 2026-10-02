import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  WIRE_COMMAND,
  WIRE_PROPERTY_KEYS,
  designUse,
  ownDesignSystemAt,
  wireframeModule
} from "./chunk-IVKDWDSN.mjs";
import {
  FIDELITY_PROP,
  JUDGMENT_UNAVAILABLE,
  canvasScopes,
  checkDesign,
  groupContentBox,
  groupDescendants,
  isGroupItem,
  itemUrl,
  markOffered,
  moduleAsset,
  moduleMarkPatch,
  newGroupId,
  newItemId,
  newVersionId,
  readingOrder,
  selectDesignSystem,
  titleSlug
} from "./chunk-7WD5QFHE.mjs";
import "./chunk-GUY4UN4O.mjs";
import {
  CONTRAST_BODY,
  contrastRatio,
  designSurface,
  luminance,
  parseDesign,
  parseHex,
  resolveToken
} from "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/wireframe/src/cli-runtime.ts
import { readFile as readFile3 } from "node:fs/promises";

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
  for (let i = 0; i < n; i++) out += bar(WIDTHS[(i + offset) % WIDTHS.length], cls);
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
      const logo = str(props, "kind") === "logo";
      const r = logo ? "1/1" : ratio(str(props, "ratio"));
      const cls = logo ? "sm" : str(props, "kind") === "illustration" ? "illustration" : "";
      const caption = flag(props, "caption") ? fill?.lines?.[0] !== void 0 ? tx(fill.lines[0], "meta cap-t") : bar(40, "cap") : "";
      return `<div class="${logo ? "logo" : ""}">${fill?.motif ? pic(fill.motif, r, cls) : img(r, logo ? "sm" : "")}${caption}</div>`;
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
var SHADES = [77, 53, 36, 22].map((pct3) => `color-mix(in srgb, var(--w-primary) ${pct3}%, var(--w-ground))`);
function valuesOf(fill, s, fallback, lo, hi) {
  const v = fill?.series?.[s % (fill.series.length || 1)];
  if (!v || v.length === 0) return [...fallback];
  return fallback.map((_, i) => Math.round(lo + v[i % v.length] / 100 * (hi - lo)));
}
function chartSvg(kind, series2, legend, data) {
  const shades = SHADES;
  const fill = (c) => `style="fill:${c}"`;
  const stroke = (c) => `fill="none" style="stroke:${c}"`;
  let marks = "";
  if (kind === "pie" || kind === "donut") {
    marks = `<circle cx="100" cy="60" r="48" ${fill(shades[3])}/><path d="M100 60 L100 12 A48 48 0 0 1 145 76 Z" ${fill(shades[0])}/>${kind === "donut" ? `<circle cx="100" cy="60" r="24" ${fill("var(--w-ground)")}/>` : ""}`;
  } else if (kind === "bar" || kind === "column") {
    const vals = valuesOf(data, 0, [40, 70, 55, 90, 65, 80], 20, 95);
    marks = vals.map((v, i) => rowsOf(series2, (s) => kind === "column" ? `<rect x="${12 + i * 31 + s * (24 / series2)}" y="${110 - v * (1 - s * 0.15)}" width="${24 / series2 - 1}" height="${v * (1 - s * 0.15)}" ${fill(shades[s])}/>` : `<rect x="10" y="${8 + i * 17 + s * (14 / series2)}" width="${v * 1.9 * (1 - s * 0.15)}" height="${14 / series2 - 1}" ${fill(shades[s])}/>`)).join("");
  } else {
    marks = rowsOf(series2, (s) => {
      const pts = valuesOf(data, s, [70, 55, 62, 35, 48, 22, 30], 78, 12).map((v, i) => `${10 + i * 30},${Math.min(108, v + (data?.series ? 0 : s * 14))}`).join(" ");
      return kind === "area" ? `<polygon points="10,110 ${pts} 190,110" ${fill(shades[s + 1] ?? shades[3])}/><polyline points="${pts}" ${stroke(shades[s])} stroke-width="2"/>` : `<polyline points="${pts}" ${stroke(shades[s])} stroke-width="2"/>`;
    });
  }
  const axis = kind === "pie" || kind === "donut" || kind === "sparkline" ? "" : `<line x1="8" y1="110" x2="194" y2="110" style="stroke:var(--w-line)"/>`;
  const ticks = data?.values && axis && kind !== "bar" ? `<div class="ticks">${data.values.slice(0, kind === "column" ? 6 : 7).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "";
  return `<div class="chart k-${esc(kind)}"><svg viewBox="0 0 200 ${kind === "sparkline" ? 90 : 116}" preserveAspectRatio="none">${axis}${marks}</svg>${ticks}${legend ? `<div class="legend">${rowsOf(series2, (s) => `<span><i style="background:${shades[s]}"></i>${word(data?.labels, s, bar(100, "in"))}</span>`)}</div>` : ""}</div>`;
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
    draw: ({ props, label, hot, fill }) => `<div class="onb">${flag(props, "skip") ? `<div class="right"><span class="lnk"${hot("skip")}>${label("skip")}</span></div>` : ""}${str(props, "media") === "none" ? "" : fill?.motif ? pic(fill.motif, str(props, "media") === "image" ? "4/3" : "1/1", str(props, "media")) : img(str(props, "media") === "image" ? "4/3" : "1/1", str(props, "media"))}<div class="center">${fill?.heading !== void 0 ? `${tx(fill.heading, "title")}${tx((fill.lines ?? []).join(" "), "body")}` : `${bar(60, "k")}${bars(2)}`}</div><div class="dots">${rowsOf(num(props, "steps"), (i) => `<i class="${i + 1 === sel(props, "current", "steps") ? "on" : ""}"></i>`)}</div><div class="actions">${btn(label("next"), "primary", "block", hot("next"))}</div></div>`
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
      return `<div class="fpost"${hot("row")}><div class="fhead">${avatarOf(it?.person, "s")}<div class="row-t">${head}</div></div>${it ? tx(it.text ?? "", "body") : bars(2, p)}${media === "image" ? m("4/3") : media === "video" ? `<div class="video">${m("16/9")}<span class="play">\u25B6</span></div>` : media === "link" ? `<div class="linkcard">${m("1/1", "thumb-img")}<div>${it ? `${tx(it.title, "k")}${tx(it.sub ?? "", "meta")}` : `${bar(70, "k")}${bar(40, "meta")}`}</div></div>` : ""}<div class="factions">${rowsOf(num(props, "actions"), (i) => `<span class="fa"${hot(`action-${i + 1}`)}>${glyph(intent(`action-${i + 1}`))} ${label(`action-${i + 1}`)}</span>`)}</div></div>`;
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
    recipe: "main: image \u2192 heading \u2192 text? \u2192 (button | button-group) \u2192 link?",
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
    recipe: "header: app-bar | navbar; main: chip? \u2192 (card-grid | gallery-section | product-card-list)",
    intents: { "app-bar": { "action-1": "search", "action-2": "filter", "action-3": "share" } }
  },
  {
    id: "detail",
    title: "Detail",
    platforms: ["app", "web"],
    recipe: "header: app-bar; main: detail-header \u2192 (text | long-form | description-list) \u2192 (comment-list | card-grid)?; footer: (button | button-group)?",
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
    recipe: "header: app-bar | page-header; nav: side-nav?; main: profile-header? \u2192 (settings-group | form-block)",
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
    recipe: "header: app-bar; main: long-form; footer: button?",
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

// packages/core/src/jev.ts
var JEV_URL = "https://api.typesafe.ai/v1/systemone";
var JEV_MODEL = "jev-latest";
var JEV_INPUT_PRICE = 0.042 / 1e6;
function responseProblems(request, body) {
  const res = body;
  if (!res || typeof res !== "object") return ["a response is a JSON object with `answers`"];
  if (res.detail !== void 0) return [`the answerer refused the request: ${detailText(res.detail)}`];
  if (!res.answers || typeof res.answers !== "object") return ["a response has `answers`, one per question"];
  const problems = [];
  const isP = (v) => typeof v === "number" && v >= 0 && v <= 1;
  for (const [id, q] of Object.entries(request.questions)) {
    const a = res.answers[id];
    const where = `answer "${id}"`;
    if (!a || typeof a !== "object") {
      problems.push(`${where} is missing`);
      continue;
    }
    if (a.type !== q.type) {
      problems.push(`${where} must be a ${q.type}, not ${String(a.type)}`);
      continue;
    }
    if (q.type === "noul") {
      if (!isP(a.noul)) problems.push(`${where}: noul must be a number 0\u20131`);
      continue;
    }
    const keys = q.type === "choice" ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    const probs = a.probabilities;
    if (!probs || typeof probs !== "object") {
      problems.push(`${where}: probabilities are missing`);
      continue;
    }
    for (const [k, v] of Object.entries(probs)) {
      if (!keys.includes(k)) problems.push(`${where}: "${k}" is not one of its options (${keys.join(", ")})`);
      else if (!isP(v)) problems.push(`${where}: probability of "${k}" must be 0\u20131`);
    }
    if (q.type === "choice" && !keys.includes(String(a.choice))) problems.push(`${where}: choice "${String(a.choice)}" is not one of ${keys.join(", ")}`);
    if (q.type === "score" && typeof a.score !== "number") problems.push(`${where}: score must be a number`);
  }
  for (const id of Object.keys(res.answers)) if (!(id in request.questions)) problems.push(`answer "${id}" answers no question`);
  return problems;
}
function readResponse(request, body, from = "the answerer") {
  const problems = responseProblems(request, body);
  if (problems.length > 0) throw new Error(`${from} gave answers this cannot apply:
  ${problems.join("\n  ")}`);
  return body;
}
function detailText(detail) {
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const e = d;
      return `${(e.loc ?? []).join(".")}: ${e.msg ?? JSON.stringify(d)}`;
    }).join("; ");
  }
  if (detail && typeof detail === "object") {
    const e = detail;
    return e.message ?? e.error_type ?? JSON.stringify(detail);
  }
  return String(detail);
}
function chosenOption(q, a) {
  if (q.type === "noul" && a.type === "noul") {
    const yes = a.noul >= 0.5;
    return { value: yes ? "true" : "false", p: yes ? a.noul : 1 - a.noul, distribution: { true: a.noul, false: 1 - a.noul } };
  }
  if (q.type === "choice" && a.type === "choice") {
    const distribution = Object.fromEntries(Object.keys(q.criteria).map((k) => [k, a.probabilities[k] ?? 0]));
    return { value: a.choice, p: distribution[a.choice] ?? 0, distribution };
  }
  if (q.type === "score" && a.type === "score") {
    const levels = q.criteria.map((_, i) => a.probabilities[String(i)] ?? 0);
    const top = Math.max(...levels);
    let best = 0;
    levels.forEach((p, i) => {
      if (p === top && (levels[best] !== top || Math.abs(i - a.score) < Math.abs(best - a.score))) best = i;
    });
    return { value: q.criteria[best], p: top, distribution: Object.fromEntries(q.criteria.map((c, i) => [c, levels[i]])) };
  }
  throw new Error(`a ${q.type} question answered as ${a.type}`);
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function stubAnswerer(seed = 1) {
  return {
    name: "stub",
    async answer(request) {
      const answers = {};
      for (const [id, q] of Object.entries(request.questions)) {
        const draw = seeded(seed ^ hash(`${JSON.stringify(request.state)}|${id}`))();
        if (q.type === "noul") {
          answers[id] = { type: "noul", noul: Math.round(draw * 100) / 100 };
        } else if (q.type === "choice") {
          const keys = Object.keys(q.criteria);
          answers[id] = { type: "choice", choice: keys[Math.floor(draw * keys.length)], probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])), confidence: 0 };
        } else {
          const pick = Math.floor(draw * q.criteria.length);
          answers[id] = { type: "score", score: pick, probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), 1 / q.criteria.length])), confidence: 0 };
        }
      }
      return { response: { model: "stub", answers, usage: { input_tokens: 0, output_tokens: 0 } }, ms: 0, by: `stub (seed ${seed})` };
    }
  };
}
function jevAnswerer(opts) {
  const key = opts.key;
  if (!key) throw new Error("the Jev answerer needs TYPESAFE_API_KEY in the environment \u2014 or `--answerer stub` (random, seeded) or `--answerer agent` (answer the questions yourself)");
  const doFetch = opts.fetch ?? fetch;
  const backoff = opts.backoff ?? [500, 1e3, 2e3, 4e3];
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  return {
    name: "jev",
    async answer(request) {
      for (let attempt = 0; ; attempt++) {
        const t0 = now();
        const res = await doFetch(JEV_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(request)
        });
        const ms = now() - t0;
        if ((res.status === 429 || res.status === 529) && attempt < backoff.length) {
          await sleep(backoff[attempt]);
          continue;
        }
        let body;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (!res.ok) {
          const detail = body?.detail;
          throw new Error(`Jev answered ${res.status}${detail !== void 0 ? `: ${detailText(detail)}` : ""}`);
        }
        const response = readResponse(request, body, "Jev");
        return { response, ms, by: response.model ?? JEV_MODEL };
      }
    }
  };
}
var HOME_HAS_NO_JUDGE = JUDGMENT_UNAVAILABLE;
function homeAnswerer(post, canvasId, now = () => Date.now()) {
  return {
    name: "home",
    async answer(request) {
      const t0 = now();
      const body = await post({ ...request, canvasId });
      const ms = now() - t0;
      const response = readResponse(request, body, "the home's judge");
      return { response, ms, by: `${response.model ?? JEV_MODEL} via the home` };
    }
  };
}
function isNoJudge(error) {
  return error?.code === HOME_HAS_NO_JUDGE;
}
function homeOrStub(home, stub, onFallback) {
  let fell = false;
  let current = home;
  return {
    get name() {
      return current.name;
    },
    async answer(request) {
      try {
        return await current.answer(request);
      } catch (error) {
        if (!isNoJudge(error)) throw error;
        current = stub;
        if (!fell) {
          fell = true;
          onFallback(error);
        }
        return stub.answer(request);
      }
    }
  };
}
var DEFAULT_ENTROPY_GATE = 1;
var DEFAULT_CONFIDENCE_FLOOR = 0.5;
function entropyBits(probabilities) {
  const raw = Array.isArray(probabilities) ? probabilities : Object.values(probabilities);
  const pos = raw.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (pos.length <= 1) return 0;
  const total = pos.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const v of pos) {
    const p = v / total;
    if (p > 0 && p < 1) h -= p * Math.log2(p);
  }
  return Math.round(h * 1e3) / 1e3;
}
function gatedChoice(q, a, opts = {}) {
  const { value, p, distribution } = chosenOption(q, a);
  const entropy = entropyBits(distribution);
  const maxEntropy = opts.maxEntropyBits ?? DEFAULT_ENTROPY_GATE;
  const minConf = opts.minConfidence ?? DEFAULT_CONFIDENCE_FLOOR;
  const topK = opts.topK ?? 3;
  const options = Object.entries(distribution).map(([k, prob]) => ({ value: k, p: Math.round(prob * 1e3) / 1e3 })).sort((x, y) => y.p - x.p || x.value.localeCompare(y.value)).slice(0, topK);
  const uncertain = entropy > maxEntropy || p < minConf;
  if (opts.pinned !== void 0 && Object.prototype.hasOwnProperty.call(distribution, opts.pinned)) {
    const pinnedP = Math.round((distribution[opts.pinned] ?? 0) * 1e3) / 1e3;
    return { status: "pinned", value: opts.pinned, p: pinnedP, entropy, options, uncertain };
  }
  if (uncertain && !opts.noAsk) {
    return { status: "ask", value, p: Math.round(p * 1e3) / 1e3, entropy, options, uncertain: true };
  }
  return { status: "confident", value, p: Math.round(p * 1e3) / 1e3, entropy, options, uncertain };
}
function isTransientJevError(error) {
  const status = error?.status;
  if (status === 429 || status === 529) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(?:429|529)\b/.test(msg);
}
var PriorityGate = class {
  inner;
  concurrency;
  maxRetries;
  backoffMs;
  sleep;
  active = 0;
  highQueue = [];
  normalQueue = [];
  constructor(innerOrOpts, maybeOpts = {}) {
    const isAnswerer = innerOrOpts !== void 0 && typeof innerOrOpts.answer === "function";
    this.inner = isAnswerer ? innerOrOpts : void 0;
    const opts = isAnswerer ? maybeOpts : innerOrOpts ?? {};
    this.concurrency = Math.max(1, opts.concurrency ?? opts.maxConcurrent ?? 3);
    this.maxRetries = Math.max(0, opts.maxRetries ?? 3);
    const base = opts.baseDelayMs;
    this.backoffMs = opts.backoffMs ?? (base !== void 0 ? [base, base * 2, base * 4] : [200, 500, 1e3]);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  /** Number of currently in-flight calls across both lanes. */
  get inFlight() {
    return this.active;
  }
  /** Number of queued calls waiting for a slot (`high` + `normal`). */
  get pending() {
    return this.highQueue.length + this.normalQueue.length;
  }
  acquire(priority) {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const task = () => {
        this.active++;
        resolve();
      };
      if (priority === "high") this.highQueue.push(task);
      else this.normalQueue.push(task);
    });
  }
  release() {
    this.active--;
    const next2 = this.highQueue.shift() ?? this.normalQueue.shift();
    if (next2) next2();
  }
  /** Run an arbitrary async operation through the priority semaphore with transient retry. */
  async run(first, second = "high") {
    const priority = typeof first === "string" ? first : second;
    const fn = typeof first === "function" ? first : second;
    await this.acquire(priority);
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await fn();
        } catch (error) {
          if (isTransientJevError(error) && attempt < this.maxRetries) {
            const wait = this.backoffMs[Math.min(attempt, this.backoffMs.length - 1)] ?? 200;
            await this.sleep(wait);
            continue;
          }
          throw error;
        }
      }
    } finally {
      this.release();
    }
  }
  /** Answer a `JevRequest` at the given priority (`"high"` by default). */
  answer(request, priority = "high") {
    if (!this.inner) throw new Error("PriorityGate has no default inner Answerer \u2014 pass one to constructor or use asAnswerer(answerer)");
    return this.run(priority, () => this.inner.answer(request));
  }
  /** View this gate as a standard `Answerer` bound to the given priority lane. */
  asAnswerer(first = "high", second = "high") {
    const target = typeof first === "string" ? this.inner : first;
    const priority = typeof first === "string" ? first : second;
    if (!target) throw new Error("PriorityGate.asAnswerer requires an Answerer");
    const self = this;
    return {
      get name() {
        return target.name;
      },
      answer(request) {
        return self.run(priority, () => target.answer(request));
      }
    };
  }
};
var STOP_WORDS = /* @__PURE__ */ new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "app",
  "flow",
  "screen",
  "screens",
  "wireframe",
  "design",
  "generate",
  "write",
  "copy",
  "json",
  "schema"
]);
function promptNouns(prompt) {
  const words2 = prompt.replace(/[^a-zA-Z0-9\s-]/g, " ").split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
  if (words2.length === 0) return ["Acme", "Workspace", "Operations", "Status"];
  const unique = [];
  for (const w of words2) {
    const cap = w[0].toUpperCase() + w.slice(1);
    if (!unique.includes(cap)) unique.push(cap);
  }
  return unique.length > 0 ? unique : ["Acme", "Workspace"];
}
function synthesizeFromSchema(schema, prompt, path3, seed) {
  const h = hash(`${seed}:${prompt}:${path3}:${schema.description ?? ""}`);
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[h % schema.enum.length];
  }
  switch (schema.type) {
    case "boolean":
      return (h & 1) === 0;
    case "number":
      return h % 90 + 10;
    case "array": {
      const len = schema.minItems ?? schema.maxItems ?? 3;
      const itemSchema = schema.items ?? { type: "string" };
      return Array.from({ length: len }, (_, i) => synthesizeFromSchema(itemSchema, prompt, `${path3}.${i}`, seed));
    }
    case "object": {
      const out = {};
      for (const [k, propSchema] of Object.entries(schema.properties ?? {})) {
        out[k] = synthesizeFromSchema(propSchema, prompt, path3 ? `${path3}.${k}` : k, seed);
      }
      return out;
    }
    case "string":
    default: {
      const nouns = promptNouns(prompt);
      const a = nouns[h % nouns.length];
      const b = nouns[(h >>> 3) % nouns.length];
      const leaf = path3.split(".").pop() ?? path3;
      if (leaf === "brand") return `${a} ${b === a ? "Studio" : b}`;
      if (leaf === "title" || leaf === "heading") return a === b ? `${a} Overview` : `${a} ${b}`;
      if (leaf === "bar") return a;
      if (leaf === "value") return `${h % 900 + 100}`;
      if (leaf === "delta") return `+${h % 18 + 2}%`;
      if (leaf === "status") return ["Active", "Scheduled", "Completed", "In review"][h % 4];
      if (leaf === "label") return a;
      return `${a} ${b.toLowerCase()} ${h % 90 + 10}`;
    }
  }
}
function stubTextGenerator(seed = 1) {
  return {
    name: `stub-text (seed ${seed})`,
    async generateJson(prompt, schema) {
      return synthesizeFromSchema(schema, prompt, "", seed);
    }
  };
}
function httpTextGenerator(opts = {}) {
  const apiKey = opts.apiKey ?? process.env.ISOCAN_TEXT_API_KEY ?? "";
  const model = opts.model ?? process.env.ISOCAN_TEXT_MODEL ?? "gpt-4o-mini";
  const endpoint = opts.endpoint ?? process.env.ISOCAN_TEXT_ENDPOINT ?? "https://api.openai.com/v1/chat/completions";
  const fetchFn = opts.fetch ?? globalThis.fetch;
  return {
    name: model,
    async generateJson(prompt, schema) {
      if (!apiKey) throw new Error("httpTextGenerator requires apiKey or ISOCAN_TEXT_API_KEY");
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Return only valid JSON conforming to the provided JSON schema." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "wire_response", strict: true, schema }
          }
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`TextGenerator HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const body = await res.json();
      const text = body.choices?.[0]?.message?.content;
      if (!text) throw new Error("TextGenerator returned an empty response");
      return JSON.parse(text);
    }
  };
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
  const questions2 = {};
  for (const role of ROLES) {
    const options = candidates[role];
    if (options.length < 2) continue;
    questions2[role] = {
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
  return { model: "jev-latest", state, questions: questions2 };
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
  return {
    v: 1,
    request: opts.request ?? "",
    flow: opts.flow ?? "",
    archetype: r.id,
    title: opts.title ?? r.title,
    platform: opts.platform ?? r.platforms[0],
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
  return problems;
}
function propsFor(c, props) {
  return { ...defaultProps(c), ...props };
}

// packages/modules/wireframe/src/compose.ts
function requestBlueprint(request, flow) {
  return { ...blueprint("home", { request, flow, title: request }), round: 0 };
}
function platformFor(r, platform) {
  if (r.platforms.includes(platform)) return platform;
  const twin = platform === "web" ? "site" : platform === "site" ? "web" : null;
  return twin && r.platforms.includes(twin) ? twin : null;
}
var HEADER_OPTIONS = [
  ...new Set(RECIPES.flatMap((r) => r.sections.filter((s) => s.region === "header" && s.options.length > 1).flatMap((s) => s.options)))
];
var NAV_OPTIONS = [
  .../* @__PURE__ */ new Set([...RECIPES.flatMap((r) => r.sections.filter((s) => s.region === "nav").flatMap((s) => s.options)), "navbar", "none"])
];
var PLATFORM_WORDS = {
  app: "a phone app",
  web: "a web app used at a desk",
  site: "a public, scrolling website"
};
var CHROME_WORDS = {
  "tab-bar": "tabs along the bottom of the screen",
  "side-nav": "a navigation column down the side",
  navbar: "a navigation bar across the top",
  none: "no persistent navigation",
  "app-bar": "a compact bar: a title and icon actions",
  "page-header": "a large page title with actions"
};
function flowRequest(request) {
  const questions2 = {};
  for (const r of RECIPES) {
    questions2[`needs:${r.id}`] = {
      type: "noul",
      // Plain words, not the recipe's component ids: on Enrico they read 1–3 points more accurately for ~20% fewer tokens (24 Sep 2026).
      instructions: `Does the product in the request need this screen: ${ARCHETYPE_WORDS[r.id]}? Yes only if the request implies one.`
    };
  }
  questions2.platform = {
    type: "choice",
    instructions: "Which platform is this product for?",
    criteria: Object.fromEntries(PLATFORMS.map((p) => [p, PLATFORM_WORDS[p]]))
  };
  questions2.nav = {
    type: "choice",
    instructions: "Which persistent navigation should every screen of this product share?",
    criteria: Object.fromEntries(NAV_OPTIONS.map((n) => [n, CHROME_WORDS[n] ?? null]))
  };
  questions2.header = {
    type: "choice",
    instructions: "Which header should every screen of this product share?",
    criteria: Object.fromEntries(HEADER_OPTIONS.map((h) => [h, CHROME_WORDS[h] ?? null]))
  };
  return { model: JEV_MODEL, state: { request }, questions: questions2 };
}
var NEEDS_YES = 0.5;
var MAYBE_FLOOR = 0.3;
function decideFlow(req, res) {
  const answer2 = (id) => chosenOption(req.questions[id], res.answers[id]);
  const platform = answer2("platform");
  const nav = answer2("nav");
  const header = answer2("header");
  const archetypes = [];
  const declined = [];
  let best = null;
  for (const r of RECIPES) {
    const yes = res.answers[`needs:${r.id}`].noul;
    if (!best || yes > best.p) best = { id: r.id, p: yes };
    if (yes < MAYBE_FLOOR) declined.push({ id: r.id, p: yes, why: "no" });
    else if (!platformFor(r, platform.value)) declined.push({ id: r.id, p: yes, why: "platform" });
    else archetypes.push({ id: r.id, p: yes, ...yes < NEEDS_YES ? { maybe: true } : {} });
  }
  if (archetypes.length === 0 && best) {
    const r = recipe(best.id);
    if (platformFor(r, platform.value)) {
      archetypes.push({ ...best, ...best.p < NEEDS_YES ? { maybe: true } : {} });
      declined.splice(declined.findIndex((d) => d.id === best.id), 1);
    }
  }
  if (archetypes.length === 0) throw new Error(`no wave-1 archetype draws on ${platform.value} for this request`);
  return {
    platform: platform.value,
    chrome: { nav: nav.value, header: header.value },
    archetypes,
    declined,
    distributions: { platform: platform.distribution, nav: nav.distribution, header: header.distribution }
  };
}
function alternativesOf(distribution, options, chosen) {
  return options.filter((o) => o !== chosen && (distribution[o] ?? 0) > 0).map((o) => ({ block: o, p: distribution[o] })).sort((a, b) => b.p - a.p);
}
function chromeFor(section, chrome) {
  if (section.region === "header" && section.options.includes(chrome.header)) return { block: chrome.header };
  if (section.region === "nav") {
    if (section.options.includes(chrome.nav)) return { block: chrome.nav };
    if (chrome.nav === "none" && section.optional) return "declined";
  }
  return null;
}
function flowScreen(archetype, request, flow, decision) {
  const r = recipe(archetype);
  const platform = platformFor(r, decision.platform);
  const spec = blueprint(archetype, { request, flow, platform });
  const slots = [];
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
      ...alternatives.length ? { alternatives } : {}
    });
  }
  const asked = decision.archetypes.find((a) => a.id === archetype);
  return {
    ...spec,
    slots,
    round: 1,
    chrome: decision.chrome,
    ...asked ? { need: asked.p } : {},
    ...asked?.maybe ? { maybe: true } : {}
  };
}
function structureRequest(spec, flowTitles, opts = {}) {
  const r = recipe(spec.archetype);
  const questions2 = {};
  const candidates = opts.layout ? templatesFor(spec.archetype, spec.platform) : [];
  if (opts.layout && !spec.template && candidates.length > 1) {
    questions2.template = {
      type: "choice",
      instructions: `Which layout template best organizes the main body of the ${spec.title} screen?`,
      criteria: Object.fromEntries(candidates.map((t) => [t.id, t.description]))
    };
  }
  if (opts.layout && !spec.density) {
    questions2.density = {
      type: "score",
      instructions: `How dense should the spacing on the ${spec.title} screen be?`,
      criteria: ["1: compact", "2: default", "3: spacious"]
    };
  }
  const regionPool = opts.layout ? spec.template ? template(spec.template).regions : [...new Set(candidates.filter((t) => t.id !== "single" && t.regions.length > 1).flatMap((t) => t.regions))] : [];
  for (const slot of spec.slots) {
    if (slot.block !== null) continue;
    const section = r.sections.find((s) => s.slot === slot.slot);
    if (section.optional) {
      questions2[`${section.slot}:include`] = {
        type: "noul",
        instructions: `Does the ${spec.title} screen need ${section.options.join(" or ")} in its ${section.region}?`
      };
    }
    if (section.options.length > 1) {
      questions2[section.slot] = {
        type: "choice",
        instructions: `Which block fills the ${section.region} of the ${spec.title} screen here?`,
        criteria: Object.fromEntries(section.options.map((o) => [o, `a ${component(o).category} block`]))
      };
    }
    if (opts.layout && section.region === "main" && !slot.region && regionPool.length > 1) {
      questions2[`${section.slot}:region`] = {
        type: "choice",
        instructions: `Which template region does ${section.slot} sit in on the ${spec.title} screen?`,
        criteria: Object.fromEntries(regionPool.map((reg) => [reg, `the ${reg} region`]))
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: { request: spec.request, platform: spec.platform, screens: flowTitles, screen: spec.title, chrome: spec.chrome },
    questions: questions2
  };
}
function applyStructure(spec, req, res) {
  const r = recipe(spec.archetype);
  const chosenTemplate = req.questions.template && res.answers.template ? chosenOption(req.questions.template, res.answers.template).value : spec.template;
  const chosenDensity = req.questions.density && res.answers.density ? densityFromScore(chosenOption(req.questions.density, res.answers.density).value) : spec.density;
  const slots = [];
  const declined = [...spec.declined ?? []];
  for (const slot of spec.slots) {
    if (slot.block !== null) {
      slots.push(slot);
      continue;
    }
    const section = r.sections.find((s) => s.slot === slot.slot);
    const pick = section.options.length > 1 ? chosenOption(req.questions[section.slot], res.answers[section.slot]) : null;
    const block = pick?.value ?? section.options[0];
    let pOut = 0;
    if (section.optional) {
      const include = chosenOption(req.questions[`${section.slot}:include`], res.answers[`${section.slot}:include`]);
      pOut = include.distribution.false;
      if (include.value === "false") {
        declined.push({ slot: section.slot, p: pOut, block });
        continue;
      }
    }
    const alternatives = [
      ...pick ? alternativesOf(pick.distribution, section.options, block) : [],
      ...pOut > 0 ? [{ block: LEAVE_OUT, p: pOut }] : []
    ].sort((a, b) => b.p - a.p);
    const p = pick ? pick.p : section.optional ? 1 - pOut : void 0;
    const regionQ = req.questions[`${section.slot}:region`];
    const regionA = res.answers[`${section.slot}:region`];
    const pickedRegion = regionQ && regionA ? chosenOption(regionQ, regionA).value : slot.region;
    slots.push({
      ...resolveSlot(r.id, section.slot, block),
      ...p !== void 0 ? { p } : {},
      ...alternatives.length ? { alternatives } : {},
      ...pickedRegion !== void 0 ? { region: pickedRegion } : {}
    });
  }
  if (chosenTemplate && chosenTemplate !== "single") {
    const tpl = template(chosenTemplate);
    const mainSlots = slots.filter((s) => r.sections.find((sec) => sec.slot === s.slot)?.region === "main");
    mainSlots.forEach((s, idx) => {
      if (!s.region || !tpl.regions.includes(s.region)) {
        s.region = defaultSlotRegion(tpl.id, s, idx, mainSlots.length);
      }
    });
  }
  return {
    ...spec,
    slots,
    round: 2,
    ...chosenTemplate !== void 0 ? { template: chosenTemplate } : {},
    ...chosenDensity !== void 0 ? { density: chosenDensity } : {},
    ...declined.length ? { declined } : {}
  };
}
function propQuestion(label, def) {
  switch (def.kind) {
    case "choice":
      if (def.values.length < 2) return null;
      return { q: { type: "choice", instructions: `${label}: which?`, criteria: Object.fromEntries(def.values.map((v) => [v, null])) }, read: (v) => v };
    case "flag":
      return { q: { type: "noul", instructions: `${label}: yes or no?` }, read: (v) => v === "true" };
    case "count": {
      const levels = Array.from({ length: def.max - def.min + 1 }, (_, i) => String(def.min + i));
      if (levels.length < 2) return null;
      const q = levels.length <= 10 ? { type: "score", instructions: `${label}: how many?`, criteria: levels } : { type: "choice", instructions: `${label}: how many?`, criteria: Object.fromEntries(levels.map((l) => [l, null])) };
      return { q, read: (v) => Number(v) };
    }
    case "index": {
      if (def.max < 2) return null;
      const levels = Array.from({ length: def.max }, (_, i) => String(i + 1));
      return { q: { type: "choice", instructions: `${label}: which one, counted from 1?`, criteria: Object.fromEntries(levels.map((l) => [l, null])) }, read: (v) => Number(v) };
    }
  }
}
var PER_SCREEN_NAV_PROPS = /* @__PURE__ */ new Set(["selected"]);
function isNavChrome(r, slot) {
  return r.sections.find((s) => s.slot === slot.slot)?.region === "nav";
}
function propsRequest(spec, sharedNav = /* @__PURE__ */ new Set()) {
  const r = recipe(spec.archetype);
  const questions2 = {};
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const c = component(slot.block);
    const settled = r.props?.[c.id] ?? {};
    const shared = isNavChrome(r, slot) && sharedNav.has(c.id);
    for (const [key, def] of Object.entries(c.props)) {
      if (key in settled || shared && !PER_SCREEN_NAV_PROPS.has(key)) continue;
      const pq = propQuestion(`The ${c.id} in the ${slot.slot} of the ${spec.title} screen \u2014 ${key}`, def);
      if (pq) questions2[`${slot.slot}:${c.id}.${key}`] = pq.q;
    }
    for (const [element, el] of Object.entries(c.elements ?? {})) {
      if (el.accepts.length < 2 || shared) continue;
      questions2[`${slot.slot}:${c.id}#${element}`] = {
        type: "choice",
        instructions: `What does ${element} of the ${c.id} on the ${spec.title} screen do?`,
        criteria: Object.fromEntries(el.accepts.map((i) => [i, null]))
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: {
      request: spec.request,
      platform: spec.platform,
      screen: spec.title,
      blocks: Object.fromEntries(spec.slots.filter((s) => s.block).map((s) => [s.slot, s.block]))
    },
    questions: questions2
  };
}
function applyProps(spec, req, res) {
  const r = recipe(spec.archetype);
  const slots = spec.slots.map((slot) => {
    if (slot.block === null) return slot;
    const c = component(slot.block);
    const settled = r.props?.[c.id] ?? {};
    const props = {};
    for (const [key, def] of Object.entries(c.props)) {
      if (key in settled) continue;
      const id = `${slot.slot}:${c.id}.${key}`;
      const pq = propQuestion("", def);
      if (!pq || !req.questions[id]) continue;
      props[key] = pq.read(chosenOption(req.questions[id], res.answers[id]).value);
    }
    const resolved2 = resolveSlot(r.id, slot.slot, slot.block, props);
    const present = presentElements(c, resolved2.props);
    const intents = { ...resolved2.intents ?? {} };
    const used = /* @__PURE__ */ new Set();
    for (const element of present) {
      const id = `${slot.slot}:${c.id}#${element}`;
      if (req.questions[id]) {
        const pick = chosenOption(req.questions[id], res.answers[id]);
        const ranked = [pick.value, ...Object.entries(pick.distribution).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
        intents[element] = ranked.find((k) => !used.has(k)) ?? pick.value;
      }
      used.add(intents[element]);
    }
    const out = { ...resolved2 };
    if (present.length > 0) out.intents = intents;
    if (slot.p !== void 0) out.p = slot.p;
    if (slot.alternatives) out.alternatives = slot.alternatives;
    if (slot.region !== void 0) out.region = slot.region;
    return out;
  });
  return { ...spec, slots, round: 3 };
}
function navOwners(specs) {
  const owners = /* @__PURE__ */ new Map();
  specs.forEach((spec, i) => {
    const r = recipe(spec.archetype);
    for (const slot of spec.slots) if (slot.block && isNavChrome(r, slot) && !owners.has(slot.block)) owners.set(slot.block, i);
  });
  return owners;
}
function propsRequests(specs) {
  const owners = navOwners(specs);
  return specs.map((spec, i) => propsRequest(spec, new Set([...owners].filter(([, owner]) => owner !== i).map(([block]) => block))));
}
function shareNav(specs) {
  const owners = navOwners(specs);
  return specs.map((spec, i) => {
    const r = recipe(spec.archetype);
    const slots = spec.slots.map((slot) => {
      if (!slot.block || !isNavChrome(r, slot)) return slot;
      const owner = owners.get(slot.block);
      if (owner === i) return slot;
      const from = specs[owner].slots.find((s) => s.block === slot.block && isNavChrome(recipe(specs[owner].archetype), s));
      const props = { ...from.props, ...Object.fromEntries([...PER_SCREEN_NAV_PROPS].filter((k) => k in slot.props).map((k) => [k, slot.props[k]])) };
      const c = component(slot.block);
      const present = presentElements(c, props);
      const out = { ...slot, props };
      if (present.length > 0) out.intents = Object.fromEntries(present.map((e) => [e, from.intents[e]]));
      else delete out.intents;
      for (const key of PER_SCREEN_NAV_PROPS) {
        const def = c.props[key];
        const cap = typeof props.items === "number" ? props.items : def?.kind === "index" ? def.max : void 0;
        if (typeof out.props[key] === "number" && cap !== void 0 && out.props[key] > cap) out.props = { ...out.props, [key]: cap };
      }
      return out;
    });
    return { ...spec, slots };
  });
}
function applyPropsRound(specs, requests, responses) {
  return shareNav(specs.map((spec, i) => applyProps(spec, requests[i], responses[i])));
}
function pendingRound(specs) {
  const rounds = specs.map((s) => s.round ?? 3);
  const lowest = Math.min(...rounds);
  return lowest >= 3 ? null : lowest + 1;
}
function roundCalls(round, screens) {
  if (round === 1) return [{ item: screens[0].item, request: flowRequest(screens[0].spec.request) }];
  const titles = screens.map((s) => s.spec.title);
  if (round === 3) {
    const requests = propsRequests(screens.map((s) => s.spec));
    return screens.map(({ item }, i) => ({ item, request: requests[i] }));
  }
  return screens.map(({ item, spec }) => ({ item, request: structureRequest(spec, titles) }));
}
function answeredResponse(call, from) {
  return readResponse(call.request, call.response, from);
}

// packages/modules/wireframe/src/keep.ts
var KEEP_MARK = wireframeModule.marks[0];
var KEEP_PROP = KEEP_MARK.property;
var KEEP_EMOJI = KEEP_MARK.emoji;
var KEEP_BY_PROP = `${KEEP_PROP}By`;
function isKept(item) {
  return Boolean(item.properties?.[KEEP_PROP]);
}
function keepable(item) {
  return markOffered(KEEP_MARK, item);
}
function keepPatch(on, who) {
  return moduleMarkPatch(KEEP_PROP, on, who);
}
function firstChoices(screens) {
  return screens.filter((s) => !s.spec.variantOf && !s.spec.maybe && (s.spec.need ?? 1) >= NEEDS_YES);
}
function kept(canvas) {
  return readingOrder(Object.values(canvas.items).filter(isKept));
}

// packages/modules/wireframe/src/entropy-ask.ts
var ROOT_GATE_KEYS = ["platform", "pack", "style.direction"];
var ROOT_PROMPTS = {
  platform: "Which platform should this flow target?",
  pack: "Which domain content pack fits this request best?",
  "style.direction": "Which visual style direction should govern this flow?"
};
function parsePinFlags(flags) {
  const out = {};
  if (!flags) return out;
  for (const raw of flags) {
    const eq = raw.indexOf("=");
    if (eq <= 0 || eq === raw.length - 1) {
      throw new Error(`--pin "${raw}" must be key=value (for example: --pin platform=web)`);
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (!key || !value) {
      throw new Error(`--pin "${raw}" must have a non-empty key and value`);
    }
    out[key] = value;
  }
  return out;
}
function gateFlowDecision(req, res, opts = {}) {
  const resolved2 = { ...opts.pinned ?? {} };
  const asks = [];
  for (const key of ROOT_GATE_KEYS) {
    const q = req.questions[key];
    const a = res.answers[key];
    if (!q || !a) continue;
    const gated = gatedChoice(q, a, {
      ...opts.pinned?.[key] !== void 0 ? { pinned: opts.pinned[key] } : {},
      ...opts.noAsk !== void 0 ? { noAsk: opts.noAsk } : {},
      maxEntropyBits: opts.maxEntropyBits ?? DEFAULT_ENTROPY_GATE,
      minConfidence: opts.minConfidence ?? DEFAULT_CONFIDENCE_FLOOR,
      topK: 3
    });
    resolved2[key] = gated.value;
    if (gated.status === "ask") {
      asks.push({
        key,
        prompt: ROOT_PROMPTS[key],
        entropy: gated.entropy,
        options: gated.options,
        chosen: gated.value
      });
    }
  }
  return { resolved: resolved2, asks };
}
function formatAskComment(q) {
  const opts = q.options.map((o) => `${o.value} (${Math.round(o.p * 100)}%)`).join(" \xB7 ");
  return `/ask ${q.prompt} [entropy ${q.entropy.toFixed(2)} bits] \u2014 ${opts}`;
}
function applyPinnedToSpecs(specs, pinned) {
  if (!pinned || Object.keys(pinned).length === 0) return [...specs];
  const pinnedPlatform = PLATFORMS.includes(pinned.platform) ? pinned.platform : void 0;
  const pinnedTemplate = TEMPLATE_IDS.includes(pinned.template) ? pinned.template : void 0;
  const pinnedDensity = DENSITY_LEVELS.includes(pinned.density) ? pinned.density : void 0;
  return specs.map((spec) => ({
    ...spec,
    ...pinnedPlatform ? { platform: pinnedPlatform } : {},
    ...pinnedTemplate ? { template: pinnedTemplate } : {},
    ...pinnedDensity ? { density: pinnedDensity } : {},
    pinned: { ...spec.pinned ?? {}, ...pinned }
  }));
}

// packages/modules/wireframe/src/port.ts
function currentVersionOf(item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];
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
function inferLinks(kept2, opts = {}) {
  const ids = new Set(kept2.map((s) => s.id));
  const topLevel = kept2.filter((s) => isTopLevel(s.spec)).map((s) => s.id);
  const firstOf = (archetypes) => kept2.find((s) => archetypes.includes(s.spec.archetype))?.id ?? null;
  const out = [];
  kept2.forEach((screen, at) => {
    const spots = hotspots(screen.spec);
    const overlayScreen = OVERLAY_ARCHETYPES.includes(screen.spec.archetype);
    const decide = (h) => {
      if (h.kind === "row") {
        const after = kept2.slice(at + 1).find((s) => s.spec.archetype === "detail") ?? kept2.slice(0, at).reverse().find((s) => s.spec.archetype === "detail");
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
          const next2 = kept2[at + 1];
          return next2 ? { to: next2.id, transition: nav.transition, rule: "intent" } : { to: null, needs: "a next screen", transition: nav.transition, rule: "missing" };
        }
        case "after-run": {
          let i = at + 1;
          while (i < kept2.length && ONBOARDING_RUN.includes(kept2[i].spec.archetype)) i++;
          const target = kept2[i];
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
          const target = kept2.find((s) => nav.component === "drawer" && s.spec.archetype === "menu" || s.spec.slots.some((x) => x.block === nav.component && x.slot === "overlay"));
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
function startScreen(kept2) {
  return (kept2.find((s) => ["welcome", "sign-in"].includes(s.spec.archetype)) ?? kept2[0])?.id ?? null;
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
.h{font-weight:700;color:var(--w-ink);line-height:1.2}
.h1{font-size:26px}.h2{font-size:22px}.h3{font-size:18px}.h4{font-size:16px}
.txt.s .bar{height:6px}.txt.l .bar{height:10px}.txt.quote{border-left:3px solid var(--w-line);padding-left:10px}.txt.caption .bar{background:${BAR_SOFT}}
.img{width:100%;border:1.5px solid var(--w-line);border-radius:${R(12)};background:var(--w-surface) linear-gradient(to top right,transparent calc(50% - 1px),var(--w-line) calc(50% - 1px),var(--w-line) calc(50% + 1px),transparent calc(50% + 1px)),linear-gradient(to bottom right,transparent calc(50% - 1px),var(--w-line) calc(50% - 1px),var(--w-line) calc(50% + 1px),transparent calc(50% + 1px))}
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
.main[data-template]{container-type:inline-size}
.tpl-region{display:flex;flex-direction:column;gap:var(--w-space);min-width:0}
@container (min-width: 640px){
.main.tpl-split{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:calc(var(--w-space)*1.5);align-items:start}
.main.tpl-master_detail{display:grid;grid-template-columns:minmax(220px,2fr) minmax(0,3fr);gap:calc(var(--w-space)*1.5);align-items:start}
.main.tpl-master_detail .tpl-r-master{border-right:1px solid var(--w-line);padding-right:var(--w-space)}
.main.tpl-grid .tpl-r-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--w-space);align-items:start}
.main.tpl-bento .tpl-r-bento{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--w-space);align-items:stretch}
.main.tpl-bento .tpl-r-bento>.slot{grid-column:span 3}
.main.tpl-bento .tpl-r-bento>.slot:first-child{grid-column:span 4}
.main.tpl-bento .tpl-r-bento>.slot:nth-child(2){grid-column:span 2}
.main.tpl-hero_then_grid .tpl-r-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--w-space);align-items:start}
.main.tpl-dashboard{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:calc(var(--w-space)*1.5);align-items:start}
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
function polishCss(patches) {
  return patches && patches.length > 0 ? POLISH_CSS : "";
}
function resolvePolishTokens(patches, target) {
  if (!patches || patches.length === 0) return [];
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
  const slotPolish = resolvePolishTokens(spec.polish, slot.slot);
  const ctx = {
    props,
    intent: intentOf,
    // A fleshed lone action says what it acts on ("Edit delivery"); anything else, its intent's own word.
    label: (element) => esc(slot.fill?.actions?.[element] ?? INTENT_BY_ID.get(intentOf(element))?.label ?? intentOf(element)),
    hot: (element) => {
      const intentId = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(r, c, element) : void 0);
      const elPolish = resolvePolishTokens(spec.polish, `${slot.slot}.${element}`);
      const polishAttr = elPolish.length > 0 ? ` data-polish="${esc(elPolish.join(" "))}"` : "";
      return ` data-hot="${esc(hotKey(slot.slot, element))}" data-wf="${esc(`${slot.slot}.${element}`)}"${intentId ? ` data-intent="${esc(intentId)}"` : ""}${polishAttr}`;
    },
    title: esc(c.id === "app-bar" ? barTitleOf(spec) : headingOf(spec)),
    platform: spec.platform,
    wide: spec.platform !== "app",
    ...slot.fill ? { fill: slot.fill } : {}
  };
  const slotClass = ["slot", "w", ...slotPolish].join(" ");
  return `<section class="${esc(slotClass)}" ${attrs} data-block="${esc(c.id)}" data-state="wire">${c.draw(ctx)}</section>`;
}
function headingOf(spec) {
  return spec.content?.title ?? spec.title;
}
function barTitleOf(spec) {
  if (!spec.content) return spec.title;
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
  return spec.slots.every((s) => s.block === null) ? void 0 : spec.style;
}
function themeCss(style, density) {
  return `:root{${themeDecls(style, density)}}`;
}
function wireCss(spec) {
  const density = spec.slots.every((s) => s.block === null) ? void 0 : spec.density;
  return `${themeCss(styleOf(spec), density)}${WIRE_CSS}${surfaceCss([surfaceOf(styleOf(spec))])}${templateCss(spec.template)}${polishCss(spec.polish)}${spec.slots.some((s) => s.block === null) ? SKELETON_CSS : ""}`;
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
  return [
    `<div class="frame ${spec.platform}${undecided ? " sk-frame" : ""}${surface === "flat" ? "" : ` s-${surface}`}" style="${size}">`,
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

// packages/modules/wireframe/src/link-override.ts
var LINK_PREFIX = "wireLink:";
function linkProp(key) {
  return `${LINK_PREFIX}${key}`;
}
function overridesOf(properties) {
  const out = readOverrides(properties?.[LINKS_PROP]);
  for (const [prop, value] of Object.entries(properties ?? {})) {
    if (prop.startsWith(LINK_PREFIX) && value) out[prop.slice(LINK_PREFIX.length)] = value;
  }
  return out;
}
function linkPatch(item, key, value) {
  const properties = {};
  const removeProperties = [];
  const legacy = item.properties?.[LINKS_PROP];
  if (legacy !== void 0) {
    for (const [k, v] of Object.entries(readOverrides(legacy))) {
      if (k !== key && item.properties?.[linkProp(k)] === void 0) properties[linkProp(k)] = v;
    }
    removeProperties.push(LINKS_PROP);
  }
  if (value === null) removeProperties.push(linkProp(key));
  else properties[linkProp(key)] = value;
  return { ...Object.keys(properties).length ? { properties } : {}, ...removeProperties.length ? { removeProperties } : {} };
}
function linkChanges(item, key, value) {
  if (item.properties?.[LINKS_PROP] !== void 0) return true;
  return value === null ? item.properties?.[linkProp(key)] !== void 0 : item.properties?.[linkProp(key)] !== value;
}
async function setLinkOverride(port, item, key, value, group) {
  const patch = linkPatch(item, key, value);
  const after = { ...item.properties ?? {}, ...patch.properties ?? {} };
  for (const prop of patch.removeProperties ?? []) delete after[prop];
  const overrides = overridesOf(after);
  if (!linkChanges(item, key, value)) return { overrides, wrote: false };
  await port.send({ type: "item.update", itemId: item.id, patch }, group);
  return { overrides, wrote: true };
}

// packages/modules/wireframe/src/prototype.ts
var PROTOTYPE_MARKER = "<!-- isocan:wireframe-prototype -->";
var PROTOTYPE_PROP = "wirePrototype";
var BAR_HEIGHT = 32;
var PAD = 8;
function prototypeSize(kept2) {
  const { width, height } = stageSize(kept2);
  return { width: width + PAD * 2, height: height + BAR_HEIGHT + PAD * 3 };
}
function stageSize(kept2) {
  let width = 0;
  let height = 0;
  for (const s of kept2) {
    const size = wireSize(s.spec);
    width = Math.max(width, size.width);
    height = Math.max(height, size.height - CAPTION_HEIGHT);
  }
  return { width, height };
}
var PROTO_CSS = `
body.proto{display:flex;flex-direction:column;align-items:center;gap:${PAD}px;padding:${PAD}px;background:var(--w-surface)}
.pbar{display:flex;align-items:center;gap:10px;height:${BAR_HEIGHT}px;font:600 13px/1.2 var(--w-font);color:var(--w-ink)}
.pbar .sp{flex:1}
.pbar .pnote{font-weight:500;color:var(--w-ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbar button{font:inherit;border:1.5px solid var(--w-ink);background:var(--w-ground);color:var(--w-ink);border-radius:4px;padding:3px 10px;cursor:pointer}
.stage{position:relative;overflow:hidden}
.pscreen{position:absolute;left:0;top:0;background:var(--w-surface)}
.pscreen[hidden]{display:none}
[data-go]{cursor:pointer}
[data-go]:hover{outline:2px solid color-mix(in srgb, var(--w-ink) 35%, transparent);outline-offset:2px}
[data-needs]{outline:2px dashed var(--w-ink-muted);outline-offset:2px;cursor:help}
.pflash{outline:3px solid var(--w-primary,var(--w-ink));outline-offset:3px;animation:pflash .6s ease-in-out 3 alternate}
@keyframes pflash{to{outline-color:transparent}}
@media (prefers-reduced-motion: reduce){.pflash{animation:none}}
`;
var ROUTER = `(function(){
var data=JSON.parse(document.getElementById("isocan-prototype").textContent);
var screens=[].slice.call(document.querySelectorAll(".pscreen"));
var name=document.getElementById("pname"),note=document.getElementById("pnote");
var still=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var stack=[];
function by(id){for(var i=0;i<screens.length;i++)if(screens[i].getAttribute("data-screen")===id)return screens[i];return null}
var MOVES={push:[["translateX(100%)","none"],null],pop:[null,["none","translateX(100%)"]],overlay:[["translateY(100%)","none"],null],"overlay-out":[null,["none","translateY(100%)"]],dissolve:[["opacity0","opacity1"],null]};
function animate(el,frames){if(!el||!frames||still||!el.animate)return null;var kf=frames[0]==="opacity0"?[{opacity:0},{opacity:1}]:[{transform:frames[0]},{transform:frames[1]}];return el.animate(kf,{duration:240,easing:"ease-out"})}
function run(el,frames,done){var a=animate(el,frames),over=false;function end(){if(over)return;over=true;if(a)try{a.finish()}catch(e){}done()}if(a){a.onfinish=end;setTimeout(end,320)}else end()}
function off(el){if(el!==by(stack[stack.length-1]))el.hidden=true}
function show(id,kind){var next=by(id),cur=stack.length?by(stack[stack.length-1]):null;return{next:next,cur:cur,kind:kind}}
function paint(step){var next=step.next,cur=step.cur,m=MOVES[step.kind]||[null,null];
screens.forEach(function(s){if(s!==next&&s!==cur)s.hidden=true;s.style.zIndex=""});
next.hidden=false;
if(cur&&cur!==next){if(m[1]){cur.style.zIndex=2;run(cur,m[1],function(){off(cur);cur.style.zIndex=""})}else{next.style.zIndex=2;run(next,m[0],function(){off(cur);next.style.zIndex=""})}}
var id=stack[stack.length-1];document.body.setAttribute("data-at",id);name.textContent=next.getAttribute("data-title");note.textContent=stack.length>1?"\xB7 "+stack.length+" deep":""}
function go(to,kind){if(to==="back"){if(stack.length<2){note.textContent="\xB7 nothing to go back to";return}var step=show(stack[stack.length-2],kind==="overlay"?"overlay-out":"pop");stack.pop();paint(step);return}
if(!by(to))return;var s=show(to,kind);if(kind==="dissolve")stack=[to];else if(kind==="none"&&stack.length)stack[stack.length-1]=to;else stack.push(to);paint(s)}
function restart(){var s=show(data.start,"none");stack=[data.start];paint(s)}
function at(){var q={};(location.hash||"").replace(/^#/,"").split("&").forEach(function(p){var i=p.indexOf("=");if(i>0)q[p.slice(0,i)]=decodeURIComponent(p.slice(i+1))});return q}
function flash(key,id){if(!key)return;var sc=by(id);if(!sc)return;[].slice.call(sc.querySelectorAll("[data-hot]")).forEach(function(el){if(el.getAttribute("data-hot")!==key)return;el.classList.add("pflash");setTimeout(function(){el.classList.remove("pflash")},1800)})}
function jump(){var q=at();if(!q.screen||!by(q.screen))return false;var s=show(q.screen,"none");stack=[q.screen];paint(s);flash(q.hot,q.screen);return true}
document.addEventListener("click",function(e){var el=e.target.closest&&e.target.closest("[data-hot]");if(!el||!el.closest(".pscreen"))return;e.preventDefault();
var needs=el.getAttribute("data-needs");if(needs){note.textContent="\xB7 needs "+needs+" \u2014 not in the prototype yet";return}
var to=el.getAttribute("data-go");if(to)go(to,el.getAttribute("data-t")||"push")});
document.getElementById("restart").addEventListener("click",restart);
[].slice.call(document.querySelectorAll("[data-needs]")).forEach(function(el){el.setAttribute("title","needs: "+el.getAttribute("data-needs"))});
window.addEventListener("hashchange",jump);
if(!jump())restart()})();`;
function bind(frame, links) {
  let out = frame;
  for (const l of links) {
    const attr = ` data-hot="${esc(l.key)}"`;
    const extra = l.to ? ` data-go="${esc(l.to)}" data-t="${l.transition}"` : l.needs ? ` data-needs="${esc(l.needs)}"` : "";
    if (extra) out = out.split(attr).join(`${attr}${extra}`);
  }
  return out;
}
function json(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function assemblePrototype(kept2, links, opts = {}) {
  if (kept2.length === 0) throw new Error("no screen is in the prototype \u2014 it plays the screens marked \u{1F4D0}");
  const start = startScreen(kept2);
  const { width, height } = stageSize(kept2);
  const title = opts.title ?? "Prototype";
  const undecided = kept2.find((s) => s.spec.slots.some((x) => x.block === null));
  const first = kept2.find((s) => s.id === start) ?? kept2[0];
  const lead2 = styleOf(first.spec);
  const leadSpec = { ...(undecided ?? first).spec, ...lead2 ? { style: lead2 } : {} };
  const leadSurface = surfaceOf(styleOf(leadSpec));
  const needsTemplate = (!leadSpec.template || leadSpec.template === "single") && kept2.some((s) => s.spec.template && s.spec.template !== "single");
  const sheet = wireCss(leadSpec) + surfaceCss(kept2.map((s) => surfaceOf(styleOf(s.spec))).filter((s) => s !== leadSurface)) + (needsTemplate ? templateCss("split") : "");
  const sections = kept2.map((s) => {
    const mine = links.filter((l) => l.from === s.id);
    const density = s.spec.slots.every((x) => x.block === null) ? void 0 : s.spec.density;
    return `<section class="pscreen" data-screen="${esc(s.id)}" data-title="${esc(s.title)}" style="${esc(themeDecls(styleOf(s.spec), density))}" hidden>${bind(renderFrame(s.spec), mine)}</section>`;
  });
  const table = {
    start,
    screens: kept2.map((s) => ({ id: s.id, title: s.title, hotspots: hotspots(s.spec).length })),
    links: links.map((l) => ({ from: l.from, key: l.key, to: l.to, ...l.needs ? { needs: l.needs } : {}, t: l.transition, rule: l.rule }))
  };
  return `<!doctype html>
${PROTOTYPE_MARKER}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width + PAD * 2}">
<title>${esc(title)}</title>
<style>${sheet}${PROTO_CSS}</style>
</head>
<body class="proto">
<div class="pbar" style="width:${width}px"><span id="pname"></span><span class="pnote" id="pnote"></span><span class="sp"></span><button type="button" id="restart">Restart</button></div>
<div class="stage" style="width:${width}px;height:${height}px">
${sections.join("\n")}
</div>
<script type="application/json" id="isocan-prototype">${json(table)}</script>
<script>${ROUTER}</script>
</body>
</html>
`;
}
function playAnchor(screen, hot) {
  return `screen=${encodeURIComponent(screen)}${hot ? `&hot=${encodeURIComponent(hot)}` : ""}`;
}

// packages/modules/wireframe/src/route.ts
var LANE0 = 96;
var LANE = 26;
var MAX_LANES = 4;
var LABEL_H = 16;

// packages/modules/wireframe/src/kept-flows.ts
function keptFlowsOf(canvas, screens) {
  const wires = new Map(screens.map((w) => [w.item, w]));
  const flows = /* @__PURE__ */ new Map();
  for (const item of kept(canvas)) {
    const wire = wires.get(item.id);
    if (!wire) continue;
    const flow = wire.spec.flow;
    const entry = flows.get(flow) ?? { flow, request: wire.spec.request, screens: [], items: [], guests: [] };
    entry.screens.push({ id: item.id, title: item.title, spec: wire.spec, overrides: overridesOf(item.properties) });
    entry.items.push(item);
    flows.set(flow, entry);
  }
  const all = [...flows.values()];
  const home = new Map(all.flatMap((f) => f.screens.map((s, i) => [s.id, { screen: s, item: f.items[i] }])));
  for (const f of all) {
    const own = new Set(f.screens.map((s) => s.id));
    for (const target of f.screens.flatMap((s) => Object.values(s.overrides ?? {}))) {
      const guest = home.get(target);
      if (!guest || own.has(target)) continue;
      own.add(target);
      f.screens.push(guest.screen);
      f.items.push(guest.item);
      f.guests.push(target);
    }
  }
  return all;
}
function prototypeScreens(canvas, prototype, screens) {
  const flow = prototype.properties?.[PROTOTYPE_PROP];
  if (flow === void 0) return [];
  return keptFlowsOf(canvas, screens).find((f) => f.flow === flow)?.items ?? [];
}
function pickKeptFlow(flows, wanted, flag2 = "--flow") {
  if (flows.length === 0) throw new Error("no screen is in a prototype \u2014 `isocan wire use <screens...>` marks the screens a prototype plays");
  if (wanted !== void 0) {
    const found = flows.find((f) => f.flow === wanted);
    if (!found) throw new Error(`no screen of flow "${wanted}" is in a prototype \u2014 flows with screens in one: ${flows.map((f) => `${f.flow || "(hand-drawn)"} "${f.request}"`).join(", ")}`);
    return found;
  }
  if (flows.length > 1) {
    throw new Error(`the screens in a prototype come from ${flows.length} flows \u2014 say which with ${flag2}:
  ${flows.map((f) => `${flag2} ${f.flow || '""'}  "${f.request}" (${f.screens.length} in the prototype)`).join("\n  ")}`);
  }
  return flows[0];
}
function prototypeTitle(flow) {
  return `Prototype \xB7 ${flow.request.length > 60 ? `${flow.request.slice(0, 59)}\u2026` : flow.request || "hand-drawn screens"}`;
}
function sharedGroup(items) {
  const first = items[0]?.containerId;
  return first && items.every((i) => i.containerId === first) ? { containerId: first, groupPlacement: "exact" } : void 0;
}
var PROTOTYPE_AT_PROP = "wirePrototypeAt";
var PROTOTYPE_CLEAR = LANE0 + (MAX_LANES + 1) * LANE + LABEL_H + 24;
var meets = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
function prototypeSpot(canvas, flow, size, self) {
  const own = flow.items.filter((i) => !flow.guests.includes(i.id));
  const left = Math.min(...own.map((i) => i.x));
  const right = Math.max(...own.map((i) => i.x + i.width));
  const top = Math.min(...own.map((i) => i.y));
  const x = Math.round((left + right) / 2 - size.width / 2);
  let y = Math.round(top - PROTOTYPE_CLEAR - size.height);
  const others = Object.values(canvas.items ?? {}).filter((i) => i.id !== self && i.properties?.kind !== "group");
  for (let i = 0; i < 50; i++) {
    const want = { x: x - 20, y: y - 60, width: size.width + 40, height: size.height + 80 };
    const hit = others.filter((o) => meets(want, { x: o.x, y: o.y, width: o.width, height: o.height }));
    if (hit.length === 0) break;
    y = Math.round(Math.min(...hit.map((o) => o.y)) - 80 - size.height);
  }
  return { x, y };
}
var atOf = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
function placedByComposer(item) {
  const at = item.properties?.[PROTOTYPE_AT_PROP];
  return typeof at !== "string" || at === atOf(item);
}
async function writePrototype(port, canvas, flow, group) {
  const links = inferLinks(flow.screens);
  const title = prototypeTitle(flow);
  const html = assemblePrototype(flow.screens, links, { title });
  const { width, height } = prototypeSize(flow.screens);
  const filename = "prototype.html";
  const upload = await port.put(html, "text/html", filename);
  const version = { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  const existing = Object.values(canvas.items ?? {}).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
  const own = flow.items.filter((i) => !flow.guests.includes(i.id));
  if (existing) {
    const same2 = currentVersionOf(existing)?.blobHash === upload.blobHash;
    if (!same2) await port.send({ type: "item.addVersion", itemId: existing.id, version }, group);
    if (existing.width !== width || existing.height !== height) await port.send({ type: "item.resize", itemId: existing.id, width, height }, group);
    if (existing.title !== title) await port.send({ type: "item.update", itemId: existing.id, patch: { title } }, group);
    const moved = placedByComposer(existing) ? await place(port, canvas, flow, existing.id, { width, height }, existing, group) : false;
    return { itemId: existing.id, title, links, what: !same2 ? "versioned" : moved ? "moved" : "unchanged" };
  }
  const itemId = newItemId();
  const spot = prototypeSpot(canvas, flow, { width, height });
  const landed = await port.send({
    type: "item.add",
    itemId,
    version,
    width,
    height,
    placement: { ...spot, chosen: true },
    title,
    // A wireframe's fidelity, so the design-system gate does not count it as an undesigned screen.
    properties: { [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: flow.flow, [PROTOTYPE_AT_PROP]: atOf(spot) },
    // In the group its screens live in, when they share one (Porchlight #6).
    ...sharedGroup(own) ?? {}
  }, group);
  if (landed && atOf(landed) !== atOf(spot)) await port.send({ type: "item.update", itemId, patch: { properties: { [PROTOTYPE_AT_PROP]: atOf(landed) } } }, group);
  return { itemId, title, links, what: "added" };
}
async function place(port, canvas, flow, itemId, size, item, group) {
  const spot = prototypeSpot(canvas, flow, size, itemId);
  const recorded = item.properties?.[PROTOTYPE_AT_PROP];
  if (atOf(item) === atOf(spot) && recorded === atOf(spot)) return false;
  if (atOf(item) !== atOf(spot)) await port.send({ type: "item.move", itemId, x: spot.x, y: spot.y }, group);
  const now = (await port.canvas()).items[itemId];
  await port.send({ type: "item.update", itemId, patch: { properties: { [PROTOTYPE_AT_PROP]: atOf(now ?? spot) } } }, group);
  return true;
}
async function rebuildPrototypes(port, canvas, all, changed, group) {
  const out = [];
  const touched = new Set(changed.map((s) => s.spec.flow));
  const now = all.map((s) => changed.find((c) => c.item === s.item) ?? s);
  for (const flow of keptFlowsOf(canvas, now)) {
    if (!touched.has(flow.flow)) continue;
    if (!Object.values(canvas.items).some((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow)) continue;
    const written = await writePrototype(port, canvas, flow, group);
    out.push({ itemId: written.itemId, what: written.what });
  }
  return out;
}

// packages/modules/wireframe/src/rerender.ts
async function writeWire(port, item, spec, group, was) {
  const current = currentVersionOf(item);
  const filename = current?.filename ?? "wireframe.html";
  const upload = await port.put(renderWire(spec), "text/html", filename);
  const { width, height } = wireSize(spec);
  const resize = item.width !== width || item.height !== height;
  const retitle = was !== void 0 && item.title === wireTitle(was) && wireTitle(spec) !== wireTitle(was);
  if (current?.blobHash === upload.blobHash && !resize && !retitle) return false;
  if (current?.blobHash !== upload.blobHash) {
    await port.send({ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
  }
  if (resize) await port.send({ type: "item.resize", itemId: item.id, width, height }, group);
  if (retitle) await port.send({ type: "item.update", itemId: item.id, patch: { title: wireTitle(spec) } }, group);
  return true;
}
async function rerender(port, canvas, all, screens, opts = {}) {
  const group = opts.group ?? newGroupId();
  const changed = [];
  let resized = 0;
  for (const s of screens) {
    const item = canvas.items[s.item];
    if (!item) continue;
    const { width, height } = wireSize(s.spec);
    if (await writeWire(port, item, s.spec, group)) {
      changed.push(s);
      if (item.width !== width || item.height !== height) resized += 1;
    }
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, screens, group);
  return { group, screens, changed, resized, prototypes };
}
function rerenderSummary(r) {
  const protos = r.prototypes.filter((p) => p.what !== "unchanged").length;
  const n = r.screens.length;
  const head = `${r.changed.length} of ${n} wire${n === 1 ? "" : "s"} re-rendered \xB7 ${n - r.changed.length} unchanged`;
  const resized = r.resized ? ` \xB7 ${r.resized} resized to the screen alone` : "";
  const proto = r.prototypes.length ? ` \xB7 ${protos} of ${r.prototypes.length} prototype${r.prototypes.length === 1 ? "" : "s"} rebuilt` : "";
  const tail = r.changed.length || protos ? " \u2014 one op group: one undo takes it back" : " \u2014 nothing written";
  return `${head}${resized}${proto}${tail}`;
}
function rerenderLines(r) {
  return r.changed.map((s) => `${s.item}  ${wireTitle(s.spec)} \u2014 re-rendered`);
}

// packages/modules/wireframe/src/restyle.ts
function governingSystem(canvas, item) {
  const selected = selectDesignSystem(canvas, { at: item });
  return selected.status === "selected" ? selected.item : null;
}
var StyleResolver = class {
  constructor(port, answerer, loadKnown, onAsked) {
    this.port = port;
    this.answerer = answerer;
    this.loadKnown = loadKnown;
    this.onAsked = onAsked;
  }
  port;
  answerer;
  loadKnown;
  onAsked;
  mappings = /* @__PURE__ */ new Map();
  calls = 0;
  inputTokens = 0;
  by = "";
  known = null;
  async styleFor(system) {
    if (!system) return DEFAULT_STYLE;
    const m = await this.mapping(system);
    return { source: "design-system", itemId: system.id, versionId: m.versionId, name: m.name, ...m.by ? { by: m.by } : {}, roles: m.roles, ...m.surface !== "flat" ? { surface: m.surface } : {} };
  }
  /** A mapping on the canvas may be lent to this run: anything Jev (or nobody) answered; a stub's only to the stub. */
  lendable(style, system, versionId) {
    if (style?.source !== "design-system" || style.itemId !== system.id || style.versionId !== versionId) return false;
    return !style.by?.startsWith("stub") || this.answerer.name === "stub";
  }
  async mapping(system) {
    const current = currentVersionOf(system);
    if (!current) throw new Error(`the design system "${system.title}" has no version to read`);
    const key = `${system.id}@${current.id}`;
    const cached = this.mappings.get(key);
    if (cached) return cached;
    const base = {
      system,
      versionId: current.id,
      version: system.versions.findIndex((v) => v.id === current.id) + 1,
      versions: system.versions.length
    };
    this.known ??= [...await this.loadKnown()];
    const lent = this.known.find((s) => this.lendable(s.style, system, current.id));
    const doc = parseDesign(await this.port.readText(current.blobHash));
    const name = doc.tokens.name ?? system.title;
    const surface = designSurface(doc.tokens);
    if (lent?.style?.source === "design-system") {
      const m2 = { ...base, name, roles: lent.style.roles, surface, how: "reused", ...lent.style.by ? { by: lent.style.by } : {} };
      this.mappings.set(key, m2);
      return m2;
    }
    const candidates = candidatesOf(doc);
    const request = mappingRequest(doc, candidates);
    let response = { answers: {} };
    let ms;
    let by;
    const asking = Object.keys(request.questions).length > 0;
    if (asking) {
      const answered = await this.answerer.answer(request);
      response = answered.response;
      ms = answered.ms;
      by = answered.by;
      this.by = answered.by;
      this.calls += 1;
      this.inputTokens += response.usage?.input_tokens ?? 0;
      await this.onAsked?.(system, current.id, request, response);
    }
    const m = { ...base, name, roles: applyMapping(request, response, candidates), surface, how: asking ? "asked" : "nothing to ask", request, response, ...ms !== void 0 ? { ms } : {}, ...by ? { by } : {} };
    this.mappings.set(key, m);
    return m;
  }
  /** Who answers — the versioned model once one has, else the answerer's name. */
  get who() {
    return this.by || this.answerer.name;
  }
  cost() {
    return this.inputTokens * JEV_INPUT_PRICE;
  }
};
function mappingLines(m, by) {
  const named = ROLES.some((role) => m.roles[role]?.why === "named");
  const how = m.how === "asked" ? `mapped by ${m.by ?? by}${m.ms !== void 0 ? ` in ${m.ms} ms` : ""}` : m.how === "reused" ? `mapping (by ${m.by ?? "nobody \u2014 nothing to ask"}) reused from a wire already in this version \u2014 nothing asked` : named ? "its tokens are named for the wire's roles \u2014 nothing asked" : "every role had one candidate or none \u2014 nothing asked";
  return [
    `"${m.name}" \u2014 ${m.system.id}, version ${m.version} of ${m.versions} \xB7 ${how}`,
    ...ROLES.map((role) => `  ${roleLine(role, m.roles[role])}`),
    ...m.surface !== "flat" ? [`  ${"surface".padEnd(11)} ${m.surface}`] : []
  ];
}
function alreadyLooks(was, now) {
  const system = (s) => s?.source === "design-system" ? s.itemId : null;
  return system(was) === system(now) && sameLook(was, now);
}
async function restyle(port, canvas, all, screens, resolver, opts = {}) {
  const targets = [];
  for (const s of screens) {
    const item = canvas.items[s.item];
    const system = opts.toDefault ? null : governingSystem(canvas, item);
    targets.push({ screen: s, item, system, style: await resolver.styleFor(system) });
  }
  const group = opts.group ?? newGroupId();
  const changed = [];
  for (const t of targets) {
    if (sameStyle(t.screen.spec.style, t.style) || alreadyLooks(t.screen.spec.style, t.style)) continue;
    const spec = { ...t.screen.spec, style: t.style };
    if (!await writeWire(port, t.item, spec, group)) continue;
    t.screen = { ...t.screen, spec };
    changed.push(t);
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, changed.map((t) => t.screen), group);
  return { group, targets, changed, prototypes, resolver };
}
function restyleSummary(r) {
  const { targets, changed, resolver } = r;
  const tail = changed.length ? " \u2014 one op group: one undo takes the restyle back" : " \u2014 nothing written";
  return `${changed.length} of ${targets.length} wires restyled \xB7 ${targets.length - changed.length} unchanged \xB7 ${resolver.calls === 0 ? "nothing asked" : `${resolver.calls} ${resolver.calls === 1 ? "call" : "calls"} to ${resolver.who} \xB7 ${resolver.inputTokens.toLocaleString("en-US")} input tokens \xB7 $${resolver.cost().toFixed(6)}`}${tail}`;
}

// packages/modules/wireframe/src/content/pack.ts
var FIRST_NAMES = [
  "Priya",
  "Tom\xE1s",
  "Aisha",
  "Kenji",
  "Maya",
  "Luca",
  "Zanele",
  "Omar",
  "Ingrid",
  "Mateo",
  "Leila",
  "Chen",
  "Amara",
  "Jonas",
  "Sofia",
  "Ravi",
  "Nia",
  "Felix",
  "Yuki",
  "Diego",
  "Hana",
  "Kofi",
  "Elena",
  "Arjun",
  "Freya",
  "Malik",
  "Rosa",
  "Tariq",
  "Lena",
  "Emeka",
  "Mei",
  "Nikolai",
  "Ana",
  "Idris",
  "Clara",
  "Sanjay",
  "Imani",
  "Oskar",
  "Luc\xEDa",
  "Ahmed",
  "Wren",
  "Tuan",
  "Farah",
  "Bruno",
  "Ayo",
  "Greta",
  "Ishaan",
  "Noor"
];
var INITIALS = "ABCDEFGHJKLMNOPRSTVWY";
var DAYS = ["Today", "Today", "Yesterday", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Tomorrow"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var SETTINGS_ROWS = [
  ["Notifications", ""],
  ["Language", "English"],
  ["Dark mode", ""],
  ["Account", "{first}"],
  ["Privacy", ""],
  ["Units", "Metric"],
  ["Sound", ""],
  ["Help and feedback", ""],
  ["Storage", "{#1-9}.{#0-9} GB"],
  ["Sign-in and security", ""]
];
var GENERIC = {
  email: "{lower}@example.com",
  password: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
  phone: "+1 555 01{#10-99}",
  code: "{#100000-999999}",
  steps: ["Details", "Address", "Schedule", "Review", "Payment", "Done"],
  noResults: ["No matches", "Try a different word or clear a filter."],
  cleared: ["All caught up", "Nothing left here \u2014 new ones will appear as they arrive."],
  signInLead: ["Welcome back", "Sign in to pick up where you left off."],
  signUpLead: ["Create your account", "It takes less than a minute."],
  verifyLead: ["Check your phone", "Enter the code we sent to \u2022\u2022\u2022\u2022 {#10-99}."],
  forgotLead: ["Reset your password", "We'll email you a link to choose a new one."],
  sentLead: ["Check your email", "A reset link is on its way."],
  errors: {
    "404": "This page has moved or never existed.",
    offline: "You're offline. Check your connection and try again.",
    generic: "Something went wrong on our side. Try again in a moment.",
    permission: "Ask the owner for access to see this."
  },
  filterGroups: ["Status", "Category", "Date"],
  sectionHeads: ["Today", "Earlier this week", "Last week"],
  crumbs: ["Home", "All"],
  newsletter: "Get updates"
};

// packages/modules/wireframe/src/content/packs.ts
var PACKS = [
  {
    id: "generic",
    name: "Generic",
    about: "anything that fits no other pack \u2014 a general-purpose app of documents, projects and notes",
    noun: ["Item", "Items"],
    home: "Overview",
    titles: ["Spring update", "Project Alder", "Weekly review", "Onboarding plan", "Budget draft", "Team notes", "Launch checklist", "Field report", "Client brief", "Design review", "Roadmap", "Retro notes", "Q{#1-4} goals", "Supplier list", "Event plan", "Training guide", "Photo set", "Travel plan", "Reading list", "Idea board", "Open questions", "Kickoff notes"],
    subs: ["Edited by {name}", "{#2-14} files", "Shared with {#2-9} people", "Updated {ago}", "{#1-9} comments"],
    statuses: ["Active", "Draft", "In review", "Done", "Archived"],
    categories: ["Work", "Personal", "Shared", "Ideas", "Archive"],
    meta: ["{ago}", "{day}", "{date}"],
    amount: ["{#1-40} pages", "{#1-9}.{#0-9} MB"],
    columns: ["Name", "Details", "Status", "Updated", "Folder", "Owner", "Created", "Size"],
    metrics: [{ label: "Open", value: "{#8-40}", delta: "+{#1-6}" }, { label: "Due this week", value: "{#2-9}" }, { label: "Done", value: "{#60-95}%", delta: "+{#2-9}%" }, { label: "Shared", value: "{#3-30}" }],
    fields: [["Name", "Spring update"], ["Owner", "{name}"], ["Due", "{date}"], ["Folder", "Work"], ["Tags", "Planning, Q{#1-4}"], ["Notes", "Draft for review"]],
    details: [["Owner", "{name}"], ["Created", "{date}"], ["Folder", "Work"], ["Size", "{#1-9}.{#0-9} MB"]],
    lines: ["A short summary of what this is and who it is for.", "Updated after the last review, with the open questions answered.", "Everything the team needs before the next milestone.", "Two sections still need an owner.", "Linked from the weekly review.", "The next step is a quick read-through."],
    remarks: ["Looks good to me.", "Can we move this to next week?", "Added the missing numbers.", "Left two notes in the draft.", "Who owns this one?", "Done \u2014 thanks!"],
    roles: ["Project lead", "Member since {date}"],
    profile: [["Items", "{#12-240}"], ["Shared", "{#3-40}"], ["Teams", "{#1-6}"]],
    pitch: ["Everything in one place", "Keep your work organised and share it in a tap."],
    empty: ["Nothing here yet", "Items you add will show up here."],
    success: ["All set", "Your changes are saved."],
    motifs: ["image", "checklist", "briefcase", "calendar", "chat", "star"]
  },
  {
    id: "deliveries",
    name: "Deliveries and logistics",
    about: "couriers, parcels, drivers, delivery routes, shipping and tracking",
    noun: ["Delivery", "Deliveries"],
    home: "Today's route",
    titles: ["Parcel {#4400-4999}", "Parcel {#4400-4999}", "Envelope {#1100-1999}", "Box {#210-299}", "Pallet {A-F}{#10-99}", "Return {#300-399}", "Crate {#50-99}", "Flowers for {first}", "Grocery drop", "Pharmacy bag", "Bike parts", "Office supplies", "Tile samples", "Birthday cake", "Laptop return", "Plant pots \xD7{#2-6}", "Paint tins", "Spare tyres", "Wine case", "Print proofs", "Camera kit", "Rug, rolled"],
    subs: ["{#1-6} items", "{#1-6} items \xB7 {#1-12} kg", "Signature needed", "Leave at door", "Stop {#1-24} of 24"],
    statuses: ["Out for delivery", "Awaiting scan", "Delivered", "Delayed", "At depot", "Picked up"],
    categories: ["Standard", "Express", "Same day", "Return", "Oversize"],
    meta: ["{time}", "ETA {time}", "{#1-9}.{#0-9} km"],
    amount: ["{#1-12}.{#0-9} kg"],
    columns: ["Parcel", "Items", "Status", "ETA", "Service", "Driver", "Date", "Weight"],
    metrics: [{ label: "Today", value: "{#12-40}", delta: "+{#2-6}" }, { label: "Late", value: "{#1-5}", delta: "\u2212{#1-2}", down: true }, { label: "Delivered", value: "{#60-98}%" }, { label: "Stops left", value: "{#3-18}" }, { label: "Km driven", value: "{#20-140}" }],
    fields: [["Recipient", "{name}"], ["Parcel ID", "{#4400-4999}"], ["Weight", "{#1-12}.{#0-9} kg"], ["Service", "Express"], ["Delivery window", "{time}\u2013{time}"], ["Instructions", "Leave with neighbour"]],
    details: [["Recipient", "{name}"], ["Service", "Express"], ["Weight", "{#1-12}.{#0-9} kg"], ["Window", "{time}\u2013{time}"]],
    lines: ["Scanned at the north depot and loaded on van {#1-9}.", "The recipient asked for a call on arrival.", "Two attempts left before it returns to the depot.", "Fragile \u2014 keep upright.", "Proof of delivery is a photo at the door.", "Rerouted after the first stop was closed."],
    remarks: ["Left it with the concierge.", "Customer not home \u2014 card left.", "Van {#1-9} is running {#5-20} min late.", "Gate code updated.", "Signed by {first}.", "Scanned twice by mistake \u2014 fixed."],
    roles: ["Driver \xB7 Route {#1-30}", "Dispatcher \xB7 North depot"],
    profile: [["Deliveries", "{#300-2000}"], ["Rating", "4.{#6-9}"], ["On time", "{#88-99}%"]],
    pitch: ["Every parcel, one route", "Scan, sort and deliver without the paperwork."],
    empty: ["No deliveries yet", "Parcels you scan will show up here."],
    success: ["Delivered", "The parcel was signed for at {time}."],
    motifs: ["parcel", "truck", "box", "scan", "pin", "checklist"]
  },
  {
    id: "inventory",
    name: "Inventory and warehouse",
    about: "stock, warehouses, receiving goods, stock counts, suppliers and purchase orders",
    noun: ["Delivery", "Incoming"],
    home: "Receiving",
    titles: ["Delivery {#7100-7999}", "PO-{#2000-2999}", "Cable ties, 200 mm", "Shelf bracket {A-F}", "Pallet wrap", "Safety gloves (L)", "Bin labels", "Hex bolts M{#6-12}", "Cardboard 60\xD740", "Packing tape", "Hi-vis vest", "Floor tape, yellow", "Barcode rolls", "Steel shelving", "Hand truck", "Tote {#100-199}", "Returns batch {#10-99}", "Cycle count {A-F}", "Mixed SKU pallet", "Fuse kit", "Spare casters", "Label printer ribbon"],
    subs: ["Dock {#1-6}", "Bay {A-F}{#1-24}", "Alder Supply Co.", "Aisle {#1-18} \xB7 shelf {#1-6}", "{#2-9} lines outstanding", "PO-{#2000-2999}"],
    statuses: ["Outstanding", "Received", "Partial", "Checked", "Low stock", "Put away"],
    categories: ["Inbound", "Outbound", "Returns", "Consumables", "Fixtures"],
    meta: ["{#4-120} units", "{time}", "Dock {#1-6}"],
    amount: ["{#4-480} units", "${#12-900}.00"],
    columns: ["Item", "Location", "Status", "Qty", "Type", "Checked by", "Received", "Value"],
    metrics: [{ label: "Outstanding", value: "{#4-24}", delta: "\u2212{#1-5}", down: true }, { label: "Received today", value: "{#18-90}", delta: "+{#3-12}" }, { label: "Low stock", value: "{#2-9}" }, { label: "Accuracy", value: "9{#6-9}.{#0-9}%" }],
    fields: [["Delivery note", "DN-{#7100-7999}"], ["Supplier", "Alder Supply Co."], ["Quantity", "{#4-120}"], ["Location", "Bay {A-F}{#1-24}"], ["Condition", "Good"], ["Notes", "Two cartons dented"]],
    details: [["Supplier", "Alder Supply Co."], ["Location", "Bay {A-F}{#1-24}"], ["On hand", "{#4-480} units"], ["Reorder at", "{#10-60}"]],
    lines: ["Arrived on dock {#1-6} and waiting to be checked.", "{#1-9} lines are short against the purchase order.", "Count matches the delivery note.", "Put away before the evening shift.", "Two cartons arrived damaged and are set aside.", "Reorder point reached \u2014 a purchase order is drafted."],
    remarks: ["Counted twice, all good.", "Short by {#2-9} units.", "Moved to bay {A-F}{#1-24}.", "Supplier says the rest ships Friday.", "Labels reprinted.", "Scanner battery low on dock {#1-6}."],
    roles: ["Receiving \xB7 Dock {#1-6}", "Stock controller"],
    profile: [["Received", "{#200-1800}"], ["Counts", "{#20-90}"], ["Accuracy", "9{#6-9}%"]],
    pitch: ["Know what came in", "Scan deliveries at the dock and see what is still outstanding."],
    empty: ["Nothing outstanding", "Deliveries you scan will appear here."],
    success: ["Delivery received", "Every line is checked and put away."],
    motifs: ["box", "scan", "truck", "parcel", "checklist", "ladder"]
  },
  {
    id: "restaurant",
    name: "Restaurant and ordering",
    about: "restaurants, kitchens, food ordering, tables, menus and takeaway",
    noun: ["Order", "Orders"],
    home: "Tonight",
    titles: ["Table {#1-24}", "Order #{#100-999}", "Takeaway for {first}", "Margherita", "Mushroom risotto", "Fish tacos", "Caesar salad", "Lamb shoulder", "Veggie burger", "Tomato soup", "Chocolate tart", "Lemon sorbet", "Flat white", "House lemonade", "Chips, large", "Pad kra pao", "Dumplings \xD7{#6-12}", "Ramen, spicy", "Falafel wrap", "Garden salad", "Roast chicken", "Espresso"],
    subs: ["{#1-6} items \xB7 ${#12-90}", "{#2-8} guests", "Pickup {time}", "No onions", "Allergy: nuts"],
    statuses: ["New", "Preparing", "Ready", "Served", "Paid", "Waiting"],
    categories: ["Starters", "Mains", "Desserts", "Drinks", "Sides"],
    meta: ["{time}", "${#6-38}", "{#5-25} min"],
    amount: ["${#6-38}.{#00-99}"],
    columns: ["Order", "Details", "Status", "Time", "Course", "Server", "Date", "Total"],
    metrics: [{ label: "Covers", value: "{#40-160}", delta: "+{#4-20}" }, { label: "Waiting", value: "{#1-8}" }, { label: "Avg ticket", value: "${#18-45}" }, { label: "Prep time", value: "{#8-19} min", delta: "\u2212{#1-3}", down: true }],
    fields: [["Name", "{name}"], ["Guests", "{#2-8}"], ["Time", "{time}"], ["Table", "{#1-24}"], ["Phone", "+1 555 01{#10-99}"], ["Notes", "Window seat"]],
    details: [["Table", "{#1-24}"], ["Guests", "{#2-8}"], ["Server", "{name}"], ["Total", "${#40-240}"]],
    lines: ["Slow-cooked with garlic, lemon and thyme.", "Served with a side of seasonal greens.", "Our most ordered dish this month.", "Can be made vegan on request.", "Kitchen closes at {time}.", "Two courses left for this table."],
    remarks: ["Table {#1-24} would like the bill.", "Out of sorbet tonight.", "Extra napkins for {#2-8}.", "Fire the mains now.", "Birthday \u2014 bring a candle.", "Allergy noted: nuts."],
    roles: ["Server \xB7 Evening shift", "Head chef"],
    profile: [["Orders", "{#400-3000}"], ["Rating", "4.{#5-9}"], ["Shifts", "{#20-200}"]],
    pitch: ["Orders, straight to the kitchen", "Take orders at the table and see what is ready."],
    empty: ["No orders yet", "New orders will appear here as they come in."],
    success: ["Order sent", "The kitchen has it \u2014 about {#10-25} minutes."],
    motifs: ["bowl", "cup", "pan", "checklist", "star", "chat"]
  },
  {
    id: "recipes",
    name: "Recipes and cooking",
    about: "recipes, cooking at home, meal plans, ingredients and shopping lists",
    noun: ["Recipe", "Recipes"],
    home: "What's cooking",
    titles: ["One-pan lemon chicken", "Weeknight dal", "Green shakshuka", "Miso aubergine", "Roast squash soup", "Crispy tofu bowls", "Tomato galette", "Banana bread", "Herb omelette", "Pesto pasta", "Black bean tacos", "Chickpea curry", "Mushroom stroganoff", "Summer rolls", "Overnight oats", "Lentil salad", "Ginger fried rice", "Fish pie", "Apple crumble", "Flatbreads", "Spiced carrots", "Corn fritters"],
    subs: ["{#15-60} min \xB7 serves {#2-6}", "{#5-12} ingredients", "Vegetarian", "By {name}", "Saved {#40-900} times"],
    statuses: ["Saved", "Cooked", "Planned", "New", "Favourite"],
    categories: ["Breakfast", "Lunch", "Dinner", "Baking", "Quick"],
    meta: ["{#15-60} min", "\u2605 4.{#2-9}", "{#200-800} kcal"],
    amount: ["{#15-60} min"],
    columns: ["Recipe", "Details", "Status", "Time", "Meal", "Cook", "Added", "Prep"],
    metrics: [{ label: "Saved", value: "{#12-80}" }, { label: "Cooked this week", value: "{#2-7}", delta: "+{#1-3}" }, { label: "Avg time", value: "{#20-45} min" }, { label: "Shopping list", value: "{#4-18} items" }],
    fields: [["Title", "Weeknight dal"], ["Serves", "{#2-6}"], ["Prep time", "{#10-30} min"], ["Cook time", "{#15-50} min"], ["Tags", "Vegetarian, quick"], ["Notes", "Double the garlic"]],
    details: [["Serves", "{#2-6}"], ["Prep", "{#10-30} min"], ["Cook", "{#15-50} min"], ["Calories", "{#300-700} kcal"]],
    lines: ["Soften the onion in a little oil until golden.", "Add the spices and cook for a minute until fragrant.", "Simmer gently, stirring now and then.", "Season to taste and finish with lemon.", "Keeps for three days in the fridge.", "Serve with rice or warm flatbread."],
    remarks: ["Made this twice \u2014 so good.", "Added chilli, worked well.", "Needed more salt for us.", "Kids loved it.", "Swapped in spinach.", "Perfect for a Tuesday."],
    roles: ["Home cook", "Recipe developer"],
    profile: [["Recipes", "{#12-200}"], ["Followers", "{#80-9000}"], ["Cooked", "{#40-400}"]],
    pitch: ["Dinner, sorted", "Plan the week, cook from your phone, shop in one list."],
    empty: ["No recipes saved", "Tap the heart on any recipe to keep it here."],
    success: ["Added to your plan", "It's on the list for {day}."],
    motifs: ["pan", "bowl", "leaf", "cup", "checklist", "star"]
  },
  {
    id: "shop",
    name: "Shop and retail",
    about: "an online shop, products, a store catalogue, carts, checkout and orders",
    noun: ["Product", "Products"],
    home: "Shop",
    titles: ["Linen shirt", "Canvas tote", "Trail runner", "Wool beanie", "Ceramic mug", "Desk lamp", "Rain jacket", "Leather wallet", "Water bottle", "Knit scarf", "Denim jacket", "Cotton tee", "Travel pillow", "Weekender bag", "Oak side table", "Scented candle", "Wireless earbuds", "Yoga mat", "Plant stand", "Sunglasses", "Notebook set", "Throw blanket"],
    subs: ["{#2-8} colours", "Free shipping", "Only {#2-9} left", "New arrival", "Size S\u2013XL"],
    statuses: ["In stock", "Low stock", "Sold out", "Shipped", "Delivered", "Pre-order"],
    categories: ["New", "Clothing", "Home", "Accessories", "Sale"],
    meta: ["{#20-900} reviews", "${#12-180}", "\u2605 4.{#1-9}"],
    amount: ["${#12-180}.00", "${#9-99}.99"],
    columns: ["Product", "Details", "Status", "Reviews", "Category", "Buyer", "Ordered", "Price"],
    metrics: [{ label: "Orders", value: "{#20-240}", delta: "+{#4-30}" }, { label: "Revenue", value: "${#2-9},{#100-999}", delta: "+{#3-18}%" }, { label: "Returns", value: "{#1-9}", down: true, delta: "\u2212{#1-3}" }, { label: "Conversion", value: "{#1-4}.{#0-9}%" }],
    fields: [["Full name", "{name}"], ["Email", "{lower}@example.com"], ["Size", "M"], ["Colour", "Sand"], ["Quantity", "{#1-3}"], ["Gift note", "Happy birthday!"]],
    details: [["Material", "Organic cotton"], ["Fit", "Relaxed"], ["Care", "Machine wash cold"], ["Ships in", "{#1-3} days"]],
    lines: ["Made from organic cotton and cut for an easy fit.", "Free returns within 30 days.", "Ships in {#1-3} working days.", "Our best-seller this season.", "Pairs well with the canvas tote.", "Every order is packed without plastic."],
    remarks: ["Fits true to size.", "Colour is lovely in person.", "Arrived quickly, well packed.", "Bought a second one.", "A bit long in the sleeve.", "Great gift."],
    roles: ["Shopper since {date}", "Store manager"],
    profile: [["Orders", "{#2-60}"], ["Reviews", "{#1-30}"], ["Saved", "{#3-80}"]],
    pitch: ["Things worth keeping", "New pieces every week, free returns always."],
    empty: ["Your bag is empty", "Items you add will wait here."],
    success: ["Order placed", "We'll email you when it ships."],
    motifs: ["shirt", "shoe", "gift", "cup", "star", "box"]
  },
  {
    id: "fitness",
    name: "Fitness and training",
    about: "workouts, training plans, gyms, running, classes and activity tracking",
    noun: ["Workout", "Workouts"],
    home: "This week",
    titles: ["Morning run", "Upper body", "Leg day", "Tempo {#5-10}k", "Core blast", "Yoga flow", "HIIT {#15-30}", "Long ride", "Mobility", "Rowing intervals", "Full body", "Hill repeats", "Swim drills", "Pilates", "Recovery walk", "Push day", "Pull day", "Spin class", "Stretch & breathe", "Kettlebell circuit", "Easy {#3-8}k", "Boxing basics"],
    subs: ["{#20-75} min \xB7 {#200-800} kcal", "{#3-6} sets", "With {name}", "{#4-18} km", "Zone {#2-4}"],
    statuses: ["Planned", "Done", "Skipped", "In progress", "Personal best"],
    categories: ["Strength", "Cardio", "Mobility", "Classes", "Outdoor"],
    meta: ["{#20-75} min", "{#4-18}.{#0-9} km", "{time}"],
    amount: ["{#20-75} min", "{#200-800} kcal"],
    columns: ["Workout", "Details", "Status", "Time", "Type", "Coach", "Date", "Calories"],
    metrics: [{ label: "Workouts", value: "{#2-6}", delta: "+{#1-2}" }, { label: "Active min", value: "{#90-320}", delta: "+{#10-40}" }, { label: "Distance", value: "{#8-42} km" }, { label: "Streak", value: "{#3-21} days" }],
    fields: [["Workout", "Tempo run"], ["Duration", "{#20-75} min"], ["Distance", "{#4-18} km"], ["Effort", "Hard"], ["Date", "{date}"], ["Notes", "Felt strong"]],
    details: [["Duration", "{#20-75} min"], ["Calories", "{#200-800} kcal"], ["Avg heart rate", "{#120-165} bpm"], ["Coach", "{name}"]],
    lines: ["Warm up for ten minutes at an easy pace.", "Hold each position for 30 seconds.", "Keep the effort steady through the middle.", "Rest {#60-120} seconds between sets.", "Finish with a slow cool-down.", "Great for rest days."],
    remarks: ["New personal best!", "Legs are sore today.", "See you at the 7 am class.", "Swapped to the bike today.", "That last set was tough.", "{#5-10}k done before work."],
    roles: ["Runner \xB7 {#2-9} years", "Coach"],
    profile: [["Workouts", "{#40-600}"], ["Km", "{#200-3000}"], ["Streak", "{#3-60}"]],
    pitch: ["Train with a plan", "Workouts that fit your week, progress you can see."],
    empty: ["No workouts yet", "Log your first one to start a streak."],
    success: ["Workout logged", "{#20-75} minutes \u2014 nice work."],
    motifs: ["dumbbell", "bike", "heart-pulse", "chart", "calendar", "shoe"]
  },
  {
    id: "travel",
    name: "Travel and trips",
    about: "trips, flights, hotels, bookings, itineraries and travel planning",
    noun: ["Trip", "Trips"],
    home: "Upcoming",
    titles: ["Weekend by the lake", "Flight {A-F}{A-F} {#100-999}", "Coast road trip", "Mountain cabin", "City break", "Island hopping", "Hotel, 3 nights", "Night train", "Ski week", "Food tour", "Harbour ferry", "Desert camp", "Old town walk", "Vineyard stay", "Surf lessons", "Museum pass", "Car rental", "Hostel, 2 nights", "River cruise", "Hiking loop", "Market morning", "Canyon day trip"],
    subs: ["{date} \u2013 {date}", "{#2-6} travellers", "{#1-9} nights", "Gate {A-F}{#1-30} \xB7 {time}", "Booked by {name}"],
    statuses: ["Booked", "Checked in", "On time", "Delayed", "Planning", "Cancelled"],
    categories: ["Flights", "Stays", "Activities", "Transport", "Ideas"],
    meta: ["{date}", "{time}", "${#90-900}"],
    amount: ["${#90-1800}"],
    columns: ["Trip", "Dates", "Status", "When", "Type", "Traveller", "Booked", "Price"],
    metrics: [{ label: "Trips", value: "{#2-9}" }, { label: "Nights away", value: "{#6-40}" }, { label: "Days to go", value: "{#3-60}" }, { label: "Budget left", value: "${#200-2400}", delta: "\u2212${#20-200}", down: true }],
    fields: [["Destination", "Lakeside"], ["Check in", "{date}"], ["Check out", "{date}"], ["Guests", "{#1-6}"], ["Room", "Double"], ["Requests", "Late check-in"]],
    details: [["Dates", "{date} \u2013 {date}"], ["Guests", "{#1-6}"], ["Confirmation", "{A-F}{#10000-99999}"], ["Total", "${#200-1800}"]],
    lines: ["A quiet stay a short walk from the water.", "Breakfast is included every morning.", "Free cancellation until {date}.", "Check-in opens at {time}.", "The trail starts right behind the lodge.", "Bring layers \u2014 evenings get cold."],
    remarks: ["Can't wait for this one!", "Gate changed to {A-F}{#1-30}.", "Booked the ferry for {time}.", "Found a great caf\xE9 nearby.", "Pack the rain jackets.", "Upgrade came through."],
    roles: ["Traveller \xB7 {#4-40} trips", "Trip organiser"],
    profile: [["Trips", "{#4-40}"], ["Countries", "{#2-30}"], ["Reviews", "{#1-50}"]],
    pitch: ["Every trip in one place", "Flights, stays and plans \u2014 together, offline."],
    empty: ["No trips planned", "Add a booking to start your first trip."],
    success: ["You're booked", "Confirmation sent \u2014 have a great trip."],
    motifs: ["plane", "suitcase", "pin", "ticket", "camera", "house"]
  },
  {
    id: "events",
    name: "Events and tickets",
    about: "events, conferences, concerts, meetups, tickets and RSVPs",
    noun: ["Event", "Events"],
    home: "This week",
    titles: ["Design meetup", "Jazz in the park", "Night market", "Open studio", "Book launch", "Community run", "Film night", "Pottery workshop", "Tech talk: {A-F}I", "Summer fair", "Trivia night", "Gallery opening", "Comedy hour", "Makers market", "Choir concert", "Startup breakfast", "Poetry slam", "Board game night", "Dance class", "Food festival", "Climate talk", "Charity gala"],
    subs: ["{day} \xB7 {time}", "{#20-400} going", "Hosted by {name}", "Free", "Hall {A-F}"],
    statuses: ["Going", "Interested", "Sold out", "Waitlist", "Cancelled", "On sale"],
    categories: ["Music", "Talks", "Workshops", "Food", "Community"],
    meta: ["{day}", "{time}", "${#5-80}"],
    amount: ["${#5-80}", "Free"],
    columns: ["Event", "When", "Status", "Day", "Type", "Host", "Date", "Price"],
    metrics: [{ label: "RSVPs", value: "{#40-400}", delta: "+{#5-40}" }, { label: "Tickets sold", value: "{#60-98}%" }, { label: "Check-ins", value: "{#20-300}" }, { label: "Waitlist", value: "{#2-40}" }],
    fields: [["Event name", "Design meetup"], ["Date", "{date}"], ["Start", "{time}"], ["Venue", "Hall {A-F}"], ["Capacity", "{#40-400}"], ["Ticket price", "${#5-80}"]],
    details: [["When", "{date}, {time}"], ["Where", "Hall {A-F}"], ["Host", "{name}"], ["Tickets", "${#5-80}"]],
    lines: ["An evening of short talks and good conversation.", "Doors open at {time}; the first talk starts half an hour later.", "Tickets include one drink.", "Step-free access through the side entrance.", "Bring a friend \u2014 it's more fun.", "Limited seats, first come first served."],
    remarks: ["See you there!", "Is there parking nearby?", "Loved last month's one.", "Bringing two friends.", "Can I switch my ticket?", "Running {#5-15} min late."],
    roles: ["Organiser \xB7 {#3-60} events", "Regular"],
    profile: [["Events", "{#3-120}"], ["Going", "{#1-12}"], ["Followers", "{#20-4000}"]],
    pitch: ["Find something on tonight", "Events near you, tickets in your pocket."],
    empty: ["No events yet", "Events you save or book will show here."],
    success: ["You're going", "Your ticket is in the app \u2014 see you on {day}."],
    motifs: ["ticket", "calendar", "music", "pin", "star", "chat"]
  },
  {
    id: "finance",
    name: "Money and finance",
    about: "banking, budgets, expenses, payments, invoices and personal finance",
    noun: ["Transaction", "Transactions"],
    home: "Balance",
    titles: ["Groceries", "Rent", "Salary", "Coffee", "Electricity bill", "Gym membership", "Transfer to savings", "Refund", "Phone plan", "Train pass", "Dinner out", "Invoice #{#1000-1999}", "Insurance", "Bookshop", "Pharmacy", "Taxi", "Hardware store", "Streaming plan", "Farmers market", "Water bill", "Pet supplies", "Parking"],
    subs: ["Card \u2022\u2022 {#1000-9999}", "{day}", "Split with {name}", "Recurring", "Pending"],
    statuses: ["Completed", "Pending", "Declined", "Refunded", "Scheduled"],
    categories: ["Food", "Bills", "Transport", "Income", "Shopping"],
    meta: ["\u2212${#4-120}.{#00-99}", "+${#20-900}.00", "{day}"],
    amount: ["${#4-900}.{#00-99}"],
    columns: ["Payee", "Account", "Status", "Amount", "Category", "Paid by", "Date", "Total"],
    metrics: [{ label: "Balance", value: "${#1-9},{#100-999}", delta: "+${#20-400}" }, { label: "Spent this month", value: "${#600-2400}", delta: "+{#2-12}%", down: true }, { label: "Saved", value: "${#100-900}" }, { label: "Bills due", value: "{#1-5}" }],
    fields: [["Amount", "${#20-500}.00"], ["To", "{name}"], ["From account", "Everyday \u2022\u2022 {#1000-9999}"], ["Date", "{date}"], ["Reference", "Rent {date}"], ["Category", "Bills"]],
    details: [["Account", "Everyday \u2022\u2022 {#1000-9999}"], ["Date", "{date}"], ["Category", "Bills"], ["Reference", "{A-F}{#10000-99999}"]],
    lines: ["Your spending is lower than last month.", "Two bills are due before {date}.", "Round-ups added ${#4-40} to savings this week.", "This payment repeats every month.", "Transfers arrive within a working day.", "Tap a transaction to split it."],
    remarks: ["Paid you back for dinner.", "Split the taxi?", "Rent sent.", "That refund came through.", "Moved ${#50-500} to savings.", "Bill is higher than usual."],
    roles: ["Personal account", "Joint account with {first}"],
    profile: [["Accounts", "{#1-4}"], ["Saved", "${#1-9}k"], ["Goals", "{#1-5}"]],
    pitch: ["Know where it goes", "See every payment, budget in minutes, save automatically."],
    empty: ["No transactions yet", "Payments will appear here as they happen."],
    success: ["Payment sent", "It should arrive within a working day."],
    motifs: ["coin", "chart", "briefcase", "phone", "checklist", "key"]
  },
  {
    id: "tasks",
    name: "Tasks and projects",
    about: "to-do lists, tasks, project management, teams, sprints and issues",
    noun: ["Task", "Tasks"],
    home: "My day",
    titles: ["Draft the brief", "Review pull request", "Book venue", "Update roadmap", "Fix login bug", "Write release notes", "Plan sprint {#10-40}", "Call supplier", "Order new chairs", "Prepare demo", "Send invoice", "Team retro", "Interview candidate", "Clean up backlog", "Migrate database", "Design review", "Check analytics", "Renew licence", "Onboard {first}", "Test checkout", "Write test plan", "Archive old files"],
    subs: ["Due {day}", "Assigned to {name}", "{#1-9} subtasks", "Project Alder", "{#1-9} comments"],
    statuses: ["To do", "In progress", "In review", "Done", "Blocked"],
    categories: ["Design", "Engineering", "Ops", "Marketing", "Personal"],
    meta: ["{day}", "{#1-8} pts", "{date}"],
    amount: ["{#1-8} pts", "{#1-16} h"],
    columns: ["Task", "Details", "Status", "Due", "Area", "Assignee", "Created", "Estimate"],
    metrics: [{ label: "Open", value: "{#8-40}", delta: "\u2212{#1-6}", down: true }, { label: "Due today", value: "{#1-7}" }, { label: "Done this week", value: "{#6-30}", delta: "+{#2-9}" }, { label: "Blocked", value: "{#0-3}" }],
    fields: [["Title", "Draft the brief"], ["Assignee", "{name}"], ["Due date", "{date}"], ["Priority", "High"], ["Project", "Project Alder"], ["Description", "First pass by Friday"]],
    details: [["Assignee", "{name}"], ["Due", "{date}"], ["Priority", "High"], ["Estimate", "{#1-8} pts"]],
    lines: ["A first pass is enough \u2014 we'll review it together.", "Blocked until the design is signed off.", "Linked to two other tasks in this sprint.", "Priority raised after the customer call.", "Moved from last sprint.", "Check the notes before starting."],
    remarks: ["On it.", "Pushed a fix, can you review?", "Moving this to next sprint.", "Blocked on the API.", "Done \u2014 closing.", "Who has context here?"],
    roles: ["Product designer", "Engineering lead"],
    profile: [["Done", "{#40-900}"], ["Open", "{#3-30}"], ["Projects", "{#1-8}"]],
    pitch: ["Get the right things done", "Plan the day, share the load, ship on time."],
    empty: ["Nothing due", "Enjoy it \u2014 or add a task to plan ahead."],
    success: ["Task done", "{#1-9} left for today."],
    motifs: ["checklist", "calendar", "chart", "chat", "laptop", "briefcase"]
  },
  {
    id: "tools",
    name: "Tools and lending",
    about: "lending and borrowing tools, a tool library, rentals, equipment and sharing things with neighbours",
    noun: ["Tool", "Tools"],
    home: "Near you",
    titles: ["Cordless drill", "Step ladder", "Hedge trimmer", "Pressure washer", "Circular saw", "Tile cutter", "Stud finder", "Wheelbarrow", "Sander", "Socket set", "Paint sprayer", "Extension lead", "Carpet cleaner", "Jigsaw", "Lawn mower", "Camping stove", "Car jack", "Spirit level", "Glue gun", "Bolt cutters", "Leaf blower", "Clamp set"],
    subs: ["{#1-9} min away", "Lent by {name}", "Free \xB7 {#1-7} days", "Good condition", "Batteries included"],
    statuses: ["Available", "On loan", "Reserved", "Returned", "Overdue"],
    categories: ["Power tools", "Garden", "Ladders", "Cleaning", "Outdoors"],
    meta: ["{#1-9} min", "{#1-7} days", "${#0-15}/day"],
    amount: ["${#0-15}/day", "Free"],
    columns: ["Tool", "Details", "Status", "Distance", "Type", "Owner", "Due back", "Deposit"],
    metrics: [{ label: "Borrowed", value: "{#2-12}" }, { label: "Lent out", value: "{#1-8}", delta: "+{#1-3}" }, { label: "Due back", value: "{#1-4}" }, { label: "Neighbours", value: "{#12-90}" }],
    fields: [["Tool", "Cordless drill"], ["Pick-up", "{day}, {time}"], ["Return by", "{date}"], ["Deposit", "${#0-40}"], ["Condition", "Good"], ["Message", "Can I grab it after work?"]],
    details: [["Owner", "{name}"], ["Condition", "Good"], ["Loan length", "Up to {#1-7} days"], ["Deposit", "${#0-40}"]],
    lines: ["Comes with two batteries and a set of bits.", "Pick up from the porch \u2014 it's in the blue box.", "Please return it clean and charged.", "Lent {#3-40} times without a scratch.", "Ask before taking it overnight.", "Great for a weekend job."],
    remarks: ["Worked perfectly, thanks!", "Back on your porch.", "Can I keep it one more day?", "Battery was flat \u2014 charged it.", "Happy to lend anytime.", "Picked up at {time}."],
    roles: ["Neighbour \xB7 {#2-9} years", "Tool library volunteer"],
    profile: [["Lent", "{#3-80}"], ["Borrowed", "{#2-40}"], ["Rating", "4.{#6-9}"]],
    pitch: ["Borrow, don't buy", "Tools from your street, lent and returned with a tap."],
    empty: ["Nothing borrowed", "Find a tool nearby and ask to borrow it."],
    success: ["Request sent", "{first} will reply soon."],
    motifs: ["drill", "hammer", "ladder", "wrench", "house", "key"]
  },
  {
    id: "pets",
    name: "Pets and animal care",
    about: "pets, pet care, vets, dog walking, pet sitting and adoption",
    noun: ["Pet", "Pets"],
    home: "Today",
    titles: ["Biscuit", "Luna", "Pepper", "Mochi", "Otis", "Juniper", "Walk with Biscuit", "Vet check-up", "Flea treatment", "Grooming", "Puppy class", "Feeding", "Sitter: {first}", "Nail trim", "Vaccination", "Weigh-in", "Park meetup", "Dental clean", "Adopt: Ziggy", "Adopt: Clover", "Night-time pills", "Bath day"],
    subs: ["Dog \xB7 {#1-12} yrs", "Cat \xB7 {#1-16} yrs", "{time} \xB7 {#20-60} min", "With {name}", "Due {day}"],
    statuses: ["Due", "Done", "Booked", "Overdue", "Adoptable"],
    categories: ["Walks", "Health", "Food", "Grooming", "Training"],
    meta: ["{time}", "{#20-60} min", "{#3-40} kg"],
    amount: ["{#3-40} kg", "${#20-120}"],
    columns: ["Pet", "Details", "Status", "Time", "Care", "Carer", "Date", "Cost"],
    metrics: [{ label: "Walks", value: "{#8-21}", delta: "+{#1-4}" }, { label: "Km walked", value: "{#12-60}" }, { label: "Next vet", value: "{#2-30} days" }, { label: "Weight", value: "{#3-40} kg" }],
    fields: [["Pet's name", "Biscuit"], ["Species", "Dog"], ["Breed", "Mixed"], ["Age", "{#1-12}"], ["Vet", "Riverside Vets"], ["Notes", "Scared of thunder"]],
    details: [["Breed", "Mixed"], ["Age", "{#1-12} years"], ["Weight", "{#3-40} kg"], ["Vet", "Riverside Vets"]],
    lines: ["Friendly with other dogs, a little shy with people.", "Two walks a day, one of them long.", "Takes a pill with dinner.", "Loves the park by the river.", "Microchipped and vaccinated.", "Needs a quiet home with a garden."],
    remarks: ["Such a good walk today!", "Ate everything.", "A little limp \u2014 keeping an eye on it.", "Met {first}'s dog at the park.", "Bath done, very fluffy.", "Back home at {time}."],
    roles: ["Dog walker", "Pet parent"],
    profile: [["Walks", "{#20-900}"], ["Pets", "{#1-4}"], ["Rating", "4.{#6-9}"]],
    pitch: ["Happy pets, easy care", "Walks, meals and vet visits \u2014 all on one calendar."],
    empty: ["No pets yet", "Add your pet to start tracking their care."],
    success: ["Walk booked", "{first} will pick them up at {time}."],
    motifs: ["paw", "heart-pulse", "calendar", "house", "bowl", "camera"]
  },
  {
    id: "home-services",
    name: "Home services",
    about: "home repairs, cleaning, plumbers, electricians, handymen and booking services at home",
    noun: ["Job", "Jobs"],
    home: "Your home",
    titles: ["Leaky tap", "Deep clean", "Boiler service", "Fix fence panel", "Paint the hallway", "Gutter clearing", "Replace light fitting", "Window cleaning", "Assemble wardrobe", "Unblock drain", "Garden tidy", "Tile the bathroom", "Hang shelves", "Move sofa", "Smoke alarm check", "Carpet clean", "Fix door lock", "Seal the bath", "Lawn mowing", "Oven clean", "Mount the TV", "Bleed radiators"],
    subs: ["{day}, {time}", "With {name}", "{#1-4} h estimated", "Quote ${#40-400}", "{#1-9} photos"],
    statuses: ["Booked", "Quote sent", "In progress", "Completed", "Needs review"],
    categories: ["Plumbing", "Electrical", "Cleaning", "Garden", "Handyman"],
    meta: ["{day}", "${#40-400}", "{time}"],
    amount: ["${#40-400}"],
    columns: ["Job", "Details", "Status", "When", "Trade", "Pro", "Booked", "Quote"],
    metrics: [{ label: "Upcoming", value: "{#1-5}" }, { label: "Spent this year", value: "${#300-3000}" }, { label: "Pros hired", value: "{#2-12}" }, { label: "Avg rating", value: "4.{#5-9}" }],
    fields: [["What needs doing", "Leaky tap"], ["Room", "Kitchen"], ["Preferred day", "{day}"], ["Time", "{time}"], ["Budget", "${#40-400}"], ["Access notes", "Key under the mat"]],
    details: [["Pro", "{name}"], ["When", "{day}, {time}"], ["Estimate", "{#1-4} hours"], ["Quote", "${#40-400}"]],
    lines: ["Includes parts and an hour of labour.", "{first} has done {#20-300} jobs nearby.", "Photos help the pro quote accurately.", "Pay only when the job is done.", "Rescheduling is free up to a day before.", "Guaranteed for 90 days."],
    remarks: ["On my way \u2014 {#5-20} min.", "All fixed, sent photos.", "Needs one more part.", "Great job, thank you!", "Can we move to {day}?", "Left the key where you said."],
    roles: ["Plumber \xB7 {#3-20} years", "Homeowner"],
    profile: [["Jobs", "{#20-800}"], ["Rating", "4.{#6-9}"], ["Years", "{#2-25}"]],
    pitch: ["A pro at your door", "Book trusted help for any job around the house."],
    empty: ["No jobs yet", "Describe what needs doing and get quotes."],
    success: ["Job booked", "{first} will arrive {day} at {time}."],
    motifs: ["house", "wrench", "hammer", "key", "ladder", "calendar"]
  },
  {
    id: "jobs",
    name: "Jobs and hiring",
    about: "job listings, hiring, recruiting, candidates, applications and careers",
    noun: ["Job", "Jobs"],
    home: "For you",
    titles: ["Product designer", "Backend engineer", "Store manager", "Barista", "Data analyst", "Warehouse lead", "Nurse, nights", "Line cook", "Marketing lead", "Support specialist", "Electrician", "Teacher, year {#3-6}", "Delivery driver", "Office manager", "UX researcher", "Accountant", "Sales associate", "Project coordinator", "Carpenter", "Content writer", "QA engineer", "Receptionist"],
    subs: ["Remote \xB7 Full-time", "${#40-160}k", "{#1-30} applicants", "Posted {ago}", "Part-time \xB7 {#15-30} h/wk"],
    statuses: ["Open", "Applied", "Interviewing", "Offer", "Closed"],
    categories: ["Design", "Engineering", "Retail", "Hospitality", "Health"],
    meta: ["{ago}", "${#40-160}k", "Remote"],
    amount: ["${#40-160}k", "${#16-40}/h"],
    columns: ["Role", "Details", "Status", "Posted", "Team", "Recruiter", "Opened", "Salary"],
    metrics: [{ label: "Applications", value: "{#20-240}", delta: "+{#4-30}" }, { label: "Interviews", value: "{#3-18}" }, { label: "Offers", value: "{#1-4}" }, { label: "Time to hire", value: "{#12-40} days", delta: "\u2212{#1-5}", down: true }],
    fields: [["Full name", "{name}"], ["Email", "{lower}@example.com"], ["Role", "Product designer"], ["Experience", "{#2-12} years"], ["Portfolio", "example.com/{lower}"], ["Cover note", "I'd love to help"]],
    details: [["Team", "Design"], ["Location", "Remote"], ["Salary", "${#40-160}k"], ["Start", "{date}"]],
    lines: ["You'll work with a small team shipping every week.", "Flexible hours and a remote-first team.", "We'd love to hear what you've built.", "Interviews are two short conversations.", "Applications close on {date}.", "Training is paid and starts on day one."],
    remarks: ["Thanks for applying!", "Can we talk {day}?", "Loved your portfolio.", "Sent the take-home.", "Offer letter attached.", "We've filled this role."],
    roles: ["Product designer \xB7 {#2-12} yrs", "Recruiter"],
    profile: [["Applied", "{#2-30}"], ["Interviews", "{#1-9}"], ["Saved", "{#3-40}"]],
    pitch: ["Work that fits", "Roles matched to your skills, one tap to apply."],
    empty: ["No applications yet", "Save a job or apply to track it here."],
    success: ["Application sent", "You'll hear back within a week."],
    motifs: ["briefcase", "laptop", "chat", "calendar", "star", "checklist"]
  },
  {
    id: "news",
    name: "News and reading",
    about: "news, articles, magazines, blogs, newsletters and reading",
    noun: ["Story", "Stories"],
    home: "Top stories",
    titles: ["City council approves new bike lanes", "The quiet return of the corner shop", "Heatwave expected this weekend", "Local team wins the final", "What the new rail line means for you", "Inside the night market", "Five books to read this autumn", "Schools trial a four-day week", "The river cleanup, one year on", "How the harbour got its lights back", "A guide to the festival", "Rents rise for a third month", "The bakery that never closes", "Meet the city's beekeepers", "Storm clears, roads reopen", "Library extends its hours", "Why the tram is late", "A walk along the old canal", "New park opens in the east", "Theatre season announced", "Farm-to-table, reconsidered", "The last video shop"],
    subs: ["{#3-12} min read", "By {name}", "{ago}", "Opinion", "Updated {ago}"],
    statuses: ["New", "Saved", "Read", "Breaking", "Updated"],
    categories: ["Local", "Politics", "Culture", "Sport", "Weather"],
    meta: ["{ago}", "{#3-12} min", "{date}"],
    amount: ["{#3-12} min read"],
    columns: ["Headline", "Byline", "Status", "Published", "Section", "Editor", "Date", "Length"],
    metrics: [{ label: "Stories today", value: "{#12-60}" }, { label: "Readers", value: "{#2-90}k", delta: "+{#2-18}%" }, { label: "Saved", value: "{#3-40}" }, { label: "Read time", value: "{#3-12} min" }],
    fields: [["Headline", "Local team wins the final"], ["Section", "Sport"], ["Author", "{name}"], ["Publish at", "{time}"], ["Tags", "Local, sport"], ["Summary", "A late goal settles it"]],
    details: [["Author", "{name}"], ["Section", "Local"], ["Published", "{date}"], ["Read time", "{#3-12} min"]],
    lines: ["The plan passed late on Tuesday after a long debate.", "Residents say the change is overdue.", "Work is expected to begin in the spring.", "Not everyone is convinced it will help.", "The council will publish the full report next week.", "Here's what we know so far."],
    remarks: ["Great piece.", "This affects our street too.", "Any update on the timeline?", "Shared with my neighbours.", "Finally!", "Would love a follow-up."],
    roles: ["Reporter \xB7 City desk", "Reader since {date}"],
    profile: [["Articles", "{#20-900}"], ["Followers", "{#100-20000}"], ["Saved", "{#3-80}"]],
    pitch: ["The news that matters here", "Local stories, written by people who live here."],
    empty: ["Nothing saved", "Save a story to read it later."],
    success: ["Subscribed", "Your first newsletter arrives tomorrow."],
    motifs: ["newspaper", "book", "camera", "chat", "star", "image"]
  },
  {
    id: "music",
    name: "Music and audio",
    about: "music streaming, playlists, albums, artists, podcasts and audio",
    noun: ["Track", "Tracks"],
    home: "Listen now",
    titles: ["Late Summer", "Harbour Lights", "Slow Rivers", "Paper Moons", "Neon Rain", "Morning Walk", "Glasshouse", "Blue Hour", "Tidal", "Low Tide Radio", "Kite Season", "Salt & Honey", "Afterglow", "Velvet Static", "North Road", "Quiet Engines", "Golden Fields", "Night Ferry", "Cloud Atlas Mix", "Focus Beats", "Sunday Jazz", "Deep Work"],
    subs: ["The Lanterns", "Mira Vale", "{#8-40} tracks", "Podcast \xB7 Ep. {#10-99}", "Playlist by {name}"],
    statuses: ["Playing", "Downloaded", "Liked", "New release", "Queued"],
    categories: ["Pop", "Jazz", "Chill", "Podcasts", "Focus"],
    meta: ["{#2-5}:{#00-59}", "{#20-60} min", "{#1-9}.{#0-9}M plays"],
    amount: ["{#2-5}:{#00-59}"],
    columns: ["Title", "Artist", "Status", "Length", "Genre", "Added by", "Added", "Plays"],
    metrics: [{ label: "Minutes", value: "{#300-2400}", delta: "+{#20-200}" }, { label: "Artists", value: "{#12-90}" }, { label: "Playlists", value: "{#3-24}" }, { label: "Downloads", value: "{#20-400}" }],
    fields: [["Playlist name", "Sunday Jazz"], ["Description", "Slow and warm"], ["Visibility", "Private"], ["Cover", "Auto"], ["Collaborators", "{name}"], ["Tags", "Jazz, chill"]],
    details: [["Artist", "The Lanterns"], ["Album", "Harbour Lights"], ["Released", "{date}"], ["Length", "{#30-60} min"]],
    lines: ["A slow, warm record made for late evenings.", "Recorded live in one take.", "New episodes every Tuesday.", "Mixed for focus \u2014 no lyrics.", "The band's first album in five years.", "Updated every Friday."],
    remarks: ["On repeat all week.", "That bridge at 2:10!", "Saw them live last year.", "Perfect for work.", "Added to my playlist.", "Where can I hear more like this?"],
    roles: ["Listener since {date}", "Artist"],
    profile: [["Playlists", "{#3-40}"], ["Followers", "{#10-9000}"], ["Following", "{#10-400}"]],
    pitch: ["Music for every moment", "Mixes made for you, offline when you need them."],
    empty: ["Nothing here yet", "Like a track and it will show up here."],
    success: ["Playlist saved", "{#8-40} tracks, ready offline."],
    motifs: ["music", "star", "heart-pulse", "phone", "image", "chat"]
  },
  {
    id: "learning",
    name: "Learning and courses",
    about: "courses, lessons, schools, students, teachers, quizzes and education",
    noun: ["Course", "Courses"],
    home: "Keep learning",
    titles: ["Intro to watercolour", "Spanish for travel", "Algebra refresher", "Photography basics", "Public speaking", "Python in a week", "Knitting 101", "Bookkeeping", "World history: part {#1-4}", "Beginner guitar", "Data literacy", "Creative writing", "First aid", "Chemistry lab", "Mandarin tones", "Sketching people", "Home electrics", "Negotiation", "Music theory", "Budgeting basics", "Garden design", "Chess openings"],
    subs: ["{#4-20} lessons", "Lesson {#1-12} of 12", "With {name}", "{#20-90} min", "{#60-99}% complete"],
    statuses: ["Not started", "In progress", "Completed", "Due", "Graded"],
    categories: ["Languages", "Art", "Maths", "Business", "Science"],
    meta: ["{#10-45} min", "{#60-99}%", "{day}"],
    amount: ["{#4-20} lessons", "${#0-90}"],
    columns: ["Course", "Progress", "Status", "Length", "Subject", "Teacher", "Started", "Price"],
    metrics: [{ label: "Streak", value: "{#3-40} days", delta: "+1" }, { label: "Lessons done", value: "{#12-120}" }, { label: "Avg score", value: "{#72-98}%" }, { label: "Hours", value: "{#6-80}" }],
    fields: [["Course", "Spanish for travel"], ["Level", "Beginner"], ["Goal", "{#10-30} min a day"], ["Start date", "{date}"], ["Reminders", "{time}"], ["Why", "A trip in the spring"]],
    details: [["Teacher", "{name}"], ["Lessons", "{#4-20}"], ["Level", "Beginner"], ["Certificate", "Included"]],
    lines: ["Short lessons you can finish on the bus.", "Each lesson ends with a five-question quiz.", "You'll build a small project by the end.", "Practise speaking with voice exercises.", "Pick up where you left off on any device.", "Join the weekly live session."],
    remarks: ["Finally understood fractions!", "Lesson {#3-9} was hard.", "Great examples.", "Can we get more practice?", "Just got my certificate.", "See you in class {day}."],
    roles: ["Student", "Teacher \xB7 {#3-20} years"],
    profile: [["Courses", "{#1-20}"], ["Streak", "{#3-60}"], ["Certificates", "{#0-8}"]],
    pitch: ["Learn something new", "Ten minutes a day, one small step at a time."],
    empty: ["No courses yet", "Pick a course to start learning."],
    success: ["Lesson complete", "{#72-98}% \u2014 on to the next one."],
    motifs: ["book", "cap", "laptop", "checklist", "star", "chart"]
  },
  {
    id: "health",
    name: "Health and care",
    about: "health, clinics, doctors, appointments, medication, patients and wellbeing",
    noun: ["Appointment", "Appointments"],
    home: "Your health",
    titles: ["Annual check-up", "Dental clean", "Blood test", "Physio session", "Eye exam", "Flu vaccine", "Therapy session", "Skin check", "Follow-up call", "Vitamin D, daily", "Blood pressure log", "Allergy review", "Hearing test", "Prescription refill", "Nutrition consult", "Sleep diary", "Knee X-ray", "Mental health check-in", "Travel vaccines", "Walk {#5-10}k steps", "Iron, weekly", "Stretching routine"],
    subs: ["{day}, {time}", "With Dr {first}", "Room {#1-20}", "Video call", "Take with food"],
    statuses: ["Booked", "Confirmed", "Completed", "Due", "Missed"],
    categories: ["Appointments", "Medication", "Tests", "Activity", "Wellbeing"],
    meta: ["{time}", "{day}", "{#1-3} \xD7 day"],
    amount: ["{#15-60} min"],
    columns: ["Appointment", "Details", "Status", "Time", "Type", "Clinician", "Date", "Length"],
    metrics: [{ label: "Steps", value: "{#4-12},{#100-999}", delta: "+{#200-900}" }, { label: "Resting HR", value: "{#56-74} bpm" }, { label: "Sleep", value: "{#6-8} h {#00-59} m" }, { label: "Meds taken", value: "{#80-100}%" }],
    fields: [["Full name", "{name}"], ["Date of birth", "{date}"], ["Reason", "Annual check-up"], ["Preferred time", "{time}"], ["Clinic", "Riverside Clinic"], ["Symptoms", "None"]],
    details: [["Clinician", "Dr {first}"], ["When", "{day}, {time}"], ["Where", "Room {#1-20}"], ["Length", "{#15-60} min"]],
    lines: ["Arrive ten minutes early to check in.", "Bring a list of any medication you take.", "Results are usually ready within three days.", "You can join by video from home.", "Drink water before a blood test.", "Reschedule free of charge up to a day before."],
    remarks: ["Feeling much better.", "Results look normal.", "Can I move to {day}?", "Remember to fast before.", "Refill sent to the pharmacy.", "See you at {time}."],
    roles: ["Patient", "Nurse practitioner"],
    profile: [["Visits", "{#2-30}"], ["Streak", "{#3-60}"], ["Records", "{#4-80}"]],
    pitch: ["Care that fits your life", "Book visits, track medication and see results in one place."],
    empty: ["No appointments", "Book one when you need it."],
    success: ["Appointment booked", "{day} at {time} \u2014 we'll remind you."],
    motifs: ["heart-pulse", "pill", "calendar", "chat", "chart", "checklist"]
  },
  {
    id: "real-estate",
    name: "Homes and property",
    about: "homes for sale or rent, property listings, estate agents, viewings and landlords",
    noun: ["Home", "Homes"],
    home: "Homes for you",
    titles: ["Two-bed flat with balcony", "Garden cottage", "Loft near the river", "Family house, 4 bed", "Studio, top floor", "Terrace with courtyard", "Converted warehouse", "Ground-floor flat", "Townhouse, 3 bed", "Bungalow with drive", "Penthouse", "Shared house, 1 room", "Canal-side flat", "Victorian semi", "New-build duplex", "Mews house", "Farmhouse", "Houseboat", "Garden flat", "Corner house", "Studio by the park", "Cabin plot"],
    subs: ["{#1-5} bed \xB7 {#1-3} bath", "{#40-180} m\xB2", "{#1-9} min to the station", "Viewing {day}", "Listed {ago}"],
    statuses: ["For sale", "To let", "Under offer", "Sold", "Viewing booked"],
    categories: ["Flats", "Houses", "New builds", "Rentals", "Land"],
    meta: ["{#40-180} m\xB2", "${#250-900}k", "${#1-4},{#100-900}/mo"],
    amount: ["${#250-900},000", "${#1-4},{#100-900}/mo"],
    columns: ["Property", "Details", "Status", "Size", "Type", "Agent", "Listed", "Price"],
    metrics: [{ label: "Saved homes", value: "{#3-30}" }, { label: "Viewings", value: "{#1-6}" }, { label: "New today", value: "{#2-18}", delta: "+{#1-6}" }, { label: "Avg price", value: "${#300-800}k" }],
    fields: [["Area", "Riverside"], ["Budget", "Up to ${#300-900}k"], ["Bedrooms", "{#1-5}"], ["Move-in", "{date}"], ["Must have", "Garden"], ["Viewing time", "{day}, {time}"]],
    details: [["Bedrooms", "{#1-5}"], ["Bathrooms", "{#1-3}"], ["Size", "{#40-180} m\xB2"], ["Agent", "{name}"]],
    lines: ["Bright rooms with tall windows and wooden floors.", "A short walk to the station and the park.", "Newly fitted kitchen with space to eat.", "South-facing garden with a shed.", "No onward chain.", "Viewings available this weekend."],
    remarks: ["Loved the light in this one.", "Is the garden shared?", "Booked a viewing for {day}.", "Price just dropped.", "Offer accepted!", "Too far from work for us."],
    roles: ["Home hunter", "Agent \xB7 {#2-20} years"],
    profile: [["Saved", "{#3-60}"], ["Viewings", "{#1-20}"], ["Alerts", "{#1-6}"]],
    pitch: ["Find your next home", "New listings the minute they land, viewings in a tap."],
    empty: ["No saved homes", "Save a listing to compare it later."],
    success: ["Viewing booked", "{first} will meet you on {day} at {time}."],
    motifs: ["house", "key", "pin", "camera", "calendar", "leaf"]
  },
  {
    id: "social",
    name: "Social and community",
    about: "social networks, communities, groups, friends, posts, messaging and neighbourhoods",
    noun: ["Post", "Posts"],
    home: "Your feed",
    titles: ["Sunset from the pier", "Anyone up for a run?", "New caf\xE9 on the corner", "Lost cat \u2014 grey tabby", "Garden swap this Sunday", "My first loaf!", "Book club pick", "Road closed on the high street", "Free sofa, must collect", "Street party photos", "Recommend a plumber?", "Morning swim crew", "Kids' football results", "The mural is finished", "Found keys by the bus stop", "Community fridge restocked", "Litter pick, {day}", "Choir needs tenors", "Balcony tomatoes", "Rain again\u2026", "Quiz night winners", "Welcome, new neighbours"],
    subs: ["{name} \xB7 {ago}", "{#2-90} likes", "{#1-40} comments", "In Riverside", "Shared by {name}"],
    statuses: ["New", "Popular", "Pinned", "Following", "Resolved"],
    categories: ["Neighbours", "Events", "For sale", "Lost & found", "Photos"],
    meta: ["{ago}", "{#2-90} \u2661", "{#1-40} replies"],
    amount: ["{#2-90} likes"],
    columns: ["Post", "Author", "Status", "Posted", "Group", "Member", "Date", "Likes"],
    metrics: [{ label: "Followers", value: "{#40-900}", delta: "+{#2-20}" }, { label: "Posts", value: "{#12-300}" }, { label: "Groups", value: "{#2-12}" }, { label: "Replies", value: "{#10-90}" }],
    fields: [["Display name", "{name}"], ["Username", "@{lower}"], ["Neighbourhood", "Riverside"], ["Bio", "Coffee, bikes, plants"], ["Website", "example.com/{lower}"], ["Birthday", "{date}"]],
    details: [["Joined", "{date}"], ["Neighbourhood", "Riverside"], ["Groups", "{#2-12}"], ["Posts", "{#12-300}"]],
    lines: ["Caught this on the way home \u2014 the sky was unreal.", "Meeting at the gate at seven, all paces welcome.", "Free to a good home, just come and grab it.", "Thanks to everyone who came along!", "Anyone know who does this kind of repair?", "More photos in the album."],
    remarks: ["So beautiful!", "Count me in.", "Thanks for sharing.", "I'll come by at {time}.", "Congrats!", "Which street is this?"],
    roles: ["Riverside \xB7 member since {date}", "Group admin"],
    profile: [["Posts", "{#12-300}"], ["Followers", "{#40-900}"], ["Following", "{#20-400}"]],
    pitch: ["Know your neighbours", "Share, swap and help out on your street."],
    empty: ["It's quiet here", "Follow people and groups to fill your feed."],
    success: ["Posted", "Your neighbours can see it now."],
    motifs: ["chat", "camera", "image", "heart-pulse", "house", "star"]
  },
  {
    id: "rides",
    name: "Rides and transport",
    about: "ride hailing, taxis, car sharing, bike hire, public transport and fleets of vehicles",
    noun: ["Ride", "Rides"],
    home: "Where to?",
    titles: ["Home", "Work", "Station", "Airport run", "Ride to the gym", "Evening pickup", "Bike {#100-999}", "Van {A-F}{#10-99}", "Shuttle {#1-9}", "Car {#1000-9999}", "School run", "Late train home", "Ride to the clinic", "Hire: city bike", "Scooter {#100-999}", "Night bus {#10-99}", "Weekend car share", "Ride to the match", "Market trip", "Hotel transfer", "Commute", "Ferry terminal"],
    subs: ["{#4-40} min \xB7 {#2-30} km", "Driver {name}", "Arrives {time}", "{#2-6} seats", "Battery {#40-99}%"],
    statuses: ["Arriving", "On trip", "Completed", "Scheduled", "Cancelled"],
    categories: ["Cars", "Bikes", "Scooters", "Transit", "Shared"],
    meta: ["{#2-12} min", "${#6-48}", "{#2-30} km"],
    amount: ["${#6-48}.{#00-99}"],
    columns: ["Trip", "Details", "Status", "ETA", "Mode", "Driver", "Date", "Fare"],
    metrics: [{ label: "Trips", value: "{#4-40}", delta: "+{#1-6}" }, { label: "Km", value: "{#20-300}" }, { label: "Spent", value: "${#40-400}" }, { label: "CO\u2082 saved", value: "{#2-40} kg" }],
    fields: [["Pickup", "Current location"], ["Drop-off", "Station"], ["When", "Now"], ["Passengers", "{#1-4}"], ["Payment", "Card \u2022\u2022 {#1000-9999}"], ["Note to driver", "By the blue door"]],
    details: [["Driver", "{name}"], ["Vehicle", "Grey hatchback"], ["Plate", "{A-F}{A-F}{#10-99} {A-F}{A-F}{A-F}"], ["Fare", "${#6-48}"]],
    lines: ["Your driver is {#2-9} minutes away.", "Meet at the pickup point by the main entrance.", "Fares include tolls and taxes.", "Share your trip with a friend for peace of mind.", "Bikes can be left in any marked bay.", "Scheduled rides can be changed until an hour before."],
    remarks: ["Great driver, smooth ride.", "Running a couple of minutes late.", "At the front entrance.", "Left my umbrella in the car.", "Thanks for waiting!", "Traffic on the bridge."],
    roles: ["Rider since {date}", "Driver \xB7 {#200-5000} trips"],
    profile: [["Trips", "{#10-900}"], ["Rating", "4.{#6-9}"], ["Years", "{#1-8}"]],
    pitch: ["Get there, easily", "A ride, a bike or the next train \u2014 in one app."],
    empty: ["No trips yet", "Your rides will show up here."],
    success: ["Ride booked", "{first} arrives at {time}."],
    motifs: ["car", "bike", "pin", "phone", "ticket", "calendar"]
  },
  {
    id: "plants",
    name: "Plants and gardening",
    about: "gardening, plants, plant care, allotments, seeds, watering and nurseries",
    noun: ["Plant", "Plants"],
    home: "Your garden",
    titles: ["Monstera", "Fiddle-leaf fig", "Snake plant", "Basil", "Tomatoes, cherry", "Lavender", "Peace lily", "Pothos", "Rosemary", "Chilli pepper", "Olive tree", "Succulent tray", "Sunflowers", "Mint", "Aloe", "Fern, Boston", "Strawberries", "Runner beans", "Rubber plant", "Orchid", "Cactus", "Hydrangea"],
    subs: ["Water in {#1-7} days", "Bright, indirect light", "Planted {date}", "Bed {#1-6}", "Repot soon"],
    statuses: ["Thirsty", "Healthy", "Needs light", "Blooming", "Harvest ready"],
    categories: ["Indoor", "Herbs", "Veg", "Flowers", "Succulents"],
    meta: ["{#1-7} days", "{day}", "{#10-180} cm"],
    amount: ["${#4-60}"],
    columns: ["Plant", "Care", "Status", "Next water", "Type", "Grower", "Planted", "Price"],
    metrics: [{ label: "Plants", value: "{#6-40}" }, { label: "Water today", value: "{#1-8}" }, { label: "Harvested", value: "{#1-9} kg", delta: "+{#1-3}" }, { label: "Streak", value: "{#3-40} days" }],
    fields: [["Plant name", "Monstera"], ["Where", "Living room"], ["Light", "Bright, indirect"], ["Water every", "{#3-10} days"], ["Pot size", "{#12-30} cm"], ["Notes", "New leaf unfurling"]],
    details: [["Light", "Bright, indirect"], ["Water", "Every {#3-10} days"], ["Height", "{#10-180} cm"], ["Planted", "{date}"]],
    lines: ["Let the top of the soil dry out between waterings.", "Turn it a quarter each week so it grows evenly.", "Feed once a month in spring and summer.", "Yellow leaves usually mean too much water.", "Pinch out the tips to keep it bushy.", "Bring it inside before the first frost."],
    remarks: ["New leaf this morning!", "Is this too much sun?", "First tomatoes of the year.", "Repotted, looking happier.", "Swapping cuttings on {day}.", "Aphids again\u2026"],
    roles: ["Balcony gardener", "Allotment {#1-60}"],
    profile: [["Plants", "{#6-80}"], ["Harvests", "{#2-40}"], ["Swaps", "{#1-20}"]],
    pitch: ["Keep every plant happy", "Reminders to water, feed and repot \u2014 plant by plant."],
    empty: ["No plants yet", "Add a plant to get care reminders."],
    success: ["Watered", "Next one's due in {#2-7} days."],
    motifs: ["leaf", "plant", "calendar", "house", "camera", "checklist"]
  },
  {
    id: "support",
    name: "Support and help desk",
    about: "customer support, help desks, tickets, service requests, IT help and complaints",
    noun: ["Ticket", "Tickets"],
    home: "Inbox",
    titles: ["Can't sign in", "Refund request #{#1000-9999}", "App crashes on launch", "Change billing address", "Order never arrived", "Password reset loop", "Feature request: dark mode", "Wrong item received", "Slow loading", "Cancel subscription", "Invoice missing", "Printer offline", "Account locked", "Update email", "Broken link on page", "Export not working", "Double charged", "Delivery damaged", "Can't upload photo", "Two-factor issue", "Question about pricing", "VPN won't connect"],
    subs: ["From {name}", "#{#1000-9999} \xB7 {ago}", "{#1-9} replies", "Priority: High", "Assigned to {first}"],
    statuses: ["Open", "Pending", "Solved", "Urgent", "Waiting on customer"],
    categories: ["Billing", "Account", "Bugs", "Orders", "Questions"],
    meta: ["{ago}", "{#1-48} h", "#{#1000-9999}"],
    amount: ["{#1-48} h"],
    columns: ["Subject", "Requester", "Status", "Updated", "Type", "Agent", "Opened", "Wait"],
    metrics: [{ label: "Open", value: "{#8-60}", delta: "\u2212{#1-9}", down: true }, { label: "First reply", value: "{#12-90} min" }, { label: "Solved today", value: "{#10-80}", delta: "+{#2-12}" }, { label: "Satisfaction", value: "9{#0-8}%" }],
    fields: [["Subject", "Can't sign in"], ["Email", "{lower}@example.com"], ["Category", "Account"], ["Priority", "Normal"], ["Order number", "#{#1000-9999}"], ["Describe the problem", "It says my code expired"]],
    details: [["Requester", "{name}"], ["Priority", "High"], ["Agent", "{name}"], ["Opened", "{date}"]],
    lines: ["The customer can't get past the sign-in screen.", "Tried clearing the cache \u2014 no change.", "Happened after the latest update.", "They'd like a call back this afternoon.", "Linked to {#2-9} similar tickets.", "Refund approved, waiting on the bank."],
    remarks: ["Thanks, that fixed it!", "Still seeing the error.", "Escalating to the team.", "Can you send a screenshot?", "Refund issued.", "Closing \u2014 reopen anytime."],
    roles: ["Support agent \xB7 Tier {#1-2}", "Team lead"],
    profile: [["Solved", "{#200-4000}"], ["CSAT", "9{#0-8}%"], ["Open", "{#2-20}"]],
    pitch: ["Help, fast", "Every request in one inbox, answered in minutes."],
    empty: ["Inbox zero", "New tickets will land here."],
    success: ["Ticket solved", "The customer has been notified."],
    motifs: ["headset", "chat", "checklist", "laptop", "phone", "star"]
  }
];
var PACK_BY_ID = new Map(PACKS.map((p) => [p.id, p]));
var PACK_IDS = PACKS.map((p) => p.id);
var GENERIC_PACK = "generic";

// packages/modules/wireframe/src/content/fill.ts
function hash2(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function singular(text) {
  return text.replace(/(^|[^\d.,])1 ([a-z]+?)(ies|s)\b/g, (whole, pre, stem, end) => stem.length < 2 || /ss$/.test(stem + end) ? whole : `${pre}1 ${stem}${end === "ies" ? "y" : ""}`);
}
var Ink = class {
  next;
  constructor(seed) {
    this.next = rng(seed);
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  name() {
    return `${this.pick(FIRST_NAMES)} ${this.pick(INITIALS.split(""))}.`;
  }
  x(template2) {
    return singular(this.expand(template2));
  }
  expand(template2) {
    return template2.replace(/\{([^}]+)\}/g, (whole, token) => {
      const range = /^#(\d+)-(\d+)$/.exec(token);
      if (range) {
        const [lo, hi] = [range[1], range[2]];
        const n = this.int(Number(lo), Number(hi));
        return lo.length > 1 && lo.startsWith("0") ? String(n).padStart(lo.length, "0") : String(n);
      }
      const letters = /^([A-Z])-([A-Z])$/.exec(token);
      if (letters) return String.fromCharCode(this.int(letters[1].charCodeAt(0), letters[2].charCodeAt(0)));
      switch (token) {
        case "name":
          return this.name();
        case "first":
          return this.pick(FIRST_NAMES);
        case "lower":
          return this.pick(FIRST_NAMES).toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
        case "time":
          return `${this.int(7, 19)}:${String(this.int(0, 11) * 5).padStart(2, "0")}`;
        case "day":
          return this.pick(DAYS);
        case "date":
          return `${this.pick(MONTHS)} ${this.int(1, 28)}`;
        case "ago":
          return this.next() < 0.5 ? `${this.int(2, 55)} min ago` : `${this.int(1, 9)} h ago`;
        default:
          return whole;
      }
    });
  }
};
function entity(pack, flow, k) {
  const n = pack.titles.length;
  const i = (k % n + n) % n;
  const ink = new Ink(hash2(`${pack.id}|${flow}|entity|${i}`));
  return {
    title: ink.x(pack.titles[i]),
    sub: ink.x(ink.pick(pack.subs)),
    status: ink.pick(pack.statuses),
    // The first meta is the one a table's column names, so every row says the same kind of thing.
    meta: ink.x(pack.meta[0]),
    category: ink.pick(pack.categories),
    person: ink.name(),
    date: ink.x(ink.pick(["{day}", "{date}", "{date}"])),
    amount: ink.x(ink.pick(pack.amount)),
    // A thing's picture is one of the domain's own objects — the pack's first three motifs.
    motif: pack.motifs[(i + hash2(flow)) % Math.min(3, pack.motifs.length)]
  };
}
var STEPS = [1, 3, 5, 7, 11, 13];
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
var Picker = class {
  constructor(pack, flow, key, slot, lead2) {
    this.pack = pack;
    this.flow = flow;
    this.key = key;
    this.slot = slot;
    this.lead = lead2;
    const seed = hash2(`${key}|${slot}`);
    this.ink = new Ink(seed);
    this.n = pack.titles.length;
    this.start = seed % this.n;
    this.step = STEPS.filter((s) => gcd(s, this.n) === 1)[seed % 3] ?? 1;
  }
  pack;
  flow;
  key;
  slot;
  lead;
  ink;
  start;
  step;
  n;
  /** The flow's focus: the entity its detail screen shows, and the first row of every lead list. */
  get focusIndex() {
    return hash2(`${this.pack.id}|${this.flow}|focus`) % this.n;
  }
  focus() {
    return entity(this.pack, this.flow, this.focusIndex);
  }
  /** n entities for this slot: the focus first in a lead slot, then a seeded walk that skips it. */
  entities(count2) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    if (this.lead) {
      out.push(this.focus());
      seen.add(this.focusIndex);
    }
    for (let j = 0; out.length < count2 && j < count2 + this.n; j++) {
      const k = (this.start + j * this.step) % this.n;
      if (seen.has(k) && seen.size < this.n) continue;
      seen.add(k);
      out.push(entity(this.pack, this.flow, k));
    }
    return out;
  }
  /** n from a list, cycling from a seeded offset (or from the start when `from0`). */
  cycle(list, count2, from0 = false) {
    const off = from0 ? 0 : this.start % list.length;
    return Array.from({ length: count2 }, (_, i) => list[(off + i) % list.length]);
  }
  x(template2) {
    return this.ink.x(template2);
  }
  sentences(count2) {
    return this.cycle(this.pack.lines, count2).map((l) => this.x(l));
  }
};
var num2 = (props, key) => Number(props[key]);
var lower = (s) => s.toLowerCase();
function rowItems(c, n, opts = {}) {
  return c.p.entities(n).map((e) => ({
    title: e.title,
    ...opts.lines === void 0 || opts.lines >= 2 ? { sub: e.sub } : {},
    status: e.status,
    meta: e.meta,
    person: e.person,
    motif: e.motif
  }));
}
function stats(c, n) {
  return c.p.cycle(c.p.pack.metrics, n, true).map((m) => ({
    label: m.label,
    value: c.p.x(m.value),
    ...m.delta ? { delta: c.p.x(m.delta) } : {},
    ...m.down ? { down: true } : {}
  }));
}
var ACCOUNT_FIELDS = [
  ["Full name", "{name}"],
  ["Email", GENERIC.email],
  ["Phone", GENERIC.phone],
  ["Language", "English"],
  ["Time zone", "GMT+{#1-9}"],
  ["Password", GENERIC.password]
];
var ACCOUNT_ARCHETYPES = /* @__PURE__ */ new Set(["sign-up", "settings"]);
function fieldPairs(c, n, skipFirst = 0) {
  const pairs = c.p.cycle(ACCOUNT_ARCHETYPES.has(c.archetype) ? ACCOUNT_FIELDS : c.p.pack.fields, n + skipFirst, true).slice(skipFirst);
  return { labels: pairs.map(([l]) => l), values: pairs.map(([, v]) => c.p.x(v)) };
}
function series(c, count2) {
  return Array.from({ length: count2 }, () => Array.from({ length: 7 }, () => c.p.ink.int(25, 95)));
}
var LEGAL_HEADS = ["Your account", "Using the service", "Payments and refunds", "Your content", "Privacy", "Ending this agreement"];
var FILLERS = {
  // ---- primitives
  image: ({ p, props }) => ({ motif: p.pack.motifs[0], ...props.caption === true ? { lines: [p.focus().title] } : {} }),
  text: ({ p, props, archetype }) => ({ lines: archetype === "welcome" ? [p.pack.pitch[1]] : p.sentences(Math.max(1, Math.ceil(num2(props, "lines") * 0.6))) }),
  "description-list": ({ p, props }) => {
    const e = p.focus();
    const c = p.pack.columns;
    const own = [[c[1], e.sub], [c[4], e.category], [c[5], e.person], [c[6], e.date], [c[7], e.amount]];
    const more = p.pack.details.filter(([l]) => !own.some(([o]) => o === l)).map(([l, v]) => [l, p.x(v)]);
    const pairs = [...own, ...more].slice(0, num2(props, "pairs"));
    return { labels: pairs.map(([l]) => l), values: pairs.map(([, v]) => v) };
  },
  chip: ({ p, props }) => ({ labels: ["All", ...p.pack.categories].slice(0, num2(props, "count")) }),
  list: (c) => ({ items: rowItems(c, num2(c.props, "rows"), { lines: num2(c.props, "lines") }) }),
  "search-field": ({ p }) => ({ labels: [`Search ${lower(p.pack.noun[1])}`], values: [lower(p.focus().category)] }),
  "segmented-control": ({ p, props }) => ({ labels: ["All", ...p.pack.statuses].slice(0, num2(props, "count")) }),
  tabs: ({ p, props }) => ({ labels: ["All", ...p.pack.categories].slice(0, num2(props, "count")) }),
  steps: ({ props }) => ({ labels: GENERIC.steps.slice(0, num2(props, "count")) }),
  chart: (c) => ({ series: series(c, num2(c.props, "series")), labels: c.p.pack.categories.slice(0, num2(c.props, "series")), values: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }),
  drawer: ({ p }) => {
    const e = p.focus();
    return { person: e.person, sub: p.x(p.pack.roles[0]) };
  },
  sheet: ({ p, props }) => props.kind === "sheet" ? { heading: p.focus().title, lines: p.sentences(2) } : void 0,
  modal: ({ p, label }) => ({ heading: `${label("action-1")} ${p.focus().title}?`, lines: p.sentences(1) }),
  // ---- blocks
  navbar: ({ p }) => ({ motif: p.pack.motifs[0] }),
  "app-shell": ({ p }) => ({ values: ["9:41", `app.example.com/${lower(p.pack.noun[1]).replace(/[^a-z]+/g, "-")}`] }),
  "page-header": ({ p }) => ({
    values: [...GENERIC.crumbs, p.pack.noun[1]],
    sub: `${p.ink.int(8, 60)} ${lower(p.pack.noun[1])} \xB7 updated ${p.x("{ago}")}`,
    labels: ["All", ...p.pack.categories].slice(0, 3)
  }),
  "sign-in-form": ({ p }) => ({ values: [p.x(GENERIC.email), GENERIC.password], lines: ["New here?"] }),
  "sign-up-form": ({ p, props }) => {
    const labels = ["Full name", "Email", "Password", "Phone", "Date of birth", "Postcode"].slice(0, num2(props, "fields"));
    const values = [p.ink.name(), p.x(GENERIC.email), GENERIC.password, p.x(GENERIC.phone), p.x("{date}, 19{#70-99}"), p.x("{A-F}{#1-9} {#1-9}{A-F}{A-F}")].slice(0, labels.length);
    return { labels, values, lines: ["I agree to the", "Already have an account?"] };
  },
  "verify-code": ({ p }) => ({ lines: [p.x(GENERIC.verifyLead[1])], values: p.x(GENERIC.code).split(""), sub: "Didn't get it?" }),
  "forgot-password": ({ p, props }) => props.step === "request" ? { lines: [GENERIC.forgotLead[1]], values: [p.x(GENERIC.email)] } : { heading: GENERIC.sentLead[0], lines: [GENERIC.sentLead[1]] },
  "onboarding-step": ({ p }) => ({ motif: p.pack.motifs[0], heading: p.pack.pitch[0], lines: [p.pack.pitch[1]] }),
  wizard: (c) => ({ groups: (c.archetype === "sign-up" ? ["Account", "Profile", "Preferences", "Review", "Verify", "Done"] : GENERIC.steps).slice(0, num2(c.props, "steps")), ...fieldPairs(c, 3), lines: [c.p.focus().title, c.p.focus().sub] }),
  "form-block": (c) => ({ ...fieldPairs(c, num2(c.props, "fields")), groups: ["Details", "More", "Notes"].slice(0, num2(c.props, "sections")) }),
  "filter-panel": ({ p, props }) => {
    const groups = [...GENERIC.filterGroups, "Owner", "Price", "More"].slice(0, num2(props, "groups"));
    const options = [p.pack.statuses, p.pack.categories, ["Today", "This week", "This month"], FIRST_NAMES.slice(0, 3), ["Under $50", "$50\u2013$200", "Over $200"], ["Saved", "Shared", "Archived"]];
    return { groups, labels: groups.flatMap((_, g) => options[g].slice(0, 3)) };
  },
  "settings-group": ({ p, props }) => {
    const rows = p.cycle(SETTINGS_ROWS, num2(props, "groups") * num2(props, "rows"), true);
    return { groups: ["General", "Account", "Privacy", "About"].slice(0, num2(props, "groups")), labels: rows.map(([l]) => l), values: rows.map(([, v]) => p.x(v)) };
  },
  "stats-row": (c) => ({ stats: stats(c, num2(c.props, "count")), ...c.props.chart === true ? { series: series(c, num2(c.props, "count")) } : {} }),
  "stacked-list": (c) => ({ items: rowItems(c, num2(c.props, "rows")), ...num2(c.props, "sections") > 0 ? { groups: GENERIC.sectionHeads.slice(0, num2(c.props, "sections")) } : {} }),
  "card-grid": (c) => ({ items: c.p.entities(num2(c.props, "items")).map((e) => ({ title: e.title, sub: e.sub, meta: e.meta, status: e.status, motif: e.motif })) }),
  "data-table": (c) => ({
    labels: [...c.p.pack.columns],
    items: c.p.entities(num2(c.props, "rows")).map((e) => ({ title: e.title, cells: [e.title, e.sub, e.status, e.meta, e.category, e.person, e.date, e.amount] }))
  }),
  "blog-list": (c) => ({ items: c.p.entities(num2(c.props, "posts")).map((e, i) => ({ title: e.title, sub: `${e.category} \xB7 ${e.date}`, text: c.p.x(c.p.pack.lines[i % c.p.pack.lines.length]), person: e.person, motif: e.motif })) }),
  "long-form": ({ p, props, archetype }) => {
    const n = num2(props, "sections");
    return { groups: archetype === "legal" ? LEGAL_HEADS.slice(0, n).map((h, i) => `${i + 1}. ${h}`) : ["About", "Details", "Notes", "More", "History", "Related"].slice(0, n), lines: p.sentences(n * 3) };
  },
  "detail-header": ({ p, props }) => {
    const e = p.focus();
    return { heading: e.title, sub: e.sub, motif: e.motif, labels: [e.status, e.category, e.date, e.amount].slice(0, num2(props, "meta")) };
  },
  "comment-list": ({ p, props }) => {
    const n = num2(props, "comments");
    return {
      heading: `${n} comments`,
      items: p.entities(n).map((e, i) => ({ title: e.person, person: e.person, text: p.x(p.pack.remarks[(i + p.focusIndex) % p.pack.remarks.length]), meta: p.x("{ago}") }))
    };
  },
  "profile-header": ({ p }) => {
    const e = p.focus();
    return { person: e.person, sub: p.x(p.pack.roles[0]), stats: p.pack.profile.map(([label, value]) => ({ label, value: p.x(value) })) };
  },
  "feed-post": ({ p, props }) => ({
    items: p.entities(num2(props, "count")).map((e, i) => ({
      title: e.title,
      person: e.person,
      meta: p.x("{ago}"),
      text: p.x(i % 2 === 0 ? p.pack.lines[(i + p.focusIndex) % p.pack.lines.length] : p.pack.remarks[i % p.pack.remarks.length]),
      sub: e.sub,
      motif: e.motif
    }))
  }),
  "gallery-section": ({ p, props }) => ({ items: p.entities(num2(props, "items")).map((e) => ({ title: e.title, motif: e.motif })) }),
  "product-card-list": ({ p, props }) => ({ items: p.entities(num2(props, "items")).map((e, i) => ({ title: e.title, meta: e.amount, sub: e.sub, motif: e.motif, rating: 3 + (i + p.focusIndex) % 3 })) }),
  "empty-state": ({ p, props }) => {
    const [heading2, line] = props.cause === "no-results" ? GENERIC.noResults : props.cause === "cleared" ? GENERIC.cleared : p.pack.empty;
    return { motif: p.pack.motifs[0], heading: heading2, lines: [p.x(line)] };
  },
  "error-state": ({ props }) => ({ lines: [GENERIC.errors[String(props.kind)] ?? GENERIC.errors.generic] }),
  "success-state": ({ p }) => {
    const e = p.focus();
    return { heading: p.pack.success[0], lines: [p.x(p.pack.success[1])], values: [e.title, e.sub, e.amount] };
  },
  "confirm-dialog": ({ p, label }) => ({ heading: `${label("confirm")} ${p.focus().title}?`, lines: p.sentences(1) })
};
function contentTitle(archetype, pack, flow, blocks = []) {
  if (blocks.includes("forgot-password")) return GENERIC.forgotLead[0];
  const focus = () => new Picker(pack, flow, flow, "title", true).focus();
  switch (archetype) {
    case "home":
      return pack.home;
    case "list":
    case "gallery":
      return pack.noun[1];
    case "detail":
      return focus().title;
    case "form":
      return `New ${lower(pack.noun[0])}`;
    case "profile":
      return focus().person;
    case "search":
      return `Search ${lower(pack.noun[1])}`;
    case "feed":
      return "Activity";
    case "welcome":
      return pack.pitch[0];
    case "sign-in":
      return GENERIC.signInLead[0];
    case "sign-up":
      return GENERIC.signUpLead[0];
    case "verify":
      return GENERIC.verifyLead[0];
    default:
      return void 0;
  }
}
function domainTitle(archetype, pack) {
  switch (archetype) {
    case "list":
    case "gallery":
      return pack.noun[1];
    case "detail":
      return pack.noun[0];
    case "form":
      return `New ${lower(pack.noun[0])}`;
    case "search":
      return `Search ${lower(pack.noun[1])}`;
    default:
      return void 0;
  }
}
function objectLabel(intent, label, noun) {
  return OBJECT_VERBS.has(intent) ? `${label} ${lower(noun)}` : void 0;
}
var OBJECT_VERBS = /* @__PURE__ */ new Set(["edit", "delete", "share", "save", "add", "submit", "upload"]);
function loneAction(pack, archetype, slot) {
  const r = recipe(archetype);
  const region = r.sections.find((s) => s.slot === slot.slot)?.region;
  const c = component(slot.block);
  const present = presentElements(c, { ...Object.fromEntries(Object.entries(c.props).map(([k, d]) => [k, d.default])), ...slot.props });
  const intentOf = (element2) => slot.intents?.[element2] ?? defaultIntent(r, c, element2);
  const named = Object.fromEntries(present.flatMap((element2) => {
    const nav = INTENT_BY_ID.get(intentOf(element2))?.nav;
    const words3 = intentOf(element2).startsWith("open-") && nav?.to === "archetype" ? domainTitle(nav.archetype, pack) : void 0;
    return words3 ? [[element2, words3]] : [];
  }));
  if (Object.keys(named).length > 0) return named;
  if (region === "header" || region === "nav") return void 0;
  if (present.length !== 1) return void 0;
  const element = present[0];
  const intent = slot.intents?.[element] ?? defaultIntent(r, c, element);
  const label = INTENT_BY_ID.get(intent)?.label ?? intent;
  const words2 = objectLabel(intent, label, c.id === "profile-header" || archetype === "profile" ? "profile" : pack.noun[0]);
  return words2 ? { [element]: words2 } : void 0;
}
function packOf(id) {
  return PACK_BY_ID.get(id ?? GENERIC_PACK) ?? PACK_BY_ID.get(GENERIC_PACK);
}
function fillSlot(pack, spec, key, slot) {
  if (!slot.block) return void 0;
  const actions = loneAction(pack, spec.archetype, { ...slot, block: slot.block });
  const filled = fillWords(pack, spec, key, { ...slot, block: slot.block });
  if (!actions) return filled;
  return { ...filled ?? {}, actions };
}
function fillWords(pack, spec, key, slot) {
  const filler = FILLERS[slot.block];
  if (!filler) return void 0;
  const c = component(slot.block);
  const props = { ...Object.fromEntries(Object.entries(c.props).map(([k, d]) => [k, d.default])), ...slot.props };
  const lead2 = slot.slot.startsWith("main");
  const p = new Picker(pack, spec.flow || key, key, slot.slot, lead2);
  const label = (element) => {
    const intent = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(recipe(spec.archetype), c, element) : element);
    return INTENT_BY_ID.get(intent)?.label ?? intent;
  };
  return filler({ p, props, archetype: spec.archetype, label });
}

// packages/modules/wireframe/src/content/flesh-spec.ts
function seedKey(spec, itemId) {
  return spec.variantOf ?? itemId;
}
function isBlueprint(spec) {
  return spec.slots.every((s) => s.block === null);
}
function fleshSpec(spec, key, pack, meta = {}) {
  if (isBlueprint(spec)) return barsSpec(spec);
  const title = contentTitle(spec.archetype, pack, spec.flow || key, spec.slots.map((s) => s.block));
  const content = {
    source: "pack",
    pack: pack.id,
    ...meta.p !== void 0 ? { p: Math.round(meta.p * 1e3) / 1e3 } : {},
    ...meta.by ? { by: meta.by } : {},
    ...title !== void 0 ? { title } : {},
    ...spec.archetype === "detail" ? { bar: pack.noun[0] } : {}
  };
  return { ...spec, title: fleshedTitle(spec, pack), content, slots: spec.slots.map((slot) => withFill(slot, fillSlot(pack, spec, key, slot))) };
}
function fleshedTitle(spec, pack) {
  const archetype = RECIPE_BY_ID.get(spec.archetype)?.title;
  const earlier = spec.content?.pack ? domainTitle(spec.archetype, packOf(spec.content.pack)) : void 0;
  if (spec.title !== archetype && (earlier === void 0 || spec.title !== earlier)) return spec.title;
  return domainTitle(spec.archetype, pack) ?? archetype ?? spec.title;
}
function barsSpec(spec) {
  const given = spec.content?.pack ? domainTitle(spec.archetype, packOf(spec.content.pack)) : void 0;
  const archetype = RECIPE_BY_ID.get(spec.archetype)?.title;
  const out = {
    ...spec,
    ...given !== void 0 && spec.title === given && archetype ? { title: archetype } : {},
    slots: spec.slots.map((slot) => withFill(slot, void 0))
  };
  delete out.content;
  return out;
}
function withFill(slot, fill) {
  const out = { ...slot };
  if (fill) out.fill = fill;
  else delete out.fill;
  return out;
}
function refill(spec, key, slots) {
  if (!spec.content) return spec;
  const pack = packOf(spec.content.pack);
  return { ...spec, slots: spec.slots.map((slot) => slots.includes(slot.slot) ? withFill(slot, fillSlot(pack, spec, key, slot)) : slot) };
}
function wordsOf(fill) {
  const out = {};
  if (!fill) return out;
  for (const key of ["heading", "sub", "person"]) if (fill[key] !== void 0) out[key] = fill[key];
  for (const key of ["lines", "labels", "values", "groups"]) fill[key]?.forEach((w, i) => out[`${key}.${i}`] = w);
  fill.items?.forEach((it, i) => {
    for (const key of ["title", "sub", "status", "meta", "person", "text"]) if (it[key] !== void 0) out[`items.${i}.${key}`] = it[key];
    it.cells?.forEach((w, j) => out[`items.${i}.cells.${j}`] = w);
  });
  fill.stats?.forEach((s, i) => {
    out[`stats.${i}.label`] = s.label;
    out[`stats.${i}.value`] = s.value;
    if (s.delta !== void 0) out[`stats.${i}.delta`] = s.delta;
  });
  Object.entries(fill.actions ?? {}).forEach(([element, w]) => {
    out[`actions.${element}`] = w;
  });
  return out;
}
function withWords(fill, words2, where) {
  const have = wordsOf(fill);
  const paths = Object.keys(have);
  const pairs = Array.isArray(words2) ? words2.map((w, i) => {
    if (i >= paths.length) throw new Error(`${where}: ${words2.length} words given, but the slot holds ${paths.length}`);
    return [paths[i], w];
  }) : Object.entries(words2);
  const out = structuredClone(fill);
  for (const [path3, word2] of pairs) {
    if (!(path3 in have)) throw new Error(`${where}: no word at "${path3}" \u2014 it holds ${paths.join(", ")}`);
    if (typeof word2 !== "string") throw new Error(`${where}: "${path3}" must be a string`);
    const parts = path3.split(".");
    let at = out;
    for (const part of parts.slice(0, -1)) at = at[part];
    at[parts[parts.length - 1]] = word2;
  }
  return out;
}
function copyOf(spec) {
  return {
    title: spec.content?.title ?? spec.title,
    content: spec.content ?? null,
    slots: spec.slots.filter((s) => s.block && s.fill).map((s) => ({ slot: s.slot, block: s.block, words: wordsOf(s.fill) }))
  };
}
function applyCopy(spec, file, by) {
  if (!spec.content) throw new Error("this screen draws bars \u2014 `isocan wire flesh <screen>` fills it first, then its words can be replaced");
  const bySlot = new Map(spec.slots.map((s) => [s.slot, s]));
  for (const name of Object.keys(file.slots ?? {})) {
    const slot = bySlot.get(name);
    if (!slot) throw new Error(`no slot "${name}" on this screen \u2014 it has ${spec.slots.map((s) => s.slot).join(", ")}`);
    if (!slot.fill) throw new Error(`slot "${name}" (${slot.block ?? "undecided"}) holds no words`);
  }
  if (file.title !== void 0 && typeof file.title !== "string") throw new Error("title must be a string");
  const slots = spec.slots.map((slot) => {
    const words2 = file.slots?.[slot.slot];
    return words2 && slot.fill ? { ...slot, fill: withWords(slot.fill, words2, `slot "${slot.slot}"`) } : slot;
  });
  const pack = spec.content.pack;
  const title = file.title ?? spec.content.title;
  if (file.bar !== void 0 && typeof file.bar !== "string") throw new Error("bar must be a string");
  const bar2 = file.bar ?? spec.content.bar;
  const content = { source: "copy", by, ...pack ? { pack } : {}, ...title !== void 0 ? { title } : {}, ...bar2 !== void 0 ? { bar: bar2 } : {} };
  return { ...spec, content, slots };
}

// packages/modules/wireframe/src/vary.ts
var VARIATION_FLOOR = 0.1;
var DEFAULT_VARIATIONS = 2;
function decisions(spec) {
  const r = recipe(spec.archetype);
  const out = [];
  const order = (slot) => r.sections.findIndex((s) => s.slot === slot);
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const section = r.sections.find((s) => s.slot === slot.slot);
    if (!section || spec.chrome && chromeFor(section, spec.chrome) !== null) continue;
    const alts = slot.alternatives ?? [];
    const block = alts.find((a) => a.block !== LEAVE_OUT);
    if (block && slot.p !== void 0) {
      out.push({ slot: slot.slot, kind: "block", from: slot.block, to: block.block, p: slot.p, runnerUp: block.p });
    }
    const out_ = alts.find((a) => a.block === LEAVE_OUT);
    if (out_) out.push({ slot: slot.slot, kind: "include", from: slot.block, to: LEAVE_OUT, p: 1 - out_.p, runnerUp: out_.p });
  }
  for (const d of spec.declined ?? []) {
    out.push({ slot: d.slot, kind: "include", from: LEAVE_OUT, to: d.block, p: d.p, runnerUp: 1 - d.p });
  }
  return out.sort((a, b) => order(a.slot) - order(b.slot));
}
var same = (a, b) => a.slot === b.slot && a.from === b.from && a.to === b.to;
function honestFlips(spec, made = []) {
  const r = recipe(spec.archetype);
  const order = (slot) => r.sections.findIndex((s) => s.slot === slot);
  return decisions(spec).filter((d) => d.runnerUp >= VARIATION_FLOOR && !made.some((m) => same(m, d))).sort((a, b) => b.runnerUp - a.runnerUp || a.p - b.p || order(a.slot) - order(b.slot));
}
function vary(spec, d, variantOf) {
  const r = recipe(spec.archetype);
  let slots = spec.slots;
  let declined = spec.declined ?? [];
  if (d.kind === "block") {
    slots = slots.map((slot) => {
      if (slot.slot !== d.slot) return slot;
      const alternatives = [{ block: d.from, p: d.p }, ...(slot.alternatives ?? []).filter((a) => a.block !== d.to)].sort((a, b) => b.p - a.p);
      return {
        ...resolveSlot(r.id, slot.slot, d.to),
        p: d.runnerUp,
        alternatives,
        ...slot.region !== void 0 ? { region: slot.region } : {}
      };
    });
  } else if (d.to === LEAVE_OUT) {
    slots = slots.filter((slot) => slot.slot !== d.slot);
    declined = [...declined, { slot: d.slot, p: d.runnerUp, block: d.from }];
  } else {
    const back = { ...resolveSlot(r.id, d.slot, d.to), p: d.runnerUp, alternatives: [{ block: LEAVE_OUT, p: d.p }] };
    const at = r.sections.findIndex((s) => s.slot === d.slot);
    const before = slots.filter((slot) => r.sections.findIndex((s) => s.slot === slot.slot) < at);
    slots = [...before, back, ...slots.slice(before.length)];
    declined = declined.filter((x) => x.slot !== d.slot);
  }
  const out = {
    ...spec,
    slots,
    declined,
    variantOf,
    flip: { slot: d.slot, from: d.from, to: d.to },
    round: 3
  };
  delete out.varied;
  if (declined.length === 0) delete out.declined;
  return refill(out, variantOf, [d.slot]);
}
function variations(spec, variantOf, count2 = DEFAULT_VARIATIONS, made = []) {
  const room = Math.max(0, count2 - made.length);
  return honestFlips(spec, made).slice(0, room).map((d) => vary(spec, d, variantOf));
}

// packages/modules/wireframe/src/content/choose.ts
var PACK_FLOOR = 0.4;
function packRequest(request) {
  return {
    model: JEV_MODEL,
    state: { request },
    questions: {
      pack: {
        type: "choice",
        instructions: "Which domain does the product in the request belong to? Its screens will be filled with that domain's sample nouns, people, numbers and pictures. Choose generic when no other fits.",
        criteria: Object.fromEntries(PACKS.map((p) => [p.id, `${p.name}: ${p.about}`]))
      }
    }
  };
}
function readPackChoice(request, response, by) {
  const { value, p, distribution } = chosenOption(request.questions.pack, response.answers.pack);
  const known = PACK_BY_ID.has(value) ? value : GENERIC_PACK;
  return { pack: p >= PACK_FLOOR ? known : GENERIC_PACK, p, leaned: known, by, how: "asked", distribution, inputTokens: response.usage?.input_tokens ?? 0 };
}
async function choosePack(answerer, request) {
  const req = packRequest(request);
  const answered = await answerer.answer(req);
  return { ...readPackChoice(req, answered.response, answered.by), ms: answered.ms };
}
function flagPack(id) {
  if (!PACK_BY_ID.has(id)) throw new Error(`no pack "${id}" \u2014 the packs are: ${PACKS.map((p) => p.id).join(", ")}`);
  return { pack: id, p: 1, leaned: id, by: "--pack", how: "flag" };
}
function packLine(c, flowWords) {
  const name = PACK_BY_ID.get(c.pack)?.name ?? c.pack;
  if (c.how === "flag") return `pack: ${c.pack} (${name}) \u2014 chosen with --pack \xB7 ${flowWords}`;
  if (c.how === "reused") return `pack: ${c.pack} (${name}) \u2014 already on these screens, nothing asked \xB7 ${flowWords}`;
  const top = Object.entries(c.distribution ?? {}).sort((a, b) => b[1] - a[1]).slice(1, 3).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
  const under = c.p < PACK_FLOOR ? ` \u2014 under ${PACK_FLOOR}, so the generic pack fills${c.leaned !== c.pack ? ` (--pack ${c.leaned} to take the lean)` : ""}` : "";
  return `pack: ${c.leaned} p ${c.p.toFixed(2)}${top ? ` (then ${top})` : ""}${under} \xB7 chosen by ${c.by} \xB7 ${flowWords}`;
}

// packages/modules/wireframe/src/maybe.ts
var MAYBE_PROP = "wireMaybe";
function maybeProperties(spec) {
  return spec.maybe ? { [MAYBE_PROP]: (spec.need ?? 0).toFixed(2) } : {};
}

// packages/modules/wireframe/src/flow.ts
var GAP = 80;
function slugOf(title) {
  return titleSlug(title, { max: 60 }) || "screen";
}
var FlowCanvas = class {
  constructor(port, group) {
    this.port = port;
    this.group = group;
  }
  port;
  group;
  /** Variations this run added, in the order they landed. */
  variants = [];
  /**
   * The governing design system's mapping (design §9), stamped on every spec
   * this canvas writes that has none of its own — so a flow asked for where a
   * system governs arrives in it. Unset: the default look.
   */
  style;
  /**
   * The group every item this canvas adds lands in — `wire --in <group>`'s,
   * or the source screen's for a variation. Sent as the op's own
   * `containerId` (not inside `placement`), which both surfaces' writers read.
   */
  into;
  /**
   * The pack a composed flow fills from (design §10): stamped on every
   * screen as round 3 draws it, so the flow arrives fleshed — no second pass.
   */
  pack;
  /**
   * Who is drawing (`WireSpec.by`): stamped on every spec this canvas writes
   * once an answerer has spoken — the composer sets it when round 1 answers,
   * `wire answer` for an agent, `wire vary` from the screen it varies.
   */
  by;
  /**
   * Root decisions pinned via `--pin key=value` or `/ask` disambiguation
   * (design §12), stamped on every non-blueprint spec this flow writes.
   */
  pinned;
  styled(given, itemId) {
    const signed = this.by && given.round !== 0 ? { ...given, by: this.by } : given;
    const withPinned = given.round !== 0 ? applyPinnedToSpecs([signed], this.pinned)[0] : signed;
    const spec = this.style && withPinned.style === void 0 ? { ...withPinned, style: this.style } : withPinned;
    if (!this.pack || spec.round !== 3 || spec.content) return spec;
    return fleshSpec(spec, seedKey(spec, itemId), packOf(this.pack.pack), { p: this.pack.p, by: this.pack.by });
  }
  async version(spec) {
    const filename = `${slugOf(wireTitle(spec))}.html`;
    const upload = await this.port.put(renderWire(spec), "text/html", filename);
    return { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  }
  send(op) {
    return this.port.send(op, this.group);
  }
  async add(given, placement, into = this.into) {
    const itemId = newItemId();
    const spec = this.styled(given, itemId);
    const { width, height } = wireSize(spec);
    const at = await this.send({
      type: "item.add",
      itemId,
      version: await this.version(spec),
      width,
      height,
      placement,
      title: wireTitle(spec),
      // A maybe says so in the op that draws it; the canvas marks it until it is kept (maybe.ts).
      properties: { [FIDELITY_PROP]: "wireframe", ...maybeProperties(spec) },
      ...into ?? {}
    });
    const landed = at ?? placement;
    return { item: itemId, spec, x: landed.x ?? 0, y: landed.y ?? 0, width, height, ...into ? { containerId: into.containerId } : {} };
  }
  /** A new version of the same item — the screen fills in place — and its title and size if they moved. */
  async write(screen, given) {
    const spec = this.styled(given, screen.item);
    await this.send({ type: "item.addVersion", itemId: screen.item, version: await this.version(spec) });
    const maybe = maybeProperties(spec);
    const retitled = wireTitle(spec) !== wireTitle(screen.spec);
    const newlyMaybe = spec.maybe === true && !screen.spec.maybe;
    if (retitled || newlyMaybe) {
      await this.send({ type: "item.update", itemId: screen.item, patch: { ...retitled ? { title: wireTitle(spec) } : {}, ...newlyMaybe ? { properties: maybe } : {} } });
    }
    const { width, height } = wireSize(spec);
    if (width !== screen.width || height !== screen.height) await this.send({ type: "item.resize", itemId: screen.item, width, height });
    return { ...screen, spec, width, height };
  }
};
var PROTOTYPE_ROOM = PROTOTYPE_CLEAR + 1e3;
function rowStart(canvas, room = 0) {
  const items = Object.values(canvas.items ?? {});
  if (items.length === 0) return { x: 0, y: 0, chosen: true };
  const left = Math.min(...items.map((i) => i.x));
  const bottom = Math.max(...items.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160 + room), chosen: true };
}
function rowStartIn(canvas, groupId, room = 0) {
  const group = canvas.items[groupId];
  if (!group) throw new Error(`no group ${groupId} on this canvas`);
  const inside = groupDescendants(canvas, groupId);
  if (inside.length === 0) {
    const box = groupContentBox(group);
    return { x: Math.round(box.x), y: Math.round(box.y), chosen: true };
  }
  const left = Math.min(...inside.map((i) => i.x));
  const bottom = Math.max(...inside.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160 + room), chosen: true };
}
async function ask(answerer, round, calls, onAsked) {
  const t0 = Date.now();
  let by = answerer.name;
  const answered = await Promise.all(calls.map(async (call) => {
    if (Object.keys(call.request.questions).length === 0) return { response: { answers: {} }, asked: false };
    const a = await answerer.answer(call.request);
    by = a.by;
    return { response: a.response, asked: true };
  }));
  const ms = Date.now() - t0;
  const responses = answered.map((a) => a.response);
  await onAsked?.(round, calls, responses);
  return {
    responses,
    by,
    tally: {
      round,
      calls: answered.filter((a) => a.asked).length,
      ms,
      inputTokens: responses.reduce((sum, r) => sum + (r.usage?.input_tokens ?? 0), 0)
    }
  };
}
var pct = (p) => p === void 0 ? "\u2014" : p.toFixed(2);
var MAYBE_WORDS = "maybe \u2014 round 1 was unsure it is needed; use it in the prototype (\u{1F4D0}) or leave it";
function describeFlow(d) {
  const chosen = d.archetypes.map((a) => `${a.id} ${pct(a.p)}${a.maybe ? " (maybe)" : ""}`).join(", ");
  const declined = d.declined.map((a) => `${a.id} ${pct(a.p)}${a.why === "platform" ? ` (not on ${d.platform})` : ""}`).join(", ");
  return `flow: ${d.platform} ${pct(d.distributions.platform[d.platform])} \xB7 nav ${d.chrome.nav} ${pct(d.distributions.nav[d.chrome.nav])} \xB7 header ${d.chrome.header} ${pct(d.distributions.header[d.chrome.header])}
  screens: ${chosen}
  declined: ${declined || "none"}`;
}
function screenLine(s, note) {
  const open = s.spec.slots.filter((x) => x.block === null).length;
  const state = open === 0 ? "wireframe" : open === s.spec.slots.length ? "blueprint" : `${s.spec.slots.length - open} of ${s.spec.slots.length} slots chosen`;
  return `${s.item}  ${wireTitle(s.spec)} \u2014 ${s.spec.archetype}, ${s.spec.platform}, ${state}${note ? ` \xB7 ${note}` : ""}`;
}
async function applyRound(canvas, round, screens, calls, responses, say) {
  if (round === 1) {
    const first = screens[0];
    const decision = decideFlow(calls[0].request, responses[0]);
    say(describeFlow(decision));
    const specs2 = decision.archetypes.map((a) => flowScreen(a.id, first.spec.request, first.spec.flow, decision));
    const out2 = [await canvas.write(first, specs2[0])];
    for (const spec of specs2.slice(1)) {
      const prev = out2[out2.length - 1];
      out2.push(await canvas.add(spec, { x: prev.x + prev.width + GAP, y: prev.y, chosen: true }));
    }
    out2.forEach((s, i) => say(screenLine(s, `p(yes) ${pct(decision.archetypes[i].p)}${s.spec.maybe ? ` \xB7 ${MAYBE_WORDS}` : ""}`)));
    return out2;
  }
  const specs = round === 2 ? screens.map((screen, i) => applyStructure(screen.spec, calls[i].request, responses[i])) : applyPropsRound(screens.map((s) => s.spec), calls.map((c) => c.request), responses).map((spec) => honestFlips(spec).length === 0 ? { ...spec, varied: "none" } : spec);
  const out = [];
  for (const [i, screen] of screens.entries()) out.push(await canvas.write(screen, specs[i]));
  if (round === 3) {
    for (const s of out) {
      if (s.spec.maybe) {
        say(screenLine(s, "maybe \u2014 no variations until it is in the prototype (`wire vary` draws them)"));
        continue;
      }
      const made = await addVariations(canvas, s, [], DEFAULT_VARIATIONS);
      say(screenLine(s, s.spec.varied === "none" ? "one way to draw this" : `${made.length} variation${made.length === 1 ? "" : "s"}`));
      for (const v of made) say(`  ${screenLine(v, "")}`);
    }
  }
  return out;
}
async function addVariations(canvas, screen, siblings, count2) {
  const specs = variations(screen.spec, screen.item, count2, siblings.map((v) => v.spec.flip).filter(Boolean));
  const made = [];
  let bottom = Math.max(screen.y + screen.height, ...siblings.map((v) => v.y + v.height));
  const into = canvas.into ?? (screen.containerId ? { containerId: screen.containerId, groupPlacement: "exact" } : void 0);
  for (const spec of specs) {
    const v = await canvas.add(spec, { x: screen.x, y: bottom + GAP, chosen: true }, into);
    bottom = v.y + v.height;
    made.push(v);
    canvas.variants.push(v);
  }
  return made;
}
async function wiresOn(port, canvas) {
  const items = Object.values(canvas.items ?? {}).filter((i) => i.properties?.[FIDELITY_PROP] === "wireframe");
  const read = await Promise.all(items.map(async (item) => {
    const current = currentVersionOf(item);
    if (!current || current.mimeType !== "text/html") return null;
    const spec = readWire(await port.readText(current.blobHash));
    return spec ? { item: item.id, spec, x: item.x, y: item.y, width: item.width, height: item.height, ...item.containerId ? { containerId: item.containerId } : {} } : null;
  }));
  return read.filter((s) => s !== null);
}
async function flowsOn(port, canvas) {
  const flows = /* @__PURE__ */ new Map();
  const order = (s) => RECIPES.findIndex((r) => r.id === s.spec.archetype);
  for (const s of await wiresOn(port, canvas)) {
    if (!s.spec.flow || s.spec.variantOf) continue;
    flows.set(s.spec.flow, [...flows.get(s.spec.flow) ?? [], s]);
  }
  for (const list of flows.values()) list.sort((a, b) => order(a) - order(b));
  return flows;
}
function pickFlow(flows, wanted) {
  if (wanted) {
    const screens = flows.get(wanted);
    if (!screens) throw new Error(`no wireframe flow "${wanted}" on this canvas`);
    const round = pendingRound(screens.map((s) => s.spec));
    if (!round) throw new Error(`flow ${wanted} is drawn \u2014 every screen has answered all three rounds`);
    return { flow: wanted, screens, round };
  }
  const pending = [...flows.entries()].flatMap(([flow, screens]) => {
    const round = pendingRound(screens.map((s) => s.spec));
    return round ? [{ flow, screens, round }] : [];
  });
  if (pending.length === 0) throw new Error('no wireframe flow on this canvas is waiting on answers \u2014 `isocan wire "<request>" --answerer agent` starts one');
  return pending[pending.length - 1];
}
async function styleAt(port, itemId, mapper) {
  const canvas = await port.canvas();
  const item = canvas.items[itemId];
  const system = item ? governingSystem(canvas, item) : null;
  const style = await mapper.styleFor(system);
  if (!system) return { system, style, lines: [] };
  const m = [...mapper.mappings.values()].find((x) => x.system.id === system.id);
  const cost = mapper.calls ? ` \xB7 ${mapper.inputTokens.toLocaleString("en-US")} input tokens \xB7 $${mapper.cost().toFixed(6)}` : "";
  return { system, style, lines: [`style: in the design system that governs here${cost}`, ...mappingLines(m, mapper.who).map((l) => `  ${l}`)] };
}
async function startFlow(port, request, placement, room = 0) {
  const flow = newGroupId();
  const canvas = new FlowCanvas(port, flow);
  const { containerId, groupPlacement, ...spot } = placement ?? rowStart(await port.canvas(), room);
  if (typeof containerId === "string") canvas.into = { containerId, groupPlacement: "exact" };
  const where = typeof containerId === "string" && groupPlacement !== "exact" ? rowStartIn(await port.canvas(), containerId, room) : spot;
  const first = await canvas.add(requestBlueprint(request, flow), where);
  return { canvas, first, flow };
}
async function composeFlow(port, request, answerer, opts = {}) {
  const say = opts.say ?? (() => {
  });
  const gate = opts.priorityGate ?? new PriorityGate();
  const gatedAnswerer = gate.asAnswerer(answerer, "normal");
  const activePinned = { ...opts.pinned ?? {} };
  const t0 = Date.now();
  const { canvas, first, flow } = await startFlow(port, request, opts.placement, opts.flesh === false ? 0 : PROTOTYPE_ROOM);
  if (Object.keys(activePinned).length > 0) canvas.pinned = activePinned;
  const firstMs = Date.now() - t0;
  await opts.onBlueprint?.(first, firstMs, flow);
  const mapper = new StyleResolver(port, opts.mappingAnswerer ?? gatedAnswerer, async () => (await wiresOn(port, await port.canvas())).map((s) => s.spec), opts.onMappingAsked);
  const styling = styleAt(port, first.item, mapper);
  styling.catch(() => {
  });
  const fleshWith = opts.flesh === false ? void 0 : opts.flesh ?? {};
  const packPin = activePinned.pack ?? fleshWith?.pack;
  const choosing = fleshWith ? (packPin !== void 0 ? Promise.resolve(flagPack(packPin)) : choosePack(gatedAnswerer, request)).catch((e) => e instanceof Error ? e : new Error(String(e))) : void 0;
  let screens = [first];
  const tallies = [];
  let by = answerer.name;
  let askedGates;
  for (const round of [1, 2, 3]) {
    const calls = roundCalls(round, screens);
    const asked = await ask(gatedAnswerer, round, calls, opts.onAsked);
    tallies.push(asked.tally);
    by = asked.by;
    canvas.by = wireBy(by, port.actor);
    if (round === 1) {
      const gateResult = gateFlowDecision(calls[0].request, asked.responses[0], {
        pinned: activePinned,
        ...opts.noAsk !== void 0 ? { noAsk: opts.noAsk } : {}
      });
      if (gateResult.asks.length > 0) {
        askedGates = gateResult.asks;
        if (opts.onGateAsk) {
          for (const q of gateResult.asks) {
            const comment = formatAskComment(q);
            say(comment);
            const picked = await opts.onGateAsk(q, comment);
            if (picked) activePinned[q.key] = picked;
          }
        }
      }
      if (Object.keys(activePinned).length > 0) {
        canvas.pinned = { ...activePinned };
        const prevPlatform = asked.responses[0]?.answers.platform;
        if (activePinned.platform && prevPlatform?.type === "choice") {
          asked.responses[0] = {
            ...asked.responses[0],
            answers: {
              ...asked.responses[0].answers,
              platform: {
                type: "choice",
                choice: activePinned.platform,
                probabilities: {
                  ...Object.fromEntries(Object.keys(prevPlatform.probabilities).map((k) => [k, 0])),
                  [activePinned.platform]: 1
                }
              }
            }
          };
        }
      }
      const styled = await styling;
      canvas.style = styled.system ? styled.style : void 0;
      for (const line of styled.lines) say(line);
    }
    if (round === 3 && choosing) {
      const chosen = await choosing;
      if (chosen instanceof Error) {
        say(`no pack: ${chosen.message} \u2014 the screens stay in grey bars; \`wire flesh\` fills them later`);
      } else {
        canvas.pack = chosen;
        say(packLine(chosen, "the screens arrive fleshed"));
        if (chosen.how === "asked" && tallies[0]) {
          tallies[0].calls += 1;
          tallies[0].inputTokens += chosen.inputTokens ?? 0;
        }
      }
    }
    screens = await applyRound(canvas, round, screens, calls, asked.responses, say);
  }
  const prototype = fleshWith ? await prototypeOfFirstChoices(canvas, screens, say) : void 0;
  return {
    flow,
    screens,
    variants: canvas.variants,
    tallies,
    by,
    firstMs,
    totalMs: Date.now() - t0,
    style: canvas.style,
    mapper,
    ...canvas.pack ? { pack: canvas.pack } : {},
    ...prototype ? { prototype } : {},
    ...canvas.pinned ? { pinned: canvas.pinned } : {},
    ...askedGates ? { askedGates } : {}
  };
}
async function prototypeOfFirstChoices(canvas, screens, say = () => {
}) {
  const picked = firstChoices(screens);
  if (picked.length === 0) {
    say("no prototype: round 1 was confident of no screen \u2014 use the ones that belong (\u{1F4D0}), then `wire prototype`");
    return void 0;
  }
  const answerer = canvas.by?.answerer ?? "jev";
  for (const s of picked) await canvas.port.send({ type: "item.update", itemId: s.item, patch: keepPatch(true, answerer) }, canvas.group);
  const now = await canvas.port.canvas();
  const flow = keptFlowsOf(now, [...screens, ...canvas.variants]).find((f) => f.flow === picked[0].spec.flow);
  if (!flow) return void 0;
  const written = await writePrototype(canvas.port, now, flow, canvas.group);
  const inIt = flow.items.map((i) => picked.find((s) => s.item === i.id)).filter(Boolean);
  const line = prototypeWords(inIt.length, answerer);
  say(`${written.itemId}  "${written.title}" \u2014 ${line}`);
  return { itemId: written.itemId, title: written.title, links: written.links, screens: inIt, answerer };
}
function prototypeWords(screens, answerer) {
  const whose = answerer === "stub" ? "the stub's" : answerer === "agent" ? "the agent's" : "Jev's";
  return `prototype of ${screens} screen${screens === 1 ? "" : "s"}, ${whose} first choices`;
}
function costLine(tallies, by, screens, maybe = 0) {
  const tokens = tallies.reduce((s, t) => s + t.inputTokens, 0);
  const calls = tallies.reduce((s, t) => s + t.calls, 0);
  const rounds = tallies.map((t) => `round ${t.round} ${t.ms} ms`).join(" \xB7 ");
  return `${screens} screens${maybe ? ` (${maybe} maybe)` : ""}, one op group \u2014 answered by ${by} \xB7 ${rounds} \xB7 ${calls} calls \xB7 ${tokens.toLocaleString("en-US")} input tokens \xB7 $${(tokens * JEV_INPUT_PRICE).toFixed(6)}`;
}

// packages/modules/wireframe/src/web-port.ts
function webPort(canvasId, host) {
  return {
    canvasId,
    actor: host.viewer ? { id: host.viewer.id, name: host.viewer.name } : void 0,
    canvas: async () => host.getCanvas(),
    readText: (blobHash) => host.readText(blobHash),
    put: (text, mimeType, filename) => host.putBlob(new Blob([text], { type: mimeType }), filename),
    send: async (op, group) => {
      await host.send([op], group);
      if (op.type !== "item.add") return;
      const landed = host.getCanvas().items[op.itemId];
      return landed ? { x: landed.x, y: landed.y } : void 0;
    }
  };
}

// packages/modules/wireframe/src/follow.ts
async function followMarks(port, changed, group) {
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const moved = new Set(changed);
  const flowsOfChanged = new Set(all.filter((w) => moved.has(w.item)).map((w) => w.spec.flow));
  const kept2 = keptFlowsOf(canvas, all);
  const out = [];
  for (const proto of Object.values(canvas.items).filter((i) => i.properties?.[PROTOTYPE_PROP] !== void 0)) {
    const flow = proto.properties[PROTOTYPE_PROP];
    const current = kept2.find((f) => f.flow === flow);
    const linksToChanged = Object.values(canvas.items).some((i) => all.some((w) => w.item === i.id && w.spec.flow === flow) && Object.values(overridesOf(i.properties)).some((to) => moved.has(to)));
    if (!flowsOfChanged.has(flow) && !linksToChanged) continue;
    if (!current) {
      out.push({ flow, itemId: proto.id, what: "left", screens: 0 });
      continue;
    }
    const written = await writePrototype(port, canvas, current, group);
    out.push({ flow, itemId: written.itemId, what: written.what === "added" ? "versioned" : written.what, screens: current.screens.length });
  }
  return out;
}
async function followOnWeb({ canvasId, group, changed, host }) {
  await followMarks(webPort(canvasId, host), changed.map((i) => i.id), group);
}
function followedLine(f) {
  if (f.what === "left") return `prototype ${f.itemId} left as it was \u2014 nothing of its flow is in it now; \`isocan wire use <screens...>\` puts some back`;
  if (f.what === "unchanged") return `prototype ${f.itemId} already plays these ${f.screens} screens`;
  return `prototype ${f.itemId} follows \u2014 it plays ${f.screens} screen${f.screens === 1 ? "" : "s"} now${f.what === "moved" ? ", back above its flow" : ""}`;
}

// packages/modules/wireframe/src/command.ts
var wireframeCore = {
  ...wireframeModule,
  marks: [{ ...KEEP_MARK, follow: followOnWeb }],
  propertyKeys: [...WIRE_PROPERTY_KEYS],
  commands: [WIRE_COMMAND]
};

// packages/modules/wireframe/src/edit.ts
var EDIT_KINDS = ["content", "add", "remove", "variant", "restyle"];
function scopeEdit(spec, edit) {
  const r = recipe(spec.archetype);
  if (edit.kind === "content") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to update content on`);
    const slots2 = spec.slots.map((s, i) => {
      if (i !== idx) return s;
      const mergedFill = { ...s.fill ?? {}, ...edit.fill ?? {} };
      return { ...s, fill: mergedFill };
    });
    return {
      ...spec,
      slots: slots2,
      content: spec.content ?? { source: "copy", by: spec.by?.model ?? spec.by?.answerer ?? "agent" }
    };
  }
  if (edit.kind === "variant") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to vary`);
    const current = spec.slots[idx];
    const section = r.sections.find((s) => s.slot === edit.slot);
    const nextBlock = edit.block ?? current.block;
    if (!nextBlock) throw new Error(`slot "${edit.slot}" is undecided \u2014 give a block to resolve it`);
    if (section && !section.options.includes(nextBlock)) {
      throw new Error(`slot "${edit.slot}" on ${r.id} accepts ${section.options.join(", ")} \u2014 not "${nextBlock}"`);
    }
    const baseSlot = nextBlock !== current.block ? resolveSlot(r.id, edit.slot, nextBlock, edit.props) : (() => {
      const c = component(nextBlock);
      const mergedProps = { ...current.props, ...edit.props ?? {} };
      const present = presentElements(c, mergedProps);
      const resolved2 = resolveSlot(r.id, edit.slot, nextBlock, mergedProps);
      const intents = present.length > 0 ? Object.fromEntries(present.map((el) => [el, current.intents?.[el] ?? resolved2.intents[el]])) : void 0;
      return {
        ...current,
        props: resolved2.props,
        ...intents ? { intents } : {}
      };
    })();
    const updatedSlot = {
      ...baseSlot,
      ...current.p !== void 0 && nextBlock === current.block ? { p: current.p } : {},
      ...current.alternatives && nextBlock === current.block ? { alternatives: current.alternatives } : {},
      ...edit.region ?? current.region ? { region: edit.region ?? current.region } : {},
      ...current.fill && nextBlock === current.block ? { fill: current.fill } : {}
    };
    const slots2 = spec.slots.map((s, i) => i === idx ? updatedSlot : s);
    return { ...spec, slots: slots2 };
  }
  if (edit.kind === "add") {
    const section = r.sections.find((s) => s.slot === edit.slot);
    if (!section) {
      throw new Error(`${r.id} has no section "${edit.slot}" \u2014 valid sections: ${r.sections.map((s) => s.slot).join(", ")}`);
    }
    const chosenBlock = edit.block ?? spec.declined?.find((d) => d.slot === edit.slot)?.block ?? section.options[0];
    if (!section.options.includes(chosenBlock)) {
      throw new Error(`slot "${edit.slot}" on ${r.id} accepts ${section.options.join(", ")} \u2014 not "${chosenBlock}"`);
    }
    const resolved2 = resolveSlot(r.id, edit.slot, chosenBlock, edit.props);
    const newSlot = {
      ...resolved2,
      ...edit.region ? { region: edit.region } : {},
      ...edit.fill ? { fill: edit.fill } : {}
    };
    const existingIdx = spec.slots.findIndex((s) => s.slot === edit.slot);
    let slots2;
    if (existingIdx >= 0) {
      slots2 = spec.slots.map((s, i) => i === existingIdx ? newSlot : s);
    } else {
      const order = r.sections.map((s) => s.slot);
      const targetOrder = order.indexOf(edit.slot);
      slots2 = [...spec.slots];
      const insertAt = slots2.findIndex((s) => order.indexOf(s.slot) > targetOrder);
      if (insertAt < 0) slots2.push(newSlot);
      else slots2.splice(insertAt, 0, newSlot);
    }
    const nextDeclined = (spec.declined ?? []).filter((d) => d.slot !== edit.slot);
    const out = { ...spec, slots: slots2 };
    if (nextDeclined.length > 0) out.declined = nextDeclined;
    else delete out.declined;
    return out;
  }
  if (edit.kind === "remove") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to remove`);
    const removed = spec.slots[idx];
    const section = r.sections.find((s) => s.slot === edit.slot);
    const slots2 = spec.slots.filter((_, i) => i !== idx);
    const nextDeclined = [...(spec.declined ?? []).filter((d) => d.slot !== edit.slot)];
    if (section?.optional && removed.block) {
      nextDeclined.push({ slot: edit.slot, p: 1, block: removed.block });
    }
    return {
      ...spec,
      slots: slots2,
      ...nextDeclined.length > 0 ? { declined: nextDeclined } : {}
    };
  }
  const nextTemplate = edit.template && TEMPLATE_IDS.includes(edit.template) ? edit.template : spec.template;
  const nextDensity = edit.density && DENSITY_LEVELS.includes(edit.density) ? edit.density : spec.density;
  const slots = edit.region ? spec.slots.map((s) => s.slot === edit.slot ? { ...s, region: edit.region } : s) : spec.slots;
  return {
    ...spec,
    slots,
    ...nextTemplate ? { template: nextTemplate } : {},
    ...nextDensity ? { density: nextDensity } : {}
  };
}
async function planEditWithJev(screens, instruction, answerer, targetScreenId) {
  if (screens.length === 0) {
    throw new Error("no wireframe screens on this canvas to edit");
  }
  let screen;
  let by = answerer.name;
  if (targetScreenId) {
    screen = screens.find((s) => s.item === targetScreenId || s.spec.title.toLowerCase() === targetScreenId.toLowerCase());
    if (!screen) throw new Error(`no wireframe screen "${targetScreenId}" on this canvas`);
  } else if (screens.length === 1) {
    screen = screens[0];
  } else {
    const pickReq = {
      model: JEV_MODEL,
      state: { instruction, screens: screens.map((s) => ({ id: s.item, title: s.spec.title, archetype: s.spec.archetype })) },
      questions: {
        screen: {
          type: "choice",
          instructions: "Which wireframe screen should this edit instruction apply to?",
          criteria: Object.fromEntries(screens.map((s) => [s.item, `${s.spec.title} (${s.spec.archetype})`]))
        }
      }
    };
    const picked = await answerer.answer(pickReq);
    by = picked.by;
    const itemId = chosenOption(pickReq.questions.screen, picked.response.answers.screen).value;
    screen = screens.find((s) => s.item === itemId) ?? screens[0];
  }
  const r = recipe(screen.spec.archetype);
  const allSlots = r.sections.map((s) => s.slot);
  const presentSlots = screen.spec.slots.map((s) => s.slot);
  const slotChoices = allSlots.length > 0 ? allSlots : presentSlots;
  const questions2 = {
    kind: {
      type: "choice",
      instructions: "What kind of surgical edit does the instruction ask for?",
      criteria: {
        variant: "Swap a slot's block or adjust its component props",
        content: "Change the heading, labels, or sample text inside a slot",
        add: "Add or restore an optional section on the screen",
        remove: "Remove an optional section from the screen",
        restyle: "Adjust layout template, region assignment, or spacing density"
      }
    },
    slot: {
      type: "choice",
      instructions: "Which slot on the screen does the instruction target?",
      criteria: Object.fromEntries(
        r.sections.map((s) => [s.slot, `${s.region} (${s.options.join(" | ")}${s.optional ? ", optional" : ""})`])
      )
    },
    density: {
      type: "choice",
      instructions: "If the instruction adjusts spacing density, which density should apply?",
      criteria: {
        compact: "Tight 8px spacing",
        default: "Balanced 12px spacing",
        spacious: "Airy 16px spacing"
      }
    }
  };
  for (const s of r.sections) {
    if (s.options.length > 1) {
      questions2[`block:${s.slot}`] = {
        type: "choice",
        instructions: `If slot ${s.slot} changes block, which block should fill it?`,
        criteria: Object.fromEntries(s.options.map((o) => [o, o.replace(/-/g, " ")]))
      };
    }
  }
  const editReq = {
    model: JEV_MODEL,
    state: {
      instruction,
      screen: screen.spec.title,
      archetype: screen.spec.archetype,
      slots: screen.spec.slots.map((s) => ({ slot: s.slot, block: s.block })),
      declined: screen.spec.declined ?? []
    },
    questions: questions2
  };
  const answered = await answerer.answer(editReq);
  by = answered.by;
  const kind = chosenOption(questions2.kind, answered.response.answers.kind).value;
  const chosenSlot = slotChoices.includes(chosenOption(questions2.slot, answered.response.answers.slot).value) ? chosenOption(questions2.slot, answered.response.answers.slot).value : presentSlots[0] ?? slotChoices[0];
  const targetSlot = (kind === "remove" || kind === "variant" || kind === "content") && !presentSlots.includes(chosenSlot) ? presentSlots.find((s) => s.startsWith("main")) ?? presentSlots[0] : chosenSlot;
  const section = r.sections.find((s) => s.slot === targetSlot);
  const blockQ = questions2[`block:${targetSlot}`];
  const blockA = answered.response.answers[`block:${targetSlot}`];
  const chosenBlock = blockQ && blockA ? chosenOption(blockQ, blockA).value : section?.options[0];
  const chosenDensity = chosenOption(questions2.density, answered.response.answers.density).value;
  const edit = {
    kind,
    slot: targetSlot,
    ...kind === "variant" || kind === "add" ? chosenBlock ? { block: chosenBlock } : {} : {},
    ...kind === "content" ? { fill: { heading: instruction } } : {},
    ...kind === "restyle" ? { density: chosenDensity } : {}
  };
  return { screen, edit, by };
}
async function editWireOnCanvas(port, instruction, answerer, opts = {}) {
  const beforeCanvas = await port.canvas();
  const all = await wiresOn(port, beforeCanvas);
  const primaryScreens = all.filter((s) => !s.spec.variantOf);
  const pool = opts.screenId ? all : primaryScreens.length > 0 ? primaryScreens : all;
  const planned = opts.edit ? (() => {
    const target = opts.screenId ? pool.find((s) => s.item === opts.screenId || s.spec.title.toLowerCase() === opts.screenId.toLowerCase()) : pool[0];
    if (!target) throw new Error(opts.screenId ? `no wireframe screen "${opts.screenId}" on this canvas` : "no wireframe screens on this canvas");
    return { screen: target, edit: opts.edit, by: answerer.name };
  })() : await planEditWithJev(pool, instruction, answerer, opts.screenId);
  const previous = planned.screen.spec;
  const nextSpec = {
    ...scopeEdit(previous, planned.edit),
    by: wireBy(planned.by, port.actor)
  };
  const group = newGroupId();
  const title = wireTitle(nextSpec);
  const filename = `${titleSlug(title, { max: 60 }) || "screen"}.html`;
  const html = renderWire(nextSpec);
  const upload = await port.put(html, "text/html", filename);
  const version = {
    id: newVersionId(),
    blobHash: upload.blobHash,
    mimeType: "text/html",
    filename,
    size: upload.size
  };
  await port.send({ type: "item.addVersion", itemId: planned.screen.item, version }, group);
  const { width, height } = wireSize(nextSpec);
  if (title !== wireTitle(previous)) {
    await port.send({ type: "item.update", itemId: planned.screen.item, patch: { title } }, group);
  }
  if (width !== planned.screen.width || height !== planned.screen.height) {
    await port.send({ type: "item.resize", itemId: planned.screen.item, width, height }, group);
  }
  const updatedScreen = {
    ...planned.screen,
    spec: nextSpec,
    width,
    height
  };
  const afterCanvas = await port.canvas();
  const afterWires = await wiresOn(port, afterCanvas);
  const keptFlows2 = keptFlowsOf(afterCanvas, afterWires);
  const affectedFlow = keptFlows2.find((f) => f.items.some((i) => i.id === updatedScreen.item));
  let prototype;
  if (affectedFlow) {
    const written = await writePrototype(port, afterCanvas, affectedFlow, group);
    prototype = { itemId: written.itemId, title: written.title };
  }
  return {
    group,
    screen: updatedScreen,
    previous,
    edit: planned.edit,
    by: planned.by,
    ...prototype ? { prototype } : {}
  };
}

// packages/modules/wireframe/src/why.ts
function round2(n) {
  return Math.round(n * 100) / 100;
}
function compactDecisions(req, res) {
  const out = {};
  for (const [id, q] of Object.entries(req.questions)) {
    const a = res.answers[id];
    if (!a) continue;
    const { distribution } = chosenOption(q, a);
    const top3 = Object.entries(distribution).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3).map(([k, p]) => [k, round2(p)]);
    out[id] = Object.fromEntries(top3);
  }
  return out;
}
function pct2(p) {
  return `${Math.round(p * 100)}%`;
}
function explainWireDecision(spec, question) {
  const by = spec.by?.model ?? spec.by?.answerer ?? "hand-drawn";
  const lines = [];
  const needPart = spec.need !== void 0 ? ` \xB7 need P(yes)=${pct2(spec.need)}${spec.maybe ? " (maybe)" : ""}` : "";
  const tplPart = spec.template ? ` \xB7 template=${spec.template}` : "";
  const denPart = spec.density ? ` \xB7 density=${spec.density}` : "";
  lines.push(
    `${spec.title} (${spec.archetype}, ${spec.platform}) \u2014 answered by ${by}${needPart}${tplPart}${denPart}`
  );
  if (spec.pinned && Object.keys(spec.pinned).length > 0) {
    const pins = Object.entries(spec.pinned).map(([k, v]) => `${k}=${v}`).join(", ");
    lines.push(`  pinned: ${pins}`);
  }
  const slotRows = spec.slots.map((s) => {
    const alts = s.alternatives ?? [];
    const dist = {};
    if (s.block && s.p !== void 0) dist[s.block] = s.p;
    for (const a of alts) dist[a.block] = a.p;
    const entropy = Object.keys(dist).length > 0 ? round2(entropyBits(dist)) : void 0;
    return {
      slot: s.slot,
      block: s.block,
      ...s.p !== void 0 ? { p: s.p } : {},
      ...entropy !== void 0 ? { entropy } : {},
      alternatives: alts,
      ...s.region ? { region: s.region } : {}
    };
  });
  const qLower = question?.trim().toLowerCase();
  const matchesFilter = (key, text) => {
    if (!qLower) return true;
    return key.toLowerCase().includes(qLower) || text.toLowerCase().includes(qLower);
  };
  for (const row of slotRows) {
    const pStr = row.p !== void 0 ? ` (${pct2(row.p)})` : "";
    const regStr = row.region ? ` [${row.region}]` : "";
    const altStr = row.alternatives.length > 0 ? ` \u2014 runners-up: ${row.alternatives.map((a) => `${a.block} ${pct2(a.p)}`).join(", ")}` : "";
    const line = `  ${row.slot}: ${row.block ?? "blueprint"}${pStr}${regStr}${altStr}`;
    if (matchesFilter(row.slot, line)) lines.push(line);
  }
  const declined = spec.declined ?? [];
  if (declined.length > 0) {
    const decLine = `  declined optional slots: ${declined.map((d) => `${d.slot} (${d.block}, P(omit)=${pct2(d.p)})`).join(", ")}`;
    if (matchesFilter("declined", decLine)) lines.push(decLine);
  }
  const decisions2 = spec.decisions ?? {};
  for (const [qId, dist] of Object.entries(decisions2)) {
    const formatted = Object.entries(dist).map(([k, p]) => `${k} ${pct2(p)}`).join(", ");
    const line = `  decision ${qId}: ${formatted}`;
    if (matchesFilter(qId, line)) lines.push(line);
  }
  if (lines.length === 1 && qLower) {
    for (const row of slotRows) {
      const pStr = row.p !== void 0 ? ` (${pct2(row.p)})` : "";
      const altStr = row.alternatives.length > 0 ? ` \u2014 runners-up: ${row.alternatives.map((a) => `${a.block} ${pct2(a.p)}`).join(", ")}` : "";
      lines.push(`  ${row.slot}: ${row.block ?? "blueprint"}${pStr}${altStr}`);
    }
  }
  return {
    screenTitle: spec.title,
    archetype: spec.archetype,
    platform: spec.platform,
    by,
    ...spec.need !== void 0 ? { need: spec.need } : {},
    ...spec.maybe ? { maybe: true } : {},
    ...spec.template ? { template: spec.template } : {},
    ...spec.density ? { density: spec.density } : {},
    ...spec.pinned ? { pinned: spec.pinned } : {},
    slots: slotRows,
    declined,
    decisions: decisions2,
    lines
  };
}

// packages/modules/wireframe/src/copy-schema.ts
function ensureFleshedForCopy(spec, key) {
  const resolvedKey = key ?? seedKey(spec, spec.archetype || "screen");
  if (!spec.content) {
    return fleshSpec(spec, resolvedKey, packOf(void 0), { by: "pack" });
  }
  const pack = packOf(spec.content.pack);
  let missingFill = false;
  for (const s of spec.slots) {
    if (s.block && !s.fill) {
      missingFill = true;
      break;
    }
  }
  if (!missingFill) return spec;
  const fleshed = fleshSpec(spec, resolvedKey, pack, { by: spec.content.by ?? "pack" });
  return {
    ...spec,
    slots: spec.slots.map((s, i) => s.fill ? s : fleshed.slots[i] ?? s)
  };
}
function describeWordPath(spec, slot, path3, sample) {
  if (path3.startsWith("actions.") && slot.block) {
    const element = path3.slice("actions.".length);
    const c = component(slot.block);
    const r = recipe(spec.archetype);
    const intent = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(r, c, element) : element);
    const intentLabel = INTENT_BY_ID.get(intent)?.label ?? intent;
    return `Action label bound to intent "${intent}" (keep verb "${intentLabel}", e.g. "${sample}")`;
  }
  return `${slot.block ?? "slot"} ${path3} (e.g. "${sample}")`;
}
function blockContentSchema(spec) {
  const fleshed = ensureFleshedForCopy(spec);
  const slotProps = {};
  const requiredSlots = [];
  for (const slot of fleshed.slots) {
    if (!slot.block || !slot.fill) continue;
    const words2 = wordsOf(slot.fill);
    const paths = Object.keys(words2);
    if (paths.length === 0) continue;
    const wordProps = {};
    for (const p of paths) {
      wordProps[p] = {
        type: "string",
        description: describeWordPath(fleshed, slot, p, words2[p] ?? "")
      };
    }
    const variant = typeof slot.props?.variant === "string" ? slot.props.variant : "default";
    slotProps[slot.slot] = {
      type: "object",
      description: `Words for slot "${slot.slot}" (block "${slot.block}", variant "${variant}")`,
      properties: wordProps,
      required: paths,
      additionalProperties: false
    };
    requiredSlots.push(slot.slot);
  }
  const properties = {
    title: {
      type: "string",
      description: `Screen heading for ${fleshed.archetype} screen (currently "${fleshed.content?.title ?? fleshed.title}")`
    },
    ...fleshed.archetype === "detail" || fleshed.content?.bar !== void 0 ? {
      bar: {
        type: "string",
        description: `App bar context label above the detail heading (currently "${fleshed.content?.bar ?? fleshed.title}")`
      }
    } : {},
    slots: {
      type: "object",
      description: "Replacement words keyed by slot id and dot-path",
      properties: slotProps,
      required: requiredSlots,
      additionalProperties: false
    }
  };
  return {
    type: "object",
    description: `Wireframe copy schema for screen "${fleshed.title}" (archetype "${fleshed.archetype}", ${COMPONENTS.size} catalog components supported)`,
    properties,
    required: ["title", "slots"],
    additionalProperties: false
  };
}
function validateCopyPayload(spec, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("copy payload must be a JSON object");
  }
  const obj = raw;
  if ("intents" in obj) {
    throw new Error("copy payload cannot modify actionable intents");
  }
  if (obj.title !== void 0 && (typeof obj.title !== "string" || obj.title.trim().length === 0)) {
    throw new Error("title must be a non-empty string");
  }
  if (obj.bar !== void 0 && (typeof obj.bar !== "string" || obj.bar.trim().length === 0)) {
    throw new Error("bar must be a non-empty string");
  }
  if (obj.slots !== void 0 && (!obj.slots || typeof obj.slots !== "object" || Array.isArray(obj.slots))) {
    throw new Error("slots must be an object mapping slot names to words");
  }
  const fleshed = ensureFleshedForCopy(spec);
  const bySlot = new Map(fleshed.slots.map((s) => [s.slot, s]));
  const normalizedSlots = {};
  for (const [slotName2, rawEntry] of Object.entries(obj.slots ?? {})) {
    const slot = bySlot.get(slotName2);
    if (!slot) {
      throw new Error(`no slot "${slotName2}" on this screen \u2014 it has ${fleshed.slots.map((s) => s.slot).join(", ")}`);
    }
    if (!slot.fill) {
      if (rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry) && Object.keys(rawEntry).length === 0) {
        continue;
      }
      throw new Error(`slot "${slotName2}" (${slot.block ?? "undecided"}) holds no words`);
    }
    const have = wordsOf(slot.fill);
    const validPaths = Object.keys(have);
    if (Array.isArray(rawEntry)) {
      if (rawEntry.length > validPaths.length) {
        throw new Error(`slot "${slotName2}": ${rawEntry.length} words given, but the slot holds ${validPaths.length}`);
      }
      for (let i = 0; i < rawEntry.length; i++) {
        if (typeof rawEntry[i] !== "string") {
          throw new Error(`slot "${slotName2}": entry ${i} must be a string`);
        }
      }
      normalizedSlots[slotName2] = rawEntry;
      continue;
    }
    if (!rawEntry || typeof rawEntry !== "object") {
      throw new Error(`slot "${slotName2}" must be an object or array of strings`);
    }
    const unwrapped = "words" in rawEntry && typeof rawEntry.words === "object" && rawEntry.words !== null ? rawEntry.words : rawEntry;
    const slotWords = {};
    for (const [path3, val] of Object.entries(unwrapped)) {
      if (!(path3 in have)) {
        throw new Error(`slot "${slotName2}": no word at "${path3}" \u2014 it holds ${validPaths.join(", ")}`);
      }
      if (typeof val !== "string") {
        throw new Error(`slot "${slotName2}": "${path3}" must be a string`);
      }
      slotWords[path3] = val;
    }
    normalizedSlots[slotName2] = slotWords;
  }
  return {
    ...typeof obj.title === "string" ? { title: sanitizeFlowTitle(obj.title) } : {},
    ...typeof obj.bar === "string" ? { bar: sanitizeFlowTitle(obj.bar) } : {},
    slots: normalizedSlots
  };
}
async function generateWireCopy(spec, generator = stubTextGenerator(1), opts = {}) {
  const base = ensureFleshedForCopy(spec, opts.key);
  const schema = blockContentSchema(base);
  const current = copyOf(base);
  const promptLines = [
    `Write realistic product UI copy for the "${base.title}" screen (archetype: ${base.archetype}).`,
    `Flow request: ${base.request || base.title}`,
    ...opts.brief ? [`Copy brief: ${opts.brief}`] : [],
    `Current slots and sample words: ${JSON.stringify(current.slots)}`
  ];
  const raw = await generator.generateJson(promptLines.join("\n"), schema);
  const validated = validateCopyPayload(base, raw);
  return applyCopy(base, validated, generator.name);
}
function sanitizeFlowTitle(raw) {
  let text = raw.trim();
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  text = firstLine ?? "";
  text = text.replace(
    /^(?:sure[!,.]?\s*|certainly[!,.]?\s*|of course[!,.]?\s*)?(?:here(?:'s| is)\s+(?:a|the|your)\s+(?:suggested\s+|concise\s+)?(?:flow\s+|screen\s+|product\s+|app\s+|brand\s+)?(?:title|name)\s*[:\-–—]\s*)/i,
    ""
  );
  text = text.replace(/^(?:title|name|flow|brand|screen)\s*[:\-–—]\s*/i, "");
  text = text.replace(/^[`*"'\u2018\u2019\u201c\u201d.;:!?]+|[`*"'\u2018\u2019\u201c\u201d.;:!?]+$/g, "").trim();
  text = text.replace(/\s+/g, " ");
  if (text.length > 48) {
    text = text.slice(0, 48).replace(/\s+\S*$/, "").trim() || text.slice(0, 48).trim();
  }
  return text || "Untitled";
}
var NAV_BLOCKS = /* @__PURE__ */ new Set(["tab-bar", "side-nav", "navbar"]);
function flowNameSchema(specs) {
  const titleProps = {};
  const requiredKeys = [];
  let navItemCount = 4;
  for (let i = 0; i < specs.length; i++) {
    const s = ensureFleshedForCopy(specs[i], `screen-${i}`);
    const key = `${s.archetype}-${i}`;
    titleProps[key] = {
      type: "string",
      description: `Specific screen title for archetype "${s.archetype}" (currently "${s.title}")`
    };
    requiredKeys.push(key);
    for (const slot of s.slots) {
      if (slot.block && NAV_BLOCKS.has(slot.block)) {
        const actionKeys = Object.keys(slot.fill?.actions ?? {});
        if (actionKeys.length > 0) navItemCount = actionKeys.length;
        else if (slot.fill?.items?.length) navItemCount = slot.fill.items.length;
      }
    }
  }
  return {
    type: "object",
    description: "Coherent flow naming: brand, per-screen titles, and shared navigation labels",
    properties: {
      brand: {
        type: "string",
        description: "Short brand or product name (1-3 words)"
      },
      titles: {
        type: "object",
        description: "Screen title keyed by screen id",
        properties: titleProps,
        required: requiredKeys,
        additionalProperties: false
      },
      navLabels: {
        type: "array",
        description: "Shared navigation item labels in order across the flow",
        items: { type: "string", description: "Navigation tab or link label" },
        minItems: navItemCount,
        maxItems: navItemCount
      }
    },
    required: ["brand", "titles", "navLabels"],
    additionalProperties: false
  };
}
async function nameFlow(specs, request, generator = stubTextGenerator(1)) {
  if (specs.length === 0) {
    return { brand: "Acme", titles: {}, navLabels: [], specs: [] };
  }
  const fleshedSpecs = specs.map((s, i) => ensureFleshedForCopy(s, seedKey(s, `screen-${i}`)));
  const schema = flowNameSchema(fleshedSpecs);
  const flowReq = request ?? fleshedSpecs[0]?.request ?? fleshedSpecs[0]?.title ?? "Product flow";
  const prompt = [
    `Name the product brand, each screen's specific title, and the shared navigation bar labels for this flow.`,
    `Flow request: ${flowReq}`,
    `Screens: ${fleshedSpecs.map((s, i) => `${s.archetype}-${i} (${s.archetype})`).join(", ")}`
  ].join("\n");
  const raw = await generator.generateJson(prompt, schema);
  const brand = sanitizeFlowTitle(raw?.brand ?? "Acme");
  const navLabels = (raw?.navLabels ?? []).map((l) => sanitizeFlowTitle(String(l)));
  const titles = {};
  const namedSpecs = fleshedSpecs.map((spec, i) => {
    const key = `${spec.archetype}-${i}`;
    const rawTitle = raw?.titles?.[key] ?? spec.content?.title ?? spec.title;
    const cleanTitle = sanitizeFlowTitle(rawTitle);
    titles[key] = cleanTitle;
    const slots = spec.slots.map((slot) => {
      if (!slot.block) return slot;
      if (NAV_BLOCKS.has(slot.block) && navLabels.length > 0) {
        const baseFill = slot.fill ? structuredClone(slot.fill) : {};
        const actionKeys = Object.keys(baseFill.actions ?? {});
        const keysToFill = actionKeys.length > 0 ? actionKeys : navLabels.map((_, idx) => `item-${idx + 1}`);
        const actions = { ...baseFill.actions ?? {} };
        keysToFill.forEach((k, idx) => {
          actions[k] = navLabels[idx % navLabels.length];
        });
        const fill = {
          ...baseFill,
          actions,
          ...slot.block === "navbar" ? { heading: brand } : {},
          ...baseFill.items ? {
            items: baseFill.items.map((it, idx) => ({
              ...it,
              title: navLabels[idx % navLabels.length] ?? it.title
            }))
          } : {}
        };
        return { ...slot, fill };
      }
      return slot;
    });
    const content = spec.content ? {
      ...spec.content,
      source: "copy",
      by: generator.name,
      title: cleanTitle
    } : {
      source: "copy",
      by: generator.name,
      title: cleanTitle
    };
    return {
      ...spec,
      title: cleanTitle,
      content,
      slots
    };
  });
  return { brand, titles, navLabels, specs: namedSpecs };
}
function resolveTextGenerator(opts = {}) {
  if (!opts.useStub && process.env.ISOCAN_TEXT_API_KEY) {
    return httpTextGenerator();
  }
  return stubTextGenerator(opts.seed ?? 1);
}
async function copyAiOnCanvas(port, canvas, all, screens, generator = stubTextGenerator(1), opts = {}) {
  const group = opts.group ?? newGroupId();
  const changed = [];
  for (const s of screens) {
    if (isBlueprint(s.spec)) continue;
    const next2 = await generateWireCopy(s.spec, generator, {
      ...opts.brief ? { brief: opts.brief } : {},
      key: seedKey(s.spec, s.item)
    });
    if (JSON.stringify(next2) === JSON.stringify(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    if (await writeWire(port, item, next2, group, s.spec)) {
      changed.push({ itemId: s.item, title: wireTitle(next2), spec: next2 });
    }
  }
  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group
  );
  return { group, by: generator.name, changed, prototypes };
}
async function nameFlowOnCanvas(port, canvas, all, screens, generator = stubTextGenerator(1), opts = {}) {
  const group = opts.group ?? newGroupId();
  const targetScreens = screens.filter((s) => !isBlueprint(s.spec));
  const named = await nameFlow(
    targetScreens.map((s) => s.spec),
    opts.request,
    generator
  );
  const changed = [];
  for (let i = 0; i < targetScreens.length; i++) {
    const s = targetScreens[i];
    const next2 = named.specs[i];
    if (JSON.stringify(next2) === JSON.stringify(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    if (await writeWire(port, item, next2, group, s.spec)) {
      changed.push({ itemId: s.item, title: wireTitle(next2), spec: next2 });
    }
  }
  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group
  );
  return {
    group,
    by: generator.name,
    brand: named.brand,
    navLabels: named.navLabels,
    changed,
    prototypes
  };
}

// packages/modules/wireframe/src/presets.ts
var HOUSE = "house";
var PRESET_PROP = "wirePreset";
var OWN_PRESETS = [
  { id: "material", name: "Material", about: "Material 3's ideas \u2014 tonal violet, 12px corners, elevation", from: "own" },
  { id: "shadcn", name: "shadcn", about: "shadcn/ui's look \u2014 zinc neutrals, hairline borders, small corners", from: "own" },
  { id: "glass", name: "Glass", about: "glassmorphism \u2014 frosted translucent panes over a soft gradient", from: "own" },
  { id: "ios", name: "iOS", about: "Apple's HIG \u2014 system face, grouped greys, 10px corners, tint blue", from: "own" },
  { id: "fluent", name: "Fluent", about: "Fluent 2's ideas \u2014 neutral greys, communication blue, 4px corners, light shadows", from: "own" },
  { id: "carbon", name: "Carbon", about: "Carbon's ideas \u2014 square, dense, cool greys, one strong blue", from: "own" },
  { id: "brutalist", name: "Brutalist", about: "thick black borders, hard shadows, monospace, loud flat colour", from: "own" }
];
var PACK_PRESETS = ["duarte", "frog", "ideo", "ive", "kare", "linear", "rams", "tufte", "victor"].map((id) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  about: "a design-competition pack \u2014 its tokens mapped onto the wire by the answerer",
  from: "pack"
}));
var PRESET_NAMES = [HOUSE, ...OWN_PRESETS.map((p) => p.id), ...PACK_PRESETS.map((p) => p.id)];
function presetById(id) {
  return OWN_PRESETS.find((p) => p.id === id) ?? PACK_PRESETS.find((p) => p.id === id);
}
function presetFile(preset) {
  return preset.from === "own" ? `assets/styles/${preset.id}/DESIGN.md` : `assets/packs/${preset.id}/DESIGN.md`;
}
function presetOrSay(name) {
  const id = name.trim().toLowerCase();
  if (id === HOUSE) return HOUSE;
  const found = presetById(id);
  if (!found) throw new Error(`"${name}" is not a wire style \u2014 ${PRESET_NAMES.join(", ")}`);
  return found;
}
function presetTitle(preset) {
  return `${preset.name} \u2014 DESIGN.md`;
}
function flowScreens(all, itemIds) {
  if (itemIds.length === 0) return [...all];
  const named = new Set(itemIds);
  const flows = new Set(all.filter((s) => named.has(s.item)).map((s) => s.spec.flow || s.item));
  return all.filter((s) => named.has(s.item) || flows.has(s.spec.flow || s.item));
}
var GAP2 = 160;
function refuseOwnSystem(system, scope) {
  const where = scope ? `the group \u201C${scope.title}\u201D` : "this canvas";
  return new Error(`\u201C${system.title}\u201D is the design system of ${where}, and a wire style would become a new version of it. Wires draw in it already (\`isocan wire style\`); to use a wire style instead, stop it governing first \u2014 \`isocan design use ${system.id} --off\`, or its right-click menu \u2192 Stop using as design system.`);
}
async function applyPreset(port, all, screens, choice2, text, resolver) {
  if (screens.length === 0) throw new Error('no wireframe to style \u2014 `isocan wire "<request>"` composes some');
  if (choice2 !== HOUSE && !text) throw new Error(`the ${choice2.name} wire style has no DESIGN.md to read`);
  const before = await port.canvas();
  const group = newGroupId();
  const byScope = /* @__PURE__ */ new Map();
  for (const s of screens) {
    const item = before.items[s.item];
    if (!item) continue;
    const scope = canvasScopes(before, item)[0]?.id ?? null;
    byScope.set(scope, [...byScope.get(scope) ?? [], s]);
  }
  if (choice2 !== HOUSE) {
    for (const scope of byScope.keys()) {
      const own = ownDesignSystemAt(before, scope);
      if (own && own.properties?.[PRESET_PROP] === void 0) throw refuseOwnSystem(own, scope ? before.items[scope] ?? null : null);
    }
  }
  const placed = [];
  for (const [scope, list] of byScope) {
    const own = ownDesignSystemAt(before, scope);
    const mine = own && own.properties?.[PRESET_PROP] !== void 0 ? own : null;
    if (choice2 === HOUSE) {
      if (mine) {
        await port.send({ type: "item.delete", itemId: mine.id }, group);
        placed.push({ itemId: mine.id, scope, what: "removed" });
      }
      continue;
    }
    const words2 = text;
    const title = presetTitle(choice2);
    if (mine) {
      const current = currentVersionOf(mine);
      if (mine.properties[PRESET_PROP] === choice2.id && current && await port.readText(current.blobHash) === words2) {
        placed.push({ itemId: mine.id, scope, what: "unchanged" });
        continue;
      }
      const upload2 = await port.put(words2, "text/markdown", "DESIGN.md");
      await port.send({ type: "item.addVersion", itemId: mine.id, version: { id: newVersionId(), blobHash: upload2.blobHash, mimeType: "text/markdown", filename: "DESIGN.md", size: upload2.size } }, group);
      await port.send({ type: "item.update", itemId: mine.id, patch: { title, properties: { [PRESET_PROP]: choice2.id } } }, group);
      placed.push({ itemId: mine.id, scope, what: "versioned" });
      continue;
    }
    const upload = await port.put(words2, "text/markdown", "DESIGN.md");
    const itemId = newItemId();
    const scopeItem = scope ? before.items[scope] : void 0;
    await port.send({
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/markdown", filename: "DESIGN.md", size: upload.size },
      width: 560,
      height: 720,
      // Beside the flow, level with its top: where somebody looking at the screens looks next.
      placement: { x: Math.max(...list.map((s) => s.x + s.width)) + GAP2, y: Math.min(...list.map((s) => s.y)), chosen: true },
      title,
      properties: { [PRESET_PROP]: choice2.id },
      ...scopeItem && isGroupItem(scopeItem) ? { containerId: scopeItem.id, groupPlacement: "exact" } : {}
    }, group);
    const landed = await port.canvas();
    await port.send(designUse(landed, landed.items[itemId]).op, group);
    placed.push({ itemId, scope, what: "added" });
  }
  const after = await port.canvas();
  const governs = (canvas, s) => {
    const item = canvas.items[s.item];
    const system = item ? governingSystem(canvas, item) : null;
    return system ? `${system.id}@${system.currentVersionId}` : "";
  };
  const asked = new Set(screens.map((s) => s.item));
  const touched = all.filter((s) => after.items[s.item] && (asked.has(s.item) || governs(before, s) !== governs(after, s)));
  const restyled = await restyle(port, after, all, touched, resolver, { toDefault: choice2 === HOUSE, group });
  return { group, name: choice2 === HOUSE ? HOUSE : choice2.id, placed, restyled };
}
function presetSummary(r) {
  const style = r.name === HOUSE ? "house (the default greys)" : presetById(r.name)?.name ?? r.name;
  const files = r.placed.map((p) => p.what === "added" ? "its DESIGN.md placed beside the flow" : p.what === "versioned" ? "a new version of the flow's wire-style DESIGN.md" : p.what === "removed" ? "the wire-style DESIGN.md moved to the trash" : "its DESIGN.md already there");
  const { changed, targets } = r.restyled;
  const wrote = changed.length > 0 || r.placed.some((p) => p.what !== "unchanged");
  return `${style}: ${[...new Set(files)].join("; ") || "no file to change"} \xB7 ${changed.length} of ${targets.length} wires restyled${wrote ? " \u2014 one op group: one undo takes it all back" : " \u2014 nothing written"}`;
}

// packages/modules/wireframe/src/ds.ts
var DS_DIRECTIONS = [
  {
    id: "nordic-slate",
    name: "Nordic Slate",
    summary: "Crisp cool slate greys, deep navy primary, high-clarity technical tables and operations tools",
    surface: "flat",
    colors: {
      ground: "#ffffff",
      surface: "#f1f5f9",
      line: "#cbd5e1",
      ink: "#0f172a",
      "ink-muted": "#475569",
      bar: "#e2e8f0",
      primary: "#1e3a8a",
      "on-primary": "#ffffff"
    },
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    radius: { sm: "4px", base: "6px", lg: "10px", full: "999px" }
  },
  {
    id: "editorial-warm",
    name: "Editorial Warm",
    summary: "Warm paper ground, stone surfaces, espresso ink and terracotta primary for consumer and publishing flows",
    surface: "raised",
    colors: {
      ground: "#fafaf9",
      surface: "#f5f5f4",
      line: "#d6d3d1",
      ink: "#1c1917",
      "ink-muted": "#57534e",
      bar: "#e7e5e4",
      primary: "#9a3412",
      "on-primary": "#ffffff"
    },
    fontFamily: "Georgia, 'Times New Roman', ui-serif, serif",
    radius: { sm: "6px", base: "8px", lg: "14px", full: "999px" }
  },
  {
    id: "precision-cobalt",
    name: "Precision Cobalt",
    summary: "Clean white ground, cool zinc borders, cobalt primary and raised cards for SaaS dashboards and analytics",
    surface: "raised",
    colors: {
      ground: "#ffffff",
      surface: "#f4f4f5",
      line: "#d4d4d8",
      ink: "#18181b",
      "ink-muted": "#52525b",
      bar: "#e4e4e7",
      primary: "#1d4ed8",
      "on-primary": "#ffffff"
    },
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    radius: { sm: "6px", base: "8px", lg: "12px", full: "999px" }
  },
  {
    id: "verdant-studio",
    name: "Verdant Studio",
    summary: "Soft sage-tinted surface, deep forest ink and emerald primary for health, sustainability and finance apps",
    surface: "glass",
    colors: {
      ground: "#ffffff",
      surface: "#f0fdf4",
      line: "#bbf7d0",
      ink: "#052e16",
      "ink-muted": "#166534",
      bar: "#dcfce7",
      primary: "#15803d",
      "on-primary": "#ffffff"
    },
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    radius: { sm: "8px", base: "12px", lg: "16px", full: "999px" }
  },
  {
    id: "industrial-amber",
    name: "Industrial Amber",
    summary: "High-contrast stark borders, bold surface shadows, dark bronze primary for field, warehouse and logistics tools",
    surface: "bold",
    colors: {
      ground: "#ffffff",
      surface: "#fef3c7",
      line: "#1c1917",
      ink: "#1c1917",
      "ink-muted": "#44403c",
      bar: "#fde68a",
      primary: "#78350f",
      "on-primary": "#ffffff"
    },
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    radius: { sm: "2px", base: "4px", lg: "6px", full: "999px" }
  }
];
function toHexByte(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}
function rgbToHex(r, g, b) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}
function mixRgb(rgb, target, t) {
  return {
    r: rgb.r + (target.r - rgb.r) * t,
    g: rgb.g + (target.g - rgb.g) * t,
    b: rgb.b + (target.b - rgb.b) * t
  };
}
function ensurePairContrast(fgHex, bgHexes, minRatio) {
  const parsedFg = parseHex(fgHex);
  const bgLums = bgHexes.map((b) => luminance(b)).filter((l) => l !== null);
  if (!parsedFg || bgLums.length === 0) return fgHex;
  const passesAll = (candidate) => bgHexes.every((bg) => {
    const r = contrastRatio(candidate, bg);
    return r !== null && r >= minRatio;
  });
  if (passesAll(fgHex)) return fgHex;
  const avgBgLum = bgLums.reduce((acc, l) => acc + l, 0) / bgLums.length;
  const primaryTarget = avgBgLum > 0.35 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const fallbackTarget = avgBgLum > 0.35 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  for (const target of [primaryTarget, fallbackTarget]) {
    for (let step = 1; step <= 50; step++) {
      const t = step / 50;
      const mixed = mixRgb(parsedFg, target, t);
      const hex = rgbToHex(mixed.r, mixed.g, mixed.b);
      if (passesAll(hex)) return hex;
    }
  }
  return avgBgLum > 0.35 ? "#000000" : "#ffffff";
}
function repairContrast(colors, minRatio = CONTRAST_BODY) {
  const out = { ...colors };
  const repairs = [];
  const ground = out.ground ?? "#ffffff";
  const surface = out.surface ?? ground;
  const bgs = [ground, surface];
  for (const role of ["ink", "ink-muted", "primary"]) {
    const current = out[role];
    if (!current) continue;
    const worstBefore = Math.min(
      ...bgs.map((bg) => contrastRatio(current, bg) ?? minRatio)
    );
    if (worstBefore < minRatio) {
      const fixed = ensurePairContrast(current, bgs, minRatio);
      const worstAfter = Math.min(
        ...bgs.map((bg) => contrastRatio(fixed, bg) ?? minRatio)
      );
      out[role] = fixed;
      repairs.push({
        role,
        against: "ground/surface",
        from: current,
        to: fixed,
        beforeRatio: worstBefore,
        afterRatio: worstAfter
      });
    }
  }
  if (out["on-primary"] && out.primary) {
    const current = out["on-primary"];
    const before = contrastRatio(current, out.primary) ?? minRatio;
    if (before < minRatio) {
      const fixed = ensurePairContrast(current, [out.primary], minRatio);
      const after = contrastRatio(fixed, out.primary) ?? minRatio;
      out["on-primary"] = fixed;
      repairs.push({
        role: "on-primary",
        against: "primary",
        from: current,
        to: fixed,
        beforeRatio: before,
        afterRatio: after
      });
    }
  }
  return { colors: out, repairs };
}
async function proposeThenPick(request, answerer = stubAnswerer(1), candidates = DS_DIRECTIONS) {
  const list = candidates.length > 0 ? candidates : DS_DIRECTIONS;
  const dirCriteria = Object.fromEntries(list.map((c) => [c.id, `${c.name}: ${c.summary}`]));
  const surfaceCriteria = {
    flat: "Flat hairline borders and crisp surfaces without drop shadows",
    raised: "Subtle elevation and soft card shadows",
    glass: "Translucent frosted panels with backdrop blur",
    bold: "High-contrast stark borders and offset shadows"
  };
  const dirQ = {
    type: "choice",
    instructions: "Select the visual direction that best fits the product and request.",
    criteria: dirCriteria
  };
  const surfQ = {
    type: "choice",
    instructions: "Select the surface elevation mode for the design system.",
    criteria: surfaceCriteria
  };
  const densQ = {
    type: "score",
    instructions: "Score the appropriate information density for the product.",
    criteria: [
      "1 \u2014 compact density (tight 8px spacing for data-dense tools)",
      "2 \u2014 default density (balanced 12px spacing)",
      "3 \u2014 spacious density (generous 16px editorial spacing)"
    ]
  };
  const questions2 = {
    "ds.direction": dirQ,
    "ds.surface": surfQ,
    "ds.density": densQ
  };
  const req = {
    model: JEV_MODEL,
    state: { task: "Choose design system direction, surface and density", request },
    questions: questions2
  };
  const answered = await answerer.answer(req);
  const dirAns = answered.response.answers["ds.direction"];
  const dirChoice = dirAns ? chosenOption(dirQ, dirAns) : null;
  const pickedId = dirChoice ? dirChoice.value : list[0].id;
  const direction = list.find((c) => c.id === pickedId) ?? list[0];
  const p = dirChoice ? dirChoice.p : 1;
  const surfAns = answered.response.answers["ds.surface"];
  const pickedSurface = surfAns && surfAns.type === "choice" ? chosenOption(surfQ, surfAns).value : direction.surface;
  const densAns = answered.response.answers["ds.density"];
  const scoreIdx = densAns && densAns.type === "score" ? Math.max(0, Math.min(2, Math.round(densAns.score))) : 1;
  const density = DENSITY_LEVELS[scoreIdx] ?? "default";
  return {
    direction,
    surface: pickedSurface,
    density,
    p: Math.round(p * 1e3) / 1e3,
    by: answered.by,
    decisions: compactDecisions(req, answered.response)
  };
}
async function synthesizeDesignSystem(request, answerer = stubAnswerer(1), opts = {}) {
  const picked = await proposeThenPick(request, answerer, opts.candidates);
  const surface = opts.surface ?? picked.surface;
  const mergedColors = { ...picked.direction.colors };
  for (const [k, v] of Object.entries(opts.colors ?? {})) {
    if (typeof v === "string") mergedColors[k] = v;
  }
  const { colors, repairs } = repairContrast(mergedColors, CONTRAST_BODY);
  const name = sanitizeFlowTitle(opts.name ?? `${picked.direction.name} \u2014 ${request || "Design System"}`);
  const { fontFamily, radius } = picked.direction;
  const markdown = [
    "---",
    "version: alpha",
    `name: "${name.replace(/"/g, "'")}"`,
    `description: "Synthesized design system (${picked.direction.name}, surface ${surface}, density ${picked.density}) for ${request.replace(/"/g, "'") || "wireframe flow"}."`,
    `surface: ${surface}`,
    "colors:",
    `  ground: "${colors.ground}"`,
    `  surface: "${colors.surface}"`,
    `  line: "${colors.line}"`,
    `  ink: "${colors.ink}"`,
    `  ink-muted: "${colors["ink-muted"]}"`,
    `  bar: "${colors.bar}"`,
    `  primary: "${colors.primary}"`,
    `  on-primary: "${colors["on-primary"]}"`,
    "typography:",
    "  title:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 20px",
    "    fontWeight: 600",
    "    lineHeight: 1.3",
    "  body:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 14px",
    "    fontWeight: 400",
    "    lineHeight: 1.5",
    "  label:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 14px",
    "    fontWeight: 500",
    "    lineHeight: 1.4",
    "rounded:",
    `  sm: ${radius.sm}`,
    `  base: ${radius.base}`,
    `  lg: ${radius.lg}`,
    `  full: ${radius.full}`,
    "spacing:",
    "  xs: 4px",
    `  base: ${picked.density === "compact" ? "8px" : picked.density === "spacious" ? "16px" : "12px"}`,
    "  md: 16px",
    "  lg: 24px",
    "components:",
    "  button-primary:",
    '    backgroundColor: "{colors.primary}"',
    '    textColor: "{colors.on-primary}"',
    '    typography: "{typography.label}"',
    '    rounded: "{rounded.base}"',
    "    height: 40px",
    '    padding: "0 {spacing.md}"',
    "  card:",
    '    backgroundColor: "{colors.ground}"',
    '    textColor: "{colors.ink}"',
    '    rounded: "{rounded.lg}"',
    '    padding: "{spacing.lg}"',
    "---",
    "",
    "## Overview",
    "",
    `${picked.direction.summary}. Synthesized for "${request || "this canvas"}" with deterministic WCAG AA contrast verification.`,
    "",
    "## Colors",
    "",
    `- **ground** (${colors.ground}) and **surface** (${colors.surface}) establish the canvas hierarchy.`,
    `- **ink** (${colors.ink}) and **ink-muted** (${colors["ink-muted"]}) maintain \u2265 4.5:1 AA contrast against both ground and surface.`,
    `- **primary** (${colors.primary}) and **on-primary** (${colors["on-primary"]}) anchor primary actions.`,
    "",
    "## Typography",
    "",
    `Set in ${fontFamily} with a 20px semibold title and 14px body/label scale.`,
    "",
    "## Layout",
    "",
    `Default density is ${picked.density}.`,
    "",
    "## Elevation & Depth",
    "",
    `\`surface: ${surface}\` governs card and chrome depth across the flow.`,
    "",
    "## Shapes",
    "",
    `Controls use ${radius.base} corners; cards use ${radius.lg}.`,
    "",
    "## Components",
    "",
    "Primary buttons use `{colors.primary}` with `{colors.on-primary}`; cards sit on `{colors.ground}`.",
    "",
    "## Do's and Don'ts",
    "",
    "- Do keep every foreground/background pair at or above 4.5:1 contrast.",
    "- Don't introduce unmapped literal hex colours outside the role tokens.",
    ""
  ].join("\n");
  const doc = parseDesign(markdown);
  const findings = checkDesign(doc).filter((f) => f.severity === "error" || f.severity === "warning");
  if (findings.length > 0) {
    throw new Error(`Synthesized DESIGN.md failed design check: ${findings.map((f) => `${f.where}: ${f.what}`).join("; ")}`);
  }
  return {
    name,
    direction: picked.direction,
    surface,
    density: picked.density,
    colors,
    repairs,
    markdown,
    by: picked.by,
    p: picked.p,
    decisions: picked.decisions
  };
}
var GAP3 = 160;
async function wireDsOnCanvas(port, all, screens, request, answerer = stubAnswerer(1), opts = {}) {
  if (screens.length === 0) {
    throw new Error('no wireframe to style \u2014 `isocan wire "<request>"` composes some');
  }
  const effectiveRequest = request.trim() || screens[0].spec.request || screens[0].spec.title;
  const synthesized = await synthesizeDesignSystem(effectiveRequest, answerer, opts);
  const before = await port.canvas();
  const group = newGroupId();
  const firstItem = before.items[screens[0].item];
  const scope = firstItem ? canvasScopes(before, firstItem)[0]?.id ?? null : null;
  const existing = ownDesignSystemAt(before, scope);
  const title = `DESIGN.md \u2014 ${synthesized.direction.name}`;
  let dsItemId;
  let what;
  if (existing) {
    dsItemId = existing.id;
    const upload = await port.put(synthesized.markdown, "text/markdown", "DESIGN.md");
    await port.send(
      {
        type: "item.addVersion",
        itemId: existing.id,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: "text/markdown",
          filename: "DESIGN.md",
          size: upload.size
        }
      },
      group
    );
    await port.send(
      {
        type: "item.update",
        itemId: existing.id,
        patch: { title, properties: { [PRESET_PROP]: synthesized.direction.id } }
      },
      group
    );
    what = "versioned";
  } else {
    dsItemId = newItemId();
    const upload = await port.put(synthesized.markdown, "text/markdown", "DESIGN.md");
    const scopeItem = scope ? before.items[scope] : void 0;
    await port.send(
      {
        type: "item.add",
        itemId: dsItemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: "text/markdown",
          filename: "DESIGN.md",
          size: upload.size
        },
        width: 560,
        height: 720,
        placement: {
          x: Math.max(...screens.map((s) => s.x + s.width)) + GAP3,
          y: Math.min(...screens.map((s) => s.y)),
          chosen: true
        },
        title,
        properties: { [PRESET_PROP]: synthesized.direction.id },
        ...scopeItem && isGroupItem(scopeItem) ? { containerId: scopeItem.id, groupPlacement: "exact" } : {}
      },
      group
    );
    const landed = await port.canvas();
    await port.send(designUse(landed, landed.items[dsItemId]).op, group);
    what = "added";
  }
  const after = await port.canvas();
  const governs = (canvas, s) => {
    const item = canvas.items[s.item];
    const system = item ? governingSystem(canvas, item) : null;
    return system ? `${system.id}@${system.currentVersionId}` : "";
  };
  const asked = new Set(screens.map((s) => s.item));
  const touched = all.filter(
    (s) => after.items[s.item] && (asked.has(s.item) || governs(before, s) !== governs(after, s))
  );
  const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec));
  const restyled = await restyle(port, after, all, touched, resolver, { toDefault: false, group });
  return {
    group,
    dsItemId,
    what,
    synthesized,
    restyled
  };
}

// packages/modules/wireframe/src/polish.ts
function polishIntensityBudget(intensity) {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped < 0.25) return 0;
  if (clamped < 0.5) return 4;
  if (clamped <= 0.75) return 8;
  return 12;
}
function collectAttrValues(html, attr) {
  const out = /* @__PURE__ */ new Set();
  const re = new RegExp(`\\b${attr}="([^"]+)"`, "g");
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) out.add(m[1]);
  }
  return out;
}
function verifyWireContract(baselineHtml, candidateHtml, spec) {
  const problems = [];
  const baseSec = collectAttrValues(baselineHtml, "data-sec");
  const candSec = collectAttrValues(candidateHtml, "data-sec");
  for (const s of baseSec) {
    if (!candSec.has(s)) {
      problems.push(`missing data-sec="${s}" in candidate HTML`);
    }
  }
  const baseWf = collectAttrValues(baselineHtml, "data-wf");
  const candWf = collectAttrValues(candidateHtml, "data-wf");
  for (const w of baseWf) {
    if (!candWf.has(w)) {
      problems.push(`missing data-wf="${w}" in candidate HTML`);
    }
  }
  const baseHot = collectAttrValues(baselineHtml, "data-hot");
  const candHot = collectAttrValues(candidateHtml, "data-hot");
  for (const h of baseHot) {
    if (!candHot.has(h)) {
      problems.push(`missing hotspot data-hot="${h}" in candidate HTML`);
    }
  }
  const baseIntent = collectAttrValues(baselineHtml, "data-intent");
  const candIntent = collectAttrValues(candidateHtml, "data-intent");
  for (const intent of baseIntent) {
    if (!candIntent.has(intent)) {
      problems.push(`missing actionable intent data-intent="${intent}" in candidate HTML`);
    }
  }
  if (spec?.polish) {
    const allowedTokens = new Set(POLISH_TOKENS);
    for (const patch of spec.polish) {
      if (!baseWf.has(patch.target) && !baseSec.has(patch.target)) {
        problems.push(`polish target "${patch.target}" does not match any data-wf or data-sec path on the screen`);
      }
      for (const t of patch.add ?? []) {
        if (!allowedTokens.has(t)) {
          problems.push(`polish token "${t}" on "${patch.target}" is not in POLISH_TOKENS`);
        }
      }
      for (const t of patch.remove ?? []) {
        if (!allowedTokens.has(t)) {
          problems.push(`polish remove token "${t}" on "${patch.target}" is not in POLISH_TOKENS`);
        }
      }
    }
  }
  if (spec?.style && spec.style.source === "design-system") {
    const roles = spec.style.roles;
    const ground = roles.ground?.value ?? DEFAULT_THEME.ground;
    const surface = roles.surface?.value ?? DEFAULT_THEME.surface;
    const ink = roles.ink?.value ?? DEFAULT_THEME.ink;
    const muted = roles["ink-muted"]?.value ?? DEFAULT_THEME["ink-muted"];
    const primary = roles.primary?.value ?? DEFAULT_THEME.primary;
    const onPrimary = roles["on-primary"]?.value ?? DEFAULT_THEME["on-primary"];
    const pairs = [
      ["ink vs ground", ink, ground],
      ["ink vs surface", ink, surface],
      ["ink-muted vs ground", muted, ground],
      ["ink-muted vs surface", muted, surface],
      ["on-primary vs primary", onPrimary, primary]
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio2 = contrastRatio(fg, bg);
      if (ratio2 !== null && ratio2 < CONTRAST_BODY) {
        problems.push(`contrast violation (${label}): ${ratio2}:1 < ${CONTRAST_BODY}:1`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}
function applyWirePolish(spec, patches) {
  const unpolishedSpec = { ...spec };
  delete unpolishedSpec.polish;
  const baselineHtml = renderWire(unpolishedSpec);
  const mergedPatches = [...spec.polish ?? [], ...patches];
  const nextSpec = mergedPatches.length > 0 ? { ...spec, polish: mergedPatches } : unpolishedSpec;
  const candidateHtml = renderWire(nextSpec);
  const check3 = verifyWireContract(baselineHtml, candidateHtml, nextSpec);
  if (!check3.ok) {
    throw new Error(`wire polish rejected by contract gate:
  ${check3.problems.join("\n  ")}`);
  }
  return { spec: nextSpec, html: candidateHtml };
}
var POLISH_DESCRIPTIONS = {
  "wf-elevated": "Elevated card surface with soft shadow and border",
  "wf-bordered": "Crisp 1.5px bordered container with balanced padding",
  "wf-subtle": "Subtle tinted surface background fill",
  "wf-emphasis": "Left accent border emphasizing the section",
  "wf-compact-pad": "Tighter inner padding for compact data sections",
  "wf-spacious-pad": "Generous inner padding for hero or focal sections",
  "wf-rounded-lg": "Larger corner radius for prominent cards",
  "wf-accent-ring": "Primary focus/accent outline ring",
  none: "Leave section unpolished"
};
async function planPolishWithJev(spec, answerer = stubAnswerer(1), opts = {}) {
  const resolvedSlots = spec.slots.filter((s) => s.block !== null);
  const questions2 = {
    "polish.intensity": {
      type: "noul",
      instructions: "Should this screen receive visual polish refinements (elevation, surface contrast, emphasis borders)?",
      criteria: {
        true: "Apply visual polish tokens to refine section hierarchy and surface depth",
        false: "Keep sections unpolished"
      }
    }
  };
  for (const s of resolvedSlots) {
    questions2[`polish.slot.${s.slot}`] = {
      type: "choice",
      instructions: `Choose the visual polish token for slot "${s.slot}" (${s.block}).`,
      criteria: POLISH_DESCRIPTIONS
    };
  }
  const req = {
    model: JEV_MODEL,
    state: {
      task: "Score polish_intensity and choose per-slot visual refinement tokens",
      archetype: spec.archetype,
      title: spec.title,
      request: spec.request,
      slots: resolvedSlots.map((s) => ({ slot: s.slot, block: s.block }))
    },
    questions: questions2
  };
  const answered = await answerer.answer(req);
  const intAns = answered.response.answers["polish.intensity"];
  const rawIntensity = opts.intensity !== void 0 ? opts.intensity : intAns && intAns.type === "noul" ? intAns.noul : 0.5;
  const budget = polishIntensityBudget(rawIntensity);
  const patches = [];
  if (budget > 0) {
    for (const s of resolvedSlots) {
      if (patches.length >= budget) break;
      const q = questions2[`polish.slot.${s.slot}`];
      const ans = answered.response.answers[`polish.slot.${s.slot}`];
      const pick = ans && ans.type === "choice" ? chosenOption(q, ans).value : "wf-bordered";
      const token = pick !== "none" && POLISH_TOKENS.includes(pick) ? pick : s.slot.startsWith("main") ? "wf-elevated" : "wf-subtle";
      patches.push({ target: s.slot, add: [token] });
    }
  }
  return {
    intensity: Math.round(rawIntensity * 1e3) / 1e3,
    budget,
    patches,
    by: answered.by,
    decisions: compactDecisions(req, answered.response)
  };
}
async function polishWireOnCanvas(port, canvas, all, screens, answerer = stubAnswerer(1), opts = {}) {
  const group = opts.group ?? newGroupId();
  const changed = [];
  let by = answerer.name;
  for (const s of screens) {
    if (isBlueprint(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    if (opts.clear) {
      if (!s.spec.polish || s.spec.polish.length === 0) continue;
      const cleared = { ...s.spec };
      delete cleared.polish;
      if (await writeWire(port, item, cleared, group, s.spec)) {
        changed.push({
          itemId: s.item,
          title: wireTitle(cleared),
          intensity: 0,
          budget: 0,
          patches: [],
          spec: cleared
        });
      }
      continue;
    }
    const planned = await planPolishWithJev(s.spec, answerer, {
      ...opts.intensity !== void 0 ? { intensity: opts.intensity } : {}
    });
    by = planned.by;
    if (planned.patches.length === 0) continue;
    const mergedDecisions = { ...s.spec.decisions ?? {}, ...planned.decisions };
    const { spec: polished } = applyWirePolish(
      Object.keys(mergedDecisions).length > 0 ? { ...s.spec, decisions: mergedDecisions } : s.spec,
      planned.patches
    );
    if (JSON.stringify(polished) === JSON.stringify(s.spec)) continue;
    if (await writeWire(port, item, polished, group, s.spec)) {
      changed.push({
        itemId: s.item,
        title: wireTitle(polished),
        intensity: planned.intensity,
        budget: planned.budget,
        patches: planned.patches,
        spec: polished
      });
    }
  }
  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group
  );
  return { group, by, changed, prototypes };
}

// packages/modules/wireframe/src/behind.ts
function checkState(spec, system, doc) {
  const s = spec.style;
  if (!system) return s?.source === "design-system" ? "no system governs" : "current";
  if (s?.source !== "design-system") return "not in it yet";
  if (s.itemId !== system.id) return "other system";
  if (s.versionId === system.currentVersionId) return "current";
  return doc && stillDraws(s, doc) ? "current" : "behind";
}
function stillDraws(style, doc) {
  if (designSurface(doc.tokens) !== surfaceOf(style)) return false;
  const now = candidatesOf(doc);
  for (const role of ROLES) {
    const was = style.roles[role];
    if (was?.token !== void 0) {
      if (!now[role].some((c) => c.token === was.token && c.value === was.value)) return false;
    } else if (!was || was.why === "none") {
      if (now[role].length > 0) return false;
    }
  }
  return true;
}
function checkWire(canvas, item, spec, docOf) {
  const system = governingSystem(canvas, item);
  const drawn = spec.style?.source === "design-system" ? spec.style : null;
  const index2 = drawn ? canvas.items[drawn.itemId]?.versions.findIndex((v) => v.id === drawn.versionId) : void 0;
  return {
    itemId: item.id,
    state: checkState(spec, system, system ? docOf?.(system) : void 0),
    governedBy: system ? { itemId: system.id, title: system.title, version: system.versions.findIndex((v) => v.id === system.currentVersionId) + 1, versions: system.versions.length } : null,
    drawnBy: drawn ? { itemId: drawn.itemId, version: index2 !== void 0 && index2 >= 0 ? index2 + 1 : null, name: drawn.name ?? null } : "default"
  };
}
function checkWords(c) {
  const d = c.drawnBy;
  const was = typeof d === "string" ? "the default look" : `"${d.name ?? d.itemId}" version ${d.version ?? "?"}`;
  const is = c.governedBy ? `"${c.governedBy.title}" version ${c.governedBy.version} of ${c.governedBy.versions}` : "no system";
  return `${c.state}: drawn in ${was}, governed by ${is}`;
}
function systemName(c) {
  return typeof c.drawnBy !== "string" && c.drawnBy.name ? c.drawnBy.name : c.governedBy?.title ?? "its design system";
}
function restyleLabel(c) {
  return `Restyle to ${systemName(c)}`;
}
function isWire(item) {
  return item.properties?.[FIDELITY_PROP] === "wireframe" && item.properties?.[PROTOTYPE_PROP] === void 0;
}
function specKey(item) {
  const v = currentVersionOf(item);
  return v && v.mimeType === "text/html" ? v.blobHash : null;
}
async function readSystemDoc(system, readText) {
  const v = currentVersionOf(system);
  if (!v) return null;
  try {
    return parseDesign(await readText(v.blobHash));
  } catch {
    return null;
  }
}
function systemsToRead(canvas, specOf) {
  const out = /* @__PURE__ */ new Map();
  for (const item of Object.values(canvas.items)) {
    if (!isWire(item)) continue;
    const key = specKey(item);
    const s = key ? specOf(key)?.style : void 0;
    if (s?.source !== "design-system") continue;
    const system = governingSystem(canvas, item);
    if (system && system.id === s.itemId && system.currentVersionId !== s.versionId) out.set(system.id, system);
  }
  return [...out.values()];
}

// packages/modules/wireframe/src/flesh.ts
function packOnCanvas(all, flow) {
  for (const s of all) {
    const c = s.spec.content;
    if (s.spec.flow !== flow || !c || !c.pack) continue;
    return { pack: c.pack, p: c.source === "pack" ? c.p ?? 1 : 1, leaned: c.pack, by: c.source === "pack" ? c.by ?? "" : c.by, how: "reused" };
  }
  return null;
}
async function packFor(answerer, all, flow, request, flag2) {
  if (flag2 !== void 0) return flagPack(flag2);
  const lent = packOnCanvas(all, flow);
  if (lent) return lent;
  if (!request.trim()) return { pack: GENERIC_PACK, p: 1, leaned: GENERIC_PACK, by: "nobody \u2014 no request to choose from", how: "flag" };
  return choosePack(answerer, request);
}
async function flesh(port, canvas, all, screens, answerer, opts = {}) {
  const group = opts.group ?? newGroupId();
  const choices = /* @__PURE__ */ new Map();
  let calls = 0;
  let inputTokens = 0;
  if (!opts.bars) {
    const flows = /* @__PURE__ */ new Map();
    for (const s of screens) if (!isBlueprint(s.spec) && !flows.has(s.spec.flow)) flows.set(s.spec.flow, s.spec.request);
    await Promise.all([...flows].map(async ([flow, request]) => {
      const choice2 = await packFor(answerer, all, flow, request, opts.pack);
      if (choice2.how === "asked") {
        calls += 1;
        inputTokens += choice2.inputTokens ?? 0;
      }
      choices.set(flow, choice2);
    }));
  }
  const targets = screens.map((screen) => {
    const spec = screen.spec;
    if (!opts.bars && isBlueprint(spec)) return { screen, spec, skipped: "blueprint" };
    if (spec.content?.source === "copy" && !opts.bars && opts.pack === void 0) return { screen, spec, skipped: "copy" };
    if (opts.bars) return { screen, spec: barsSpec(spec) };
    const c = choices.get(spec.flow);
    const meta = c.how === "reused" ? { ...spec.content?.source === "pack" ? { p: spec.content.p, by: spec.content.by } : { p: c.p, by: c.by } } : { p: c.p, by: c.by };
    return { screen, spec: fleshSpec(spec, seedKey(spec, screen.item), packOf(c.pack), meta) };
  });
  const changed = [];
  for (const t of targets) {
    if (t.skipped || JSON.stringify(t.spec) === JSON.stringify(t.screen.spec)) continue;
    if (await writeWire(port, canvas.items[t.screen.item], t.spec, group, t.screen.spec)) changed.push(t);
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, changed.map((t) => ({ item: t.screen.item, spec: t.spec })), group);
  return { group, targets, changed, choices, prototypes, calls, inputTokens };
}
function fleshLines(r) {
  const out = [];
  for (const [flow, choice2] of r.choices) {
    const n = r.targets.filter((t) => t.screen.spec.flow === flow && !t.skipped).length;
    out.push(packLine(choice2, `${n} screen${n === 1 ? "" : "s"} in flow ${flow || "(hand-drawn)"}`));
  }
  const copy = r.targets.filter((t) => t.skipped === "copy");
  const blue = r.targets.filter((t) => t.skipped === "blueprint");
  if (copy.length) out.push(`${copy.length} screen${copy.length === 1 ? "" : "s"} keep${copy.length === 1 ? "s" : ""} the exact words written for ${copy.length === 1 ? "it" : "them"} (${copy.map((t) => wireTitle(t.screen.spec)).join(", ")}) \u2014 --pack <id> or --bars replaces them`);
  if (blue.length) out.push(`${blue.length} blueprint${blue.length === 1 ? "" : "s"} left blue \u2014 nothing is chosen to fill yet`);
  for (const p of r.prototypes) out.push(`prototype ${p.itemId} \u2014 ${p.what === "versioned" ? "rebuilt as a new version" : p.what}`);
  return out;
}
function fleshSummary(r, bars2) {
  const tail = r.changed.length ? " \u2014 one op group: one undo takes it back" : " \u2014 nothing written";
  const asked = r.calls === 0 ? "nothing asked" : `${r.calls} ${r.calls === 1 ? "call" : "calls"} \xB7 ${r.inputTokens.toLocaleString("en-US")} input tokens \xB7 $${(r.inputTokens * JEV_INPUT_PRICE).toFixed(6)}`;
  return `${r.changed.length} of ${r.targets.length} wires ${bars2 ? "back to bars" : "fleshed"} \xB7 ${r.targets.length - r.changed.length} unchanged \xB7 ${asked}${tail}`;
}

// packages/modules/wireframe/src/compose-cli.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// packages/modules/wireframe/src/cli-port.ts
function cliPort(host, ctx, canvasId) {
  return {
    canvasId,
    // Read lazily: the actor is a getter that demands a name, and a read-only verb has no need of one.
    get actor() {
      try {
        return { id: ctx.actor.id, name: ctx.actor.name };
      } catch {
        return void 0;
      }
    },
    canvas: async () => (await ctx.client.snapshot(canvasId)).canvas,
    readText: async (blobHash) => Buffer.from(await ctx.client.downloadBlob(canvasId, blobHash)).toString("utf8"),
    put: async (text, mimeType, filename) => {
      const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), mimeType, filename);
      return { blobHash: upload.blobHash, size: upload.size };
    },
    send: async (op, group) => {
      const result = await host.sendOp(ctx, canvasId, op, group);
      if (op.type !== "item.add") return;
      const at = host.insertionReceiptPlacement(result.envelope.op, op.itemId);
      return { x: at.x ?? 0, y: at.y ?? 0 };
    }
  };
}
function cliAnswerer(ctx, canvasId, name, seed, say) {
  const key = process.env.TYPESAFE_API_KEY;
  const chosen = name ?? (key ? "jev" : "home");
  if (chosen === "stub") return stubAnswerer(seed);
  if (chosen === "jev") return jevAnswerer({ key });
  if (chosen !== "home") throw new Error(`--answerer must be jev, home, stub or agent \u2014 got: ${chosen}`);
  const home = homeAnswerer((question) => ctx.client.judgment(question), canvasId);
  if (name === "home") return home;
  return homeOrStub(home, stubAnswerer(seed), () => say(`the home has no judge either (judgment-unavailable) \u2014 answering with the stub (seed ${seed}), random and honest about it`));
}

// packages/modules/wireframe/src/compose-cli.ts
function saver(dir) {
  if (!dir) return void 0;
  return async (round, calls, responses) => {
    await mkdir(dir, { recursive: true });
    await Promise.all(calls.map(async (call, i) => {
      const name = `round-${round}.${i + 1}`;
      await writeFile(path.join(dir, `${name}.request.json`), JSON.stringify(call.request, null, 2));
      await writeFile(path.join(dir, `${name}.response.json`), JSON.stringify(responses[i], null, 2));
    }));
  };
}
function mappingSaver(dir) {
  if (!dir) return void 0;
  return async (system, versionId, request, response) => {
    await mkdir(dir, { recursive: true });
    const stem = path.join(dir, `style-${system.id}-${versionId}`);
    await writeFile(`${stem}.request.json`, JSON.stringify(request, null, 2));
    await writeFile(`${stem}.response.json`, JSON.stringify(response, null, 2));
  };
}
function registerCompose(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson, placementFor } = host;
  wire.argument("[request...]", "what the screens are for, in words \u2014 composes a flow").option("--answerer <name>", "jev (needs TYPESAFE_API_KEY), home (Jev through the canvas's home, with its key), stub (random, seeded) or agent (you answer: `wire questions` / `wire answer`) \u2014 default jev when the key is set, else the home, else the stub").option("--seed <n>", "the stub's seed", "1").option("--save <dir>", "write each round's requests and responses there as JSON").option("--canvas <canvas>").option("--at <x,y>", "start the row at world coordinates (default: under everything on the canvas)").option("--in <group>", "compose the flow inside this group \u2014 and in its design system, if it has one").option("--basic", "plain grey wires: no sample content and no prototype (the default fleshes the screens and puts the answerer's first choices in a prototype)").option("--flesh", "arrive fleshed \u2014 the default now; kept so older scripts still run").option("--pack <id>", "the content pack to flesh with, instead of asking (`wire flesh --packs` lists them)").option("--pin <key=value...>", "pin root flow decisions up front (for example: --pin platform=web --pin density=compact)").option("--no-ask", "suppress high-entropy root /ask prompts and pick top-1 silently").action(
    run(async (words2, opts, cmd) => {
      const request = words2.join(" ").trim();
      if (!request) {
        cmd.help();
        return;
      }
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const seed = Number(opts.seed);
      if (opts.basic && (opts.pack !== void 0 || opts.flesh)) throw new Error("--basic arrives unfleshed \u2014 it cannot take --pack or --flesh too");
      const pinned = parsePinFlags(opts.pin);
      if (opts.pack !== void 0) flagPack(opts.pack);
      const answerer = opts.answerer === "agent" ? "agent" : cliAnswerer(ctx, p.id, opts.answerer, seed, say);
      const snapshot = await ctx.client.snapshot(p.id);
      const placement = opts.in !== void 0 || opts.at ? placementFor(snapshot, { ...opts.at ? { at: opts.at } : {}, ...opts.in !== void 0 ? { in: opts.in } : {} }, wireSize(requestBlueprint(request, "flow"))) : void 0;
      const blueprintLine = (item, ms) => say(`${item}  "${request}" \u2014 a blueprint, on the canvas in ${ms} ms, before any answer`);
      if (answerer === "agent") {
        const t0 = Date.now();
        const { first, flow } = await startFlow(port, request, placement);
        const firstMs = Date.now() - t0;
        blueprintLine(first.item, firstMs);
        if (ctx.json) return printJson({ flow, items: [first.item], round: 1, answerer: "agent", firstBlueprintMs: firstMs });
        if (!opts.basic) say("sample content waits for the rounds: once the flow is drawn, `isocan wire flesh --flow " + flow + (opts.pack !== void 0 ? " --pack " + opts.pack : "") + "` fills it");
        say(`flow ${flow} is waiting on round 1 of 3. Answer it yourself:
  isocan wire questions > round.json    # Jev's request shape, one call per screen
  (fill each call's "response" in Jev's response shape)
  isocan wire answer round.json          # repeat until the flow is drawn`);
        return;
      }
      const who = answerer.name === "stub" ? `the stub (seed ${opts.seed})${process.env.TYPESAFE_API_KEY ? "" : " \u2014 no TYPESAFE_API_KEY here"}` : answerer.name === "home" ? "Jev through the canvas's home \u2014 no TYPESAFE_API_KEY here, so the home's key answers" : "Jev";
      const composed = await composeFlow(port, request, answerer, {
        ...placement ? { placement } : {},
        say,
        onBlueprint: (first, ms) => {
          blueprintLine(first.item, ms);
          say(`answering with ${who}`);
        },
        ...saver(opts.save) ? { onAsked: saver(opts.save), onMappingAsked: mappingSaver(opts.save) } : {},
        flesh: opts.basic ? false : opts.pack !== void 0 ? { pack: opts.pack } : {},
        ...Object.keys(pinned).length > 0 ? { pinned } : {},
        ...opts.ask === false ? { noAsk: true } : {}
      });
      const { mapper, tallies } = composed;
      if (ctx.json) {
        return printJson({
          flow: composed.flow,
          answerer: composed.by,
          firstBlueprintMs: composed.firstMs,
          totalMs: composed.totalMs,
          screens: composed.screens.map((s) => ({ itemId: s.item, title: s.spec.title, archetype: s.spec.archetype, platform: s.spec.platform, slots: s.spec.slots, ...s.spec.varied ? { varied: s.spec.varied } : {}, ...s.spec.need !== void 0 ? { need: s.spec.need } : {}, ...s.spec.maybe ? { maybe: true } : {}, ...s.spec.by ? { by: s.spec.by } : {} })),
          variations: composed.variants.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), variantOf: v.spec.variantOf, flip: v.spec.flip })),
          rounds: tallies,
          style: composed.style ?? { source: "default" },
          content: composed.pack ? { source: "pack", pack: composed.pack.pack, leaned: composed.pack.leaned, p: composed.pack.p, how: composed.pack.how } : null,
          prototype: composed.prototype ? { itemId: composed.prototype.itemId, title: composed.prototype.title, keptBy: composed.prototype.answerer, screens: composed.prototype.screens.map((s) => ({ itemId: s.item, title: wireTitle(s.spec) })), links: composed.prototype.links.length } : null,
          styleCalls: mapper.calls,
          inputTokens: tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens,
          cost: (tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens) * JEV_INPUT_PRICE
        });
      }
      say(costLine(tallies, composed.by, composed.screens.length, composed.screens.filter((s) => s.spec.maybe).length) + ` \xB7 ${composed.totalMs} ms in all \u2014 \`isocan undo\` takes the whole flow back${composed.prototype ? ", prototype included" : ""}`);
      if (composed.prototype) {
        say(`swap in a variation: \`isocan wire use <variation>\` and \`isocan wire unuse <its screen>\` \u2014 the prototype follows \xB7 \`isocan open ${composed.prototype.itemId}\` plays it`);
      }
    })
  );
}
async function questions(host, opts, cmd) {
  const { ctxOf, resolveCanvas } = host;
  const ctx = await ctxOf(cmd);
  const p = await resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(port, await port.canvas()), opts.flow);
  const file = { flow, round, calls: roundCalls(round, screens) };
  console.log(JSON.stringify(file, null, 2));
}
async function answer(host, file, cmd) {
  const { ctxOf, resolveCanvas, printJson } = host;
  let answered;
  try {
    answered = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${file} is not a JSON file this can read: ${error.message}`);
  }
  const ctx = await ctxOf(cmd);
  const say = (line) => {
    if (!ctx.json) console.log(line);
  };
  const p = await resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(port, await port.canvas()), answered.flow);
  if (answered.round !== round) throw new Error(`${file} answers round ${answered.round}, but flow ${flow} is waiting on round ${round} \u2014 \`isocan wire questions\` prints it`);
  const calls = roundCalls(round, screens);
  const responses = calls.map((call) => {
    const mine = (answered.calls ?? []).find((c) => c.item === call.item);
    if (!mine) throw new Error(`${file} has no call for ${call.item} \u2014 every screen in round ${round} needs its answers`);
    if (Object.keys(call.request.questions).length === 0) return { answers: {} };
    return answeredResponse({ ...call, response: mine.response }, `${file}'s call for ${call.item}`);
  });
  const canvas = new FlowCanvas(port, flow);
  canvas.by = wireBy("agent", port.actor);
  const mapper = new StyleResolver(port, cliAnswerer(ctx, p.id, void 0, 1, say), async () => screens.map((s) => s.spec));
  const styled = await styleAt(port, screens[0].item, mapper);
  canvas.style = styled.system ? styled.style : void 0;
  if (round === 1) for (const line of styled.lines) say(line);
  const after = await applyRound(canvas, round, screens, calls, responses, say);
  const next2 = pendingRound(after.map((s) => s.spec));
  if (ctx.json) return printJson({ flow, round, items: after.map((s) => s.item), next: next2 });
  say(next2 ? `round ${round} applied \u2014 round ${next2} is next: \`isocan wire questions\`` : `round 3 applied \u2014 flow ${flow} is drawn; \`isocan undo\` takes the whole flow back. Put the screens that belong in a prototype with \`isocan wire use <screens...>\`, then \`isocan wire prototype\``);
}

// packages/modules/wireframe/src/vary-cli.ts
function registerVary(host, wire) {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire.command("vary <screen>").description("Add a screen's variations under it \u2014 each flips the least certain remaining decision to its runner-up, from the distribution the answerer already gave").option("--canvas <canvas>").option("--count <n>", `how many variations the screen should have in all (default ${DEFAULT_VARIATIONS})`).action(
    run(async (ref, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const count2 = opts.count === void 0 ? DEFAULT_VARIATIONS : Number(opts.count);
      if (!Number.isInteger(count2) || count2 < 0) throw new Error(`--count must be a whole number \u2014 got: ${opts.count}`);
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const item = resolveItem(snapshot, ref);
      const port = cliPort(host, ctx, p.id);
      const wires = await wiresOn(port, snapshot.canvas);
      const screen = wires.find((w) => w.item === item.id);
      if (!screen) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire "<request>"\` composes some`);
      if (screen.spec.variantOf) {
        const of = snapshot.canvas.items[screen.spec.variantOf];
        throw new Error(`"${item.title}" is a variation${of ? ` of "${of.title}"` : ""} \u2014 vary the screen itself: \`isocan wire vary ${screen.spec.variantOf}\``);
      }
      if (decisions(screen.spec).length === 0) {
        throw new Error(`"${item.title}" carries no answerer's distribution (drawn by hand, or not yet answered) \u2014 there is nothing to vary it from`);
      }
      const siblings = wires.filter((w) => w.spec.variantOf === screen.item);
      const canvas = new FlowCanvas(port, newGroupId());
      if (screen.spec.by) canvas.by = { ...screen.spec.by, ...port.actor ? { actor: port.actor } : {} };
      const made = await addVariations(canvas, screen, siblings, count2);
      const left = honestFlips(screen.spec, [...siblings, ...made].map((v) => v.spec.flip).filter(Boolean));
      if (ctx.json) {
        return printJson({
          screen: screen.item,
          added: made.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), flip: v.spec.flip })),
          siblings: siblings.length + made.length,
          honestLeft: left.length
        });
      }
      for (const v of made) console.log(`${v.item}  ${wireTitle(v.spec)}`);
      const total = siblings.length + made.length;
      if (made.length === 0 && total === 0) {
        console.log(`"${item.title}" \u2014 one way to draw this: no decision's runner-up reached ${VARIATION_FLOOR.toFixed(2)}`);
      } else if (made.length === 0) {
        console.log(`"${item.title}" already has ${total} variation${total === 1 ? "" : "s"}${left.length ? ` \u2014 --count ${total + 1} adds the next (${flipWords(left[0])})` : ", and no honest alternative is left"}`);
      } else {
        console.log(`${made.length} added under "${item.title}" (${total} in all)${left.length ? "" : " \u2014 no honest alternative is left"} \xB7 \`isocan undo\` takes them back`);
      }
    })
  );
  wire.command("keep <items...>").description(`Use screens in the prototype (${KEEP_EMOJI}) \u2014 a property on the item, as a slide is, so anyone can take it off. \`wire use\` says the same`).option("--canvas <canvas>").action(markScreens(host, true));
  wire.command("unkeep <items...>").description(`Take screens out of the prototype (${KEEP_EMOJI}) \u2014 anyone's mark, not only your own. \`wire unuse\` says the same`).option("--canvas <canvas>").action(markScreens(host, false));
  wire.command("kept").description(`List the screens in the prototype (${KEEP_EMOJI}) in reading order \u2014 rows top to bottom, each left to right`).option("--canvas <canvas>").option("--prototype <item>", "only the screens this prototype plays, in its order \u2014 its flow's screens in the prototype and any guest from another flow (what selecting it lights on the canvas)").action(
    run(async (opts, cmd) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const canvas = snapshot.canvas;
      let list = kept(canvas);
      if (opts.prototype !== void 0) {
        const proto = resolveItem(snapshot, opts.prototype);
        if (proto.properties?.[PROTOTYPE_PROP] === void 0) throw new Error(`${proto.id} is not a prototype \u2014 \`isocan ls --filter Prototype\` finds them`);
        const port = cliPort(host, ctx, p.id);
        list = prototypeScreens(canvas, proto, await wiresOn(port, canvas));
        if (!ctx.json && list.length === 0) {
          console.log(`nothing prototype ${proto.id} plays is marked for it any more \u2014 \`isocan wire use <screens...>\` (${KEEP_EMOJI}) and it follows`);
          return;
        }
      }
      if (ctx.json) return printJson(list.map((i, n) => ({ n: n + 1, itemId: i.id, title: i.title })));
      if (list.length === 0) {
        console.log(`no screen is in the prototype \u2014 \`isocan wire use <screens...>\` marks them ${KEEP_EMOJI}`);
        return;
      }
      list.forEach((i, n) => console.log(`${String(n + 1).padStart(2)}. ${KEEP_EMOJI} ${i.id}  ${i.title}`));
    })
  );
}
function markScreens(host, on) {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;
  return run(async (refs, _local, cmd) => {
    const ctx = await ctxOf(cmd);
    const p = await resolveCanvas(ctx);
    const snapshot = await ctx.client.snapshot(p.id);
    const items = refs.map((ref) => resolveItem(snapshot, ref));
    const refused = items.filter((item) => !keepable(item) || item.properties?.[PROTOTYPE_PROP] !== void 0);
    if (refused.length) {
      throw new Error(`not a wireframe screen: ${refused.map((i) => `"${i.title}"`).join(", ")} \u2014 a prototype plays screens \`isocan wire\` drew`);
    }
    const group = newGroupId();
    const changed = [];
    const port = cliPort(host, ctx, p.id);
    const who = port.actor?.id;
    for (const item of items) {
      if (isKept(item) === on || changed.includes(item.id)) continue;
      await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: keepPatch(on, who) }, group);
      changed.push(item.id);
    }
    const followed = changed.length ? await followMarks(port, changed, group) : [];
    if (ctx.json) return printJson({ [on ? "kept" : "unkept"]: changed, unchanged: items.filter((i) => !changed.includes(i.id)).map((i) => i.id), prototypes: followed });
    for (const item of items) {
      const moved = changed.includes(item.id);
      console.log(`${item.id}  ${on ? KEEP_EMOJI : "  "} "${item.title}" ${on ? moved ? "in the prototype" : "was already in the prototype" : moved ? "removed from the prototype" : "was not in the prototype"}`);
    }
    const now = kept((await ctx.client.snapshot(p.id)).canvas).length;
    console.log(`${now} screen${now === 1 ? "" : "s"} in the prototype${changed.length && followed.length === 0 ? " \u2014 `isocan wire prototype` builds one for a flow that has none" : ""}`);
    for (const f of followed) console.log(followedLine(f));
  });
}

// packages/modules/wireframe/src/links-cli.ts
async function keptFlows(port) {
  const canvas = await port.canvas();
  return keptFlowsOf(canvas, await wiresOn(port, canvas));
}
function linkLine(l, title) {
  const where = l.to === LINK_BACK ? "back" : l.to ? `\u2192 "${title(l.to)}"` : l.needs ? `- - needs ${l.needs}` : "off";
  return `  ${l.key.padEnd(18)} ${l.label.padEnd(16)} ${where.padEnd(28)} ${l.rule}${l.to && l.to !== LINK_BACK ? `, ${l.transition}` : ""}`;
}
function registerLinks(host, wire) {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire.command("links [screen]").description("Print where every hotspot on the screens in the prototype goes \u2014 inferred from intents, archetypes and reading order, and any override set with `wire link`").option("--canvas <canvas>").option("--flow <flow>", "which flow's prototype (default: the only one)").action(
    run(async (ref, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const flows = await keptFlows(cliPort(host, ctx, p.id));
      const only = ref ? resolveItem(snapshot, ref) : null;
      const flow = only ? flows.find((f) => f.screens.some((s) => s.id === only.id) && !f.guests.includes(only.id)) : pickKeptFlow(flows, opts.flow);
      if (!flow) throw new Error(`"${only.title}" is not in the prototype \u2014 links run between the screens in it (\`isocan wire use ${only.id}\`)`);
      const links = inferLinks(flow.screens, { withNone: true });
      const shown = links.filter((l) => only ? l.from === only.id : !flow.guests.includes(l.from));
      if (ctx.json) return printJson({ flow: flow.flow, request: flow.request, screens: flow.screens.map((s) => ({ itemId: s.id, title: s.title })), links: shown });
      const title = (id) => flow.screens.find((s) => s.id === id)?.title ?? id;
      for (const s of flow.screens) {
        if (only && s.id !== only.id || flow.guests.includes(s.id)) continue;
        console.log(`${s.id}  "${s.title}" (${s.spec.archetype})`);
        const mine = shown.filter((l) => l.from === s.id);
        if (mine.length === 0) console.log("  (no hotspot that navigates)");
        for (const l of mine) console.log(linkLine(l, title));
      }
      const missing = shown.filter((l) => l.to === null && l.needs);
      const needs = [...new Set(missing.map((l) => l.needs))];
      console.log(`
${shown.length} links \xB7 ${missing.length} dashed${needs.length ? ` \u2014 still to make: ${needs.join(", ")}` : ""}`);
    })
  );
  wire.command("link <screen> <element> [target]").description("Override where one hotspot goes: to a screen, or --none to switch it off; --clear gives it back to the rules. A property on the source screen").option("--canvas <canvas>").option("--none", "the hotspot goes nowhere").option("--back", "the hotspot goes back, whatever the rules say").option("--clear", "forget the override \u2014 the rules decide again").action(
    run(async (ref, element, target, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const given = [target !== void 0, Boolean(opts.none), Boolean(opts.back), Boolean(opts.clear)].filter(Boolean).length;
      if (given !== 1) throw new Error("say where it goes: a <target> screen, or one of --none, --back, --clear");
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const item = resolveItem(snapshot, ref);
      const port = cliPort(host, ctx, p.id);
      const [source] = await wiresOn(port, { ...snapshot.canvas, items: { [item.id]: item } });
      if (!source) throw new Error(`"${item.title}" is not a wireframe screen \u2014 links start on screens \`isocan wire\` drew`);
      const keys = hotspots(source.spec).map((h) => h.key);
      const matches = keys.includes(element) ? [element] : keys.filter((k) => k.endsWith(`#${element}`));
      if (matches.length !== 1) {
        throw new Error(`${matches.length === 0 ? `"${item.title}" has no hotspot "${element}"` : `"${element}" is on more than one slot`} \u2014 its hotspots: ${keys.join(", ")} (\`isocan wire links ${item.id}\`)`);
      }
      const key = matches[0];
      let value;
      let to = null;
      if (opts.clear) value = null;
      else if (opts.none) value = LINK_NONE;
      else if (opts.back) value = LINK_BACK;
      else {
        to = resolveItem(snapshot, target);
        if (to.properties?.[FIDELITY_PROP] !== "wireframe" || to.properties?.[PROTOTYPE_PROP] !== void 0) throw new Error(`"${to.title}" is not a wireframe screen \u2014 a link goes to a screen`);
        value = to.id;
      }
      const { overrides } = await setLinkOverride(port, item, key, value, newGroupId());
      const keptNow = to ? isKept(to) : true;
      if (ctx.json) return printJson({ itemId: item.id, key, to: value, overrides });
      const said = value === null ? "back to the rules" : value === LINK_NONE ? "switched off" : value === LINK_BACK ? "goes back" : `goes to "${to.title}"`;
      console.log(`${item.id}  "${item.title}" ${key} ${said}${keptNow ? "" : ` \u2014 "${to.title}" is not in the prototype, so the link draws dashed until it is`} \xB7 \`isocan undo\` takes it back`);
    })
  );
  wire.command("prototype").description("Assemble the screens in the prototype (\u{1F4D0}) as one clickable HTML item above them \u2014 rebuilt, it gains a version rather than being replaced").option("--canvas <canvas>").option("--flow <flow>", "which flow's prototype (default: the only one)").action(
    run(async (_local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const flow = pickKeptFlow(keptFlowsOf(canvas, await wiresOn(port, canvas)), opts.flow);
      const { itemId, title, links, what } = await writePrototype(port, canvas, flow, newGroupId());
      const after = await ctx.client.snapshot(p.id);
      const versions = after.canvas.items[itemId]?.versions.length ?? 0;
      const dashed = links.filter((l) => l.to === null && l.needs);
      if (ctx.json) return printJson({ itemId, title, flow: flow.flow, screens: flow.screens.length, links: links.length, dashed: dashed.length, versions, [what]: true });
      console.log(`${itemId}  "${title}" \u2014 ${what === "added" ? "added above its screens" : what === "versioned" ? `version ${versions}` : what === "moved" ? `moved back above its flow (still version ${versions})` : `unchanged (still version ${versions}) \u2014 no screen in it has changed`}`);
      console.log(`  ${flow.screens.length} screens: ${flow.screens.map((s) => s.title).join(" \xB7 ")}`);
      console.log(`  ${links.length} links, ${dashed.length} dashed${dashed.length ? ` (needs ${[...new Set(dashed.map((l) => l.needs))].join(", ")})` : ""} \xB7 \`isocan open ${itemId}\` plays it${what === "unchanged" ? "" : " \xB7 `isocan undo` takes it back"}`);
    })
  );
}

// packages/modules/wireframe/src/style-cli.ts
import { existsSync, readFileSync } from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
var OWN_DIR = "packages/modules/wireframe";
var PACKS_DIR = "packages/modules/design-competition";
function rootPath(...parts) {
  let dir = path2.dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 12; up++) {
    const manifest = path2.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, "utf8")).name === "isocan") {
          return path2.join(dir, ...parts);
        }
      } catch {
      }
    }
    dir = path2.dirname(dir);
  }
  return path2.join(dir, ...parts);
}
function presetText(preset) {
  const rel = presetFile(preset);
  const where = preset.from === "own" ? moduleAsset(wireframeModule.name, rel) ?? rootPath(OWN_DIR, rel) : rootPath(PACKS_DIR, rel);
  if (!existsSync(where)) {
    throw new Error(preset.from === "pack" ? `the design competition's packs are not on this machine, so "${preset.id}" cannot be read \u2014 the module's own styles can (\`isocan wire style --list\`)` : `the ${preset.name} wire style's DESIGN.md is missing from this install (${rel})`);
  }
  return readFileSync(where, "utf8");
}
function readable(preset) {
  try {
    presetText(preset);
    return true;
  } catch {
    return false;
  }
}
function registerStyle(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("style").description("Restyle every wire in the design system that governs it \u2014 Jev maps the system's tokens onto the wire's roles, once per system version; one op group, a version per changed wire. --preset <name> chooses a named wire style for the flows (material, shadcn, glass, ios, fluent, carbon, brutalist, a design-competition pack, or house for the greys); --list names them; --default restores the greys; --check lists wires behind their system").argument("[screens...]", "only these screens' flows (ids, titles or #refs) \u2014 every wire when none").option("--canvas <canvas>").option("--preset <name>", "a wire style: its DESIGN.md placed beside the flow and made its group's (or the canvas's) design system, and the flow restyled \u2014 one op group; house returns to the greys and lets the style's file go").option("--list", "write nothing: name the wire styles --preset takes, and say which cannot be read here").option("--default", "back to the default wire look (the greys)").option("--check", "write nothing: list the wires that are behind the system that governs them").option("--flow <flow>", "only this flow's screens and their variations").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      if (opts.default && opts.check) throw new Error("--default writes and --check does not \u2014 say one");
      if (opts.preset !== void 0 && (opts.default || opts.check)) throw new Error("--preset chooses a look; --default and --check do other things \u2014 say one (--preset house is the greys)");
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      if (opts.list) return listPresets(ctx.json, printJson, say);
      const choice2 = opts.preset === void 0 ? void 0 : presetOrSay(opts.preset);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const named = (refs ?? []).map((ref) => {
        const item = host.resolveItem({ canvas }, ref);
        if (!all.some((s) => s.item === item.id)) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire "<request>"\` composes some`);
        return item.id;
      });
      const inFlow = opts.flow === void 0 ? all : all.filter((s) => s.spec.flow === opts.flow);
      const screens = named.length ? flowScreens(inFlow, named) : inFlow;
      if (screens.length === 0) {
        throw new Error(opts.flow === void 0 && !named.length ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in ${named.length ? "those screens' flows" : `flow "${opts.flow}"`} on this canvas`);
      }
      if (choice2 !== void 0) {
        const text = choice2 === HOUSE ? null : presetText(choice2);
        const answerer2 = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
        const resolver2 = new StyleResolver(port, answerer2, async () => all.map((s) => s.spec), mappingSaver(opts.save));
        const r = await applyPreset(port, all, screens, choice2, text, resolver2);
        if (ctx.json) {
          return printJson({
            group: r.group,
            preset: r.name,
            placed: r.placed,
            restyled: r.restyled.changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec) })),
            unchanged: r.restyled.targets.filter((t) => !r.restyled.changed.includes(t)).map((t) => t.item.id),
            prototypes: r.restyled.prototypes,
            calls: resolver2.calls,
            cost: resolver2.cost()
          });
        }
        for (const m of resolver2.mappings.values()) for (const line of mappingLines(m, resolver2.who)) say(line);
        for (const pl of r.placed) say(`${pl.itemId} \u2014 ${pl.what === "added" ? "placed beside the flow and made" : pl.what === "versioned" ? "a new version of" : pl.what === "removed" ? "moved to the trash; no longer" : "already"} the design system of ${pl.scope ? `group ${pl.scope}` : "the canvas"}`);
        for (const pr of r.restyled.prototypes) say(`prototype ${pr.itemId} \u2014 ${pr.what === "versioned" ? "rebuilt as a new version" : pr.what}`);
        say(presetSummary(r).replace("one undo takes", "`isocan undo` takes"));
        return;
      }
      if (opts.check) {
        const read = /* @__PURE__ */ new Map();
        for (const system of systemsToRead(canvas, (hash3) => all.find((s) => specKey(canvas.items[s.item]) === hash3)?.spec)) read.set(system.id, await readSystemDoc(system, (h) => port.readText(h)));
        return check2(canvas, screens.map((s) => ({ screen: s, item: canvas.items[s.item] })), (system) => read.get(system.id), ctx.json, printJson, say);
      }
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec), mappingSaver(opts.save));
      const result = await restyle(port, canvas, all, screens, resolver, { toDefault: Boolean(opts.default) });
      const { targets, changed, prototypes, group } = result;
      const mappings = [...resolver.mappings.values()];
      const by = resolver.who;
      if (ctx.json) {
        return printJson({
          group,
          style: opts.default ? "default" : "design-system",
          systems: mappings.map((m) => ({ itemId: m.system.id, versionId: m.versionId, version: m.version, name: m.name, how: m.how, roles: m.roles, wires: targets.filter((t) => t.system?.id === m.system.id).length })),
          restyled: changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec), style: t.style.source === "design-system" ? t.style.itemId : "default" })),
          unchanged: targets.filter((t) => !changed.includes(t)).map((t) => t.item.id),
          prototypes,
          calls: resolver.calls,
          inputTokens: resolver.inputTokens,
          cost: resolver.cost(),
          answerer: by
        });
      }
      for (const m of mappings) {
        const governed = targets.filter((t) => t.system?.id === m.system.id);
        for (const line of mappingLines(m, by)) say(line);
        say(`  governs ${governed.length} wire${governed.length === 1 ? "" : "s"}`);
      }
      const inDefault = targets.filter((t) => t.style.source === "default").length;
      if (inDefault) say(`${inDefault} wire${inDefault === 1 ? "" : "s"} in the default look${opts.default ? "" : " \u2014 no design system governs where they sit"}`);
      for (const pr of prototypes) say(`prototype ${pr.itemId} \u2014 ${pr.what === "versioned" ? "rebuilt as a new version" : pr.what}`);
      say(restyleSummary(result).replace("one undo takes", "`isocan undo` takes"));
    })
  );
  wire.command("ds [request...]").description("Synthesize a WCAG AA contrast-repaired DESIGN.md with Jev, make it govern the flow's scope, and restyle all screens and prototype in one op group").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--name <name>", "explicit name for the synthesized design system").option("--surface <surface>", "override surface mode: flat | raised | glass | bold").action(
    run(async (words2, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const screens = opts.flow === void 0 ? all : all.filter((s) => s.spec.flow === opts.flow);
      if (screens.length === 0) {
        throw new Error(opts.flow === void 0 ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in flow "${opts.flow}" on this canvas`);
      }
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const r = await wireDsOnCanvas(port, all, screens, words2.join(" "), answerer, {
        ...opts.name ? { name: opts.name } : {},
        ...opts.surface ? { surface: opts.surface } : {}
      });
      if (ctx.json) {
        return printJson({
          group: r.group,
          dsItemId: r.dsItemId,
          what: r.what,
          direction: r.synthesized.direction.id,
          surface: r.synthesized.surface,
          density: r.synthesized.density,
          repairs: r.synthesized.repairs,
          restyled: r.restyled.changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec) })),
          prototypes: r.restyled.prototypes
        });
      }
      say(`${r.dsItemId}  ${r.synthesized.name} (${r.synthesized.direction.id} \xB7 surface:${r.synthesized.surface} \xB7 density:${r.synthesized.density} \xB7 p ${r.synthesized.p.toFixed(2)})`);
      if (r.synthesized.repairs.length > 0) {
        say(`  repaired ${r.synthesized.repairs.length} contrast pair${r.synthesized.repairs.length === 1 ? "" : "s"} to \u2265 4.5:1 AA`);
      }
      say(`${r.restyled.changed.length} of ${r.restyled.targets.length} wires restyled \u2014 \`isocan undo\` takes it back`);
    })
  );
  wire.command("polish [screens...]").description("Apply Jev-budgeted visual refinement patches (0 | 4 | 8 | 12) guarded by verifyWireContract in one op group").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--intensity <n>", "override polish_intensity (0\u20131)").option("--clear", "remove polish patches from target screens").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const named = (refs ?? []).map((ref) => {
        const item = host.resolveItem({ canvas }, ref);
        const found = all.find((s) => s.item === item.id);
        if (!found) throw new Error(`"${item.title}" is not a wireframe screen`);
        return found;
      });
      const screens = named.length ? named : opts.flow === void 0 ? all : all.filter((s) => s.spec.flow === opts.flow);
      if (screens.length === 0) {
        throw new Error('no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some');
      }
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const r = await polishWireOnCanvas(port, canvas, all, screens, answerer, {
        ...opts.intensity !== void 0 ? { intensity: Number(opts.intensity) } : {},
        ...opts.clear ? { clear: true } : {}
      });
      if (ctx.json) {
        return printJson({
          group: r.group,
          by: r.by,
          changed: r.changed.map((c) => ({
            itemId: c.itemId,
            title: c.title,
            intensity: c.intensity,
            budget: c.budget,
            patches: c.patches
          })),
          prototypes: r.prototypes
        });
      }
      for (const c of r.changed) {
        say(`${c.itemId}  ${c.title} \u2014 ${c.patches.length} polish patch${c.patches.length === 1 ? "" : "es"} (intensity ${c.intensity}, budget ${c.budget})`);
      }
      say(`${r.changed.length} of ${screens.length} wire${screens.length === 1 ? "" : "s"} ${opts.clear ? "unpolished" : "polished"} (${r.by})${r.prototypes.length ? ", prototype rebuilt" : ""} \u2014 \`isocan undo\` takes it back`);
    })
  );
}
function listPresets(json2, printJson, say) {
  const rows = [
    { id: HOUSE, name: "House", about: "the default greys \u2014 lets go of a wire style's DESIGN.md", from: "house", readable: true },
    ...[...OWN_PRESETS, ...PACK_PRESETS].map((p) => ({ ...p, readable: readable(p) }))
  ];
  if (json2) return printJson({ presets: rows });
  for (const r of rows) say(`${r.id.padEnd(10)} ${r.about}${r.readable ? "" : " \u2014 not readable on this machine"}`);
  say("`isocan wire style --preset <name> [screens\u2026]` \u2014 one op group; `isocan undo` takes it back");
}
function check2(canvas, wires, docOf, json2, printJson, say) {
  const rows = wires.map(({ screen, item }) => ({ ...checkWire(canvas, item, screen.spec, docOf), title: wireTitle(screen.spec) }));
  if (json2) return printJson({ wires: rows, behind: rows.filter((r) => r.state !== "current").length });
  const off = rows.filter((r) => r.state !== "current");
  for (const r of off) say(`${r.itemId}  ${r.title} \u2014 ${checkWords(r)}${r.state === "behind" ? ` \xB7 ${restyleLabel(r)}: \`isocan wire style ${r.itemId}\`` : ""}`);
  say(off.length === 0 ? `all ${rows.length} wires draw in the system that governs them \u2014 nothing to bring forward` : `${off.length} of ${rows.length} wires are not in the system that governs them \u2014 \`isocan wire style\` brings them forward`);
}

// packages/modules/wireframe/src/flesh-cli.ts
import { readFile as readFile2 } from "node:fs/promises";
async function screensFor(host, snapshot, all, refs, flow) {
  if (refs.length > 0) {
    return refs.map((ref) => {
      const item = host.resolveItem(snapshot, ref);
      const found = all.find((s) => s.item === item.id);
      if (!found) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire "<request>"\` composes some`);
      return found;
    });
  }
  const screens = flow === void 0 ? all : all.filter((s) => s.spec.flow === flow);
  if (screens.length === 0) throw new Error(flow === void 0 ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in flow "${flow}" on this canvas`);
  return screens;
}
function registerFlesh(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("flesh [screens...]").description("Fill wires with sample content instead of grey bars \u2014 Jev picks one content pack per flow from its request (p recorded; --pack <id> overrides); one op group, a version per changed wire. --bars goes back to bars").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens and their variations").option("--bars", "back to bars: take the content off").option("--packs", "write nothing: list the content packs").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      if (opts.packs) {
        if (cmd.optsWithGlobals().json) return printJson({ packs: PACKS.map((p2) => ({ id: p2.id, name: p2.name, about: p2.about, motifs: p2.motifs })) });
        for (const p2 of PACKS) console.log(`${p2.id.padEnd(14)} ${p2.name} \u2014 ${p2.about}`);
        return;
      }
      if (opts.bars && opts.pack !== void 0) throw new Error("--bars takes content off and --pack puts it on \u2014 say one");
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const snapshot = await ctx.client.snapshot(p.id);
      const all = await wiresOn(port, snapshot.canvas);
      const screens = await screensFor(host, snapshot, all, refs, opts.flow);
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const r = await flesh(port, snapshot.canvas, all, screens, answerer, { ...opts.pack !== void 0 ? { pack: opts.pack } : {}, bars: Boolean(opts.bars) });
      if (ctx.json) {
        return printJson({
          group: r.group,
          content: opts.bars ? "bars" : "pack",
          packs: [...r.choices].map(([flow, c]) => ({ flow, pack: c.pack, leaned: c.leaned, p: c.p, how: c.how, by: c.by })),
          fleshed: r.changed.map((t) => ({ itemId: t.screen.item, title: wireTitle(t.spec), pack: t.spec.content?.pack ?? null, heading: t.spec.content?.title ?? null })),
          unchanged: r.targets.filter((t) => !r.changed.includes(t)).map((t) => ({ itemId: t.screen.item, ...t.skipped ? { skipped: t.skipped } : {} })),
          prototypes: r.prototypes,
          calls: r.calls,
          inputTokens: r.inputTokens
        });
      }
      for (const line of fleshLines(r)) say(line);
      for (const t of r.changed) say(`${t.screen.item}  ${wireTitle(t.spec)}${t.spec.content?.title ? ` \u2014 "${t.spec.content.title}"` : ""}`);
      say(fleshSummary(r, Boolean(opts.bars)).replace("one undo takes", "`isocan undo` takes"));
    })
  );
  wire.command("copy [screens...]").description(`Print a fleshed screen's words and JSON schema by slot and path; --apply <file> writes exact words back (source "copy") as one version; --ai fills schema-validated copy across one screen or flow`).option("--canvas <canvas>").option("--flow <flow>", "with --ai: only this flow's screens").option("--apply <file>", 'a JSON file: { "title"?: string, "slots": { "<slot>": { "<path>": "words" } | ["words", \u2026] } }').option("--ai", "generate schema-validated copy across target screen(s) in one op group").option("--brief <words>", "extra domain or tone brief for --ai").option("--by <name>", "who wrote the words \u2014 recorded on the screen", "agent").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const snapshot = await ctx.client.snapshot(p.id);
      const all = await wiresOn(port, snapshot.canvas);
      if (opts.ai) {
        const screens = await screensFor(host, snapshot, all, refs, opts.flow);
        const gen = resolveTextGenerator({
          seed: Number(opts.seed ?? 1),
          useStub: opts.answerer === "stub"
        });
        const r = await copyAiOnCanvas(port, snapshot.canvas, all, screens, gen, {
          ...opts.brief ? { brief: opts.brief } : {}
        });
        if (ctx.json) {
          return printJson({
            group: r.group,
            by: r.by,
            changed: r.changed.map((c) => ({ itemId: c.itemId, title: c.title, content: c.spec.content })),
            prototypes: r.prototypes
          });
        }
        for (const c of r.changed) {
          console.log(`${c.itemId}  ${c.title}${c.spec.content?.title ? ` \u2014 "${c.spec.content.title}"` : ""}`);
        }
        console.log(
          `${r.changed.length} of ${screens.length} wire${screens.length === 1 ? "" : "s"} filled with AI copy (${r.by})${r.prototypes.length ? ", prototype rebuilt" : ""} \u2014 \`isocan undo\` takes it back`
        );
        return;
      }
      const ref = refs[0];
      if (!ref) throw new Error("missing required argument 'screen' (or pass --ai)");
      const [screen] = await screensFor(host, snapshot, all, [ref], void 0);
      const spec = screen.spec;
      if (!opts.apply) {
        const words2 = copyOf(spec);
        if (!spec.content) throw new Error(`"${wireTitle(spec)}" draws bars \u2014 \`isocan wire flesh ${screen.item}\` fills it first; then \`wire copy\` prints its words to replace`);
        console.log(JSON.stringify({
          screen: screen.item,
          title: words2.title,
          ...spec.content.bar !== void 0 ? { bar: spec.content.bar } : {},
          content: words2.content,
          schema: blockContentSchema(spec),
          slots: Object.fromEntries(words2.slots.map((s) => [s.slot, { block: s.block, words: s.words }]))
        }, null, 2));
        return;
      }
      let raw;
      try {
        raw = JSON.parse(await readFile2(opts.apply, "utf8"));
      } catch (error) {
        throw new Error(`${opts.apply} is not a JSON file this can read: ${error.message}`);
      }
      const validated = validateCopyPayload(spec, raw);
      const next2 = applyCopy(spec, validated, opts.by);
      if (JSON.stringify(next2) === JSON.stringify(spec)) {
        if (ctx.json) return printJson({ itemId: screen.item, changed: false });
        console.log(`${screen.item}  ${wireTitle(spec)} \u2014 the same words; nothing written`);
        return;
      }
      const item = snapshot.canvas.items[screen.item];
      const filename = currentVersionOf(item)?.filename ?? "wireframe.html";
      const group = newGroupId();
      const upload = await port.put(renderWire(next2), "text/html", filename);
      await port.send({ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
      const prototypes = await rebuildPrototypes(port, snapshot.canvas, all, [{ item: item.id, spec: next2 }], group);
      if (ctx.json) return printJson({ itemId: item.id, changed: true, group, content: next2.content, prototypes });
      console.log(`${item.id}  ${wireTitle(next2)} \u2014 exact copy by ${opts.by}, one version${prototypes.length ? `, prototype rebuilt` : ""} \u2014 \`isocan undo\` takes it back`);
    })
  );
  wire.command("name [screens...]").description("Name a flow's brand, per-screen titles, and shared navigation bar labels coherently in one op group").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--request <words>", "override the flow request when naming").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const snapshot = await ctx.client.snapshot(p.id);
      const all = await wiresOn(port, snapshot.canvas);
      const screens = await screensFor(host, snapshot, all, refs, opts.flow);
      const gen = resolveTextGenerator({
        seed: Number(opts.seed ?? 1),
        useStub: opts.answerer === "stub"
      });
      const r = await nameFlowOnCanvas(port, snapshot.canvas, all, screens, gen, {
        ...opts.request ? { request: opts.request } : {}
      });
      if (ctx.json) {
        return printJson({
          group: r.group,
          by: r.by,
          brand: r.brand,
          navLabels: r.navLabels,
          changed: r.changed.map((c) => ({ itemId: c.itemId, title: c.title })),
          prototypes: r.prototypes
        });
      }
      console.log(`brand: ${r.brand} \xB7 nav: ${r.navLabels.join(" \xB7 ") || "none"}`);
      for (const c of r.changed) {
        console.log(`${c.itemId}  ${c.title}`);
      }
      console.log(
        `${r.changed.length} wire${r.changed.length === 1 ? "" : "s"} named (${r.by})${r.prototypes.length ? ", prototype rebuilt" : ""} \u2014 \`isocan undo\` takes it back`
      );
    })
  );
}

// packages/modules/wireframe/src/play-cli.ts
function registerPlay(host, wire) {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire.command("play <screen> [element]").description("Print the address that opens the flow's prototype full screen AT this screen of it \u2014 with [element], its hotspot pointed out. What an arrow's Play from here opens").option("--canvas <canvas>").action(
    run(async (ref, element, _local, cmd) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const screen = resolveItem(snapshot, ref);
      const flows = keptFlowsOf(snapshot.canvas, await wiresOn(cliPort(host, ctx, p.id), snapshot.canvas));
      const flow = flows.find((f) => f.screens.some((s) => s.id === screen.id));
      if (!flow) throw new Error(`"${screen.title}" is not in the prototype \u2014 a prototype plays the screens used in it (\`isocan wire use ${screen.id}\`)`);
      const proto = Object.values(snapshot.canvas.items).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
      if (!proto) throw new Error(`this flow has no prototype yet \u2014 \`isocan wire prototype${flows.length > 1 ? ` --flow ${flow.flow}` : ""}\` makes one`);
      let key;
      if (element !== void 0) {
        const keys = hotspots(flow.screens.find((s) => s.id === screen.id).spec).map((h) => h.key);
        const matches = keys.includes(element) ? [element] : keys.filter((k) => k.endsWith(`#${element}`));
        if (matches.length !== 1) throw new Error(`${matches.length === 0 ? `"${screen.title}" has no hotspot "${element}"` : `"${element}" is on more than one slot`} \u2014 its hotspots: ${keys.join(", ")}`);
        key = matches[0];
      }
      const origin = await ctx.homeOf(p.id) ?? ctx.client.base;
      const url = `${itemUrl(origin, p.id, proto.id)}?at=${encodeURIComponent(playAnchor(screen.id, key))}`;
      if (ctx.json) return printJson({ prototype: proto.id, screen: screen.id, ...key ? { hotspot: key } : {}, url });
      console.log(url);
      console.log(`  "${proto.title}" at "${screen.title}"${key ? `, ${key} pointed out` : ""} \u2014 open it in a browser signed in to this canvas (\`isocan open\` signs one in)`);
    })
  );
}

// packages/modules/wireframe/src/edit-cli.ts
function registerEditAndWhy(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("edit [words...]").description("Surgically edit a single slot or layout setting on an existing wireframe screen (`content`, `add`, `remove`, `variant`, `restyle`) in one op group, rebuilding its prototype automatically").option("--canvas <canvas>").option("--screen <item>", "target wireframe screen item id or title (default: Jev picks from the instruction)").option("--kind <kind>", `explicit edit kind (${EDIT_KINDS.join(", ")})`).option("--slot <slot>", "explicit target slot id (for example: main.1, main.2, header, nav)").option("--block <block>", "replacement or added block id").option("--density <density>", "spacing density override (compact, default, spacious)").option("--template <template>", "multi-region layout template override").option("--answerer <name>", "jev, home, or stub").option("--seed <n>", "the stub's seed", "1").action(
    run(
      async (words2, _local, cmd) => {
        const opts = cmd.optsWithGlobals();
        const ctx = await ctxOf(cmd);
        const say = (line) => {
          if (!ctx.json) console.log(line);
        };
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const all = await wiresOn(port, await port.canvas());
        if (all.length === 0) {
          throw new Error('no wireframe screens on this canvas \u2014 `isocan wire "<request>"` composes some');
        }
        let screenId = opts.screen;
        let instruction = words2.join(" ").trim();
        if (!screenId && words2.length > 1) {
          const firstMatch = all.find(
            (s) => s.item === words2[0] || s.spec.title.toLowerCase() === words2[0].toLowerCase()
          );
          if (firstMatch) {
            screenId = firstMatch.item;
            instruction = words2.slice(1).join(" ").trim();
          }
        }
        if (!instruction && !opts.kind) {
          throw new Error('what should change? `isocan wire edit [<screen>] "<instruction>"`');
        }
        let explicitEdit;
        if (opts.kind || opts.slot) {
          const kind = opts.kind ?? (opts.density || opts.template ? "restyle" : "variant");
          if (!EDIT_KINDS.includes(kind)) {
            throw new Error(`--kind must be one of ${EDIT_KINDS.join(", ")} \u2014 got "${opts.kind}"`);
          }
          const slot = opts.slot ?? "main.1";
          explicitEdit = {
            kind,
            slot,
            ...opts.block ? { block: opts.block } : {},
            ...opts.density ? { density: opts.density } : {},
            ...opts.template ? { template: opts.template } : {},
            ...kind === "content" && instruction ? { fill: { heading: instruction } } : {}
          };
        }
        const seed = Number(opts.seed ?? "1");
        const answerer = cliAnswerer(ctx, p.id, opts.answerer, seed, say);
        const result = await editWireOnCanvas(port, instruction || `${explicitEdit?.kind ?? "edit"} ${explicitEdit?.slot ?? ""}`, answerer, {
          ...screenId ? { screenId } : {},
          ...explicitEdit ? { edit: explicitEdit } : {}
        });
        if (ctx.json) {
          return printJson({
            group: result.group,
            itemId: result.screen.item,
            title: wireTitle(result.screen.spec),
            edit: result.edit,
            by: result.by,
            prototype: result.prototype ?? null
          });
        }
        const protoPart = result.prototype ? ` \xB7 prototype ${result.prototype.itemId} rebuilt` : "";
        say(
          `${result.screen.item}  ${wireTitle(result.screen.spec)} \u2014 edited ${result.edit.slot} (${result.edit.kind}${result.edit.block ? ` \u2192 ${result.edit.block}` : ""})${protoPart} \xB7 \`isocan undo\` takes it back`
        );
      }
    )
  );
  wire.command("why [words...]").description("Explain why a wireframe screen's archetype, template, density, and slot blocks were chosen, citing recorded Jev probabilities and runner-up alternatives").option("--canvas <canvas>").option("--screen <item>", "wireframe screen item id or title (default: newest wireframe screen)").action(
    run(async (words2, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const all = await wiresOn(port, await port.canvas());
      if (all.length === 0) {
        throw new Error('no wireframe screens on this canvas \u2014 `isocan wire "<request>"` composes some');
      }
      let screenId = opts.screen;
      let question = words2.join(" ").trim();
      if (!screenId && words2.length > 0) {
        const match = all.find(
          (s) => s.item === words2[0] || s.spec.title.toLowerCase() === words2[0].toLowerCase()
        );
        if (match) {
          screenId = match.item;
          question = words2.slice(1).join(" ").trim();
        }
      }
      const primary = all.filter((s) => !s.spec.variantOf);
      const target = screenId ? all.find((s) => s.item === screenId || s.spec.title.toLowerCase() === screenId.toLowerCase()) : primary[primary.length - 1] ?? all[all.length - 1];
      if (!target) {
        throw new Error(`no wireframe screen "${screenId}" on this canvas`);
      }
      const explanation = explainWireDecision(target.spec, question || void 0);
      if (ctx.json) {
        return printJson({
          itemId: target.item,
          ...explanation
        });
      }
      for (const line of explanation.lines) console.log(line);
    })
  );
}

// packages/modules/wireframe/src/cli-runtime.ts
function slugOf2(title) {
  return titleSlug(title) || "screen";
}
function asData({ id, category, props, elements }) {
  return { id, category, props, elements: Object.fromEntries(Object.entries(elements ?? {}).map(([k, e]) => [k, { accepts: e.accepts, default: e.default }])) };
}
function registerRuntime(host, wire) {
  const { run, ctxOf, resolveCanvas, sendOp, printJson, placementFor } = host;
  registerCompose(host, wire);
  registerVary(host, wire);
  registerLinks(host, wire);
  registerStyle(host, wire);
  registerFlesh(host, wire);
  registerPlay(host, wire);
  registerEditAndWhy(host, wire);
  wire.command("use <screens...>").description("Use screens in the prototype (\u{1F4D0}) \u2014 the same act as `wire keep`, in the words the item menu says").option("--canvas <canvas>").action(markScreens(host, true));
  wire.command("unuse <screens...>").description("Remove screens from the prototype (\u{1F4D0}) \u2014 the same act as `wire unkeep`").option("--canvas <canvas>").action(markScreens(host, false));
  wire.command("questions").description("Print the pending round of a wireframe flow as a question file, in Jev's request shape \u2014 for an agent to answer in Jev's place").option("--canvas <canvas>").option("--flow <flow>", "which flow (default: the newest one waiting on answers)").action(run((opts, cmd) => questions(host, opts, cmd)));
  wire.command("answer <file>").description("Apply a question file whose calls each carry a `response` in Jev's response shape \u2014 the screens fill in place, in the flow's op group").option("--canvas <canvas>").action(run((file, _opts, cmd) => answer(host, file, cmd)));
  wire.command("render [spec]").description("Draw a wireframe spec (a JSON file) and add it to the canvas as an HTML screen with the spec inside it \u2014 or, with --all, draw every wire on the canvas again from the spec it carries (one op group; a version only where the bytes change)").option("--canvas <canvas>").option("--all", "re-render every wire already on the canvas from its own spec \u2014 how a renderer change reaches screens drawn before it").option("--flow <flow>", "with --all: only this flow's screens and their variations").option("--title <title>", "the item's title (default: the spec's title)").option("--at <x,y>", "place at world coordinates").option("--anchor <item>", "place to the left of this item").option("--in <group>", "insert into this group").option("--cell <row,col>", "with --in: one cell of the sheet's grid").action(
    run(async (file, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      if (opts.all || opts.flow !== void 0) {
        if (file !== void 0) throw new Error("--all draws the wires already on the canvas \u2014 give it no spec file");
        return rerenderAll(host, cmd, opts.flow);
      }
      if (file === void 0) throw new Error("which spec? `isocan wire render <spec.json>` adds a screen; `isocan wire render --all` re-renders the ones already here");
      let spec;
      try {
        spec = JSON.parse(await readFile3(file, "utf8"));
      } catch (error) {
        throw new Error(`${file} is not a JSON file this can read: ${error.message}`);
      }
      const problems = validateWire(spec);
      if (problems.length > 0) {
        throw new Error(`${file} is not a drawable wireframe spec:
  ${problems.join("\n  ")}
  \`isocan wire spec <archetype>\` prints one that is.`);
      }
      const html = renderWire(spec);
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const title = opts.title ?? wireTitle(spec);
      const filename = `${slugOf2(title)}.html`;
      const upload = await ctx.client.uploadBlob(p.id, Buffer.from(html, "utf8"), "text/html", filename);
      const { width, height } = wireSize(spec);
      const itemId = newItemId();
      const result = await sendOp(ctx, p.id, {
        type: "item.add",
        itemId,
        version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size },
        width,
        height,
        placement: placementFor(snapshot, opts, { width, height }),
        title,
        properties: { [FIDELITY_PROP]: "wireframe" }
      });
      const at = host.insertionReceiptPlacement(result.envelope.op, itemId);
      const slots = spec.slots.length;
      const open = spec.slots.filter((s) => s.block === null).length;
      if (ctx.json) return printJson({ itemId, title, archetype: spec.archetype, platform: spec.platform, slots, undecided: open, ...at });
      console.log(`${itemId}  ${title} \u2014 ${spec.archetype}, ${spec.platform}, ${open === 0 ? "wireframe" : open === slots ? "blueprint" : `${slots - open} of ${slots} slots chosen`}`);
    })
  );
  wire.command("spec <archetype>").description("Print a spec for an archetype \u2014 a blueprint (every slot undecided), or with --resolved each slot's first block at its defaults").option("--platform <platform>", `one of ${PLATFORMS.join(", ")} (default: the archetype's first)`).option("--resolved", "choose each slot's first option, with default props and intents").option("--title <title>").option("--request <words>", "the words that asked for it").action(
    run(async (archetype, opts) => {
      if (opts.platform !== void 0 && !PLATFORMS.includes(opts.platform)) {
        throw new Error(`--platform must be one of ${PLATFORMS.join(", ")} \u2014 got: ${opts.platform}`);
      }
      const o = {
        ...opts.platform ? { platform: opts.platform } : {},
        ...opts.title ? { title: opts.title } : {},
        ...opts.request ? { request: opts.request } : {}
      };
      console.log(JSON.stringify(opts.resolved ? wireframe(archetype, o) : blueprint(archetype, o), null, 2));
    })
  );
  wire.command("catalog").description("List the archetypes (with each slot's options), and count the blocks, primitives and intents").action(
    run(async (_opts, cmd) => {
      if (cmd.optsWithGlobals().json) {
        return printJson({
          archetypes: RECIPES,
          blocks: BLOCKS.map(asData),
          primitives: PRIMITIVES.map(asData),
          intents: INTENTS
        });
      }
      for (const r of RECIPES) {
        console.log(`${r.id} (${r.platforms.join(", ")})`);
        for (const s of r.sections) console.log(`  ${s.slot.padEnd(9)} ${s.options.join(" | ")}${s.optional ? "  (optional)" : ""}`);
      }
      console.log(`
${RECIPES.length} archetypes, ${BLOCKS.length} blocks, ${PRIMITIVES.length} primitives, ${INTENTS.length} intents \u2014 \`isocan wire catalog --json\` has every prop and intent.`);
    })
  );
}
async function rerenderAll(host, cmd, flow) {
  const ctx = await host.ctxOf(cmd);
  const p = await host.resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const screens = flow === void 0 ? all : all.filter((s) => s.spec.flow === flow);
  if (screens.length === 0) throw new Error(flow === void 0 ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in flow "${flow}" on this canvas`);
  const r = await rerender(port, canvas, all, screens);
  if (ctx.json) {
    return host.printJson({
      group: r.group,
      wires: r.screens.length,
      rerendered: r.changed.map((s) => ({ itemId: s.item, title: wireTitle(s.spec) })),
      unchanged: r.screens.length - r.changed.length,
      resized: r.resized,
      prototypes: r.prototypes
    });
  }
  for (const line of rerenderLines(r)) console.log(line);
  for (const pr of r.prototypes) if (pr.what !== "unchanged") console.log(`prototype ${pr.itemId} \u2014 ${pr.what === "moved" ? "moved back above its flow" : "rebuilt as a new version"}`);
  console.log(rerenderSummary(r).replace("one undo takes", "`isocan undo` takes"));
}
async function executeWire(host, subcommand, args) {
  const actions = /* @__PURE__ */ new Map();
  const rawHost = { ...host, run: (fn2) => fn2 };
  const makeCmd = (name) => {
    const cmd = {
      description: () => cmd,
      argument: () => cmd,
      option: () => cmd,
      action: (fn2) => {
        actions.set(name, fn2);
        return cmd;
      },
      command: (spec) => makeCmd(spec.split(/\s+/)[0])
    };
    return cmd;
  };
  registerRuntime(rawHost, makeCmd(""));
  const fn = actions.get(subcommand);
  if (!fn) throw new Error(`unknown wire subcommand: ${subcommand}`);
  await fn(...args);
}
export {
  executeWire
};
