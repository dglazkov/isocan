/**
 * **The phase-0 gallery: every archetype, as a blueprint and as a wireframe.**
 *
 *   node --import tsx packages/modules/wireframe/scripts/gallery.ts <out-dir> [--canvas <canvas>] [--platform app|web|site]
 *
 * Writes, for each of wave 1's archetypes, `<id>.blueprint.json|html`,
 * `<id>.half.json|html` and `<id>.wireframe.json|html` into `<out-dir>`.
 * With `--canvas`, it then adds the 36 blueprint and wireframe screens to that
 * canvas through `isocan wire render` — blueprints in one row, wireframes in
 * the row below — which is the browser walk phase 0's proof names. Nothing
 * here is special-cased: the specs come from the same `blueprint` and
 * `wireframe` the CLI's `wire spec` prints, and the screens go through the
 * same verb an agent would type.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECIPES, blueprint, renderWire, wireSize, wireframe, type Platform, type WireSpec } from "../src/core.ts";

const args = process.argv.slice(2);
const out = args[0];
if (!out || out.startsWith("--")) {
  console.error("usage: gallery.ts <out-dir> [--canvas <canvas>] [--platform app|web|site]");
  process.exit(2);
}
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const canvas = flag("--canvas");
const platform = flag("--platform") as Platform | undefined;

mkdirSync(out, { recursive: true });
const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../cli/bin/isocan.js");
const GAP = 60;
const ROW_GAP = 120;

const rows: Array<{ state: string; specs: WireSpec[] }> = [
  { state: "blueprint", specs: [] },
  { state: "half", specs: [] },
  { state: "wireframe", specs: [] },
];
for (const r of RECIPES) {
  const p = platform && r.platforms.includes(platform) ? platform : r.platforms[0]!;
  const o = { platform: p, request: "Acme phase-0 gallery", flow: "acme-gallery" };
  rows[0]!.specs.push(blueprint(r.id, o));
  rows[1]!.specs.push(wireframe(r.id, o, (s, i) => (i % 2 === 0 ? s.options[0]! : null)));
  rows[2]!.specs.push(wireframe(r.id, o));
}
for (const row of rows) {
  for (const spec of row.specs) {
    const base = path.join(out, `${spec.archetype}.${row.state}`);
    writeFileSync(`${base}.json`, `${JSON.stringify(spec, null, 2)}\n`);
    writeFileSync(`${base}.html`, renderWire(spec));
  }
}
console.log(`wrote ${rows.reduce((n, r) => n + r.specs.length, 0) * 2} files to ${out}`);

if (canvas) {
  let y = 0;
  for (const row of rows.filter((r) => r.state !== "half")) {
    let x = 0;
    let tallest = 0;
    for (const spec of row.specs) {
      const { width, height } = wireSize(spec);
      const file = path.join(out, `${spec.archetype}.${row.state}.json`);
      const line = execFileSync(process.execPath, [cli, "wire", "render", file, "--canvas", canvas, "--at", `${x},${y}`], { encoding: "utf8" }).trim();
      console.log(line);
      x += width + GAP;
      tallest = Math.max(tallest, height);
    }
    y += tallest + ROW_GAP;
  }
}
