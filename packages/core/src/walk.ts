import type { Actor, CanvasContents, Comment, Item } from "./model.ts";
import { modules, type WalkGraph } from "./modules.ts";
import { isGroupItem } from "./canvas-groups.ts";
import { proposalMarked } from "./proposal.ts";
import { luminance } from "./contrast.ts";
import { readScreen, type ScreenRead, type WalkRect } from "./walk-read.ts";
import { titleSlug } from "./filenames.ts";

export { readScreen, type ScreenRead, type TextRun, type WalkTarget, type Spoken, type WalkRect } from "./walk-read.ts";

/**
 * **Walk it as someone else** (proactive-agent phase 9, design §11).
 *
 * A person asks for a walk of a task over a flow; each **walker** is one
 * situation and one constraint — never a biography, never a stereotype — and
 * meets the flow's screens in order. This file is the deterministic half both
 * surfaces read:
 *
 * - **which screens a flow reaches** (`walkFlow`): a module's flow (a wire
 *   prototype's links, through `CoreModule.walkFlow`), a group's screens in
 *   reading order, or one screen;
 * - **what each walker can be measured to meet** (`walkFindings`): contrast
 *   from the screen's own CSS (`contrast.ts`'s WCAG maths), target size and
 *   thumb reach where the CSS places a target, names and roles from the HTML
 *   (`walk-read.ts`);
 * - **the transforms the canvas draws them with** (`thumbArcs`,
 *   `lowVisionFilter`, `seenContrast`, `contrastFix`) — every parameter in
 *   `WALK_PARAMETERS`, with where it comes from;
 * - **the records**: the person's ask, the lead's stumbles (pins: a comment
 *   on the screen worn as the walker, `persona`), its outcome per walker and
 *   the shared finding (a Chat record), and the refusals that keep them
 *   grounded (`walkRecordRefusal`).
 *
 * The stumbles, the outcomes and the shared sentence are the lead's — a model
 * answering the ordinary summons. Nothing here calls one. **These are
 * simulations** (`WALK_NOTICE`), and every surface says so.
 */

/** Said wherever a walk is shown: the panel, the terminal, the ask and the record. */
export const WALK_NOTICE = "These are simulations, not people: each walker is one situation and one constraint, measured where the screen's code allows and judged by the lead where it does not. They do not replace testing with the people they stand for.";

/** What a walker is measured on; a walker measured on nothing is the lead's judgement alone. */
type WalkCheck = "reach" | "contrast" | "names";

/** One simulated person: a situation and a constraint (design §11: "never a stereotype"). */
export interface Walker {
  /** A slug: the persona its pins are worn as. */
  id: string;
  name: string;
  situation: string;
  constraint: string;
  checks: readonly WalkCheck[];
  /** The person described this one for this walk (not a starter). */
  described?: true;
}

/**
 * **The starters** (chosen, Dion to confirm): four ways of meeting a screen
 * that the journey names. A person can describe another for one walk
 * (`walkerOf("commuter: one hand on a strap, phone in the other")`); those are
 * judged by the lead, never measured, and say so.
 */
export const WALKERS: readonly Walker[] = [
  { id: "one-handed", name: "One-handed on a phone", situation: "holding the phone in one hand, on the move", constraint: "reaches the screen only with the thumb of the hand that holds it (the right, here)", checks: ["reach"] },
  { id: "low-vision", name: "Low vision", situation: "reading a phone at about a third of a metre, with acuity near 20/80", constraint: "reads large, high-contrast text; small or faint text blurs into what is behind it", checks: ["contrast"] },
  { id: "screen-reader", name: "A screen-reader user", situation: "hearing the screen read aloud, one thing at a time", constraint: "reaches only what has a name and a role, in the order the code puts it", checks: ["names"] },
  { id: "first-time", name: "A first-time visitor", situation: "has never seen this product before", constraint: "knows the task, not the words this product uses for it", checks: [] },
];

/** The two the smallest walk takes when nobody names any. */
export const DEFAULT_WALKERS = ["one-handed", "low-vision"] as const;
/** Enough lanes to compare; more is a survey. */
export const WALKERS_MAX = 6;

const ALIASES: Record<string, string> = {
  thumb: "one-handed", "one-hand": "one-handed", onehanded: "one-handed",
  "low-sight": "low-vision", lowvision: "low-vision", "low-vis": "low-vision",
  "screenreader": "screen-reader", sr: "screen-reader", blind: "screen-reader",
  "first-timer": "first-time", firsttime: "first-time", newcomer: "first-time", "first-visit": "first-time",
};
/** A walker's id: the one title-to-slug rule, ASCII, as persona ids are. */
const slug = (s: string) => titleSlug(s, { max: 40, ascii: true });
/** Words that describe who someone is, not what they are doing — a walker is never one. */
const IDENTITY = /\b(old|older|elderly|senior|grandma|grandpa|granny|grandmother|grandfather|boomer|millennial|gen ?z|woman|women|man|men|girl|boy|lady|guy|teen|teenager|kid|retired|retiree|disabled person)\b/i;

