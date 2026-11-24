import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  resolveCtx
} from "./chunk-RSUEX7F5.mjs";
import {
  paths_exports,
  readConfigFile
} from "./chunk-L2IGV3TO.mjs";

// packages/cli/src/output.ts
function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
function printTable(rows) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const columns = Object.keys(rows[0]);
  const widths = columns.map(
    (col) => Math.max(col.length, ...rows.map((row) => (row[col] ?? "").length))
  );
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd();
  console.log(line(columns.map((c) => c.toUpperCase())));
  for (const row of rows) {
    console.log(line(columns.map((col) => row[col] ?? "")));
  }
}
function printKeyValues(pairs) {
  const width = Math.max(...Object.keys(pairs).map((k) => k.length));
  for (const [key, value] of Object.entries(pairs)) {
    console.log(`${key.padEnd(width)}  ${value}`);
  }
}
function truncate(text, max = 40) {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}
function formatProps(properties) {
  return Object.entries(properties).map(([k, v]) => `${k}=${v}`).join(",");
}
function collectProp(value, previous) {
  const eq = value.indexOf("=");
  if (eq <= 0) throw new Error(`--prop expects key=value, got: ${value}`);
  return { ...previous, [value.slice(0, eq)]: value.slice(eq + 1) };
}
function parseXY(value) {
  const match = value.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`expected x,y coordinates, got: ${value}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

// packages/cli/src/ctx.ts
import { promises as fs } from "node:fs";
function canvasRefOf(opts, env = process.env) {
  const fromEnv = env?.ISOCAN_CANVAS?.trim();
  return opts.canvas ?? opts.project ?? (fromEnv ? fromEnv : void 0);
}
async function makeCtx(cmd) {
  const opts = cmd.optsWithGlobals();
  const ctx = await resolveCtx({
    ...opts.port ? { port: Number(opts.port) } : {},
    ...canvasRefOf(opts) !== void 0 ? { canvasRef: canvasRefOf(opts) } : {}
  });
  ctx.json = opts.json ?? false;
  return ctx;
}
async function readConfig(home) {
  return readConfigFile(home);
}
async function writeConfig(home, config) {
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(paths_exports.configFile(home), JSON.stringify(config, null, 2));
}
function metaPatch(opts) {
  const patch = {};
  if (opts.title !== void 0) patch.title = opts.title;
  if (opts.description !== void 0) patch.description = opts.description;
  if (opts.prop && Object.keys(opts.prop).length > 0) patch.properties = opts.prop;
  if (opts.rmProp && opts.rmProp.length > 0) patch.removeProperties = opts.rmProp;
  return patch;
}

export {
  printJson,
  printTable,
  printKeyValues,
  truncate,
  formatProps,
  collectProp,
  parseXY,
  canvasRefOf,
  makeCtx,
  readConfig,
  writeConfig,
  metaPatch
};
