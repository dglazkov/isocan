import { LINK_BACK, type WireLink } from "./links.ts";

/**
 * **Where a flow's arrows run** (phase 8; research *Flow arrows*, §1 and §2).
 *
 * Pure, and in world units: the screens' boxes, where each hotspot sits on
 * its screen, and the flow's links in; one route per link out. No search —
 * rules, because a flow is a row of screens with 80-unit gutters and the
 * rules cover it:
 *
 * - **Step** — the target is the next screen in the row, with nothing
 *   between. One horizontal run at the hotspot's height, from the source's
 *   facing side into the target's. Two hotspots to one neighbour are two
 *   arrows at their own heights; ports within 16 units are nudged apart.
 * - **Jump** — same row, not neighbours. Up from the source's top edge at the
 *   hotspot's column, along a lane above the row, down onto the target's top
 *   edge. Lanes sit 96 + 26·k above the row (and above anything else in the
 *   lane's span), shortest span lowest. Then the legs on each top edge are
 *   ORDERED — lanes running left on the left, lowest lane outermost; running
 *   right on the right — so no lane crosses another leg (the nudging step of
 *   Wybrow, Marriott & Stuckey 2009). On the recorded Jev flow that is 1
 *   crossing without the ordering and 0 with it; `test/arrows.test.ts` holds
 *   the 0. A lane a leg rises through moves up past that leg's lane; and
 *   when two jumps interleave (each has a leg inside the other's span, so no
 *   order of lanes on one side can separate them) the longer rides a lane
 *   44 + 26·k UNDER the row, between the screens' bottom edges.
 * - **Across rows** — a Z through the column gutter: out of the facing side
 *   at the hotspot's height, along the gutter, into the target's side.
 *
 * Every route stops `GAP` short of its target (tldraw's number), so the head
 * points at the screen instead of being stuck in it.
 *
 * What is drawn at all is the research's table: a link that changes the
 * screen, drawn; an overlay, drawn dashed; a nav item (tab, drawer, navbar),
 * only while its screen is pointed at; back, never; a missing link, only
 * while its screen is pointed at, and as a mark on the hotspot, not a line.
 */