/**
 * **A walker from what the person typed**: a starter's id (or a near
 * spelling), or `name: what they are doing and what they cannot do`.
 */
export function walkerOf(spec: string): Walker | { refused: string } {
  const raw = spec.trim();
  const colon = raw.indexOf(":");
  if (colon < 0) {
    const id = ALIASES[slug(raw).replace(/-/g, "")] ?? ALIASES[slug(raw)] ?? slug(raw);
    const found = WALKERS.find((w) => w.id === id);
    if (found) return found;
    return { refused: `no walker "${raw}" — the starters are ${WALKERS.map((w) => w.id).join(", ")}; or describe one: "<name>: <what they are doing, and what they cannot do>"` };
  }
  const name = raw.slice(0, colon).trim();
  const constraint = raw.slice(colon + 1).replace(/\s+/g, " ").trim();
  const id = slug(name);
  if (!id) return { refused: "a described walker has a name before the colon: \"commuter: one hand on a strap, reading on a moving bus\"" };
  if (WALKERS.some((w) => w.id === id)) return { refused: `"${name}" is a starter — name it alone (${id}), or call yours something else` };
  if (constraint.split(" ").length < 4) return { refused: `say what ${name} is doing and what they cannot do, in a few words: "${name}: one hand on a strap, reading on a moving bus"` };
  if (IDENTITY.test(`${name} ${constraint}`)) return { refused: "a walker is a situation and a constraint, not who someone is — say what they are doing and what they cannot do, not their age or who they are" };
  return { id, name: name.charAt(0).toUpperCase() + name.slice(1), situation: constraint, constraint: "judged by the lead from this description", checks: [], described: true };
}

// ---------- the transforms, and where their numbers come from

/** One CSS pixel, as millimetres on a phone: a 460 ppi panel at 3 device pixels per CSS pixel is 153 CSS px to the inch. */
const PX_PER_MM = 6;
/** Minimum angle of resolution for 20/80 acuity, in arcminutes (20/20 resolves 1′; 20/80, four times coarser). */
const MAR_20_80 = 4;
/** How far a phone is held to read, in millimetres. */
const VIEWING_MM = 330;
/** The minimum angle of resolution, as CSS px on the screen at the viewing distance (about 2.3 for 20/80). */
const marPx = Math.tan(((MAR_20_80 / 60) * Math.PI) / 180) * VIEWING_MM * PX_PER_MM;
/**
 * The Gaussian's deviation: half the MAR. A Gaussian of deviation σ keeps
 * exp(−2π²σ²f²) of a detail's contrast at frequency f; at the resolution
 * limit, a stroke and a gap one MAR each (f = 1 / 2·MAR), σ = MAR/2 keeps
 * about 29% — near threshold, not gone. σ = MAR would keep under 1%, which is
 * blindness, not 20/80.
 */
const blurPx = Math.round((marPx / 2) * 10) / 10;
/**
 * The veiling luminance added to everything (as glare does), as a fraction of
 * white: chosen so that 7:1 — WCAG's enhanced ratio, which its Understanding
 * document ties to vision near 20/80 — is seen as 3:1, the least a person
 * reads at all: (1.05 + V) / (1.05 / 7 + V) = 3 gives V = 0.3.
 */
const VEIL = 0.3;

/**
 * **Every number a walk uses, and where it comes from.** None of them is a
 * clinical model of anybody's eyes or hands: they are honest approximations,
 * cited so a person can disagree with one.
 */
