/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Every host, and Drive mode** (exact phase 3; design §4, §7) — the pure
 * half: which hosts a capture runs on and the device each draws, where the
 * native cards sit, what makes a difference between hosts a finding, the
 * device wall's file, and the closed list of operations Drive mode may send.
 *
 * Read by the CLI's verbs and the web half, never by `core.ts`: every CLI
 * start-up reads that, and none of this belongs on `isocan --version`'s path
 * (`test/cli-bundle.test.ts`).
 */

import type { CanvasContents, Item } from "@isocan/core";
import type { CapturePoint, CapturePoints, ExactSource } from "./core.ts";
import { core } from "./core-ref.ts";
import { DEVICES, LAYOUT, rowSize, type Device, type Scheme } from "./map.ts";
import type { Finding } from "./findings.ts";

// ---------------------------------------------------------------- hosts

export const HOSTS = ["web", "ios", "macos"] as const;
export type Host = (typeof HOSTS)[number];

/**
 * **The device each native host draws.** A simulator is one device at its
 * own size (an iPhone, by default the one `--sim` names); a Mac build is a
 * window, captured at the desktop row's size. The web draws every device.
 */
export const NATIVE_DEVICE: Record<Exclude<Host, "web">, Device> = { ios: "phone", macos: "desktop" };

export const HOST_NAMES: Record<Host, string> = { web: "web", ios: "iOS", macos: "macOS" };

export function parseHosts(given: string | undefined): Host[] {
  const picked = (given ?? "web").split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of picked) if (!(HOSTS as readonly string[]).includes(p)) throw new Error(`--hosts takes ${HOSTS.join(", ")}, not ${p}`);
  return [...new Set(picked)] as Host[];
}

/** A simulator's UDID, as `xcrun simctl create` prints it. */
export const UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/** The size a capture job asks for: the device's web size; a simulator ignores it (it is the size it is). */
export function jobSize(device: Device): string {
  return `${DEVICES[device].width}x${DEVICES[device].height}`;
}

// ---------------------------------------------------------------- layout: the native column

/**
 * **Where a native card sits**, relative to its route's phone screen: past
 * the web's device row, a column per native host — iOS then macOS — light
 * above, dark below, each at the row's height in its own shape.
 */
export function nativeOffset(host: Exclude<Host, "web">, scheme: Scheme): { x: number; y: number } {
  let x = LAYOUT.primary.width + LAYOUT.gap;
  for (const d of ["phone", "tablet", "desktop"] as Device[]) x += rowSize(d).width + LAYOUT.rowGap;
  x += LAYOUT.gap;
  if (host === "macos") x += nativeSize("ios", null).width + LAYOUT.rowGap;
  return { x, y: scheme === "light" ? 0 : LAYOUT.rowHeight + LAYOUT.rowGap };
}

/** A native card's size: its capture's shape (a simulator's screen) at the row's height. */
export function nativeSize(host: Exclude<Host, "web">, png: { width: number; height: number } | null): { width: number; height: number } {
  const shape = png ?? (host === "ios" ? { width: 402, height: 874 } : DEVICES.desktop);
  return { width: Math.round((shape.width / shape.height) * LAYOUT.rowHeight), height: LAYOUT.rowHeight };
}

/** How much wider a map cell is when it carries native columns. */
export function nativeCellWidth(hosts: readonly Host[]): number {
  let w = 0;
  if (hosts.includes("ios")) w += nativeSize("ios", null).width + LAYOUT.rowGap;
  if (hosts.includes("macos")) w += nativeSize("macos", null).width + LAYOUT.rowGap;
  return w ? w + LAYOUT.gap : 0;
}

// ---------------------------------------------------------------- a difference between hosts

/** What `exact-bridge.mjs compare` reports for one native screen: Exact's `screenshot … compare`, the web drawn at the native screen's size. */
export interface CompareReport {
  compares: Array<{
    route: string;
    host: Exclude<Host, "web">;
    size: string;
    /** The driver's `compare` reply: how much matches, and the regions that do not. */
    compare: { match: number; regions: Array<{ screen: { x: number; y: number; w: number; h: number }; count: number }>; more: number } | null;
    /** Its text: a line a region, each naming the node it is under and the line that drew it. */
    text: string;
    /** The web's nodes at that size (`exact.points`' shape), to set beside the native capture's. */
    web: CapturePoints | null;
    error?: string;
  }>;
}