export interface RouteBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A hotspot's rectangle, in its screen's own world units (0,0 is the item's corner). */
export interface HotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ArrowKind = "screen" | "overlay" | "nav";
export type Point = readonly [number, number];

export interface FlowArrow {
  /** `<from>|<hotspot key>` — one arrow per hotspot, so this is unique in a flow. */
  id: string;
  link: WireLink & { to: string };
  kind: ArrowKind;
  shape: "step" | "jump" | "cross";
  /** The orthogonal polyline; the last point is where the head's tip sits. */
  pts: Point[];
  /** Where the label sits, and the straight run (world units) it has to fit on. */
  label: { x: number; y: number; run: number };
  /** Drawn only because a screen is pointed at. */
  chrome: boolean;
  lane?: number;
  /** A fifth lane over one stretch: drawn faint, its label still says where it goes. */
  crowded?: boolean;
}

/** A missing link, marked on its hotspot while its screen is pointed at. */
export interface NeedsMark {
  id: string;
  link: WireLink;
  /** The hotspot, in world units. */
  rect: HotRect;
}

export const GAP = 10;
/** Clear of the item's counter-scaled title strip above every screen (~24 screen px, 80 world at 0.3): the research's 44 came from a harness with no titlebars, and the walk found the strip over the lowest lane. */
export const LANE0 = 96;
export const LANE = 26;
/** Under the row there is no title strip to clear. */
export const LANE0_BELOW = 44;
export const MAX_LANES = 4;
export const CORNER = 18;
const NUDGE = 16;

export interface RouteInput {
  /** The flow's kept screens, where they are now (a drag already applied). */
  screens: readonly RouteBox[];
  /** Everything else on the canvas a lane must clear: unkept variations, the prototype, notes. */
  obstacles?: readonly RouteBox[];
  links: readonly WireLink[];
  /** The hotspot's rect on its screen, or null when it is not known yet. */
  hot: (screenId: string, key: string) => HotRect | null;
  /** The screen the pointer is over: its tabs and loose ends are drawn too. */
  pointed?: string | null;
}

/** Which links become arrows, and which are chrome — the research's table. */
export function drawnLinks(links: readonly WireLink[], pointed: string | null = null): { rest: WireLink[]; chrome: WireLink[]; needs: WireLink[] } {
  const rest: WireLink[] = [];
  const chrome: WireLink[] = [];
  const needs: WireLink[] = [];
  for (const l of links) {
    if (l.to === LINK_BACK) continue;
    if (l.to === null) {
      if (l.needs && l.from === pointed) needs.push(l);
      continue;
    }
    if (l.to === l.from) continue;
    // A person's decision is intent, not chrome, even on a tab.
    if (l.nav && l.rule !== "override") {
      if (l.from === pointed) chrome.push(l);
      continue;
    }
    rest.push(l);
  }
  return { rest, chrome, needs };
}

/** The kept screens in rows — top to bottom, each left to right; a row is screens whose boxes overlap vertically. */
export function rowsOf<T extends RouteBox>(boxes: readonly T[]): T[][] {
  const byTop = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: T[][] = [];
  let bottom = -Infinity;
  for (const it of byTop) {
    if (rows.length === 0 || it.y >= bottom) {
      rows.push([it]);
      bottom = it.y + it.h;
    } else {
      rows[rows.length - 1]!.push(it);
      bottom = Math.max(bottom, it.y + it.h);
    }
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

interface Work {
  link: WireLink & { to: string };
  a: RouteBox;
  b: RouteBox;
  h: HotRect;
  chrome: boolean;
  shape: FlowArrow["shape"];
  sx?: number;
  ex?: number;
  lane?: number;
  pts?: Point[];
  label?: FlowArrow["label"];
  slot?: { x0: number; x1: number; lane: number };
  /** Riding a lane under the row: it interleaves with a jump above. */
  below?: boolean;
}

const overlapsY = (box: RouteBox, top: number, bottom: number) => box.y < bottom && box.y + box.h > top;

export function routeFlow(input: RouteInput): { arrows: FlowArrow[]; needs: NeedsMark[] } {
  const byId = new Map(input.screens.map((s) => [s.id, s]));
  const rows = rowsOf(input.screens);
  const rowOf = new Map<string, number>();
  rows.forEach((r, i) => r.forEach((s) => rowOf.set(s.id, i)));
  const band = rows.map((r) => ({ top: Math.min(...r.map((s) => s.y)), bottom: Math.max(...r.map((s) => s.y + s.h)) }));
  const others = [...input.screens, ...(input.obstacles ?? [])];
  const { rest, chrome, needs } = drawnLinks(input.links, input.pointed ?? null);

  const work = (list: readonly WireLink[], isChrome: boolean): Work[] => {
    const out: Work[] = [];
    for (const l of list) {
      const a = byId.get(l.from);
      const b = byId.get(l.to!);
      const h = input.hot(l.from, l.key);
      if (!a || !b || !h) continue;
      const ra = rowOf.get(a.id)!;
      const rb = rowOf.get(b.id)!;
      let shape: Work["shape"] = "cross";
      if (ra === rb) {
        const left = Math.min(a.x + a.w, b.x + b.w);
        const right = Math.max(a.x, b.x);
        const { top, bottom } = band[ra]!;
        const between = others.some((o) => o.id !== a.id && o.id !== b.id && overlapsY(o, top, bottom) && o.x < right && o.x + o.w > left);
        shape = between ? "jump" : "step";
      }
      out.push({ link: l as WireLink & { to: string }, a, b, h, chrome: isChrome, shape });
    }
    return out;
  };

  const lanes: Array<Array<{ x0: number; x1: number; lane: number }>> = rows.map(() => []);
  const restWork = work(rest, false);
  const chromeWork = work(chrome, true);
  const under: typeof lanes = rows.map(() => []);
  jumps(restWork, lanes, under);
  jumps(chromeWork, lanes, under);

  // Steps: straight, at the hotspot's height, nudged apart where two ports would touch.
  const used = new Map<string, number[]>();
  for (const d of [...restWork, ...chromeWork]) {
    if (d.shape !== "step") continue;
    const dir = d.b.x >= d.a.x ? 1 : -1;
    let y = clampY(d.a.y + d.h.y + d.h.h / 2, d.a, d.b);
    const gutter = `${rowOf.get(d.a.id)}:${Math.min(d.a.x, d.b.x)}`;
    const ys = used.get(gutter) ?? [];
    while (ys.some((u) => Math.abs(u - y) < NUDGE)) y += NUDGE;
    ys.push(y);
    used.set(gutter, ys);
    const x1 = dir > 0 ? d.a.x + d.a.w : d.a.x;
    const x2 = dir > 0 ? d.b.x - GAP : d.b.x + d.b.w + GAP;
    d.pts = [[x1, y], [x2, y]];
    d.label = { x: (x1 + x2) / 2, y, run: Math.abs(x2 - x1) };
  }

  // Across rows: a Z through the gutter beside the screens.
  for (const d of [...restWork, ...chromeWork]) {
    if (d.shape !== "cross") continue;
    const y1 = d.a.y + d.h.y + d.h.h / 2;
    const y2 = clampY(y1, d.b, d.b);
    const clear = d.b.x >= d.a.x + d.a.w || d.b.x + d.b.w <= d.a.x;
    let x1: number, gx: number, x2: number;
    if (clear) {
      const right = d.b.x > d.a.x;
      x1 = right ? d.a.x + d.a.w : d.a.x;
      x2 = right ? d.b.x - GAP : d.b.x + d.b.w + GAP;
      gx = (x1 + (right ? d.b.x : d.b.x + d.b.w)) / 2;
    } else {
      // Stacked (a variation kept under its original): out of the right side and round.
      x1 = d.a.x + d.a.w;
      gx = Math.max(d.a.x + d.a.w, d.b.x + d.b.w) + 40;
      x2 = d.b.x + d.b.w + GAP;
    }
    d.pts = [[x1, y1], [gx, y1], [gx, y2], [x2, y2]];
    d.label = { x: gx, y: (y1 + y2) / 2, run: Math.abs(y2 - y1) };
  }

  const arrows: FlowArrow[] = [];
  for (const d of [...restWork, ...chromeWork]) {
    if (!d.pts || !d.label) continue;
    arrows.push({
      id: arrowId(d.link),
      link: d.link,
      kind: d.chrome ? "nav" : d.link.transition === "overlay" ? "overlay" : "screen",
      shape: d.shape,
      pts: d.pts,
      label: d.label,
      chrome: d.chrome,
      ...(d.lane !== undefined ? { lane: d.lane } : {}),
      ...(d.lane !== undefined && d.lane >= MAX_LANES ? { crowded: true } : {}),
    });
  }
  const marks: NeedsMark[] = [];
  for (const l of needs) {
    const a = byId.get(l.from);
    const h = input.hot(l.from, l.key);
    if (a && h) marks.push({ id: arrowId(l), link: l, rect: { x: a.x + h.x, y: a.y + h.y, w: h.w, h: h.h } });
  }
  return { arrows, needs: marks };

  function jumps(list: Work[], occ: typeof lanes, occBelow: typeof lanes) {
    const js = list.filter((d) => d.shape === "jump").sort((p, q) => Math.abs(p.b.x - p.a.x) - Math.abs(q.b.x - q.a.x));
    if (js.length === 0) return;
    // Departures: the hotspot's column on the source's edge, nudged apart.
    const tops = new Map<string, Work[]>();
    for (const d of js) tops.set(d.a.id, [...(tops.get(d.a.id) ?? []), d]);
    for (const legs of tops.values()) {
      legs.sort((p, q) => p.h.x + p.h.w / 2 - (q.h.x + q.h.w / 2));
      let last = -Infinity;
      for (const d of legs) {
        d.sx = Math.min(d.a.x + d.a.w - 8, Math.max(d.a.x + d.h.x + d.h.w / 2, last + 22));
        last = d.sx;
      }
    }
    const side = (d: Work) => (d.below ? occBelow : occ)[rowOf.get(d.a.id)!]!;
    const take = (d: Work, from: number) => {
      const row = side(d);
      let lane = from;
      while (row.some((o) => o !== d.slot && o.lane === lane && !(d.slot!.x1 < o.x0 || d.slot!.x0 > o.x1))) lane++;
      d.lane = lane;
      d.slot!.lane = lane;
    };
    // Lanes, from a provisional arrival at the target's middle: short spans take the low lanes.
    for (const d of js) {
      d.ex = d.b.x + d.b.w / 2;
      d.slot = { x0: Math.min(d.sx!, d.ex) - 30, x1: Math.max(d.sx!, d.ex) + 30, lane: 0 };
      take(d, 0);
      side(d).push(d.slot);
    }
    place(js);
    /*
     * A lane that passes OVER a screen must also ride above every leg standing
     * on that screen's top edge, or the leg rises through it — ordering the
     * legs cannot help, because a departure sits at its hotspot's column. The
     * merged walk found it the day a person sent Detail's Done past Form,
     * which has a jump of its own. So a lane crossed by another jump's leg
     * moves up past that jump's lane.
     *
     * And when two jumps INTERLEAVE — each has a leg inside the other's span
     * (Detail → Status over Form, Form → Home over Detail) — no order of lanes
     * above the row can keep them apart: two arcs on one side of a line whose
     * ends alternate must cross. So the longer one goes under the row instead,
     * leaving and landing on the bottom edges. Bounded: a flow settles in a
     * few rounds.
     */
    for (let round = 0; round < 8; round++) {
      let moved = false;
      for (const j of js) {
        for (const k of js) {
          if (j === k || j.below !== k.below || !legCrosses(k, j)) continue;
          if (interleaves(j, k)) {
            const longer = Math.abs(j.ex! - j.sx!) >= Math.abs(k.ex! - k.sx!) ? j : k;
            if (longer.below) continue;
            const from = side(longer);
            from.splice(from.indexOf(longer.slot!), 1);
            longer.below = true;
            take(longer, 0);
            side(longer).push(longer.slot!);
          } else take(j, k.lane! + 1);
          moved = true;
        }
      }
      if (!moved) break;
      place(js);
    }
  }

  /** The x of each of a jump's two legs. */
  function legXs(d: Work): number[] {
    return [d.sx!, d.ex!];
  }
  function within(x: number, d: Work): boolean {
    return x > Math.min(d.sx!, d.ex!) && x < Math.max(d.sx!, d.ex!);
  }
  /** Each has a leg inside the other's span: no lanes on one side can separate them. */
  function interleaves(j: Work, k: Work): boolean {
    return legXs(k).filter((x) => within(x, j)).length === 1 && legXs(j).filter((x) => within(x, k)).length === 1;
  }

  /** Does one of `k`'s legs pass through `j`'s lane? */
  function legCrosses(k: Work, j: Work): boolean {
    const jx1 = j.pts![1]![0];
    const jy = j.pts![1]![1];
    const jx2 = j.pts![2]![0];
    const lo = Math.min(jx1, jx2);
    const hi = Math.max(jx1, jx2);
    for (const leg of [[k.pts![0]!, k.pts![1]!], [k.pts![2]!, k.pts![3]!]] as const) {
      const x = leg[0][0];
      const top = Math.min(leg[0][1], leg[1][1]);
      const bottom = Math.max(leg[0][1], leg[1][1]);
      if (x > lo && x < hi && jy > top && jy < bottom) return true;
    }
    return false;
  }

  function place(js: Work[]) {
    // Order the legs on each edge so no lane crosses another leg — the top edges for lanes above, the bottom for lanes below.
    for (const below of [false, true]) {
      const mine = js.filter((d) => Boolean(d.below) === below);
      for (const scr of input.screens) {
        const legs: Array<{ d: Work; end: "s" | "e"; x: number; fixed: boolean; dir: number; lane: number }> = [];
        for (const d of mine) {
          if (d.a.id === scr.id) legs.push({ d, end: "s", x: d.sx!, fixed: true, dir: Math.sign(d.ex! - d.sx!), lane: d.lane! });
          if (d.b.id === scr.id) legs.push({ d, end: "e", x: 0, fixed: false, dir: Math.sign(d.sx! - d.ex!), lane: d.lane! });
        }
        if (legs.length === 0) continue;
        const key = (g: (typeof legs)[number]) => (g.dir < 0 ? g.lane : 1000 - g.lane);
        legs.sort((p, q) => key(p) - key(q) || (p.fixed ? p.x : 0) - (q.fixed ? q.x : 0));
        const lo = scr.x + scr.w * 0.12;
        const hi = scr.x + scr.w * 0.88;
        let i = 0;
        while (i < legs.length) {
          if (legs[i]!.fixed) {
            i++;
            continue;
          }
          let j = i;
          while (j < legs.length && !legs[j]!.fixed) j++;
          const left = i > 0 ? legs[i - 1]!.x + 24 : lo;
          const right = j < legs.length ? legs[j]!.x - 24 : hi;
          for (let k = i; k < j; k++) legs[k]!.x = left + ((right - left) * (k - i + 1)) / (j - i + 1);
          i = j;
        }
        for (const g of legs) if (g.end === "e") g.d.ex = g.x;
      }
    }
    for (const d of js) {
      const r = rowOf.get(d.a.id)!;
      const x0 = Math.min(d.sx!, d.ex!);
      const x1 = Math.max(d.sx!, d.ex!);
      const inSpan = others.filter((o) => overlapsY(o, band[r]!.top, band[r]!.bottom) && o.x < x1 && o.x + o.w > x0);
      if (d.below) {
        // Under the row, and under anything taller standing in the lane's span. No title strip below an item.
        const bottom = Math.max(band[r]!.bottom, ...inSpan.map((o) => o.y + o.h));
        const ly = bottom + LANE0_BELOW + d.lane! * LANE;
        d.pts = [[d.sx!, d.a.y + d.a.h], [d.sx!, ly], [d.ex!, ly], [d.ex!, d.b.y + d.b.h + GAP]];
        d.label = { x: (d.sx! + d.ex!) / 2, y: ly, run: Math.abs(d.ex! - d.sx!) };
        continue;
      }
      // Above the row, and above anything taller standing in the lane's span.
      const top = Math.min(band[r]!.top, ...inSpan.map((o) => o.y));
      const ly = top - LANE0 - d.lane! * LANE;
      d.pts = [[d.sx!, d.a.y], [d.sx!, ly], [d.ex!, ly], [d.ex!, d.b.y - GAP]];
      d.label = { x: (d.sx! + d.ex!) / 2, y: ly, run: Math.abs(d.ex! - d.sx!) };
    }
  }
}

/** A step's height: the hotspot's, kept inside the target so the head lands on its side, not past its corner. */
function clampY(y: number, a: RouteBox, b: RouteBox): number {
  const lo = Math.max(a.y, b.y) + 48;
  const hi = Math.min(a.y + a.h, b.y + b.h) - 24;
  return hi > lo ? Math.max(lo, Math.min(hi, y)) : y;
}

export function arrowId(l: Pick<WireLink, "from" | "key">): string {
  return `${l.from}|${l.key}`;
}

/** An orthogonal polyline as a path, its corners rounded (React Flow's `smoothstep` idea). */
export function roundedPath(pts: readonly Point[], radius = CORNER): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M ${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]!;
    const [cx, cy] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    if (l1 === 0 || l2 === 0) continue;
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * r;
    const ay = cy - ((cy - py) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r;
    const by = cy + ((ny - cy) / l2) * r;
    d += ` L ${f(ax)} ${f(ay)} Q ${f(cx)} ${f(cy)} ${f(bx)} ${f(by)}`;
  }
  const [lx, ly] = pts[pts.length - 1]!;
  return `${d} L ${f(lx)} ${f(ly)}`;
}

/** Crossings between routes: a horizontal run of one strictly crossing a vertical run of another. */
export function crossings(arrows: ReadonlyArray<{ pts: readonly Point[] }>): number {
  const segs = (pts: readonly Point[]) => pts.slice(1).map((p, i) => [pts[i]!, p] as const);
  let n = 0;
  for (let i = 0; i < arrows.length; i++) {
    for (let j = i + 1; j < arrows.length; j++) {
      for (const [p1, p2] of segs(arrows[i]!.pts)) {
        for (const [p3, p4] of segs(arrows[j]!.pts)) {
          const h1 = p1[1] === p2[1];
          const h2 = p3[1] === p4[1];
          if (h1 === h2) continue;
          const [H1, H2, V1, V2] = h1 ? [p1, p2, p3, p4] : [p3, p4, p1, p2];
          const x = V1[0];
          const y = H1[1];
          if (x > Math.min(H1[0], H2[0]) && x < Math.max(H1[0], H2[0]) && y > Math.min(V1[1], V2[1]) && y < Math.max(V1[1], V2[1])) n++;
        }
      }
    }
  }
  return n;
}

/**
 * **Where a hotspot probably is, before it is measured** — by its slot: an
 * app bar's at the top (a leading chevron at the left, actions at the right),
 * a nav's items spread along the bottom, anything else in the middle. The
 * canvas swaps in the measured rect as soon as the hidden frame has laid the
 * screen out; this is only what it draws in the meantime.
 */
export function estimatedHot(key: string, size: { w: number; h: number }, navCount = 4): HotRect {
  const [slot, element = ""] = key.split("#");
  const s = slot ?? "";
  const box = (cx: number, cy: number, w = 48, h = 32): HotRect => ({ x: cx - w / 2, y: cy - h / 2, w, h });
  if (s.startsWith("header")) return box(element === "leading" ? size.w * 0.08 : size.w * 0.9, size.h * 0.09);
  const tab = /-(\d+)$/.exec(element);
  if (s.startsWith("nav") && tab) return box(((Number(tab[1]) - 0.5) / navCount) * size.w, size.h * 0.95);
  if (s.startsWith("nav")) return box(size.w / 2, size.h * 0.95);
  if (s.startsWith("footer")) return box(size.w / 2, size.h * 0.9);
  return box(size.w / 2, size.h * 0.5, size.w * 0.8, 40);
}
