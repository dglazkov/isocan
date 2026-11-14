import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/modules/exact/src/proposal.ts
function scopeFor(isAgent, granted = true) {
  return isAgent ? "propose" : granted ? "write" : "read";
}
function grantedWrite(actor, owner, grant) {
  if (actor.id === owner.id) return true;
  const names = (grant ?? "").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean);
  return names.includes(actor.id.toLowerCase()) || names.includes(actor.name.trim().toLowerCase());
}
var TOKEN_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,80}$/;
var ROW_NAME = /^-?[a-z][a-z0-9-]{0,60}$/;
var STYLE_NAME = /^[A-Z][A-Za-z0-9_]{0,60}$/;
var VALUE = /^[^\n\r\0]{1,200}$/;
function opProblem(op) {
  const o = op;
  if (!o || typeof o !== "object") return "an operation is an object";
  const value = (v) => typeof v === "number" && Number.isFinite(v) || typeof v === "string" && VALUE.test(v);
  if (o.op === "set-token") {
    if (typeof o.name !== "string" || !TOKEN_NAME.test(o.name)) return `set-token names a token, not ${JSON.stringify(o.name)}`;
    if (typeof o.value !== "string" || !VALUE.test(o.value)) return "set-token's value is one short line";
    return null;
  }
  if (o.op === "set-row") {
    if (typeof o.row !== "string" || !ROW_NAME.test(o.row)) return `set-row names a row, not ${JSON.stringify(o.row)}`;
    if (!value(o.value)) return "set-row's value is a number or one short line";
    if (o.style !== void 0) return typeof o.style === "string" && STYLE_NAME.test(o.style) ? null : `set-row's style is a style's name, not ${JSON.stringify(o.style)}`;
    if (typeof o.file !== "string" || o.file.startsWith("/") || o.file.split(/[\\/]/).includes("..")) return "set-row at a place names the app's file";
    const at = o.at;
    if (!at || !Number.isInteger(at.line) || !Number.isInteger(at.col)) return "set-row at a place says where: at {line, col}";
    if (typeof o.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(o.sha256)) return "set-row at a place carries the file's sha256 as you read it";
    return null;
  }
  if (o.op === "set-state") {
    if (typeof o.style !== "string" || !STYLE_NAME.test(o.style) || typeof o.state !== "string" || typeof o.row !== "string" || !ROW_NAME.test(o.row) || !value(o.value)) return "set-state names a style, a state, a row and a value";
    return null;
  }
  return `a proposal carries set-token, set-row or set-state, not ${JSON.stringify(o.op)}`;
}
function opsFromFlags(tokens, rows, raw) {
  const ops = [];
  for (const t of tokens) {
    const at = t.indexOf("=");
    if (at <= 0) throw new Error(`--token takes name=value, not ${JSON.stringify(t)}`);
    ops.push({ op: "set-token", name: t.slice(0, at).trim(), value: t.slice(at + 1).trim() });
  }
  for (const r of rows) {
    const m = /^([A-Z][A-Za-z0-9_]*)\.(-?[a-z][a-z0-9-]*)=(.+)$/.exec(r.trim());
    if (!m) throw new Error(`--row takes Style.row=value (a row of a \`style\`), not ${JSON.stringify(r)}`);
    const v = m[3].trim();
    ops.push({ op: "set-row", style: m[1], row: m[2], value: /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v });
  }
  for (const j of raw) {
    let op;
    try {
      op = JSON.parse(j);
    } catch {
      throw new Error(`--op takes one Tamber operation as JSON, not ${JSON.stringify(j.slice(0, 80))}`);
    }
    ops.push(op);
  }
  if (ops.length === 0) throw new Error("a proposal says what it changes: --token name=value, --row Style.row=value or --op '<json>'");
  if (ops.length > 32) throw new Error("a proposal carries at most 32 operations");
  for (const op of ops) {
    const p = opProblem(op);
    if (p) throw new Error(p);
  }
  return ops;
}
function opWords(op) {
  if (op.op === "set-token") return `${op.name} \u2192 ${op.value}`;
  if (op.op === "set-state") return `${op.style}:${op.state} ${op.row} \u2192 ${op.value}`;
  return `${op.style ?? `${op.file}:${op.at?.line}`} ${op.row} \u2192 ${op.value}`;
}
function parseProposeAsk(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    if (!Number.isFinite(v?.seq) || !Array.isArray(v.ops) || v.ops.length === 0 || v.ops.length > 32 || v.ops.some((o) => opProblem(o) !== null)) return null;
    if (typeof v.why !== "string" || !v.why.trim() || v.why.length > 600) return null;
    const cites = Array.isArray(v.cites) ? v.cites.filter((c) => c && typeof c.kind === "string" && typeof c.ref === "string" && c.ref).slice(0, 8) : [];
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, ops: v.ops, why: v.why.trim(), cites, in: typeof v.in === "string" && v.in ? v.in : null };
  } catch {
    return null;
  }
}
function parseProposeAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}
function parseProposalRecord(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v.proposal === "string" && Array.isArray(v.ops) && Array.isArray(v.previews) && v.asker && typeof v.route === "string" ? v : null;
  } catch {
    return null;
  }
}
function parseAcceptAnswer(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v.item === "string" && typeof v.version === "string" ? v : null;
  } catch {
    return null;
  }
}
function proposalTitle(asker, ops) {
  const what = ops.slice(0, 2).map(opWords).join("; ") + (ops.length > 2 ? ` and ${ops.length - 2} more` : "");
  return `Proposed by ${asker}: ${what}`.slice(0, 160);
}

export {
  scopeFor,
  grantedWrite,
  opsFromFlags,
  parseProposeAsk,
  parseProposeAnswer,
  parseProposalRecord,
  parseAcceptAnswer,
  proposalTitle
};
