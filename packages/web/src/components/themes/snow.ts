import { MAX_POINTERS, TRAIL_SIZE } from "../../lib/groundfield.ts";
import { easeGust, fillSteps, gustTarget } from "../../lib/snowpack.ts";
import { FULLSCREEN_VS, program, uniforms, type LivingGround } from "./livingkit.ts";
import "./snow.css";

/**
 * **Snow** — a living ground (living grounds phase 4; design.md's proposed
 * grounds).
 *
 * > "fresh snow the cursor leaves footprints in; flakes fall slowly,
 * > swirling around a fast-moving cursor"
 *
 * Three passes a frame:
 *
 * 1. **The pack** — an 8-bit texture of its own, laid exactly over the host's
 *    trail rect: each texel holds how trodden the snow is there. It takes the
 *    deepest of what it held and what the host's trail just pressed, and
 *    fills back in by `FILL_RATE` per awake second (`lib/snowpack.ts`). The
 *    host's trail fades in about 1.4 s; the pack does not fade while the
 *    ground sleeps, so a trail stays in the snow between visits and fills in
 *    only over the time somebody is moving on it.
 * 2. **The field** — a full-screen pass in ground space: wind-shaped swells
 *    lit from the top left, the pack pressed into them as a groove with a lit
 *    and a shaded wall, soft drifts banked against every item's edges (higher
 *    on the lee side) with a contact shade at their feet, and a few crystals
 *    glinting on the sunny slopes.
 * 3. **The flakes** — screen-space points falling slowly, drawn only with
 *    ambient (Full; never under Calm or asleep), swirled round any pointer
 *    moving fast enough to stir them (`gustTarget`), the swirl easing out
 *    over about a second.
 *
 * Every hash wraps at `TILE`, so the still (`public/grounds/snow.jpg`) is
 * rendered from this module and tiles as a world ground without a seam.
 */

/** The field repeats every this many world units — the still's tile. */
export const TILE = 1024;
/** Items the field banks drifts against (the largest on screen). */
const MAX_DRIFTS = 16;
/** How deep a fully trodden trail sinks, world units. */
const DEPTH = 9;

const HASH = `
uniform float uTile;
uint hash3(ivec2 c, uint salt, ivec2 period) {
  ivec2 w = ((c % period) + period) % period;
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, ivec2 period) { return float(hash3(c, salt, period) & 0xffffu) / 65535.0; }
float vnoise(vec2 w, vec2 s, uint salt) {
  ivec2 P = ivec2(uTile / s + 0.5);
  vec2 g = w / s;
  ivec2 i = ivec2(floor(g));
  vec2 f = fract(g);
  f = f * f * (3.0 - 2.0 * f);
  float a = rnd(i, salt, P), b = rnd(i + ivec2(1, 0), salt, P);
  float c = rnd(i + ivec2(0, 1), salt, P), d = rnd(i + ivec2(1, 1), salt, P);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

/** The pack: carry the history into this frame's rect, fill it back by
 *  `uFill` (whole 8-bit steps), and press it to the host trail's core. */
const PACK_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform sampler2D uTrail;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uFill;
uniform float uHasPrev;
uniform float uHasTrail;
out vec4 o;
void main() {
  vec2 w = uRect.xy + vUv * uRect.z;
  vec2 puv = (w - uPrevRect.xy) / uPrevRect.z;
  float v = 0.0;
  if (uHasPrev > 0.5 && all(greaterThanEqual(puv, vec2(0.0))) && all(lessThanEqual(puv, vec2(1.0)))) v = texture(uPrev, puv).r;
  v = max(v - uFill, 0.0);
  if (uHasTrail > 0.5) v = max(v, smoothstep(0.3, 0.75, texture(uTrail, vUv).r));
  o = vec4(v, 0.0, 0.0, 1.0);
}`;

