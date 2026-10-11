import { zoomFade } from "@isocan/core";
import { FULLSCREEN_VS, program, uniforms, type Field, type LivingGround } from "./livingkit.ts";

/**
 * **Orbit — how Galaxy is drawn** (living grounds phase 3; journey.md scene 2).
 *
 * > "Orbit should replace Galaxy yah" — Dion, 9 Oct 2026.
 *
 * Deep space under the items: a nebula and a few thousand stars, and every
 * cursor on the canvas a soft mass. Stars near it curve toward it and swing
 * past; a pointer held still grows a slow eddy (the eddy window, below); a
 * held button reverses the pull and the stars flee. The stored theme is still
 * `galaxy` with its label, so every canvas wearing Space Galaxy became this
 * with no migration, and Orbit at rest — the still frame,
 * `public/grounds/galaxy.jpg`, rendered from THIS module — reads as the CSS
 * Galaxy it replaced: the same space colour, the same three star
 * temperatures, the same three clouds under the same legibility cap.
 *
 * ## Stars live in the world (the bench's flaw, fixed)
 *
 * The phase 0 bench kept its stars in screen space and nudged them on each
 * pan and zoom, so the nudges accumulated: repeated zoom-outs gathered every
 * star toward the centre. Here a star's resting place is a pure function of
 * the view — no history — so zooming out three times and back puts every
 * star back where it was:
 *
 * - **A world lattice, per level.** Level ℓ is a lattice of cells
 *   `BASE · 2^ℓ` world units across, one star per cell at a hashed point.
 *   The view draws the five levels whose cells are 0.5–16× `MIN_PX` on
 *   screen, so the screen density holds at every zoom: zooming out, the
 *   finest level fades away and a coarser one has already been there. A star
 *   is the same star at every zoom it is drawn at.
 * - **Depth parallax, subtle.** Each level pans at `k` of the items' speed
 *   (0.86 for the faint dust, 1 for the bright few) as
 *   `screen = home · scale + k · t + (1 − k) · centre` — still a pure function
 *   of the view, and a zoom about the centre scales it exactly like the items.
 * - **Motion is an offset from home.** Only the displacement and velocity
 *   are state (an RGBA32F texture, ping-ponged), in screen pixels. A gentle
 *   spring takes each star home, weaker inside a cursor's reach so the eddy
 *   can hold. Each level owns a texture region `N × N` that maps onto its
 *   lattice modulo N around the view, so a star that leaves one edge of the
 *   window is reborn at the other with its state reset.
 *
 * Every hash wraps at `TILE`, so the still frame tiles as seamlessly as the
 * field it stands in for.
 */

/** The still frame's tile, in world units; every hash wraps here. */
export const TILE = 2048;
/** The finest lattice's cell, in world units, at level 0. */
const BASE = 16;
/** The finest drawn level's cells are at least this many CSS px apart once
 *  fully in; it sets how many stars a screen holds (about 2,000 at 1440×900). */
const MIN_PX = 36;
/** Levels drawn at once: one fading in, three steady, one fading out. */
const LEVELS = 5;
/** The largest state region side; past it the stars thin rather than grow. */
const MAX_N = 256;
/** The eddy window: a resting pointer keeps Orbit awake this long after its
 *  last move (phases.md, 9 Oct: "the eddy stays"). */
export const EDDY_MS = 15_000;

/** `--theme-space`, the ground under the clouds (`styles.css`). */
export const SPACE: [number, number, number] = [5, 6, 12];
/** The clouds, the CSS Galaxy's three (8 Sep 2026): colour and strength. */
export const NEBULA: { rgb: [number, number, number]; alpha: number }[] = [
  { rgb: [86, 64, 170], alpha: 0.24 },
  { rgb: [24, 86, 140], alpha: 0.2 },
  { rgb: [150, 52, 110], alpha: 0.14 },
];
/** The brightest the sky may get, whatever the clouds do: #2a244a, measured
 *  so a white card, a text node and a pen stroke keep their contrast
 *  (`galaxy.test.ts`). */
export const SKY_CAP: [number, number, number] = [42, 36, 74];
/** The three star temperatures: white, hot, cool. */
export const STAR_TINTS: [number, number, number][] = [[255, 255, 255], [198, 216, 255], [255, 224, 186]];

const v3 = (c: readonly number[]) => `vec3(${c.map((x) => (x / 255).toFixed(4)).join(", ")})`;