export const WALK_PARAMETERS = {
  phone: {
    width: 390,
    height: 844,
    pxPerMm: PX_PER_MM,
    source: "a current phone's CSS viewport (390×844, iPhone 12–15); 6 CSS px per mm from a 460 ppi panel at a device pixel ratio of 3",
  },
  thumb: {
    hand: "right" as const,
    innerMm: 15,
    easyMm: 60,
    stretchMm: 75,
    source: "the thumb pivots at the bottom corner of the holding hand: comfortable 15–60 mm from it, a stretch to 75 mm, hard beyond and very near. Shaped after Hoober's observation of how phones are held (UXmatters, 2013: 49% one-handed) and the thumb-zone map drawn from it (Hurff, 2014); a band rather than a disc because the thumb's functional area is (Bergstrom-Lehtovirta & Oulasvirta, CHI 2014). Radii are our approximation, not anthropometry",
  },
  target: {
    thumbPx: 44,
    minPx: 24,
    source: "WCAG 2.2: 2.5.8 Target Size (Minimum) 24×24 CSS px, AA; 2.5.5 Target Size (Enhanced) 44×44, AAA — the size we hold a thumb to outside its easy zone",
  },
  contrast: {
    body: 4.5,
    large: 3,
    enhanced: 7,
    largePx: 24,
    largeBoldPx: 18.66,
    source: "WCAG 2.2 1.4.3 Contrast (Minimum): 4.5:1, 3:1 for large text (24 px, or 18.66 px bold); 1.4.6 Contrast (Enhanced): 7:1",
  },
  lowVision: {
    acuity: "20/80",
    marArcmin: MAR_20_80,
    viewingMm: VIEWING_MM,
    blurPx,
    veil: VEIL,
    source: `blur: the minimum angle of resolution of 20/80 (4′) at ${VIEWING_MM} mm — where people hold a phone to read (Bababekova et al., Optometry and Vision Science, 2011: 32–36 cm) — is about ${Math.round(marPx * 10) / 10} CSS px; the blur's deviation is half that, ${blurPx} px, which leaves detail at the resolution limit with about 29% of its contrast — near threshold, not gone. Wash: a veil of ${VEIL} of white's luminance, so 7:1 (WCAG's enhanced ratio, which its Understanding of 1.4.6 ties to about 20/80) is seen as 3:1. A stand-in for one kind of low vision, not a diagnosis`,
  },
} as const;

/** How the thumb meets a point: comfortably, at a stretch, or hardly at all. */
type ThumbZone = "easy" | "stretch" | "hard";

/** The thumb's arcs on a screen, in its own CSS px: where it pivots and how far each zone reaches. */
export function thumbArcs(viewport: { width: number; height: number }): { pivot: { x: number; y: number }; inner: number; easy: number; stretch: number } {
  const t = WALK_PARAMETERS.thumb;
  return { pivot: { x: viewport.width, y: viewport.height }, inner: t.innerMm * PX_PER_MM, easy: t.easyMm * PX_PER_MM, stretch: t.stretchMm * PX_PER_MM };
}

/** Which zone a point falls in, for the right thumb. */
export function thumbZone(point: { x: number; y: number }, viewport: { width: number; height: number }): ThumbZone {
  const a = thumbArcs(viewport);
  const d = Math.hypot(point.x - a.pivot.x, point.y - a.pivot.y);
  return d < a.inner ? "hard" : d <= a.easy ? "easy" : d <= a.stretch ? "stretch" : "hard";
}

/** Is this screen the size of a phone? Reach is only measured on one. */
export const phoneSized = (viewport: { width: number }) => viewport.width <= 500;

/** The low-vision render as an SVG filter's numbers: a Gaussian blur, then a veil in linear light (`slope·c + intercept`). */
export function lowVisionFilter(): { blurPx: number; slope: number; intercept: number } {
  return { blurPx, slope: Math.round((1 / (1 + VEIL)) * 1000) / 1000, intercept: Math.round((VEIL / (1 + VEIL)) * 1000) / 1000 };
}

const rawRatio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The ratio a pair is seen at through the low-vision veil. */
export function seenContrast(fg: string, bg: string): number | null {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  return round2((Math.max(a, b) + 0.05 + VEIL) / (Math.min(a, b) + 0.05 + VEIL));
}