export interface Inversion {
  /** Above `below` on the native host, under it on the web. */
  above: CapturePoint;
  below: CapturePoint;
}

/**
 * **Is this a difference between hosts, or each platform's own
 * presentation?** (design §7). A native host draws its own bars — UIKit's
 * navigation bar and tab bar, a status bar, a Mac window's — so pixels
 * always differ, and `screenshot compare` always finds regions. What is not
 * presentation is the app's own layout: two nodes the app names (`testId`)
 * that both hosts draw, in one order on the web and the other order natively.
 * Nodes laid side by side (overlapping vertically) are not ordered; the
 * router's root and the tab bar are presentation by definition.
 */
export function inversions(web: CapturePoints, native: CapturePoints, chrome: ReadonlySet<string> = new Set()): Inversion[] {
  const pick = (p: CapturePoints) => {
    const out = new Map<string, CapturePoint>();
    for (const n of p.nodes) if (n.testId && !chrome.has(n.testId) && n.w > 0 && n.h > 0 && !out.has(n.testId)) out.set(n.testId, n);
    return out;
  };
  const a = pick(web);
  const b = pick(native);
  const both = [...a.keys()].filter((k) => b.has(k)).sort();
  const strictlyAbove = (x: CapturePoint, y: CapturePoint) => x.y + x.h <= y.y;
  const out: Inversion[] = [];
  for (const i of both) {
    for (const j of both) {
      if (i === j) continue;
      if (strictlyAbove(b.get(i)!, b.get(j)!) && strictlyAbove(a.get(j)!, a.get(i)!)) out.push({ above: b.get(i)!, below: b.get(j)! });
    }
  }
  // One sentence per moved node: a node that changed places with several is named once, with the first it passed.
  const seen = new Set<string>();
  return out.filter((v) => (seen.has(v.above.testId!) ? false : (seen.add(v.above.testId!), true)));
}

/**
 * **What each platform presents as its own** — the app's tab bar: a
 * `role="tablist"` row is UIKit's tab bar on iOS, a bottom strip on macOS
 * and a row the web places by its width, so where it sits is the
 * platform's, not the app's. The testIds drawn by any line of that subtree,
 * read off the Contract source.
 */
export function presentationTestIds(sources: Readonly<Record<string, string>>, points: readonly CapturePoints[]): Set<string> {
  const lines = new Map<string, Set<number>>();
  for (const [file, text] of Object.entries(sources)) {
    const rows = text.split("\n");
    const indent = (l: string) => l.length - l.trimStart().length;
    for (let i = 0; i < rows.length; i++) {
      if (!/\brole="tablist"/.test(rows[i]!)) continue;
      const set = lines.get(file) ?? new Set<number>();
      set.add(i + 1);
      for (let j = i + 1; j < rows.length && (rows[j]!.trim() === "" || indent(rows[j]!) > indent(rows[i]!)); j++) set.add(j + 1);
      lines.set(file, set);
    }
  }
  const out = new Set<string>();
  for (const p of points) for (const n of p.nodes) if (n.testId && lines.get(n.file)?.has(n.line)) out.add(n.testId);
  return out;
}

/**
 * **A host difference as a finding** (design §7): pinned to the native
 * screen at the moved node, naming it, with `screenshot compare`'s region
 * lines that touch it (the web drawn at the native screen's size, against
 * the native capture), `exact.source` at the line that draws it, and a key
 * that goes when the hosts agree again.
 */