const COMMON = `
precision highp float;
precision highp int;
uniform int uN;
uniform ivec2 uOrigin[${LEVELS}];
uniform int uLevel[${LEVELS}];
uniform float uCell[${LEVELS}];
uniform float uK[${LEVELS}];
uniform int uPeriod[${LEVELS}];
uniform vec3 uView;
uniform vec2 uRes;
int pmod(int a, int m) { return a - m * int(floor(float(a) / float(m))); }
ivec2 pmod2(ivec2 a, int m) { return ivec2(pmod(a.x, m), pmod(a.y, m)); }
uint hash3(ivec2 c, uint salt, int P) {
  ivec2 w = pmod2(c, P);
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, int P) { return float(hash3(c, salt, P) & 0xffffu) / 65535.0; }
ivec2 cellOf(ivec2 slot, ivec2 origin) { return origin + pmod2(slot - origin, uN); }
uint saltOf(int r) { return uint(uLevel[r] + 64) * 7919u; }
// Where a star rests on screen: its world home, through the view, with its
// level's parallax.
vec2 homeOf(int r, ivec2 cell) {
  uint s = saltOf(r);
  int P = uPeriod[r];
  vec2 home = (vec2(cell) + vec2(rnd(cell, s + 1u, P), rnd(cell, s + 2u, P))) * uCell[r];
  return home * uView.x + uView.yz * uK[r] + (1.0 - uK[r]) * uRes * 0.5;
}
float rectSd(vec2 p, vec4 b) {
  vec2 c = b.xy + b.zw * 0.5; vec2 d = abs(p - c) - b.zw * 0.5;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
vec2 rectN(vec2 p, vec4 b) {
  vec2 c = b.xy + b.zw * 0.5; vec2 d = abs(p - c) - b.zw * 0.5; vec2 s = sign(p - c + 1e-4);
  return d.x > d.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
}
`;

/** One step of the stars: a fragment per star, reading last frame's state. */
const STEP_FS = `#version 300 es
${COMMON}
uniform sampler2D uState;
uniform ivec2 uPrevOrigin[${LEVELS}];
uniform int uPrevLevel[${LEVELS}];
uniform float uDt;
uniform float uEase;
uniform float uDrift;
uniform float uClock;
uniform vec4 uP[16];
uniform int uNP;
uniform vec4 uItems[16];
uniform int uNI;
out vec4 o;
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  int r = ij.y / uN;
  ivec2 slot = ivec2(ij.x, ij.y - r * uN);
  ivec2 cell = cellOf(slot, uOrigin[r]);
  vec4 st = texelFetch(uState, ij, 0);
  // A new star in this slot (the window moved, or the level changed): it
  // starts at home and at rest.
  if (uPrevLevel[r] != uLevel[r] || cellOf(slot, uPrevOrigin[r]) != cell) st = vec4(0.0);
  vec2 hs = homeOf(r, cell);
  vec2 off = st.xy, v = st.zw;
  vec2 p = hs + off;
  bool idle = st == vec4(0.0);
  if (uEase <= 0.0 || (idle && (any(lessThan(p, vec2(-420.0))) || any(greaterThan(p, uRes + 420.0))))) { o = st; return; }
  uint s = saltOf(r);
  int P = uPeriod[r];
  float d = 0.35 + 0.65 * rnd(cell, s + 3u, P);
  vec2 acc = vec2(0.0);
  float near = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uNP) break;
    vec2 q = uP[i].xy - p; float rr = length(q);
    float nr = 1.0 - smoothstep(170.0, 360.0, rr);
    if (nr <= 0.0) continue;
    near = max(near, nr);
    vec2 dir = q / max(rr, 1.0);
    float G = 2.6e6 * uP[i].w * d;
    bool held = uP[i].z > 0.5;
    vec2 a = dir * (held ? -1.7 : 1.0) * G / (rr * rr + 2000.0);
    // Not held: a swirl, and a soft core so nothing piles onto the pointer.
    if (!held) { a += vec2(-dir.y, dir.x) * G * 0.45 / (rr * rr + 2000.0); a -= dir * 1300.0 * max(0.0, 1.0 - rr / 38.0); }
    float al = length(a); if (al > 2600.0) a *= 2600.0 / al;
    acc += a * nr;
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uNI) break;
    float sd = rectSd(p, uItems[i]);
    if (sd < 10.0) acc += rectN(p, uItems[i]) * 1700.0 * (1.0 - smoothstep(-24.0, 10.0, sd));
  }
  // Home, gently — and hardly at all inside a cursor's reach, so the eddy holds.
  acc -= off * 2.2 * (1.0 - 0.85 * near);
  // Ambient drift: each star wanders a small slow circle about its home.
  float ang = uClock * (0.15 + 0.25 * rnd(cell, s + 4u, P)) + 6.2832 * rnd(cell, s + 5u, P);
  // The drift is ambient (none under Calm); the pull above is the cursor's.
  vec2 drift = vec2(cos(ang), sin(ang)) * 9.0 * d * uDrift;
  v += acc * uDt * uEase;
  v += (drift - v) * (1.0 - exp(-uDt * 1.7));
  float vl = length(v); if (vl > 700.0) v *= 700.0 / vl;
  off += v * uDt * uEase;
  float ol = length(off); if (ol > 600.0) off *= 600.0 / ol;
  o = vec4(off, v);
}`;