/** **The fix**: the ink nearest the one used that reaches the ratio — the same hue, darkened on a light ground or lightened on a dark one. */
export function contrastFix(fg: string, bg: string, need: number): { colour: string; ratio: number } | null {
  const lb = luminance(bg);
  const f = /^#?([0-9a-f]{6})$/i.exec(fg.trim());
  if (lb === null || !f) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f[1]!.slice(i, i + 2), 16));
  const toward = lb >= 0.18 ? 0 : 255;
  for (let t = 0; t <= 100; t++) {
    const mix = [r, g, b].map((c) => Math.round(c! + ((toward - c!) * t) / 100));
    const hex = `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    const lf = luminance(hex)!;
    if (rawRatio(lf, lb) >= need) return { colour: hex, ratio: round2(rawRatio(lf, lb)) };
  }
  return null;
}

/** The screen with each fix applied — one stylesheet appended, the person's file otherwise byte for byte. What the lane draws beside the failure. */
export function walkFixHtml(html: string, fixes: readonly { path: string; colour: string }[]): string {
  if (!fixes.length) return html;
  const sheet = `<style data-isocan-walk-fix>${fixes.map((f) => `${f.path}{color:${f.colour} !important}`).join("")}</style>`;
  const at = html.search(/<\/body>/i);
  return at >= 0 ? `${html.slice(0, at)}${sheet}${html.slice(at)}` : `${html}${sheet}`;
}

// ---------- the flow

/** The screens a walk meets, in order. */
interface WalkFlow {
  via: "prototype" | "group" | "screen";
  title: string;
  screens: string[];
  /** In the flow, but no link reaches them from where it opens. */
  unreached: string[];
}

const isHtml = (item: Item) => item.versions.find((v) => v.id === item.currentVersionId)?.mimeType === "text/html";

/** Rows top to bottom, each left to right: items whose tops sit within half a screen's height of the row's first share it. */
export function readingOrder(items: readonly Item[]): Item[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    if (row && item.y - row[0]!.y < row[0]!.height / 2) row.push(item);
    else rows.push([item]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}

/** Every screen a graph reaches from where it opens, in the order a walker first meets them: breadth first, links in their own order. */
export function flowReach(graph: WalkGraph): { screens: string[]; unreached: string[] } {
  const seen = new Set<string>([graph.start]);
  const order = [graph.start];
  for (let i = 0; i < order.length; i++) {
    for (const l of graph.links) {
      if (l.from === order[i] && !seen.has(l.to) && graph.screens.includes(l.to)) {
        seen.add(l.to);
        order.push(l.to);
      }
    }
  }
  return { screens: order, unreached: graph.screens.filter((s) => !seen.has(s)) };
}

/**
 * **Which screens a walk of this item meets.** A module's flow first (a wire
 * prototype, read from its file `html`); a group's screens in reading order;
 * or the one screen. Proposals are never walked: they are not the person's.
 */
export function walkFlow(canvas: CanvasContents, itemId: string, html: string | null): WalkFlow | { refused: string } {
  const item = canvas.items[itemId];
  if (!item) return { refused: `no item ${itemId} on this canvas` };
  const title = item.title || "Untitled";
  const screen = (id: string) => {
    const it = canvas.items[id];
    return it && isHtml(it) && !proposalMarked(it) ? it : null;
  };
  if (html !== null) {
    for (const m of modules()) {
      const graph = m.walkFlow?.(item, html);
      if (!graph) continue;
      const live: WalkGraph = { start: graph.start, screens: graph.screens.filter((s) => screen(s)), links: graph.links };
      if (!screen(live.start)) return { refused: `“${title}” opens on a screen that is not on the canvas any more` };
      return { via: "prototype", title, ...flowReach(live) };
    }
  }
  if (isGroupItem(item)) {
    const inside = readingOrder(Object.values(canvas.items).filter((i) => i.containerId === item.id && screen(i.id)));
    if (!inside.length) return { refused: `“${title}” holds no screens — a walk goes over HTML screens` };
    return { via: "group", title, screens: inside.map((i) => i.id), unreached: [] };
  }
  if (screen(item.id)) return { via: "screen", title, screens: [item.id], unreached: [] };
  return { refused: `a walk goes over screens — a group of them, a prototype, or one screen; “${title}” is none of those` };
}

// ---------- what each walker meets, measured

/** One screen of a walk, at the version walked. */
export interface WalkScreen {
  itemId: string;
  versionId: string;
  title: string;
  read: ScreenRead;
}

/** Read a screen of a walk from its bytes, at the size the canvas shows it. */
export function walkScreen(item: Pick<Item, "id" | "title" | "width" | "height">, versionId: string, html: string): WalkScreen {
  return { itemId: item.id, versionId, title: item.title || "Untitled", read: readScreen(html, { width: item.width, height: item.height }) };
}

/** Something the walk measured that a walker meets — what a measured stumble cites. */
export interface WalkFinding {
  /** `<screen number>.<n>`, per walker: `2.1` is the first on the second screen. */
  id: string;
  walker: string;
  itemId: string;
  kind: "reach" | "target" | "contrast" | "unnamed" | "no-role" | "placeholder" | "no-alt";
  path: string;
  at: WalkRect | null;
  /** The words on it, or its name. */
  label: string;
  /** One sentence, with the numbers. */
  text: string;
  contrast?: { fg: string; bg: string; fontPx: number; bold: boolean; ratio: number; need: number; seen: number; fix: string | null; fixRatio: number | null };
  reach?: { zone: ThumbZone; width: number; height: number };
}

const quote = (s: string) => `“${s.length > 40 ? `${s.slice(0, 39)}…` : s}”`;
const where = (r: WalkRect, vp: { width: number; height: number }) => {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const v = cy < vp.height / 3 ? "top" : cy > (vp.height * 2) / 3 ? "bottom" : "middle";
  const h = cx < vp.width / 3 ? "left" : cx > (vp.width * 2) / 3 ? "right" : "centre";
  return v === "middle" && h === "centre" ? "the middle" : `${v} ${h}`;
};

/** What one walker meets on one screen, measured — before numbering. */
function measured(walker: Walker, s: WalkScreen): Omit<WalkFinding, "id">[] {
  const out: Omit<WalkFinding, "id">[] = [];
  const vp = s.read.viewport;
  const base = { walker: walker.id, itemId: s.itemId };
  if (walker.checks.includes("reach")) {
    const t = WALK_PARAMETERS.target;
    for (const target of s.read.targets) {
      const label = target.name || target.tag;
      const size = target.size;
      if (size && Math.min(size.width, size.height) < t.minPx) {
        out.push({ ...base, kind: "target", path: target.path, at: target.at, label, text: `${quote(label)} is ${size.width}×${size.height} px — smaller than the ${t.minPx}×${t.minPx} any finger needs` });
        continue;
      }
      if (!target.at || !phoneSized(vp)) continue;
      const zone = thumbZone({ x: target.at.x + target.at.width / 2, y: target.at.y + target.at.height / 2 }, vp);
      if (zone !== "easy" && Math.min(target.at.width, target.at.height) < t.thumbPx) {
        out.push({ ...base, kind: "reach", path: target.path, at: target.at, label, reach: { zone, width: target.at.width, height: target.at.height }, text: `${quote(label)} is ${target.at.width}×${target.at.height} px in the ${zone === "hard" ? "hard-to-reach" : "stretch"} zone, ${where(target.at, vp)} — a thumb needs ${t.thumbPx}×${t.thumbPx} there` });
      }
    }
  }
  if (walker.checks.includes("contrast")) {
    const c = WALK_PARAMETERS.contrast;
    const seen = new Set<string>();
    for (const run of s.read.texts) {
      if (!run.fg || !run.bg) continue;
      const lf = luminance(run.fg);
      const lb = luminance(run.bg);
      if (lf === null || lb === null) continue;
      const large = run.fontPx >= c.largePx || (run.bold && run.fontPx >= c.largeBoldPx);
      const need = large ? c.large : c.body;
      const ratio = round2(rawRatio(lf, lb));
      if (rawRatio(lf, lb) >= need) continue;
      const key = `${run.text}|${run.fg}|${run.bg}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // The fix reaches what this walker reads at — WCAG's enhanced ratio, which its Understanding ties to about 20/80 — not only the minimum.
      const reads = large ? c.body : c.enhanced;
      const fix = contrastFix(run.fg, run.bg, reads);
      const seenAt = seenContrast(run.fg, run.bg) ?? ratio;
      out.push({
        ...base,
        kind: "contrast",
        path: run.path,
        at: run.at,
        label: run.text,
        contrast: { fg: run.fg, bg: run.bg, fontPx: run.fontPx, bold: run.bold, ratio, need, seen: seenAt, fix: fix?.colour ?? null, fixRatio: fix?.ratio ?? null },
        text: `${quote(run.text)} is ${run.fg} on ${run.bg}, ${ratio}:1 — ${large ? "large text" : "text this size"} needs ${need}:1; through low vision it is about ${seenAt}:1${fix ? `. The fix, at the ${reads}:1 they read at: ${fix.colour} (${fix.ratio}:1)` : ""}`,
      });
    }
  }
  if (walker.checks.includes("names")) {
    for (const target of s.read.targets) {
      if (target.role === null) out.push({ ...base, kind: "no-role", path: target.path, at: target.at, label: target.name || target.tag, text: `${target.name ? quote(target.name) : `a ${target.tag}`} acts on a click but has no role — it is read as plain text, and a keyboard may never reach it` });
      else if (!target.name) out.push({ ...base, kind: "unnamed", path: target.path, at: target.at, label: target.tag, text: `a ${target.role} with no name — it is read as “${target.role}”, and nothing says what it does` });
      else if (target.placeholderOnly) out.push({ ...base, kind: "placeholder", path: target.path, at: target.at, label: target.name, text: `the field ${quote(target.name)} is named only by its placeholder, which goes as they type` });
    }
    for (const img of s.read.noAlt) out.push({ ...base, kind: "no-alt", path: img.path, at: null, label: img.src || "image", text: `an image with no alt — it is read as its file name${img.src ? `, ${quote(img.src)}` : ""}` });
  }
  return out;
}

