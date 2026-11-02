#!/usr/bin/env node
/**
 * Where a conducted session's subagents spent their wall time, by kind of
 * command: `node scripts/subagent-time.mjs <transcript.jsonl|dir> …`.
 *
 * Reads Claude Code subagent transcripts (one JSON object per line) and
 * times each tool call from its `tool_use` to its `tool_result`. This is how
 * docs/research/2026-10-02-conduct-cost.md was measured, so the next session
 * can check whether the skill's changes held. Local files only, nothing sent
 * anywhere. `--json` prints the table as JSON.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const KINDS = [
  ["whole suite", /(^|[;&|]\s*)npm (run )?test(\s*$|\s*[;&|>]|\s+2>)/],
  ["deep lane", /test:deep|test:ci/],
  ["typecheck", /npm run typecheck/],
  ["build", /npm run build/],
  ["journeys", /scripts\/journeys\.mjs --only/],
  ["targeted vitest", /vitest run \S/],
  ["reading", /^\s*(cat|sed|head|tail|ls|find|grep|\/usr\/bin\/grep|rg|git (log|show|diff|status))\b/],
];

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const files = args
  .filter((a) => a !== "--json")
  .flatMap((a) => (statSync(a).isDirectory() ? readdirSync(a).map((f) => path.join(a, f)) : [a]))
  .filter((f) => /\.(jsonl|output)$/.test(f));
if (files.length === 0) {
  console.error("usage: node scripts/subagent-time.mjs <transcript.jsonl|dir> … [--json]");
  process.exit(2);
}

const rows = new Map([...KINDS.map(([k]) => [k, { minutes: 0, calls: 0 }]), ["other", { minutes: 0, calls: 0 }]]);
let wall = 0;
let agents = 0;
for (const file of files) {
  const open = new Map();
  let first = null;
  let last = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry || typeof entry !== "object" || !entry.timestamp) continue;
    const t = Date.parse(entry.timestamp);
    first ??= t;
    last = t;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "tool_use") open.set(part.id, { t, use: part });
      if (part?.type !== "tool_result" || !open.has(part.tool_use_id)) continue;
      const { t: t0, use } = open.get(part.tool_use_id);
      if (use.name === "Read") continue;
      const command = String(use.input?.command ?? "");
      const kind = KINDS.find(([, re]) => re.test(command))?.[0] ?? "other";
      const row = rows.get(kind);
      row.minutes += (t - t0) / 60000;
      row.calls += 1;
    }
  }
  if (first !== null) {
    wall += (last - first) / 60000;
    agents += 1;
  }
}

const table = [...rows].map(([kind, r]) => ({ kind, minutes: Math.round(r.minutes * 10) / 10, calls: r.calls }));
table.sort((a, b) => b.minutes - a.minutes);
if (asJson) {
  console.log(JSON.stringify({ agents, wallMinutes: Math.round(wall), kinds: table }, null, 2));
} else {
  console.log(`${agents} transcripts, ${Math.round(wall)} min of summed wall time`);
  for (const r of table) console.log(`${r.kind.padEnd(16)} ${String(r.minutes).padStart(7)} min  ${String(r.calls).padStart(5)} calls`);
}
