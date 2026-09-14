import type { LogEntry } from "./ops.ts";
import type { CanvasContents } from "./model.ts";
import { excludedInAmbient } from "./canvas-group-context.ts";
import { summarizeRecapWindow } from "./recap-window.ts";

const HEAD_OPERATIONS = 100;
const HEAD_ACTORS = 5;
const HEAD_ITEMS = 8;
const HEAD_LABEL_POINTS = 160;

/** Current, bounded activity facts; no raw entries or historical item names. */
interface RecapHead {
  fromSeq: number;
  toSeq: number;
  fromTs: string;
  toTs: string;
  count: number;
  comments: number;
  actors: Array<{ name: string; ops: number }>;
  items: Array<{ id: string; title: string; ops: number }>;
  omitted: {
    /** Available older entries, without claiming the older history is complete. */
    earlierAvailableOps: number;
    actors: number;
    /** Eligible current rows beyond the displayed item budget. */
    items: number;
    /** Distinct touched items now absent or excluded, including excluded descendants. */
    hiddenItems: number;
    /** Displayed names/titles clipped to the shared Unicode code-point bound. */
    clippedLabels: number;
  };
}

/** The authority identifies the exact source and captured revision beside its facts. */
export interface RecapHeadResponse {
  canvasId: string;
  home: string;
  title: string;
  revision: number;
  head: RecapHead;
}

/** Recap display labels share one code-point bound, including the source title. */
export function clipRecapLabel(value: string): { text: string; clipped: boolean } {
  const points = Array.from(value);
  return { text: points.slice(0, HEAD_LABEL_POINTS).join(""), clipped: points.length > HEAD_LABEL_POINTS };
}

function sameRecord(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameRecord(a[key], b[key]));
}

/** Assemble a contiguous recent range from live/archive entries. A missing or
 * conflicting required sequence is unavailable, never an empty success. The
 * caller captures revision/state/history together under its writer boundary. */
export function buildRecapHead(entries: LogEntry[], canvas: CanvasContents, revision: number): RecapHead | null {
  if (!Number.isSafeInteger(revision) || revision < 1) return null;
  const bySeq = new Map<number, LogEntry>();
  const fromSeq = Math.max(1, revision - HEAD_OPERATIONS + 1);
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.seq) || entry.seq < 1 || entry.seq > revision) return null;
    const prior = bySeq.get(entry.seq);
    if (entry.seq >= fromSeq && prior && !sameRecord(prior, entry)) return null;
    bySeq.set(entry.seq, entry);
  }
  const recent: LogEntry[] = [];
  for (let seq = fromSeq; seq <= revision; seq++) {
    const entry = bySeq.get(seq);
    if (!entry) return null;
    recent.push(entry);
  }
  const window = summarizeRecapWindow(recent, canvas);
  const visible = window.items.filter(({ id }) => canvas.items[id] && !excludedInAmbient(canvas, canvas.items[id]!));
  let clippedLabels = 0;
  const label = (value: string) => {
    const clipped = clipRecapLabel(value);
    if (clipped.clipped) clippedLabels++;
    return clipped.text;
  };
  return {
    fromSeq, toSeq: revision, fromTs: window.fromTs, toTs: window.toTs,
    count: recent.length, comments: window.comments,
    actors: window.actors.slice(0, HEAD_ACTORS).map(({ name, ops }) => ({ name: label(name), ops })),
    items: visible.slice(0, HEAD_ITEMS).map(({ id, ops }) => ({ id, title: label(canvas.items[id]!.title), ops })),
    omitted: {
      earlierAvailableOps: [...bySeq.keys()].filter((seq) => seq < fromSeq).length,
      actors: Math.max(0, window.actors.length - HEAD_ACTORS),
      items: Math.max(0, visible.length - HEAD_ITEMS),
      hiddenItems: window.items.length - visible.length,
      clippedLabels,
    },
  };
}

/** CLI, web and MCP render the same bounded facts and explicit omissions. */
export function formatRecapHead(head: RecapHead): string {
  const parts = [
    `seq ${head.fromSeq}–${head.toSeq}: ${head.count} operations, ${head.comments} comments`,
    `${head.fromTs} – ${head.toTs}`,
  ];
  if (head.actors.length) parts.push(`Active: ${head.actors.map((actor) => `${actor.name} (${actor.ops})`).join(", ")}`);
  if (head.items.length) parts.push(`Current items: ${head.items.map((item) => `${item.title} (${item.ops})`).join(", ")}`);
  const omitted = head.omitted;
  if (omitted.earlierAvailableOps) parts.push(`${omitted.earlierAvailableOps} earlier available operations outside this head`);
  if (omitted.actors) parts.push(`${omitted.actors} additional actor rows omitted`);
  if (omitted.items) parts.push(`${omitted.items} less-active current item rows omitted`);
  if (omitted.hiddenItems) parts.push(`${omitted.hiddenItems} removed or excluded item details omitted`);
  if (omitted.clippedLabels) parts.push(`${omitted.clippedLabels} labels clipped at ${HEAD_LABEL_POINTS} Unicode code points`);
  return parts.join("; ");
}

/** Automatic inheritance reads this metadata route instead of the raw oplog. */
export function recapHeadRoute(canvasId: string): string {
  return `/api/projects/${encodeURIComponent(canvasId)}/context/recap`;
}
