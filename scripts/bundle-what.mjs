#!/usr/bin/env node
/**
 * **What is actually in the entry chunk.**
 *
 *   node scripts/bundle-what.mjs              # the top twenty, by bytes
 *   node scripts/bundle-what.mjs --top 40
 *   node scripts/bundle-what.mjs --json
 *
 * The entry chunk has had a bound since 2 September (`bundle-bytes`, at most
 * 640,000) and has been over it every night since — 600,420 → 768,993 →
 * 720,659 → 699,999. Every one of those readings is a single number, and
 * `docs/research/2026-09-06-architecture-review.md` reached its conclusion
 * without ever seeing inside it:
 *
 * > splitting is spent … what remains in the entry is `ItemView`,
 * > `CanvasViewport`, `api.ts` and the stores — the canvas itself.
 *
 * That is a reasonable inference from what is imported where. It is not a
 * measurement, and this is the measurement: **a bound nobody can look behind
 * is a bound nobody can act on**, which is why the number has been red for six
 * days while everybody agreed about what was in it.
 *
 * ## How it attributes
 *
 * A production build with sourcemaps on, and then the map read the only way
 * that gives bytes rather than guesses: **every mapping segment says which
 * source produced the generated column it starts at**, so the run from one
 * segment to the next belongs to that source. Sum the runs per source.
 *
 * That counts the code as SHIPPED — minified, after tree-shaking and after
 * whatever the bundler inlined — which is the only number that matters and is
 * not the size of the file on disk. A 900-line file of comments contributes
 * almost nothing, and this repository is full of them.
 *
 * The build is a throwaway into a temp directory, so it never disturbs the
 * `dist/` a daemon is serving.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const web = path.join(repo, "packages/web");
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const TOP = Number(argv[argv.indexOf("--top") + 1]) || 20;

/** Base64-VLQ, enough of it to read the source index off each segment. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVlq(segment) {
  const out = [];
  let shift = 0;
  let value = 0;
  for (const ch of segment) {
    const digit = B64.indexOf(ch);
    if (digit === -1) return out;
    const cont = digit & 32;
    value += (digit & 31) << shift;
    if (cont) {
      shift += 5;
    } else {
      const negative = value & 1;
      value >>= 1;
      out.push(negative ? -value : value);
      shift = 0;
      value = 0;
    }
  }
  return out;
}

/**
 * Bytes of generated output per source file.
 *
 * A segment's first field is the generated COLUMN it starts at, and its
 * fourth is a delta into `sources`. So within a line, each segment owns the
 * columns from where it starts to where the next one does — and the last
 * segment on a line owns the rest of that line.
 */
export function bytesBySource(map, generated) {
  const lines = generated.split("\n");
  const bySource = new Map();
  let sourceIndex = 0;
  map.mappings.split(";").forEach((lineMappings, lineNumber) => {
    if (!lineMappings) return;
    const lineLength = (lines[lineNumber] ?? "").length;
    let column = 0;
    const segments = [];
    for (const segment of lineMappings.split(",")) {
      const fields = decodeVlq(segment);
      if (fields.length === 0) continue;
      column += fields[0];
      if (fields.length >= 4) sourceIndex += fields[3];
      segments.push({ column, source: fields.length >= 4 ? sourceIndex : null });
    }
    segments.forEach((seg, i) => {
      if (seg.source === null) return;
      const end = i + 1 < segments.length ? segments[i + 1].column : lineLength;
      const width = Math.max(0, end - seg.column);
      const name = map.sources[seg.source] ?? "(unknown)";
      bySource.set(name, (bySource.get(name) ?? 0) + width);
    });
  });
  return bySource;
}

/** Group by what a person would call the thing: a workspace package, a
 *  node_modules dependency, or one of our own files. */
export function bucket(source) {
  const s = source.replace(/^(\.\.\/)+/, "");
  const dep = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/.exec(s);
  if (dep) return `node_modules/${dep[1]}`;
  const pkg = /packages\/([^/]+)\/(.*)$/.exec(s);
  // `--by file` breaks a workspace package into its modules: "core is half the
  // chunk" is a fact you cannot act on until you know WHICH core.
  if (pkg && pkg[1] !== "web") {
    return process.argv.includes("--by-file")
      ? `@isocan/${pkg[1]}/${pkg[2].replace(/^src\//, "")}`
      : `@isocan/${pkg[1]}`;
  }
  return s.replace(/^packages\/web\//, "");
}

function build() {
  const out = mkdtempSync(path.join(tmpdir(), "isocan-bundle-"));
  execFileSync(
    "npx",
    ["vite", "build", "--mode", "production", "--outDir", out, "--emptyOutDir", "--sourcemap", "true"],
    { cwd: web, stdio: "pipe" },
  );
  const assets = path.join(out, "assets");
  // The entry is the largest `index-*.js`, the same one `measure.mjs` reads.
  const entry = readdirSync(assets)
    .filter((f) => /^index-.*\.js$/.test(f))
    .map((f) => ({ f, size: readFileSync(path.join(assets, f)).length }))
    .sort((a, b) => b.size - a.size)[0];
  if (!entry) throw new Error("no entry chunk in the build");
  const js = readFileSync(path.join(assets, entry.f), "utf8");
  const mapPath = path.join(assets, `${entry.f}.map`);
  if (!existsSync(mapPath)) throw new Error(`no sourcemap beside ${entry.f} — is --sourcemap on?`);
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  return { out, name: entry.f, size: entry.size, js, map };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, name, size, js, map } = build();
  const bySource = bytesBySource(map, js);
  const byBucket = new Map();
  for (const [source, bytes] of bySource) {
    const key = bucket(source);
    byBucket.set(key, (byBucket.get(key) ?? 0) + bytes);
  }
  const rows = [...byBucket].sort((a, b) => b[1] - a[1]);
  const attributed = rows.reduce((n, [, b]) => n + b, 0);
  rmSync(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

  if (JSON_OUT) {
    console.log(JSON.stringify({ entry: name, size, attributed, rows }, null, 2));
  } else {
    console.log(`${name} — ${size.toLocaleString()} bytes\n`);
    const pct = (n) => `${((n / size) * 100).toFixed(1)}%`;
    for (const [what, bytes] of rows.slice(0, TOP)) {
      console.log(`${String(bytes).padStart(7)}  ${pct(bytes).padStart(6)}  ${what}`);
    }
    const rest = rows.slice(TOP).reduce((n, [, b]) => n + b, 0);
    if (rest > 0) console.log(`${String(rest).padStart(7)}  ${pct(rest).padStart(6)}  (${rows.length - TOP} more)`);
    console.log(
      `\nattributed ${attributed.toLocaleString()} of ${size.toLocaleString()} ` +
        `(${pct(attributed)}) — the rest is the bundler's own glue, which no source produced.`,
    );
  }
}