const FIELD_FS = `#version 300 es
precision highp float;
precision highp int;
${HASH}
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform sampler2D uPack;
uniform vec3 uPR;
uniform float uHasPack;
uniform vec4 uItems[${MAX_DRIFTS}];
uniform int uNI;
out vec4 o;

float packAt(vec2 w) {
  vec2 uv = (w - uPR.xy) / uPR.z;
  if (uHasPack < 0.5 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uPack, uv).r;
}
float rectSd(vec2 p, vec4 r) { vec2 c = r.xy + r.zw * 0.5; vec2 d = abs(p - c) - r.zw * 0.5; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
vec2 rectN(vec2 p, vec4 r) { vec2 q = p - (r.xy + r.zw * 0.5); vec2 d = abs(q) - r.zw * 0.5; return d.x > d.y ? vec2(sign(q.x), 0.0) : vec2(0.0, sign(q.y)); }
// The swells: long wind-drawn ridges and softer hummocks, in world units of height.
float swell(vec2 w) {
  return vnoise(w, vec2(256.0), 1u) * 34.0 + vnoise(w, vec2(128.0, 64.0), 2u) * 6.0 + vnoise(w, vec2(64.0), 3u) * 6.0 + vnoise(w, vec2(16.0), 4u) * 0.8;
}

void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (scr - uView.yz) / uView.x;
  float e = max(1.5 / uView.x, 2.0);
  vec2 g = vec2(swell(w + vec2(e, 0.0)) - swell(w - vec2(e, 0.0)), swell(w + vec2(0.0, e)) - swell(w - vec2(0.0, e))) / (2.0 * e);

  // The trodden trail: a groove pressed into the swells.
  float p = packAt(w);
  float te = uPR.z / ${TRAIL_SIZE.toFixed(1)};
  vec2 gp = vec2(packAt(w + vec2(te, 0.0)) - packAt(w - vec2(te, 0.0)), packAt(w + vec2(0.0, te)) - packAt(w - vec2(0.0, te))) / (2.0 * te);
  g -= gp * ${DEPTH.toFixed(1)};

  // Drifts banked against every item, higher on the lee (lower right) side.
  float contact = 0.0;
  float bank = 0.0;
  for (int i = 0; i < ${MAX_DRIFTS}; i++) {
    if (i >= uNI) break;
    float sd = rectSd(w, uItems[i]);
    if (sd > 0.0 && sd < 120.0) {
      vec2 n = rectN(w, uItems[i]);
      float lee = 0.75 + 0.6 * max(dot(n, vec2(0.6, 0.8)), 0.0);
      float R = 28.0 * lee;
      float h = 14.0 * lee * exp(-sd / R);
      g -= n * h / R;
      bank = max(bank, h / 14.0);
      contact = max(contact, exp(-sd / 5.0));
    }
  }

  vec3 N = normalize(vec3(-g, 1.0));
  vec3 L = normalize(vec3(-0.55, -0.65, 0.75));
  float dif = clamp(dot(N, L), 0.0, 1.0);
  vec3 shade = vec3(0.64, 0.71, 0.84);
  vec3 lit = vec3(0.93, 0.95, 0.99);
  vec3 c = mix(shade, lit, smoothstep(0.35, 0.92, dif));
  // The bottom of a fresh print is a little bluer; a drift's crest a little brighter.
  c = mix(c, c * vec3(0.84, 0.89, 0.98), smoothstep(0.05, 0.7, p) * 0.7);
  c += vec3(0.03, 0.03, 0.035) * bank;
  c *= 1.0 - 0.2 * contact;

  // Crystals catching the light on the sunny slopes; gone when too small to see.
  float cell = 8.0;
  ivec2 P = ivec2(uTile / cell + 0.5);
  ivec2 ci = ivec2(floor(w / cell));
  if (rnd(ci, 7u, P) > 0.97) {
    vec2 at = (vec2(ci) + 0.2 + 0.6 * vec2(rnd(ci, 8u, P), rnd(ci, 9u, P))) * cell;
    float d = length(w - at) * uView.x;
    float s = (1.0 - smoothstep(0.0, 1.4, d)) * smoothstep(0.62, 0.8, dif) * smoothstep(2.0, 6.0, cell * uView.x);
    c += vec3(0.5, 0.58, 0.7) * s * (1.0 - p);
  }
  o = vec4(c, 1.0);
}`;