/** **Everything a walker meets on the walk's screens, measured** — numbered per screen. A walker measured on nothing meets nothing here. */
export function walkFindings(walker: Walker, screens: readonly WalkScreen[]): WalkFinding[] {
  return screens.flatMap((s, i) => measured(walker, s).map((f, k) => ({ ...f, id: `${i + 1}.${k + 1}` })));
}

/** What a lane says beside its findings: what the read could not measure for this walker. */
function walkNotes(walker: Walker, s: WalkScreen): string[] {
  const out: string[] = [];
  if (!walker.checks.length) out.push(walker.described ? "described by the person: the lead judges this walker, nothing is measured" : "judged by the lead: this walker meets meaning, which the code cannot measure");
  if (walker.checks.includes("reach")) {
    if (!phoneSized(s.read.viewport)) out.push(`${s.read.viewport.width} px wide — wider than a phone, so reach is not measured; target size still is`);
    const unplaced = s.read.targets.filter((t) => !t.at).length;
    if (unplaced) out.push(`${unplaced} ${unplaced === 1 ? "target" : "targets"} the read could not place — it knows only fixed and absolute positions; the lead judges ${unplaced === 1 ? "it" : "them"}`);
  }
  if (walker.checks.includes("contrast")) {
    const unread = s.read.texts.filter((t) => !t.fg || !t.bg).length + s.read.unread.colours;
    if (unread) out.push(`${unread} ${unread === 1 ? "colour" : "colours"} the read could not resolve (an image, a gradient, a name it does not know)`);
  }
  if (s.read.unread.rules) out.push(`${s.read.unread.rules} CSS ${s.read.unread.rules === 1 ? "rule" : "rules"} not read (states, @media, combinators it does not match)`);
  return out;
}