const STAR_VS = `#version 300 es
${COMMON}
uniform sampler2D uState;
uniform float uAlpha[${LEVELS}];
uniform float uRel[${LEVELS}];
uniform float uDpr;
uniform float uClock;
uniform float uAmb;
uniform vec4 uItems[16];
uniform int uNI;
out vec3 vC;
out float vCore;
out float vHalo;
void main() {
  int per = uN * uN;
  int r = gl_VertexID / per;
  int k = gl_VertexID - r * per;
  ivec2 slot = ivec2(k - (k / uN) * uN, k / uN);
  vC = vec3(0.0); vCore = 1.0; vHalo = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  if (uAlpha[r] <= 0.002) return;
  ivec2 cell = cellOf(slot, uOrigin[r]);
  vec4 st = texelFetch(uState, ivec2(slot.x, slot.y + r * uN), 0);
  vec2 p = homeOf(r, cell) + st.xy;
  if (any(lessThan(p, vec2(-16.0))) || any(greaterThan(p, uRes + 16.0))) return;
  uint s = saltOf(r);
  int P = uPeriod[r];
  // A star's magnitude: its level's rank in this view, and a little luck.
  float mag = uRel[r] + (rnd(cell, s + 6u, P) - 0.5) * 0.9;
  float tp = rnd(cell, s + 7u, P);
  vec3 c = tp < 0.55 ? ${v3(STAR_TINTS[0]!)} : tp < 0.83 ? ${v3(STAR_TINTS[1]!)} : ${v3(STAR_TINTS[2]!)};
  float bright = clamp(0.2 + 0.28 * mag, 0.08, 1.0);
  float tw = 1.0 + uAmb * 0.35 * sin(uClock * (1.0 + 3.0 * rnd(cell, s + 8u, P)) + 6.2832 * rnd(cell, s + 9u, P));
  float a = bright * tw * (1.0 + min(length(st.zw) / 260.0, 0.9)) * uAlpha[r];
  for (int i = 0; i < 16; i++) { if (i >= uNI) break; a *= mix(0.08, 1.0, smoothstep(-6.0, 6.0, rectSd(p, uItems[i]))); }
  float size = 1.4 + 1.25 * clamp(mag - 0.5, 0.0, 3.0);
  float halo = smoothstep(2.3, 3.2, mag);
  gl_PointSize = size * (1.0 + 3.0 * halo) * uDpr;
  vCore = 1.0 / (1.0 + 3.0 * halo);
  vHalo = halo;
  vC = c * a;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const STAR_FS = `#version 300 es
