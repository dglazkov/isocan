import { MAX_POINTERS } from "../../lib/groundfield.ts";
import {
  FLY_CAP,
  GLOW_REACH_PX,
  drift,
  flyLight,
  glowWrite,
  itemGlow,
  pointerGlowTarget,
  wake,
  type Fly,
  type Light,
} from "../../lib/fireflies.ts";
import { FULLSCREEN_VS, program, uniforms, type LivingGround } from "./livingkit.ts";
import "./night.css";

/**
 * **Night** — the second living ground (living grounds phase 3; journey.md
 * scene 4).
 *
 * > "a dark meadow under a dim sky, with a band of soft out-of-focus lights
 * > far behind, like a town across a field. Maya's cursor is a firefly."
 *
 * Ported from the bench (`docs/projects/living-grounds/prototype`), where it
 * measured 1.37 ms GPU at 2560×1440 on an M4 Pro at density ×1; this ships at
 * the README's suggested M1 default, ×0.5 (blade spacing 7.5 / √0.5).
 *
 * Three draws a frame:
 *
 * 1. **The sky and the floor** — a full-screen pass: a dim sky with a few
 *    stars, the town's bokeh band along the horizon (screen space: it is far
 *    away, so it barely moves with a pan), a low hill line, and below it the
 *    dark floor in ground space with warm pools under every firefly and a
 *    warm rim on the ground round an item a firefly is near.
 * 2. **The grass** — dark blades from the horizon down, bent by the pointers
 *    and the trail, their tips lit by the nearest fireflies.
 * 3. **The fireflies** — every pointer (this viewer's and every presence
 *    cursor: each one IS a firefly) and the swarm their paths woke
 *    (`lib/fireflies.ts`), as additive sprites.
 *
 * ## The cursor and the light
 *
 * The pointer wears the `firefly` cursor (`cursorart.ts`), whose lantern is a
 * hole. The light is drawn HERE, at `LANTERN` past each pointer, so it shows
 * through that hole and pools on the grass — warm under every cursor, the
 * cursor itself carrying no colour, as every cursor in the library must.
 *
 * ## Items catch the light, cheaply
 *
 * An item within reach of a firefly gets `--ground-glow` on its element
 * (`night.css` turns that into a warm shadow), written only when it moves by
 * more than `GLOW_STEP` — never a write per item per frame. An item no light
 * reaches is not even measured.
 */

/** Where the sky meets the field, as a share of the screen's height. */
export const HORIZON = 0.4;
/** Screen px from the hotspot to the firefly cursor's lantern. */
export const LANTERN = { x: 12.7, y: 13.7 };
/** CSS px between blades at zoom 1 — the bench's ×0.5 density. */
const SPACING = 7.5 / Math.SQRT1_2;
/** A blade's height in world units. */
const BLADE = 30;
/** The most blades in one frame; past it the lattice drops a level. */
const MAX_BLADES = 24_000;
/** Lights the passes read, brightest first. */
const MAX_LIGHTS = 24;
/** Items the ground pass rims and shadows (the largest on screen). */
const MAX_RIMS = 16;

const COMMON = `#version 300 es
precision highp float; precision highp int;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash(ivec2 c, uint salt){ uint x = uint(c.x + 1073741824); uint y = uint(c.y + 1073741824);
  return float(pcg(x * 1973u + pcg(y * 9277u + salt))) * (1.0 / 4294967296.0); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); ivec2 c = ivec2(i);
  float a = hash(c, 1u), b = hash(c + ivec2(1,0), 1u), d = hash(c + ivec2(0,1), 1u), e = hash(c + ivec2(1,1), 1u);
  vec2 u = f * f * (3. - 2. * f); return mix(mix(a, b, u.x), mix(d, e, u.x), u.y); }
float fbm(vec2 p, int oct){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
float rectSd(vec2 p, vec4 r){ vec2 c = r.xy + r.zw * .5; vec2 d = abs(p - c) - r.zw * .5; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
vec2 rectN(vec2 p, vec4 r){ vec2 q = p - (r.xy + r.zw * .5); vec2 d = abs(q) - r.zw * .5; return d.x > d.y ? vec2(sign(q.x), 0.) : vec2(0., sign(q.y)); }
`;

