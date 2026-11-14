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
 * **Ship, the pure half** (exact phase 7; design §11). All of delivery is
 * Exact's: `scripts/deploy.mjs`'s dry run classifies, its `--yes` signs and
 * publishes. This file only reads what Exact printed and says it as the
 * canvas holds it:
 *
 * - **the lane** — `app.json`'s `deploy`, channels as rows (a JSON item);
 * - **a prepare card** — the dry run's classification, as Markdown: what goes
 *   over the air and what *needs a binary*, each with Exact's own reason;
 * - **a release card** — the release record, as Markdown, linking the screens
 *   it changed by their versions before and after.
 *
 * Every card is text that reads with the module gone. Nothing here decides
 * a classification: a row is OTA or binary because Exact's `action` says so.
 * Keys are `exact.*` (core.ts). No React, no Node: both surfaces import it.
 */

/** The same string as core.ts's: this file imports nothing, so the CLI's verb chunk does not take core.ts in twice. */
export const EXACT_LANE_MIME = "application/vnd.isocan.exact-lane+json";

/** One row of Exact's deploy table (`classify` in deploy.mjs), as far as the canvas reads it. */
export interface DeployRow {
  kind: "origin" | "stream" | "binary";
  platform?: string | null;
  compatibilityId?: string | null;
  action: string;
  seq?: number;
  head?: { seq: number; release: string | null } | null;
  changes?: Array<{ name: string; change: string; note?: string }>;
  reason?: string;
  files?: { new: string[]; changed: string[]; current: string[]; removed?: string[] };
}

/** Exact's deploy table (a dry run), or its outcome (`--yes`: plus published, refused, failed). */
export interface DeployTable {
  release: string;
  snapshot: { id: string; commit: string; dirty: boolean; changes?: string[] };
  app: { id: string; name: string };
  channel: string;
  origin: { kind: string; location: string };
  dryRun: boolean;
  notes: string[];
  rows: DeployRow[];
  published?: Array<{ kind: string; platform?: string | null; compatibilityId?: string; action: string; seq?: number; head?: { seq: number; sha256: string; release: string }; previous?: string | null; note?: string }>;
  refused?: Array<{ platform?: string | null; compatibilityId?: string; reason: string }>;
  failed?: Array<{ platform?: string | null; compatibilityId?: string; kind?: string; error: string }>;
}

/** `app.json`'s `deploy`, as the lane draws it. Key ids only: a signing key never reaches the canvas. */
export interface LaneFacts {
  format: 1;
  app: { id: string; name: string };
  platform: string;
  channels: Array<{ name: string; origin: string; release: string | null; phased: boolean }>;
  /** The channel the installed binary bakes in (`deploy.channel`). */
  baked: string | null;
  activate: string | null;
  interval: number | null;
  signing: string | null;
}

/** The classification, as the card and the confirm step say it. */
export interface Classification {
  ota: Array<{ platform: string; stream: string; seq: number | null; changes: string[] }>;
  binary: Array<{ platform: string; stream: string | null; reason: string }>;
  current: Array<{ platform: string; stream: string; seq: number | null }>;
  unavailable: Array<{ platform: string; reason: string }>;
  /** How many changes go over the air: the count a person confirms. */
  changes: number;
}

/** `exact.classification`, on a prepare card. */
export interface PreparedRecord {
  channel: string;
  release: string;
  snapshot: string;
  commit: string;
  dirty: boolean;
  origin: string;
  classification: Classification;
  notes: string[];
  /** SHA-256 of the origin directory's listing and bytes, before and after the dry run: unchanged is the proof nothing was uploaded. */
  originHash: { before: string | null; after: string | null };
  by: string;
  at: string;
  ms: number;
}

export type ShipKind = "ship" | "promote" | "rollback";