precision mediump float;
in vec3 vC;
in float vCore;
in float vHalo;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(vCore, vCore * 0.15, r);
  float h = 1.0 - smoothstep(0.0, 1.0, r);
  o = vec4(vC * (core + vHalo * 0.16 * h * h), 1.0);
}`;

/** The sky: space, and three clouds under the legibility cap — world-anchored,
 *  periodic over `TILE`, fading with zoom as the CSS Galaxy's did. */
const SKY_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uNeb;
uniform vec4 uItems[16];
uniform int uNI;
out vec4 o;
int pmod(int a, int m) { return a - m * int(floor(float(a) / float(m))); }
float rnd(ivec2 c, uint salt, int P) {
  ivec2 w = ivec2(pmod(c.x, P), pmod(c.y, P));
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float((h ^ (h >> 16u)) & 0xffffu) / 65535.0;
}
float vnoise(vec2 w, float s, uint salt) {
  int P = int(${TILE.toFixed(1)} / s + 0.5);
  vec2 g = w / s; ivec2 i = ivec2(floor(g)); vec2 f = fract(g); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rnd(i, salt, P), rnd(i + ivec2(1, 0), salt, P), f.x), mix(rnd(i + ivec2(0, 1), salt, P), rnd(i + ivec2(1, 1), salt, P), f.x), f.y);
}
float fbm(vec2 w, uint salt) { return 0.5 * vnoise(w, 1024.0, salt) + 0.3 * vnoise(w, 512.0, salt + 7u) + 0.2 * vnoise(w, 256.0, salt + 13u); }
float rectSd(vec2 p, vec4 b) {
  vec2 c = b.xy + b.zw * 0.5; vec2 d = abs(p - c) - b.zw * 0.5;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  vec3 c = ${v3(SPACE)};
  ${NEBULA.map((n, i) => `c = mix(c, ${v3(n.rgb)}, ${n.alpha.toFixed(3)} * uNeb * smoothstep(${(0.34 + i * 0.04).toFixed(2)}, ${(0.64 + i * 0.05).toFixed(2)}, fbm(w + vec2(${i * 311}.0, ${i * 173}.0), ${i * 31 + 3}u)));`).join("\n  ")}
  c = min(c, ${v3(SKY_CAP)});
  // Dark gaps round the items: they stand in a little shadow of their own.
  for (int i = 0; i < 16; i++) { if (i >= uNI) break; c *= 1.0 - 0.45 * exp(-max(rectSd(screen, uItems[i]), 0.0) / 26.0); }
  o = vec4(c, 1.0);
}`;

/** One level's place in this view. */
interface Region {
  level: number;
  cell: number;
  k: number;
  alpha: number;
  rel: number;
  period: number;
  ox: number;
  oy: number;
}