const BG_FS = COMMON + `
in vec2 vUv;
out vec4 o;
uniform vec3 uView; uniform vec2 uRes; uniform float uBufH, uDpr, uTime, uAmb, uHorizon;
uniform vec4 uItems[${MAX_RIMS}]; uniform int uNI; uniform float uGlow[${MAX_RIMS}];
uniform vec4 uLight[${MAX_LIGHTS}]; uniform int uNL;
void main(){
  vec2 scr = vec2(gl_FragCoord.x, uBufH - gl_FragCoord.y) / uDpr;
  vec2 w = (scr - uView.yz) / uView.x; float hz = uHorizon;
  vec3 c = mix(vec3(.012, .02, .05), vec3(.07, .075, .13), pow(smoothstep(0., hz, scr.y), 1.6));
  c += vec3(.15, .085, .05) * exp(-abs(scr.y - hz) / 46.);                        // a town's glow on the haze
  vec2 sk = floor(scr / 3.); float st = hash(ivec2(sk) + ivec2(int(uView.y * .02), 0), 70u);
  c += vec3(.7, .75, .9) * step(.9975, st) * .35 * (1. - smoothstep(0., hz, scr.y));
  float px = -uView.y * .04;                                                       // the far lights barely move with a pan
  if (scr.y > hz - 60. && scr.y < hz + 30.) for (int i = 0; i < 30; i++) {
    ivec2 hi = ivec2(i, 3); float x = mod(hash(hi, 1u) * uRes.x * 1.3 + px, uRes.x * 1.3) - uRes.x * .15;
    float y = hz - 4. - 30. * pow(hash(hi, 2u), 1.5); float r = 5. + 17. * pow(hash(hi, 3u), 2.);
    float dd = length(scr - vec2(x, y));
    float disc = smoothstep(r, r - 1.6, dd) * (.55 + .45 * smoothstep(r * .5, r, dd));
    vec3 lc = hash(hi, 4u) < .78 ? mix(vec3(1., .66, .32), vec3(1., .86, .58), hash(hi, 5u)) : vec3(.6, .74, 1.);
    c += lc * disc * (.12 + .26 * hash(hi, 6u)) * (1. + .15 * uAmb * sin(uTime * (.6 + hash(hi, 7u)) + 6.28 * hash(hi, 8u)));
  }
  float hill = hz + 4. - 16. * fbm(vec2((scr.x - uView.y * .12) * .006, 0.), 2) - 6. * vnoise(vec2((scr.x - uView.y * .25) * .05, 3.));
  if (scr.y > hill) {
    c = mix(vec3(.013, .024, .024), vec3(.032, .055, .05), fbm(w * .006, 2));
    vec3 L = vec3(0.);
    for (int i = 0; i < 12; i++) { if (i >= uNL) break; vec2 d = scr - uLight[i].xy; float rr = uLight[i].w * 1.7; L += vec3(1., .72, .32) * uLight[i].z / (1. + dot(d, d) / (rr * rr)); }
    c += L * .16;
  }
  for (int i = 0; i < ${MAX_RIMS}; i++) { if (i >= uNI) break;
    vec4 r = vec4(uItems[i].xy * uView.x + uView.yz, uItems[i].zw * uView.x);
    float sd = rectSd(scr, r);
    c += vec3(1., .7, .35) * uGlow[i] * .55 * exp(-max(sd, 0.) / 18.) * step(0., sd);
    c *= 1. - .35 * exp(-max(sd, 0.) / 10.) * (1. - uGlow[i]); }
  o = vec4(c, 1.);
}`;