// ---------- the ask

/** The words that start a walk in the Chat — what `walkAsks` finds it by. */
const WALK_ASK = "Walk it as someone else, please";
const ASK_RE = /Walk it as someone else, please \(([^)]*)\): “([^\n]*)” as [^\n]*\.\n/;

/** A walk the person asked for, read back off its comment. Its id is the comment's. */
export interface WalkAsk {
  id: string;
  createdAt: string;
  by: Actor;
  task: string;
  screens: { itemId: string; versionId: string }[];
  walkers: Walker[];
}

const listOf = (names: readonly string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** **The ask** — to the lead, in the Chat: the task, the screens at their versions, each walker, what was measured, and how to answer. */
export function walkAskBody(lead: Pick<Actor, "name">, task: string, screens: readonly WalkScreen[], walkers: readonly Walker[], findings: readonly WalkFinding[]): string {
  const titled = new Map(screens.map((s) => [s.itemId, s.title]));
  const measuredLines = findings.slice(0, 12).map((f) => `- ${f.walker} on “${titled.get(f.itemId)}”, ${f.id}: ${f.text}`);
  return [
    `@${lead.name} ${WALK_ASK} (${screens.map((s) => `${s.itemId}@${s.versionId}`).join(", ")}): “${task.replace(/\s+/g, " ").trim()}” as ${listOf(walkers.map((w) => w.name))}.`,
    ...walkers.map((w) => `- walker ${w.id}${w.described ? " (described)" : ""}: ${w.name} — ${w.situation}${w.described ? "" : `; ${w.constraint}`}`),
    "",
    findings.length ? `Measured (${findings.length}):` : "Measured: nothing in the way for these walkers.",
    ...measuredLines,
    ...(findings.length > 12 ? [`- and ${findings.length - 12} more: \`isocan walk --json\``] : []),
    "",
    WALK_NOTICE,
    `Walk each one through the task on these screens, in order, and answer in one command: \`isocan walk --stumble "<walker> | <screen> | <measured id, or judged> | <what happened, one sentence>"\` for each stumble (it lands as a pin, worn as that walker), \`--outcome "<walker> | made it|stumbled|gave up | <one line>"\` for every walker, and where two or more stumble on one screen, \`--shared "<screen> | <the problem, in design words>" --fix <file> --why "…"\` — one fix, a proposal. Edit nothing.`,
  ].join("\n");
}

/** One comment as a walk ask, or null. */
export function readWalkAsk(c: Comment): WalkAsk | null {
  const m = ASK_RE.exec(`${c.body}\n`);
  if (!m) return null;
  const screens = m[1]!.split(",").map((s) => s.trim()).flatMap((s) => {
    const [itemId, versionId] = s.split("@");
    return itemId && versionId ? [{ itemId, versionId }] : [];
  });
  const walkers = [...c.body.matchAll(/^- walker ([a-z0-9-]+)( \(described\))?: (.+?) — (.*)$/gm)].map((w): Walker => {
    const starter = WALKERS.find((s) => s.id === w[1]);
    return starter && !w[2] ? starter : { id: w[1]!, name: w[3]!, situation: w[4]!, constraint: "judged by the lead from this description", checks: [], described: true };
  });
  if (!screens.length || !walkers.length) return null;
  return { id: c.id, createdAt: c.createdAt, by: c.author, task: m[2]!, screens, walkers };
}

const allComments = (canvas: Pick<CanvasContents, "threads">): Comment[] =>
  Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

/** Every walk asked on this canvas, oldest first. */
export function walkAsks(canvas: Pick<CanvasContents, "threads">): WalkAsk[] {
  return allComments(canvas).flatMap((c) => (c.body.includes(WALK_ASK) ? [readWalkAsk(c)].filter((a): a is WalkAsk => a !== null) : []));
}

// ---------- stumbles: pins on the screens, worn as the walker

/** A stumble the lead pinned. */
export interface WalkStumble {
  walk: string;
  walker: string;
  itemId: string;
  /** The measured finding it cites, or `judged`. */
  finding: string;
  what: string;
  threadId?: string;
  /** Where on the screen, as fractions of it. */
  at?: { x: number; y: number };
}

/** The pin's words. The walker is the comment's `persona`. */
export function stumbleBody(walker: Pick<Walker, "name">, walkId: string, finding: string, what: string): string {
  return `${walker.name} stumbled here (walk ${walkId} · ${finding === "judged" ? "judged, not measured" : `measured ${finding}`}): ${what.replace(/\s+/g, " ").trim()}`;
}

const STUMBLE_RE = /stumbled here \(walk ([\w-]+) · (?:measured ([\d.]+)|judged, not measured)\): ([\s\S]*)$/;

/** Every stumble pinned for a walk, in the order they were pinned. */
export function walkStumbles(canvas: Pick<CanvasContents, "threads" | "items">, walkId: string): WalkStumble[] {
  return Object.values(canvas.threads)
    .flatMap((t) => {
      const c = t.comments[0];
      const m = c && c.persona && t.anchorItemId ? STUMBLE_RE.exec(c.body) : null;
      if (!m || m[1] !== walkId || !t.anchorItemId) return [];
      const item = canvas.items[t.anchorItemId];
      const at = item ? { x: Math.round((t.x / Math.max(1, item.width)) * 100) / 100, y: Math.round((t.y / Math.max(1, item.height)) * 100) / 100 } : undefined;
      return [{ createdAt: c!.createdAt, s: { walk: walkId, walker: c!.persona!, itemId: t.anchorItemId, finding: m[2] ?? "judged", what: m[3]!.trim(), threadId: t.id, ...(at ? { at } : {}) } }];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((x) => x.s);
}

/** **The shared finding**: each screen two or more walkers stumbled on, with who. Derived from the pins, never written. */
export function walkShared(stumbles: readonly Pick<WalkStumble, "walker" | "itemId">[]): { itemId: string; walkers: string[] }[] {
  const by = new Map<string, Set<string>>();
  for (const s of stumbles) by.set(s.itemId, (by.get(s.itemId) ?? new Set()).add(s.walker));
  return [...by].filter(([, w]) => w.size >= 2).map(([itemId, w]) => ({ itemId, walkers: [...w] }));
}

// ---------- the record: an outcome per walker, the shared finding, the fix

/** How a walker's walk ended (design §11). */
export const WALK_OUTCOMES = ["made it", "stumbled", "gave up"] as const;
type WalkOutcome = (typeof WALK_OUTCOMES)[number];

/** The lead's read of the walk: posted once, as a record in the Chat. */
export interface WalkRecord {
  walk: string;
  commentId: string;
  by: Actor;
  createdAt: string;
  outcomes: { walker: string; outcome: WalkOutcome; line: string }[];
  shared: { itemId: string; sentence: string } | null;
  fix: string | null;
}

const RECORD_MARK = "Walk read (walk ";

/** The record's words. */
export function walkRecordBody(ask: Pick<WalkAsk, "id" | "task">, outcomes: WalkRecord["outcomes"], shared: WalkRecord["shared"], fix: string | null): string {
  return [
    `${RECORD_MARK}${ask.id}): “${ask.task}”.`,
    ...outcomes.map((o) => `- outcome ${o.walker}: ${o.outcome} — ${o.line.replace(/\s+/g, " ").trim()}`),
    ...(shared ? [`- shared ${shared.itemId}: ${shared.sentence.replace(/\s+/g, " ").trim()}`] : []),
    ...(fix ? [`- fix ${fix}`] : []),
    "",
    WALK_NOTICE,
  ].join("\n");
}

/** The lead's record of a walk, or null while the walk waits. */
export function walkRecordOf(canvas: Pick<CanvasContents, "threads">, walkId: string): WalkRecord | null {
  const c = allComments(canvas).find((x) => x.record && x.body.startsWith(`${RECORD_MARK}${walkId})`));
  if (!c) return null;
  const outcomes = [...c.body.matchAll(/^- outcome ([a-z0-9-]+): (made it|stumbled|gave up) — (.*)$/gm)].map((m) => ({ walker: m[1]!, outcome: m[2] as WalkOutcome, line: m[3]! }));
  const sh = /^- shared ([\w-]+): (.*)$/m.exec(c.body);
  const fix = /^- fix ([\w-]+)$/m.exec(c.body)?.[1] ?? null;
  return { walk: walkId, commentId: c.id, by: c.author, createdAt: c.createdAt, outcomes, shared: sh ? { itemId: sh[1]!, sentence: sh[2]! } : null, fix };
}

/**
 * **Why this record may not be posted, in words that say what to do** — or
 * null. The grounding rules: a stumble happens on a screen the walk met, to a
 * walker it took, and cites what was measured there — or says it was judged;
 * every walker ends once, and an ending agrees with the pins; where two or
 * more walkers stumbled on one screen the lead names the shared problem and
 * proposes one fix, and only there.
 */
export function walkRecordRefusal(
  ask: WalkAsk,
  findings: readonly WalkFinding[],
  stumbles: readonly WalkStumble[],
  outcomes: readonly { walker: string; outcome: string }[],
  shared: { itemId: string } | null,
  fix: boolean,
): string | null {
  const walkers = new Map(ask.walkers.map((w) => [w.id, w]));
  const screens = new Set(ask.screens.map((s) => s.itemId));
  for (const s of stumbles) {
    if (!walkers.has(s.walker)) return `${s.walker} did not walk this — the walkers are ${[...walkers.keys()].join(", ")}`;
    if (!screens.has(s.itemId)) return `a stumble happens on a screen the walk met — ${s.itemId} is not one of them`;
    if (s.finding !== "judged" && !findings.some((f) => f.walker === s.walker && f.itemId === s.itemId && f.id === s.finding)) {
      const there = findings.filter((f) => f.walker === s.walker && f.itemId === s.itemId).map((f) => f.id);
      return `${s.walker} has no measured ${s.finding} on that screen${there.length ? ` (it has ${there.join(", ")})` : " (nothing was measured there)"} — cite one, or say judged`;
    }
    if (!s.what.trim()) return "a stumble says what happened, in one sentence";
  }
  for (const w of walkers.keys()) {
    const ends = outcomes.filter((o) => o.walker === w);
    if (ends.length !== 1) return ends.length ? `${w} ends once — one --outcome each` : `every walker ends: ${w} has no --outcome (made it, stumbled or gave up)`;
  }
  for (const o of outcomes) {
    if (!walkers.has(o.walker)) return `${o.walker} did not walk this — the walkers are ${[...walkers.keys()].join(", ")}`;
    if (!(WALK_OUTCOMES as readonly string[]).includes(o.outcome)) return `an outcome is made it, stumbled or gave up — not "${o.outcome}"`;
    const pinned = stumbles.some((s) => s.walker === o.walker);
    if (o.outcome === "made it" && pinned) return `${o.walker} stumbled — say stumbled (or gave up), not made it`;
    if (o.outcome !== "made it" && !pinned) return `${o.walker} ${o.outcome} with no stumble pinned — pin where it happened, or say made it`;
  }
  const both = walkShared(stumbles);
  if (shared && !both.some((b) => b.itemId === shared.itemId)) return "a shared finding is a screen two or more walkers stumbled on — this one is not";
  if (!shared && both.length) return `${listOf(both[0]!.walkers)} all stumbled on one screen (${both[0]!.itemId}) — name the shared problem with --shared "<screen> | …" and propose one fix`;
  if (shared && !fix) return "the shared finding comes with one fix: --fix <file> --why \"…\", a proposal beneath that screen";
  if (fix && !shared) return "the fix answers the shared finding — name it with --shared \"<screen> | …\"";
  return null;
}

// ---------- the lanes, as both surfaces say them

/** One walker's lane: the screens as they met them. */
export interface WalkLane {
  walker: Walker;
  outcome: WalkRecord["outcomes"][number] | null;
  screens: { itemId: string; title: string; findings: WalkFinding[]; stumbles: WalkStumble[]; notes: string[] }[];
}

/** **The lanes**: per walker, per screen, what was measured, what the lead pinned, and how it ended. */
export function walkLanes(walkers: readonly Walker[], screens: readonly WalkScreen[], stumbles: readonly WalkStumble[], record: WalkRecord | null): WalkLane[] {
  return walkers.map((walker) => {
    const findings = walkFindings(walker, screens);
    return {
      walker,
      outcome: record?.outcomes.find((o) => o.walker === walker.id) ?? null,
      screens: screens.map((s) => ({
        itemId: s.itemId,
        title: s.title,
        findings: findings.filter((f) => f.itemId === s.itemId),
        stumbles: stumbles.filter((x) => x.walker === walker.id && x.itemId === s.itemId),
        notes: walkNotes(walker, s),
      })),
    };
  });
}