/** Which levels this view draws, where their windows sit, and how strongly. */
interface Layout {
  key: string;
  n: number;
  /** By region slot (`level mod LEVELS`). */
  regions: Region[];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const pmod = (a: number, m: number) => a - m * Math.floor(a / m);

/** The pure function of the view that puts every star where it rests. No
 *  history: the same view always gives the same layout. */
export function layout(view: { scale: number; tx: number; ty: number }, w: number, h: number): Layout {
  const side = Math.max(w, h, 1);
  let min = MIN_PX;
  let n = Math.ceil((3.2 * side) / min) + 2;
  if (n > MAX_N) {
    min = (3.2 * side) / (MAX_N - 2);
    n = MAX_N;
  }
  const s = view.scale;
  const lf = Math.log2(min / (BASE * s));
  const L = Math.ceil(lf);
  const u = L - lf;
  const regions: Region[] = new Array(LEVELS);
  for (let level = L - 1; level <= L + 3; level++) {
    const cell = BASE * 2 ** level;
    const rel = level - lf;
    const k = 0.86 + 0.14 * smooth(-1, 3, rel);
    const cx = (k * (w / 2 - view.tx)) / s;
    const cy = (k * (h / 2 - view.ty)) / s;
    const period = cell >= 1 && cell <= TILE && TILE % cell === 0 ? TILE / cell : 65536;
    const alpha = level === L - 1 ? u : level === L + 3 ? 1 - u : 1;
    regions[pmod(level, LEVELS)] = {
      level, cell, k, alpha, rel, period,
      ox: Math.floor(cx / cell) - (n >> 1),
      oy: Math.floor(cy / cell) - (n >> 1),
    };
  }
  return { key: `${s}|${view.tx}|${view.ty}|${w}|${h}`, n, regions };
}

/** The shader's hash, in JS, for the readback. */
function rnd(cx: number, cy: number, salt: number, P: number): number {
  const wx = pmod(cx, P);
  const wy = pmod(cy, P);
  let h = (Math.imul(wx, 374761393) + Math.imul(wy, 668265263) + Math.imul(salt, 2246822519 | 0)) >>> 0;
  h = Math.imul((h ^ (h >>> 13)) >>> 0, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 0xffff) / 65535;
}

export function createOrbit(): LivingGround {
  let step: WebGLProgram | null = null;
  let star: WebGLProgram | null = null;
  let sky: WebGLProgram | null = null;
  let su: Record<string, WebGLUniformLocation | null> = {};
  let tu: Record<string, WebGLUniformLocation | null> = {};
  let ku: Record<string, WebGLUniformLocation | null> = {};
  let vao: WebGLVertexArrayObject | null = null;
  let tex: WebGLTexture[] = [];
  let fbo: WebGLFramebuffer[] = [];
  let cur = 0;
  let n = 0;
  let clock = 0;
  let prev: Layout | null = null;
  /** The step the host asked for, run at the head of the next `draw` — the
   *  one place this module is handed the context. */
  let pending: { dt: number; ease: number; drift: number } | null = null;
  let last: { lay: Layout; view: Field["view"]; w: number; h: number } | null = null;

  const alloc = (gl: WebGL2RenderingContext, size: number) => {
    for (const t of tex) gl.deleteTexture(t);
    for (const f of fbo) gl.deleteFramebuffer(f);
    tex = [];
    fbo = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size * LEVELS, 0, gl.RGBA, gl.FLOAT, new Float32Array(size * size * LEVELS * 4));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
        throw new Error("no float render target for the stars");
      }
      tex.push(t);
      fbo.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    n = size;
    cur = 0;
    prev = null;
  };

  const layoutFor = (gl: WebGL2RenderingContext, f: Field): Layout => {
    const key = `${f.view.scale}|${f.view.tx}|${f.view.ty}|${f.width}|${f.height}`;
    const lay = last && last.lay.key === key ? last.lay : layout(f.view, f.width, f.height);
    if (lay.n !== n) alloc(gl, lay.n);
    last = { lay, view: f.view, w: f.width, h: f.height };
    return lay;
  };

  /** The first 16 item rects (the largest), taken to the screen. */
  const screenItems = (f: Field) => {
    const k = Math.min(16, f.items.length / 4);
    const out = new Float32Array(64);
    const { scale, tx, ty } = f.view;
    for (let i = 0; i < k; i++) {
      out[i * 4] = f.items[i * 4]! * scale + tx;
      out[i * 4 + 1] = f.items[i * 4 + 1]! * scale + ty;
      out[i * 4 + 2] = f.items[i * 4 + 2]! * scale;
      out[i * 4 + 3] = f.items[i * 4 + 3]! * scale;
    }
    return { out, k };
  };

  const setLayout = (gl: WebGL2RenderingContext, u: Record<string, WebGLUniformLocation | null>, lay: Layout, f: Field) => {
    const r = lay.regions;
    gl.uniform1i(u.uN!, lay.n);
    gl.uniform2iv(u.uOrigin!, new Int32Array(r.flatMap((g) => [g.ox, g.oy])));
    gl.uniform1iv(u.uLevel!, new Int32Array(r.map((g) => g.level)));
    gl.uniform1fv(u.uCell!, new Float32Array(r.map((g) => g.cell)));
    gl.uniform1fv(u.uK!, new Float32Array(r.map((g) => g.k)));
    gl.uniform1iv(u.uPeriod!, new Int32Array(r.map((g) => g.period)));
    gl.uniform3f(u.uView!, f.view.scale, f.view.tx, f.view.ty);
    gl.uniform2f(u.uRes!, f.width, f.height);
  };

  return {
    name: "galaxy",
    cursor: "sparkle",
    restWindow: EDDY_MS,
    setup(gl) {
      if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("no float render targets for the stars");
      step = program(gl, FULLSCREEN_VS, STEP_FS);
      star = program(gl, STAR_VS, STAR_FS);
      sky = program(gl, FULLSCREEN_VS, SKY_FS);
      su = uniforms(gl, step);
      tu = uniforms(gl, star);
      ku = uniforms(gl, sky);
      vao = gl.createVertexArray();
      tex = [];
      fbo = [];
      n = 0;
      last = null;
    },
    step(dt, f) {
      // `step` is handed no context, so the simulation pass runs at the head
      // of the `draw` that follows it; here only the stars' clock moves. At
      // rest when the host's envelope has eased out: the stars have slowed to
      // a stop. The clock is the drift's and twinkle's, so it is ambient's.
      clock += dt * f.ambient;
      pending = { dt, ease: f.ease, drift: f.ambient };
      return f.ease > 0.002;
    },
    draw(gl, f) {
      if (!step || !star || !sky) return;
      const lay = layoutFor(gl, f);
      const items = screenItems(f);
      gl.bindVertexArray(vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      // 1. The stars move (only on a frame the host stepped).
      if (pending) {
        const { dt, ease, drift } = pending;
        pending = null;
        const next = 1 - cur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]!);
        gl.viewport(0, 0, n, n * LEVELS);
        gl.useProgram(step);
        setLayout(gl, su, lay, f);
        const pr = prev && prev.n === lay.n ? prev.regions : null;
        gl.uniform2iv(su.uPrevOrigin!, new Int32Array(lay.regions.flatMap((_, i) => (pr ? [pr[i]!.ox, pr[i]!.oy] : [0, 0]))));
        gl.uniform1iv(su.uPrevLevel!, new Int32Array(lay.regions.map((_, i) => (pr ? pr[i]!.level : -9999))));
        gl.uniform1f(su.uDt!, dt);
        gl.uniform1f(su.uEase!, ease);
        gl.uniform1f(su.uDrift!, drift);
        gl.uniform1f(su.uClock!, clock);
        const ptr = new Float32Array(64);
        let np = 0;
        for (const p of f.pointers) {
          if (np >= 16) break;
          ptr.set([p.x * f.view.scale + f.view.tx, p.y * f.view.scale + f.view.ty, p.held ? 1 : 0, p.weight], np * 4);
          np++;
        }
        gl.uniform4fv(su.uP!, ptr);
        gl.uniform1i(su.uNP!, np);
        gl.uniform4fv(su.uItems!, items.out);
        gl.uniform1i(su.uNI!, items.k);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex[cur]!);
        gl.uniform1i(su.uState!, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        cur = next;
        prev = lay;
      }

      // 2. The sky.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(sky);
      gl.uniform3f(ku.uView!, f.view.scale, f.view.tx, f.view.ty);
      gl.uniform2f(ku.uRes!, f.width, f.height);
      gl.uniform1f(ku.uNeb!, zoomFade(f.view.scale, 0.1, 0.5));
      gl.uniform4fv(ku.uItems!, items.out);
      gl.uniform1i(ku.uNI!, items.k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 3. The stars, added on top.
      gl.useProgram(star);
      setLayout(gl, tu, lay, f);
      gl.uniform1fv(tu.uAlpha!, new Float32Array(lay.regions.map((g) => g.alpha)));
      gl.uniform1fv(tu.uRel!, new Float32Array(lay.regions.map((g) => g.rel)));
      gl.uniform1f(tu.uDpr!, f.dpr);
      gl.uniform1f(tu.uClock!, clock);
      gl.uniform1f(tu.uAmb!, f.ambient);
      gl.uniform4fv(tu.uItems!, items.out);
      gl.uniform1i(tu.uNI!, items.k);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex[cur]!);
      gl.uniform1i(tu.uState!, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, n * n * LEVELS);
      gl.disable(gl.BLEND);
    },
    readback(gl, sx, sy, r) {
      if (!last || !fbo.length) return null;
      const { lay, view, w, h } = last;
      const data = new Float32Array(n * n * LEVELS * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]!);
      gl.readPixels(0, 0, n, n * LEVELS, gl.RGBA, gl.FLOAT, data);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      let count = 0;
      let radial = 0;
      let movers = 0;
      lay.regions.forEach((g, ri) => {
        if (g.alpha < 0.05) return;
        const salt = (g.level + 64) * 7919;
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const cx = g.ox + pmod(i - g.ox, n);
            const cy = g.oy + pmod(j - g.oy, n);
            const hx = (cx + rnd(cx, cy, salt + 1, g.period)) * g.cell * view.scale + view.tx * g.k + (1 - g.k) * w * 0.5;
            const hy = (cy + rnd(cx, cy, salt + 2, g.period)) * g.cell * view.scale + view.ty * g.k + (1 - g.k) * h * 0.5;
            const at = ((ri * n + j) * n + i) * 4;
            const px = hx + data[at]!;
            const py = hy + data[at + 1]!;
            const dx = px - sx;
            const dy = py - sy;
            const d = Math.hypot(dx, dy);
            if (d > r) continue;
            count += g.alpha;
            if (d > 1) {
              radial += (data[at + 2]! * dx + data[at + 3]! * dy) / d;
              movers++;
            }
          }
        }
      });
      return { count, radial: movers ? radial / movers : 0 };
    },
    dispose(gl) {
      for (const t of tex) gl.deleteTexture(t);
      for (const f of fbo) gl.deleteFramebuffer(f);
      if (step) gl.deleteProgram(step);
      if (star) gl.deleteProgram(star);
      if (sky) gl.deleteProgram(sky);
      if (vao) gl.deleteVertexArray(vao);
      tex = [];
      fbo = [];
      step = star = sky = null;
      vao = null;
    },
  };
}