const BLADE_VS = COMMON + `
uniform vec3 uView; uniform vec2 uRes; uniform float uTime, uAmb, uLodA, uFade, uS, uH, uHorizon;
uniform ivec2 uCell0; uniform int uCols, uLevel;
uniform sampler2D uTrail; uniform vec3 uTR; uniform float uHasTrail;
uniform vec4 uPtr[${MAX_POINTERS}]; uniform int uNP;
uniform vec4 uItems[${MAX_RIMS}]; uniform int uNI;
uniform vec4 uLight[${MAX_LIGHTS}]; uniform int uNL;
out vec4 vCol;
float trailAt(vec2 p) {
  vec2 uv = (p - uTR.xy) / uTR.z;
  if (uHasTrail < .5 || any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return 0.;
  return textureLod(uTrail, uv, 0.).r;
}
void main(){
  int id = gl_InstanceID; ivec2 cell = uCell0 + ivec2(id % uCols, id / uCols);
  ivec2 c0 = cell * (1 << uLevel);
  float r1 = hash(c0, 11u), r2 = hash(c0, 23u), r3 = hash(c0, 37u), r4 = hash(c0, 51u);
  vec2 base = (vec2(cell) + vec2(r1, r2)) * uS;
  float alpha = uLodA;
  if (((cell.x | cell.y) & 1) == 1) alpha *= uFade;      // these leave at the next level out: fade, don't pop
  float h = uH * (.62 + .55 * r3);
  vec2 sb = base * uView.x + uView.yz;
  float k = smoothstep(uHorizon, uRes.y * 1.05, sb.y); alpha *= smoothstep(uHorizon + 2., uHorizon + 26., sb.y); h *= mix(.35, 1.15, k);
  if (alpha < .01) { gl_Position = vec4(2., 2., 2., 1.); vCol = vec4(0.); return; }
  // History: the trail, pressed away down its slope. Now: every pointer, radially. Items: flat, leaning out at the edges.
  float tx = uTR.z / 256. * 1.5;
  float press = trailAt(base);
  vec2 g = vec2(trailAt(base + vec2(tx, 0.)) - trailAt(base - vec2(tx, 0.)), trailAt(base + vec2(0., tx)) - trailAt(base - vec2(0., tx)));
  vec2 push = length(g) > 1e-4 ? -normalize(g) * press * .9 : vec2(0.);
  for (int i = 0; i < ${MAX_POINTERS}; i++) { if (i >= uNP) break;
    vec2 d = base - uPtr[i].xy; float L = length(d), R = uPtr[i].w;
    if (L < R) { float f = 1. - L / R; f *= f * uPtr[i].z; push += (L > 1e-3 ? d / L : vec2(0.)) * f * 1.1; press = max(press, f * .9); }
  }
  for (int i = 0; i < ${MAX_RIMS}; i++) { if (i >= uNI) break;
    float sd = rectSd(base, uItems[i]);
    if (sd < 14.) { float f = 1. - smoothstep(-3., 14., sd); push += rectN(base, uItems[i]) * f * 1.15; press = max(press, f); if (sd < 0.) h *= .3; }
  }
  float wind = uAmb * (.17 * sin(uTime * 1.05 + base.x * .011 + base.y * .006) + .07 * sin(uTime * 2.3 + base.x * .045 + r4 * 6.28));
  float pl = length(push); if (pl > 1.) { push /= pl; pl = 1.; }
  vec2 lean = vec2(push.x + (wind + (r1 - .5) * .22) * (1. - pl), push.y);
  vec2 tip = vec2(lean.x * .95, -(1. - .82 * pl) + lean.y * .3) * h;
  float t = gl_VertexID >= 2 ? 1. : 0.; float side = (gl_VertexID == 1 || gl_VertexID == 3) ? .5 : -.5;
  float al = max(length(tip), 1e-3); vec2 nrm = vec2(-tip.y, tip.x) / al;
  float wd = max(2.3 * (.7 + .6 * r4), .9 / uView.x) * mix(1., .14, t);
  vec2 s = (base + tip * t + nrm * side * wd) * uView.x + uView.yz;
  gl_Position = vec4(s.x / uRes.x * 2. - 1., 1. - s.y / uRes.y * 2., 0., 1.);
  // Moonlit, not black (Dion, 9 Oct: "you should be able to tell it's grass when dark").
  vec3 c = mix(vec3(.018, .042, .04), vec3(.13, .24, .2), t * (.7 + .4 * r2)) * (.82 + .32 * r3);
  c = mix(c, vec3(.17, .27, .23), press * (.2 + .45 * t));
  vec3 L = vec3(0.);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) { if (i >= uNL) break; vec2 d = s - uLight[i].xy; L += uLight[i].z / (1. + dot(d, d) / (uLight[i].w * uLight[i].w)); }
  c += vec3(1., .74, .34) * L * (.18 + .82 * t) * .85;
  vCol = vec4(c, alpha);
}`;