const FLAKE_VS = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uT;
uniform float uAmb;
uniform vec4 uGust[${MAX_POINTERS}];   // screen x, y, signed strength, radius
uniform int uNG;
out vec2 vQ;
out float vA;
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float h(uint i, uint salt) { return float(pcg(i * 1973u + pcg(salt))) * (1.0 / 4294967296.0); }
void main() {
  uint id = uint(gl_InstanceID);
  float a = h(id, 1u), b = h(id, 2u), z = h(id, 3u), ph = h(id, 4u);
  float near = z * z;
  float W = uRes.x + 60.0, H = uRes.y + 60.0;
  float fall = mix(14.0, 46.0, near);
  vec2 p = vec2(mod(a * W + uT * (5.0 + 9.0 * near) + sin(uT * (0.5 + ph) + ph * 6.283) * (6.0 + 14.0 * near), W) - 30.0,
                mod(b * H + uT * fall, H) - 30.0);
  for (int i = 0; i < ${MAX_POINTERS}; i++) {
    if (i >= uNG) break;
    vec2 d = p - uGust[i].xy;
    float Ld = length(d), R = uGust[i].w;
    if (Ld < R && Ld > 1e-3) {
      float f = 1.0 - Ld / R;
      f = f * f * uGust[i].z;
      float an = f * 2.6;
      float cs = cos(an), sn = sin(an);
      p = uGust[i].xy + mat2(cs, sn, -sn, cs) * d * (1.0 + abs(f) * 0.35);
    }
  }
  vec2 q = vec2((gl_VertexID & 1) == 1 ? 1.0 : -1.0, (gl_VertexID & 2) == 2 ? 1.0 : -1.0);
  vQ = q;
  vA = uAmb * mix(0.4, 0.95, near);
  vec2 s = p + q * mix(1.1, 3.4, near) * 1.6;
  gl_Position = vec4(s.x / uRes.x * 2.0 - 1.0, 1.0 - s.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FLAKE_FS = `#version 300 es
precision mediump float;
in vec2 vQ;
in float vA;
out vec4 o;
void main() {
  float a = vA * (1.0 - smoothstep(0.35, 1.0, length(vQ)));
  o = vec4(vec3(1.0) * a, a);
}`;

/** Snow can say how trodden it is at a ground-space point — read back from
 *  its own pack for the `snow` journey; nothing in the app calls it. */
export type SnowGround = LivingGround & { trodden(x: number, y: number): number };

export function createSnow(): SnowGround {
  let gl0: WebGL2RenderingContext | null = null;
  let pack: WebGLProgram | null = null;
  let field: WebGLProgram | null = null;
  let flake: WebGLProgram | null = null;
  let pu: Record<string, WebGLUniformLocation | null> = {};
  let fu: Record<string, WebGLUniformLocation | null> = {};
  let ku: Record<string, WebGLUniformLocation | null> = {};
  let vao: WebGLVertexArrayObject | null = null;
  let tex: WebGLTexture[] = [];
  let fbo: WebGLFramebuffer[] = [];
  let read = 0;
  let packAt = { x: 0, y: 0, size: 1 };
  let packEver = false;

  let clock = 0;
  let carry = 0;
  let lastDt = 0;
  const gusts = new Map<string, number>();
  const gustData = new Float32Array(MAX_POINTERS * 4);
  let nGusts = 0;

  const freePack = (gl: WebGL2RenderingContext) => {
    for (const t of tex) gl.deleteTexture(t);
    for (const f of fbo) gl.deleteFramebuffer(f);
    tex = [];
    fbo = [];
    packEver = false;
  };

  return {
    name: "snow",
    cursor: "sparkle",
    setup(gl) {
      gl0 = gl;
      pack = program(gl, FULLSCREEN_VS, PACK_FS);
      field = program(gl, FULLSCREEN_VS, FIELD_FS);
      flake = program(gl, FLAKE_VS, FLAKE_FS);
      pu = uniforms(gl, pack);
      fu = uniforms(gl, field);
      ku = uniforms(gl, flake);
      vao = gl.createVertexArray();
      // A restored context starts with an empty pack: the old textures died with it.
      tex = [];
      fbo = [];
      packEver = false;
      for (let i = 0; i < 2; i++) {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TRAIL_SIZE, TRAIL_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const f = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        tex.push(t);
        fbo.push(f);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    step(dt, f) {
      lastDt = dt;
      clock += dt * f.ambient;
      // A fast cursor stirs the falling snow; the stir eases out over a second.
      const now = performance.now();
      const { scale, tx, ty } = f.view;
      nGusts = 0;
      const seen = new Set<string>();
      for (const p of f.pointers) {
        seen.add(p.id);
        const g = easeGust(gusts.get(p.id) ?? 0, gustTarget(p.speed, now - p.at < 250) * p.weight, dt);
        if (g === 0) {
          gusts.delete(p.id);
          continue;
        }
        gusts.set(p.id, g);
        // Which way it swirls follows which way the cursor went.
        const turn = p.x >= p.px ? 1 : -1;
        if (nGusts < MAX_POINTERS) gustData.set([p.x * scale + tx, p.y * scale + ty, g * turn, 150], 4 * nGusts++);
      }
      for (const id of [...gusts.keys()]) if (!seen.has(id)) gusts.delete(id);
      // The pack is not motion: it fills only while something else keeps the
      // ground awake, and holds still while it sleeps.
      return f.ambient > 0.002 || gusts.size > 0;
    },
    draw(gl, f) {
      if (!pack || !field || !flake) return;
      const { view, width, height } = f;
      gl.bindVertexArray(vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      // 1. The pack — only once a trail has ever pressed it, and never in the still.
      if (f.trail || packEver) {
        const fill = fillSteps(carry, lastDt);
        carry = fill.carry;
        const rect = f.trailRect;
        const write = 1 - read;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[write]!);
        gl.viewport(0, 0, TRAIL_SIZE, TRAIL_SIZE);
        gl.useProgram(pack);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex[read]!);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, f.trail);
        gl.uniform1i(pu.uPrev!, 0);
        gl.uniform1i(pu.uTrail!, 1);
        gl.uniform3f(pu.uRect!, rect.x, rect.y, rect.size);
        gl.uniform3f(pu.uPrevRect!, packAt.x, packAt.y, packAt.size);
        gl.uniform1f(pu.uFill!, fill.fill);
        gl.uniform1f(pu.uHasPrev!, packEver ? 1 : 0);
        gl.uniform1f(pu.uHasTrail!, f.trail ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        read = write;
        packAt = { ...rect };
        packEver = true;
      }

      // 2. The field.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(field);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, packEver ? tex[read]! : null);
      gl.uniform1f(fu.uTile!, TILE);
      gl.uniform3f(fu.uView!, view.scale, view.tx, view.ty);
      gl.uniform2f(fu.uRes!, width, height);
      gl.uniform1i(fu.uPack!, 0);
      gl.uniform3f(fu.uPR!, packAt.x, packAt.y, packAt.size);
      gl.uniform1f(fu.uHasPack!, packEver ? 1 : 0);
      const n = Math.min(f.items.length / 4, MAX_DRIFTS);
      gl.uniform1i(fu.uNI!, n);
      if (n > 0) gl.uniform4fv(fu.uItems!, f.items.subarray(0, n * 4));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 3. The flakes — ambient only: none under Calm, none asleep, none in the still.
      if (f.ambient > 0.002) {
        const count = Math.round(Math.min(900, Math.max(150, (width * height) / 2400)));
        gl.useProgram(flake);
        gl.uniform2f(ku.uRes!, width, height);
        gl.uniform1f(ku.uT!, clock);
        gl.uniform1f(ku.uAmb!, f.ambient);
        gl.uniform1i(ku.uNG!, nGusts);
        if (nGusts > 0) gl.uniform4fv(ku.uGust!, gustData.subarray(0, nGusts * 4));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        gl.disable(gl.BLEND);
      }
      gl.bindVertexArray(null);
    },
    trodden(x, y) {
      const gl = gl0;
      if (!gl || !packEver || gl.isContextLost()) return 0;
      const u = Math.floor(((x - packAt.x) / packAt.size) * TRAIL_SIZE);
      const v = Math.floor(((y - packAt.y) / packAt.size) * TRAIL_SIZE);
      if (u < 0 || v < 0 || u >= TRAIL_SIZE || v >= TRAIL_SIZE) return 0;
      const px = new Uint8Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[read]!);
      gl.readPixels(u, v, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px[0]! / 255;
    },
    dispose(gl) {
      if (pack) gl.deleteProgram(pack);
      if (field) gl.deleteProgram(field);
      if (flake) gl.deleteProgram(flake);
      if (vao) gl.deleteVertexArray(vao);
      freePack(gl);
      pack = field = flake = null;
      vao = null;
      gl0 = null;
      gusts.clear();
    },
  };
}