/** `exact.release`, on a release card. */
export interface ReleaseRecord {
  kind: ShipKind;
  channel: string;
  release: string;
  snapshot: string;
  commit: string;
  origin: string;
  by: string;
  at: string;
  /** Each stream head this release wrote: `seq` is what a client compares. */
  heads: Array<{ platform: string; stream: string; seq: number; sha256: string; previous: string | null }>;
  refused: Array<{ platform: string; reason: string }>;
  failed: string[];
  classification: Classification;
  /** Promote: the release it promoted. Roll back: the release whose content it re-published. */
  of: string | null;
  /** `deploy.phased[channel]`, and what Exact did with it. */
  phased: { asked: boolean; note: string | null };
  /** The app's screens at this release, by version: what the next card compares against. */
  screens: Record<string, string>;
  /** The screens this release changed: before and after, versions of the same item. */
  changed: Array<{ itemId: string; title: string; before: string | null; after: string }>;
  ms: number;
}

/** A ship asked for on the lane: who confirmed what. */
export interface ShipAsk { seq: number; by: string; kind: ShipKind; channel: string; changes: number | null; prepared: string | null; from: string | null }
export interface ShipAnswer { seq: number; ok: boolean; itemId: string | null; error?: string; refused?: boolean }
export interface PrepareAsk { seq: number; by: string; channel: string }
export interface PrepareAnswer { seq: number; ok: boolean; itemId: string | null; error?: string }

/** The sentence an agent's ship gets, on the CLI and on the canvas alike. */
export const agentRefusal = (name: string): string =>
  `${name} is an agent, and only a person ships: an agent may prepare a release, and a person on this machine confirms and ships it.`;

/** The sentence a person this machine's owner has not granted write gets for a lane ask (exact phase 8): they are `read`. */
export const grantRefusal = (name: string): string =>
  `${name} has read scope on this machine, and only its owner or someone it granted (ISOCAN_EXACT_GRANT) ships: ${name} may prepare a release, and the owner confirms and ships it.`;

/** Exact has no publisher-side staged rollout (schema only at cbe553f6): said on the card, never pretended. */
export const PHASED_NOTE = "app.json asks for a phased rollout; Exact's publisher stages none (deploy.phased is schema only), so every device on this channel takes it at its next check";

const OTA_CHANGE = (c: { name: string; change: string; note?: string }) => `${c.name} ${c.change}${c.note ? ` (${c.note})` : ""}`;

/** Exact's rows, sorted by Exact's own `action`: `bundle` goes over the air, `binary` needs one. */
export function classify(table: DeployTable): Classification {
  const out: Classification = { ota: [], binary: [], current: [], unavailable: [], changes: 0 };
  for (const r of table.rows) {
    const platform = r.platform ?? (r.kind === "origin" ? "web root" : "?");
    const stream = r.compatibilityId ? r.compatibilityId.slice(0, 8) : "";
    if (r.kind === "origin") {
      const f = r.files ?? { new: [], changed: [], current: [] };
      const moved = [...f.new.map((n) => `${n} new`), ...f.changed.map((n) => `${n} changed`), ...(f.removed ?? []).map((n) => `${n} removed`)];
      if (r.action === "publish") { out.ota.push({ platform, stream: "web root", seq: null, changes: moved }); out.changes += moved.length; }
      else if (r.action === "unavailable") out.unavailable.push({ platform, reason: r.reason ?? "unavailable" });
      continue;
    }
    if (r.action === "bundle") {
      const changes = (r.changes ?? []).map(OTA_CHANGE);
      out.ota.push({ platform, stream, seq: r.seq ?? null, changes });
      out.changes += changes.length;
    } else if (r.action === "binary") out.binary.push({ platform, stream: stream || null, reason: r.reason ?? "Exact gave no reason" });
    else if (r.action === "current") out.current.push({ platform, stream, seq: r.seq ?? r.head?.seq ?? null });
    else out.unavailable.push({ platform, reason: r.reason ?? r.action });
  }
  return out;
}

/** One line: what a person confirms. */
export function classificationLine(c: Classification): string {
  const parts: string[] = [];
  if (c.ota.length) parts.push(`${c.changes} change${c.changes === 1 ? "" : "s"} over the air (${c.ota.map((o) => `${o.platform}${o.stream ? ` ${o.stream}` : ""}${o.seq != null ? ` → seq ${o.seq}` : ""}`).join(", ")})`);
  if (c.binary.length) parts.push(`${c.binary.length} need${c.binary.length === 1 ? "s" : ""} a binary`);
  if (!c.ota.length && !c.binary.length) parts.push("nothing to ship: every stream is current");
  if (c.unavailable.length) parts.push(`${c.unavailable.length} unavailable`);
  return parts.join("; ");
}