const BLADE_FS = `#version 300 es
precision mediump float; in vec4 vCol; out vec4 o; void main(){ o = vCol; }`;

const FLY_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aF;   // ground x, y, intensity, radius (css px)
uniform vec3 uView; uniform vec2 uRes; out vec2 vQ; out float vI;
void main(){
  vec2 q = vec2((gl_VertexID & 1) == 1 ? 1. : -1., (gl_VertexID & 2) == 2 ? 1. : -1.);
  vec2 s = aF.xy * uView.x + uView.yz + q * aF.w; vQ = q; vI = aF.z;
  gl_Position = vec4(s.x / uRes.x * 2. - 1., 1. - s.y / uRes.y * 2., 0., 1.);
}`;

const FLY_FS = `#version 300 es
precision mediump float; in vec2 vQ; in float vI; out vec4 o;
void main(){ float r2 = dot(vQ, vQ); float edge = 1. - smoothstep(.7, 1., sqrt(r2));
  vec3 c = vec3(1., .95, .7) * exp(-r2 * 70.) * 1.5 + vec3(1., .72, .3) * exp(-r2 * 6.) * .5 + vec3(.75, 1., .35) * exp(-r2 * 22.) * .25;
  o = vec4(c * vI * edge, 1.); }`;

/** Write (or clear) one item's glow — the only DOM this ground touches. */
export type GlowWriter = (itemId: string, glow: number) => void;

const domGlow: GlowWriter = (id, glow) => {
  const el = document.querySelector<HTMLElement>(`.item[data-item-id="${CSS.escape(id)}"]`);
  if (!el) return;
  if (glow > 0) el.style.setProperty("--ground-glow", glow.toFixed(2));
  else el.style.removeProperty("--ground-glow");
};

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Night is a living ground that can also say how big its swarm is — read by
 *  the `night` journey through the canvas's probe. */
export type NightGround = LivingGround & { flies(): number };

export function createNight(writeGlow: GlowWriter = domGlow): NightGround {
  let bg: WebGLProgram | null = null;
  let blade: WebGLProgram | null = null;
  let fly: WebGLProgram | null = null;
  let gu: Record<string, WebGLUniformLocation | null> = {};
  let bu: Record<string, WebGLUniformLocation | null> = {};
  let fu: Record<string, WebGLUniformLocation | null> = {};
  let empty: WebGLVertexArrayObject | null = null;
  let flyVao: WebGLVertexArrayObject | null = null;
  let flyBuf: WebGLBuffer | null = null;

  let flies: Fly[] = [];
  let carried = 0;
  let clock = 0;
  const last = new Map<string, { x: number; y: number }>();
  const glowOf = new Map<string, number>();
  const written = new Map<string, number>();

  // Per-frame products of `step`, read by `draw`.
  const data = new Float32Array(4 * (FLY_CAP + MAX_POINTERS));
  let sprites = 0;
  const lights = new Float32Array(MAX_LIGHTS * 4);
  let nLights = 0;
  const ptrs = new Float32Array(MAX_POINTERS * 4);
  let nPtrs = 0;
  const rimGlow = new Float32Array(MAX_RIMS);

  const clearGlows = () => {
    for (const id of written.keys()) writeGlow(id, 0);
    written.clear();
  };

  return {
    name: "night",
    cursor: "firefly",
    flies: () => flies.length,
    setup(gl) {
      bg = program(gl, FULLSCREEN_VS, BG_FS);
      blade = program(gl, BLADE_VS, BLADE_FS);
      fly = program(gl, FLY_VS, FLY_FS);
      gu = uniforms(gl, bg);
      bu = uniforms(gl, blade);
      fu = uniforms(gl, fly);
      empty = gl.createVertexArray();
      flyVao = gl.createVertexArray();
      flyBuf = gl.createBuffer();
      gl.bindVertexArray(flyVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, flyBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      gl.vertexAttribDivisor(0, 1);
      gl.bindVertexArray(null);
    },
    step(dt, f) {
      const { scale, tx, ty } = f.view;
      const amb = f.ambient;
      const now = performance.now();
      clock += dt * amb;

      // Every pointer is a firefly, and its path wakes more out of the grass.
      const L: (Light & { r: number })[] = [];
      const seen = new Set<string>();
      nPtrs = 0;
      sprites = 0;
      for (const p of f.pointers) {
        seen.add(p.id);
        const was = last.get(p.id);
        if (was && amb > 0.002) {
          carried = wake(flies, carried, was, p, Math.hypot(p.x - was.x, p.y - was.y) * scale, scale);
        }
        last.set(p.id, { x: p.x, y: p.y });
        const target = pointerGlowTarget(now - p.at < 250 ? p.speed : 0);
        const g0 = glowOf.get(p.id) ?? 0.32;
        const glow = g0 + (target - g0) * (1 - Math.exp(-dt * 4));
        glowOf.set(p.id, glow);
        const i = glow * p.weight * amb;
        const sx = p.x * scale + tx + LANTERN.x;
        const sy = p.y * scale + ty + LANTERN.y;
        L.push({ x: sx, y: sy, i, r: 46 });
        if (nPtrs < MAX_POINTERS) ptrs.set([p.x, p.y, p.weight, 26 / scale], 4 * nPtrs++);
        data.set([(sx - tx) / scale, (sy - ty) / scale, i, 50], 4 * sprites++);
      }
      for (const id of [...last.keys()]) {
        if (seen.has(id)) continue;
        last.delete(id);
        glowOf.delete(id);
      }

      // The swarm drifts in eased time: it slows to a stop as the ground
      // settles, and once it is dark it is gone — nothing hidden while asleep.
      flies = amb > 0.002 ? drift(flies, dt * amb, scale) : [];
      for (const q of flies) {
        const i = flyLight(q, amb);
        L.push({ x: q.x * scale + tx, y: q.y * scale + ty, i, r: 30 });
        if (sprites < FLY_CAP + MAX_POINTERS) data.set([q.x, q.y, i, 26], 4 * sprites++);
      }

      const lit = L.filter((l) => l.i > 0.003).sort((a, b) => b.i - a.i).slice(0, MAX_LIGHTS);
      nLights = lit.length;
      lights.fill(0);
      lit.forEach((l, k) => lights.set([l.x, l.y, l.i, l.r], k * 4));

      // Items catch the light — measured only within reach, written only on change.
      const n = f.items.length / 4;
      const ids = f.itemIds ?? [];
      rimGlow.fill(0);
      const touched = new Set<string>();
      for (let k = 0; k < n; k++) {
        const x = f.items[k * 4]! * scale + tx;
        const y = f.items[k * 4 + 1]! * scale + ty;
        const w = f.items[k * 4 + 2]! * scale;
        const h = f.items[k * 4 + 3]! * scale;
        const near = lit.some((l) => l.x > x - GLOW_REACH_PX && l.x < x + w + GLOW_REACH_PX && l.y > y - GLOW_REACH_PX && l.y < y + h + GLOW_REACH_PX);
        const g = near ? itemGlow(x, y, w, h, lit) : 0;
        if (k < MAX_RIMS) rimGlow[k] = g;
        const id = ids[k];
        if (!id) continue;
        touched.add(id);
        const out = glowWrite(written.get(id) ?? 0, g);
        if (out === null) continue;
        writeGlow(id, out);
        if (out === 0) written.delete(id);
        else written.set(id, out);
      }
      // An item that scrolled away (or was deleted) while lit goes dark too.
      for (const id of [...written.keys()]) {
        if (touched.has(id)) continue;
        writeGlow(id, 0);
        written.delete(id);
      }

      return amb > 0.002 || flies.length > 0;
    },
    draw(gl, f) {
      if (!bg || !blade || !fly) return;
      const { view, width, height } = f;
      const s = view.scale;
      const hz = Math.round(height * HORIZON);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      const nItems = Math.min(f.items.length / 4, MAX_RIMS);

      gl.bindVertexArray(empty);
      gl.useProgram(bg);
      gl.uniform3f(gu.uView!, s, view.tx, view.ty);
      gl.uniform2f(gu.uRes!, width, height);
      gl.uniform1f(gu.uBufH!, gl.drawingBufferHeight);
      gl.uniform1f(gu.uDpr!, gl.drawingBufferWidth / Math.max(1, width));
      gl.uniform1f(gu.uTime!, clock);
      gl.uniform1f(gu.uAmb!, f.ambient);
      gl.uniform1f(gu.uHorizon!, hz);
      gl.uniform1i(gu.uNI!, nItems);
      if (nItems > 0) {
        gl.uniform4fv(gu.uItems!, f.items.subarray(0, nItems * 4));
        gl.uniform1fv(gu.uGlow!, rimGlow.subarray(0, nItems));
      }
      gl.uniform4fv(gu.uLight!, lights);
      gl.uniform1i(gu.uNL!, nLights);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // The grass: a lattice whose level steps by powers of two with zoom,
      // the leaving half fading rather than popping (the bench's LOD).
      const lodA = smooth((BLADE * s - 4) / 7);
      if (lodA >= 0.01) {
        const grid = (level: number) => {
          const S = SPACING * 2 ** level;
          const hm = BLADE * 1.2;
          const x0 = -view.tx / s, x1 = (width - view.tx) / s, y0 = (Math.max(0, hz) - view.ty) / s, y1 = (height - view.ty) / s;
          const ix0 = Math.floor((x0 - hm) / S), ix1 = Math.ceil((x1 + hm) / S);
          const iy0 = Math.floor((y0 - S) / S), iy1 = Math.ceil((y1 + hm) / S);
          return { S, ix0, iy0, cols: Math.max(0, ix1 - ix0), rows: Math.max(0, iy1 - iy0) };
        };
        const Lc = Math.log2(1 / s);
        let lvl = Math.max(0, Math.floor(Lc));
        let fade = Lc <= 0 ? 1 : 1 - (Lc - lvl);
        let g = grid(lvl);
        while (g.cols * g.rows > MAX_BLADES && lvl < 12) {
          lvl++;
          fade = 1;
          g = grid(lvl);
        }
        gl.useProgram(blade);
        gl.uniform3f(bu.uView!, s, view.tx, view.ty);
        gl.uniform2f(bu.uRes!, width, height);
        gl.uniform1f(bu.uTime!, clock);
        gl.uniform1f(bu.uAmb!, f.ambient);
        gl.uniform1f(bu.uLodA!, lodA);
        gl.uniform1f(bu.uFade!, fade);
        gl.uniform1f(bu.uS!, g.S);
        gl.uniform1f(bu.uH!, BLADE);
        gl.uniform1f(bu.uHorizon!, hz);
        gl.uniform2i(bu.uCell0!, g.ix0, g.iy0);
        gl.uniform1i(bu.uCols!, Math.max(1, g.cols));
        gl.uniform1i(bu.uLevel!, lvl);
        if (f.trail) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, f.trail);
        }
        gl.uniform1i(bu.uTrail!, 0);
        gl.uniform3f(bu.uTR!, f.trailRect.x, f.trailRect.y, f.trailRect.size);
        gl.uniform1f(bu.uHasTrail!, f.trail ? 1 : 0);
        gl.uniform1i(bu.uNP!, nPtrs);
        if (nPtrs > 0) gl.uniform4fv(bu.uPtr!, ptrs.subarray(0, nPtrs * 4));
        gl.uniform1i(bu.uNI!, nItems);
        if (nItems > 0) gl.uniform4fv(bu.uItems!, f.items.subarray(0, nItems * 4));
        gl.uniform4fv(bu.uLight!, lights);
        gl.uniform1i(bu.uNL!, nLights);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        if (g.cols * g.rows > 0) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, g.cols * g.rows);
      }

      if (sprites > 0) {
        gl.useProgram(fly);
        gl.uniform3f(fu.uView!, s, view.tx, view.ty);
        gl.uniform2f(fu.uRes!, width, height);
        gl.bindVertexArray(flyVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, flyBuf);
        gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, sprites * 4), gl.DYNAMIC_DRAW);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sprites);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    },
    dispose(gl) {
      clearGlows();
      if (bg) gl.deleteProgram(bg);
      if (blade) gl.deleteProgram(blade);
      if (fly) gl.deleteProgram(fly);
      if (empty) gl.deleteVertexArray(empty);
      if (flyVao) gl.deleteVertexArray(flyVao);
      if (flyBuf) gl.deleteBuffer(flyBuf);
      bg = blade = fly = null;
      empty = flyVao = null;
      flyBuf = null;
      flies = [];
    },
  };
}