export function compareFindings(report: CompareReport, natives: ReadonlyArray<{ route: string; host: Exclude<Host, "web">; points: CapturePoints | null }>, sources: Readonly<Record<string, string>> = {}): Finding[] {
  const chrome = presentationTestIds(sources, [...natives.flatMap((n) => (n.points ? [n.points] : [])), ...report.compares.flatMap((c) => (c.web ? [c.web] : []))]);
  const out: Finding[] = [];
  for (const c of report.compares) {
    const native = natives.find((n) => n.route === c.route && n.host === c.host)?.points;
    if (!native || !c.web || !c.compare) continue;
    const found = inversions(c.web, native, chrome);
    if (found.length === 0) continue;
    const name = HOST_NAMES[c.host];
    const lines = c.text.split("\n").filter((l) => /^\s+\d+ \[/.test(l));
    // The regions `compare` names under one of the moved nodes (`under cart-2 [17,78 368×52] app.contract:191: …`).
    const touches = (n: CapturePoint) => lines.filter((l) => new RegExp(`\\bunder ${n.testId!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(l));
    for (const v of found) {
      const key = `compare:${c.route}:${c.host}:${v.above.testId}`;
      const digest = native.files[v.above.file];
      const said = [...new Set([...touches(v.above), ...touches(v.below)])].slice(0, 4).map((l) => l.trim());
      const body = [
        `${name} and the web lay out ${c.route} differently, beyond each platform's own bars: \`${v.above.testId}\` is above \`${v.below.testId}\` on ${name}, and below it on the web.`,
        `\`screenshot compare\` (the web at ${name}'s ${c.size.replace("x", "×")}, against the ${name} capture): ${(c.compare.match * 100).toFixed(1)}% matches, ${c.compare.regions.length + c.compare.more} regions differ${said.length ? `; under these nodes:` : ", none of them named under these nodes."}`,
        ...said.map((l) => `  ${l}`),
        `Posted by \`isocan exact\`; it goes when the two hosts agree again.`,
        ...(digest ? [core.sourceLine({ file: v.above.file, line: v.above.line, col: v.above.col, sha256: digest } satisfies ExactSource)] : []),
        `exact.diagnostic = ${key}`,
      ];
      out.push({ key, routes: [c.route], scheme: "light", box: [v.above.x, v.above.y, v.above.w, v.above.h], body: body.join("\n"), anchor: { host: c.host, device: NATIVE_DEVICE[c.host], width: native.size?.width ?? 402 } });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the device wall

/** One cell of a wall: a screen of the route, on one host and device, as it was when the wall was written. */
export interface WallCell {
  itemId: string;
  host: Host;
  device: Device;
  scheme: Scheme;
  title: string;
  blobHash: string;
  /** The capture's size in points — what the cell's shape and pointing read. */
  width: number;
  height: number;
  /** The screen's properties a cell draws with: its route's location, its shots, its points. */
  url: string;
  shots?: string;
  points?: string;
}

export interface Wall {
  format: 1;
  app: { id: string; name: string };
  route: string;
  scheme: Scheme;
  cells: WallCell[];
}

const HOST_ORDER: Record<string, number> = { web: 0, ios: 1, macos: 2 };
const DEVICE_ORDER: Record<string, number> = { phone: 0, tablet: 1, desktop: 2 };

/**
 * **A wall's cells, read off the canvas**: every screen of the route in one
 * scheme, on every host and device there is one for — web first, then iOS,
 * then macOS; phone, tablet, desktop within each.
 */
export function wallCells(canvas: CanvasContents, appId: string, route: string, scheme: Scheme = "light"): WallCell[] {
  const P = core.EXACT_PROPS;
  const out: WallCell[] = [];
  for (const item of Object.values(canvas.items) as Item[]) {
    if (core.appIdOf(item) !== appId || item.properties?.[P.route] !== route || (item.properties?.[P.scheme] ?? "light") !== scheme) continue;
    const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions.at(-1);
    if (!v || v.mimeType !== "image/png") continue;
    const host = (item.properties?.[P.host] ?? "web") as Host;
    const device = (item.properties?.[P.device] ?? "phone") as Device;
    const points = core.parsePoints(item.properties?.[P.points]);
    const size = points?.size ?? DEVICES[device] ?? DEVICES.phone;
    out.push({
      itemId: item.id, host, device, scheme, title: item.title, blobHash: v.blobHash, width: size.width, height: size.height,
      url: item.properties?.[P.url] ?? "/",
      ...((item.properties?.[P.reached] ?? item.properties?.[P.shots]) !== undefined ? { shots: item.properties[P.reached] ?? item.properties[P.shots] } : {}),
      ...(item.properties?.[P.points] !== undefined ? { points: item.properties[P.points] } : {}),
    });
  }
  return out.sort((a, b) => (HOST_ORDER[a.host] ?? 9) - (HOST_ORDER[b.host] ?? 9) || (DEVICE_ORDER[a.device] ?? 9) - (DEVICE_ORDER[b.device] ?? 9));
}

export function wallText(wall: Wall): string {
  return `${JSON.stringify(wall, null, 2)}\n`;
}

export function parseWall(text: string): Wall {
  const v = JSON.parse(text) as Wall;
  if (!v || v.format !== 1 || !Array.isArray(v.cells)) throw new Error("not an Exact device wall (format 1)");
  return v;
}

/** The walls of an app on a canvas: items whose current version is a wall, by route. */
export function wallsOf(canvas: CanvasContents, appId: string): Array<{ item: Item; route: string; scheme: Scheme }> {
  const out: Array<{ item: Item; route: string; scheme: Scheme }> = [];
  for (const item of Object.values(canvas.items) as Item[]) {
    if (core.appIdOf(item) !== appId) continue;
    const v = item.versions.find((x) => x.id === item.currentVersionId) ?? item.versions.at(-1);
    if (v?.mimeType !== core.EXACT_WALL_MIME) continue;
    const route = item.properties?.[core.EXACT_PROPS.route];
    if (route) out.push({ item, route, scheme: item.properties?.[core.EXACT_PROPS.scheme] === "dark" ? "dark" : "light" });
  }
  return out;
}

/** A wall's size on the canvas: the cells in a row at one height, their own shapes. */
export function wallSize(cells: readonly WallCell[], height = 420): { width: number; height: number } {
  const gap = 16;
  const width = cells.reduce((w, c) => w + Math.round((c.width / c.height) * (height - 48)) + gap, gap);
  return { width: Math.max(320, width), height };
}

// ---------------------------------------------------------------- Drive mode

/**
 * **What Drive mode may send** (design §7): a press on a node the app named,
 * text typed into one, and Back. It comes from a browser and reaches the
 * person's own Exact, so it is a closed list, checked here and again in the
 * bridge — no coordinates (a drive by coordinates breaks whenever layout
 * moves, as Exact's own pitfalls say), no clock, no files.
 */
export type DriveOp = { op: "tap"; testId: string } | { op: "type"; testId: string; text: string } | { op: "back" };

const TEST_ID = /^[A-Za-z0-9_.:-]{1,80}$/;

export function driveLine(op: DriveOp): string {
  if (op.op === "back") return "back";
  if (!TEST_ID.test(op.testId)) throw new Error(`Drive mode presses a node by its testId, not ${JSON.stringify(op.testId)}`);
  if (op.op === "tap") return `tap ${op.testId}`;
  if (typeof op.text !== "string" || op.text.length > 200 || /[\n\r\0]/.test(op.text)) throw new Error("Drive mode types one line of at most 200 characters");
  return `type ${op.testId} ${JSON.stringify(op.text)}`;
}

/** Is this node one Drive mode types into rather than presses? */
export const typesInto = (n: Pick<CapturePoint, "type">) => /^(input|textfield|textinput|textarea|TextField|TextInput|Input|SearchField)$/i.test(n.type);

/**
 * **What a press at (x, y) drives**: the smallest node there that the app
 * named — a press on a row's text presses the row's link, as a finger
 * would. In the capture's points.
 */
export function driveTarget(points: CapturePoints, x: number, y: number, chrome: ReadonlySet<string> = new Set(["app"])): CapturePoint | null {
  let best: CapturePoint | null = null;
  for (const n of points.nodes) {
    if (!n.testId || chrome.has(n.testId)) continue;
    if (x < n.x || y < n.y || x > n.x + n.w || y > n.y + n.h) continue;
    if (!best || n.w * n.h <= best.w * best.h) best = n;
  }
  return best;
}