/** The prepare card's text: readable as a file. */
export function preparedMarkdown(r: PreparedRecord, appName: string): string {
  const c = r.classification;
  const lines = [
    `# Prepared: ${appName} → ${r.channel}`,
    "",
    `Exact's dry run (\`deploy.mjs --json\`), ${r.at.slice(0, 16).replace("T", " ")} for ${r.by}: release ${r.release}, snapshot ${r.snapshot.slice(0, 12)}${r.dirty ? " (DIRTY)" : ""}, origin ${r.origin}. Nothing was uploaded.`,
    "",
    `**${classificationLine(c)}**`,
    "",
  ];
  if (c.ota.length) {
    lines.push("## Over the air", "");
    for (const o of c.ota) lines.push(`- ${o.platform}${o.stream ? ` stream ${o.stream}` : ""}${o.seq != null ? `, as seq ${o.seq}` : ""}: ${o.changes.join(", ") || "no change"}`);
    lines.push("");
  }
  if (c.binary.length) {
    lines.push("## Needs a binary", "");
    for (const b of c.binary) lines.push(`- ${b.platform}${b.stream ? ` ${b.stream}` : ""}: ${b.reason}`);
    lines.push("");
  }
  if (c.current.length) lines.push(`Current: ${c.current.map((x) => `${x.platform} ${x.stream}${x.seq != null ? ` at seq ${x.seq}` : ""}`).join(", ")}.`, "");
  for (const u of c.unavailable) lines.push(`Unavailable: ${u.platform} — ${u.reason}`);
  for (const n of r.notes) lines.push(`> ${n}`);
  lines.push("", `${originLine(r)}.`);
  return lines.join("\n") + "\n";
}

/**
 * What the origin's digests prove, and only that: with no directory hashed (the channel names a URL and
 * `ISOCAN_EXACT_ORIGIN` is unset) nothing was measured, so nothing is claimed.
 */
export function originLine(r: Pick<PreparedRecord, "channel" | "origin" | "originHash">): string {
  const { before, after } = r.originHash;
  if (before === null || after === null) return `origin not hashed: ${r.channel} names ${r.origin}; set ISOCAN_EXACT_ORIGIN to the directory that host serves to prove nothing was uploaded`;
  return `origin ${before.slice(0, 16)} before, ${after.slice(0, 16)} after — ${before === after ? "unchanged, nothing uploaded" : "CHANGED"}`;
}

const KIND_WORD: Record<ShipKind, string> = { ship: "Shipped", promote: "Promoted", rollback: "Rolled back" };

/** The release card's text: the record, readable as a file. */
export function releaseMarkdown(r: ReleaseRecord, appName: string): string {
  const lines = [
    `# ${KIND_WORD[r.kind]}: ${appName} → ${r.channel}`,
    "",
    r.kind === "rollback"
      ? `A roll back: the content of ${r.of} re-published at a new sequence number (Exact has no publisher rollback; a client's anti-rollback floor only moves forward).`
      : r.kind === "promote" ? `The content of ${r.of}, promoted to ${r.channel}.` : `Signed and published by Exact's \`deploy.mjs --yes\` with the keys on ${r.by}'s machine.`,
    "",
    `Release ${r.release}, snapshot ${r.snapshot.slice(0, 12)}, by ${r.by}, ${r.at.slice(0, 19).replace("T", " ")}; origin ${r.origin}.`,
    "",
  ];
  for (const h of r.heads) lines.push(`- ${h.platform} stream ${h.stream}: head seq ${h.seq} (${h.sha256.slice(0, 12)}), previous ${h.previous ? h.previous.slice(0, 12) : "none"}`);
  for (const x of r.refused) lines.push(`- ${x.platform}: refused, needs a binary — ${x.reason}`);
  for (const f of r.failed) lines.push(`- FAILED: ${f}`);
  if (!r.heads.length && !r.refused.length && !r.failed.length) lines.push("- nothing written: every stream was current");
  if (r.phased.asked) lines.push("", `Phased: ${r.phased.note}.`);
  if (r.changed.length) {
    lines.push("", "## Screens it changed", "");
    for (const s of r.changed) lines.push(`- ${s.title}: ${s.before ? `version ${s.before} → ` : ""}version ${s.after}`);
  }
  return lines.join("\n") + "\n";
}

