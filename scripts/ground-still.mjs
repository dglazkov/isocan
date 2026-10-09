#!/usr/bin/env node
/**
 * **A living ground's still frame, rendered from the ground itself.**
 *
 *   node scripts/ground-still.mjs meadow     # → packages/web/public/grounds/meadow.jpg
 *
 * The still is what a viewer stands on under reduced motion, without WebGL2,
 * or after a lost context (living grounds, design.md §5). Painting it by hand
 * would give two pictures of one field that drift apart the first time the
 * shader changes; rendering it from the ground's own module makes the still
 * the living field at rest, by construction.
 *
 * The ground's lattice repeats every `TILE` world units (meadow.ts), so the
 * still is that window of the infinite field and tiles seamlessly as a world
 * ground. It is drawn at twice the size and scaled down for clean edges, then
 * encoded as a JPEG in the browser — no image tooling needed on the machine.
 *
 * Bundled with esbuild (already in the tree through vite) and drawn in the
 * same headless Chrome the journeys use. Run `file` on the result before it
 * goes in (docs/reviews/lessons.md, "an asset is not what its extension says").
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser } from "./lib/browser.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const name = process.argv[2] ?? "meadow";
const SIDE = 1024;
const QUALITY = Number(process.argv[3] ?? 0.8);

const modules = { meadow: { file: "packages/web/src/components/themes/meadow.ts", create: "createMeadow" } };
const mod = modules[name];
if (!mod) {
  console.error(`no living ground called ${name} — ${Object.keys(modules).join(", ")}`);
  process.exit(2);
}

const dir = mkdtempSync(path.join(tmpdir(), "isocan-still-"));
try {
  const entry = path.join(dir, "entry.js");
  writeFileSync(
    entry,
    `import { ${mod.create}, TILE } from ${JSON.stringify(path.join(repo, mod.file))};
window.renderStill = (side, quality) => {
  const big = side * 2;
  const c = document.createElement("canvas");
  c.width = big; c.height = big;
  const gl = c.getContext("webgl2", { alpha: false, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("no WebGL2 in this browser");
  const ground = ${mod.create}();
  ground.setup(gl);
  const scale = big / TILE;
  ground.draw(gl, {
    time: 0, view: { scale, tx: 0, ty: 0 }, width: big, height: big, dpr: 1, ambient: 0,
    pointers: [], items: new Float32Array(0), trail: null, trailRect: { x: 0, y: 0, size: 1 },
  });
  const out = document.createElement("canvas");
  out.width = side; out.height = side;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c, 0, 0, side, side);
  // The edge gap: mean |difference| across the wrap, against the same over an
  // interior column — lessons.md's "lay it against itself", as numbers.
  const px = ctx.getImageData(0, 0, side, side).data;
  const at = (x, y, k) => px[(y * side + x) * 4 + k];
  let edge = 0, inner = 0;
  for (let y = 0; y < side; y++) for (let k = 0; k < 3; k++) {
    edge += Math.abs(at(side - 1, y, k) - at(0, y, k)) + Math.abs(at(y, side - 1, k) - at(y, 0, k));
    inner += Math.abs(at(side / 2 - 1, y, k) - at(side / 2, y, k)) + Math.abs(at(y, side / 2 - 1, k) - at(y, side / 2, k));
  }
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  const n = px.length / 4;
  const hex = [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("");
  return { data: out.toDataURL("image/jpeg", quality), edge: edge / (side * 6), inner: inner / (side * 6), mean: "#" + hex };
};`,
  );
  const bundle = path.join(dir, "bundle.js");
  execFileSync(path.join(repo, "node_modules/.bin/esbuild"), [entry, "--bundle", "--format=iife", `--outfile=${bundle}`], {
    stdio: "inherit",
  });
  const b = await browser();
  try {
    await b.ev(`(() => { const s = document.createElement("script"); s.textContent = ${JSON.stringify(readFileSync(bundle, "utf8"))}; document.head.appendChild(s); return true; })()`);
    const shot = await b.ev(`window.renderStill(${SIDE}, ${QUALITY})`);
    if (!shot?.data) throw new Error("the browser drew nothing");
    const out = path.join(repo, "packages/web/public/grounds", `${name}.jpg`);
    writeFileSync(out, Buffer.from(shot.data.split(",")[1], "base64"));
    const bytes = readFileSync(out).length;
    console.log(`${path.relative(repo, out)}: ${bytes} bytes, mean ${shot.mean}, edge gap ${shot.edge.toFixed(2)} vs interior ${shot.inner.toFixed(2)}`);
  } finally {
    await b.close();
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