/** The screens a release changed: each screen whose version differs from the previous release's on the channel. */
export function changedScreens(now: Record<string, { title: string; version: string }>, previous: Record<string, string> | null): ReleaseRecord["changed"] {
  if (!previous) return [];
  return Object.entries(now)
    // A screen the previous release did not record is not comparable (a host captured since): only moved versions count.
    .filter(([itemId, s]) => previous[itemId] !== undefined && previous[itemId] !== s.version)
    .map(([itemId, s]) => ({ itemId, title: s.title, before: previous[itemId] ?? null, after: s.version }));
}

const parse = <T>(raw: string | undefined, ok: (v: T) => boolean): T | null => {
  if (!raw) return null;
  try { const v = JSON.parse(raw) as T; return v && ok(v) ? v : null; } catch { return null; }
};
export const parsePrepared = (raw: string | undefined) => parse<PreparedRecord>(raw, (v) => typeof v.channel === "string" && typeof v.snapshot === "string" && !!v.classification);
export const parseRelease = (raw: string | undefined) => parse<ReleaseRecord>(raw, (v) => typeof v.channel === "string" && typeof v.release === "string" && Array.isArray(v.heads));
export const parseShipAsk = (raw: string | undefined) => parse<ShipAsk>(raw, (v) => typeof v.seq === "number" && typeof v.channel === "string" && ["ship", "promote", "rollback"].includes(v.kind));
export const parseShipAnswer = (raw: string | undefined) => parse<ShipAnswer>(raw, (v) => typeof v.seq === "number" && typeof v.ok === "boolean");
export const parsePrepareAsk = (raw: string | undefined) => parse<PrepareAsk>(raw, (v) => typeof v.seq === "number" && typeof v.channel === "string");
export const parsePrepareAnswer = (raw: string | undefined) => parse<PrepareAnswer>(raw, (v) => typeof v.seq === "number" && typeof v.ok === "boolean");
export const parseLane = (text: string) => parse<LaneFacts>(text, (v) => v.format === 1 && Array.isArray(v.channels));

/** A channel name as Exact admits one (origin.mjs `validateChannel`'s shape): it names a directory. */
export const CHANNEL = /^[A-Za-z0-9._-]{1,63}$/;

/** What the bridge's `prepare` reports (exact-bridge.mjs `prepareJob`). */
export interface PrepareReport {
  ok: boolean; channel: string; platform: string; lane: LaneFacts & { updating?: boolean };
  table: DeployTable | null; originHash: { before: string | null; after: string | null }; ms: number; error?: string;
}

/** A dry run's report, as the card's record. */
export function preparedRecord(r: PrepareReport, by: string, at: string): PreparedRecord {
  const t = r.table!;
  return {
    channel: r.channel, release: t.release, snapshot: t.snapshot.id, commit: t.snapshot.commit, dirty: t.snapshot.dirty,
    origin: t.origin.location, classification: classify(t),
    // Exact's notes, bounded: its --dirty note lists the ignored files it captured.
    notes: t.notes.map((n) => (n.length > 400 ? `${n.slice(0, 400)}…` : n)),
    originHash: r.originHash, by, at, ms: r.ms,
  };
}

export const LANE_SIZE = (channels: number) => ({ width: 380, height: 120 + ROW * Math.max(1, channels) });
export const ROW = 320;
export const CARD = { width: 520, height: 300 };

/** Where the next card in a channel's row goes: right of the lane head, one after another. */
export function cardAt(lane: { x: number; y: number }, row: number, index: number): { x: number; y: number } {
  return { x: Math.round(lane.x + 420 + index * (CARD.width + 40)), y: Math.round(lane.y + 100 + row * ROW) };
}
