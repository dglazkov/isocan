import { KOI_COUNT, FRESH_MS, spawnKoi, stirred, swim, type Koi, type Stir } from "../../lib/koi.ts";
import { simRect } from "../../lib/rake.ts";
import { FULLSCREEN_VS, program, uniforms, type Field, type LivingGround } from "./livingkit.ts";
import "./pond.css";

/**
 * **Pond** — still water seen from above (living grounds phase 4; design.md,
 * "Proposed next").
 *
 * > "the cursor drags ripples across still water, and a few koi drift away
 * > from it (height-field ripple simulation)"
 *
 * Two passes a frame, and a third only while water is moving:
 *
 * 1. **The ripples** — a height field in two half-float textures, ping-
 *    ponged: each texel holds its height now and a step ago, and the classic
 *    discrete wave step (half the neighbours' sum, less the old height,
 *    damped) runs `STEP_HZ` times a second in screen-felt time. Every pointer
 *    that moved — this viewer's and every presence cursor, an agent's at its
 *    weight — presses a capsule along its path, so a cursor drags a wake. Each
 *    item is a stone: the water under it is held flat, so a ring meets it and
 *    breaks round it. The field lives in ground space (`simRect`, whole-texel
 *    pans), and once the last ripple has damped out (`RIPPLE_LIFE`) the pass
 *    stops altogether and the water is flat again.
 * 2. **The water** — one full-screen pass: a green-dark bottom with soft
 *    pebbles, refracted by the ripples' slope; the koi beneath the surface
 *    with their shadows; light glancing off every ripple; and a shade round
 *    each item, a stone standing in the pond.
 *
 * The koi (`lib/koi.ts`) cruise with the ambient — none under Calm — and
 * dart away from any cursor that comes near, which holds under every Motion
 * setting. The bottom's slow caustics run on the ambient clock too.
 *
 * Every hash wraps at `TILE`, so the still (`public/grounds/pond.jpg`,
 * `scripts/ground-still.mjs pond`) is this water at rest — flat, without
 * koi, which would repeat with the tile — and tiles without a seam.
 */

/** The still frame's tile, in world units; every hash wraps here. */
export const TILE = 1024;
/** Texels a side of the ripple field. */
const SIM_N = 768;
/** Wave steps per second of real time. */
const STEP_HZ = 120;
/** Damping per step: a ring is gone (under 0.5%) in about `RIPPLE_LIFE`. */
const DAMP = 0.982;
/** Seconds after the last press that any ripple can still be seen. */
export const RIPPLE_LIFE = 2.6;
/** A press's radius in screen px — felt on screen, like the trail's stamp. */
const PRESS_PX = 10;
/** Stones the passes know about (the largest on screen). */
const MAX_STONES = 16;
/** Koi the water pass draws. */
const MAX_KOI = 8;

const HASH = `
uniform float uTile;
uint hash3(ivec2 c, uint salt, ivec2 period) {
  ivec2 w = ((c % period) + period) % period;
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, ivec2 period) { return float(hash3(c, salt, period) & 0xffffu) / 65535.0; }
float vnoise(vec2 w, float s, uint salt) {
  ivec2 P = ivec2(int(uTile / s + 0.5));
  vec2 g = w / s; ivec2 i = ivec2(floor(g)); vec2 f = fract(g); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rnd(i, salt, P), rnd(i + ivec2(1, 0), salt, P), f.x), mix(rnd(i + ivec2(0, 1), salt, P), rnd(i + ivec2(1, 1), salt, P), f.x), f.y);
}
float rectSd(vec2 p, vec4 r) { vec2 c = r.xy + r.zw * 0.5; vec2 d = abs(p - c) - r.zw * 0.5; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
`;

/** One wave step: read last step's heights, write this one's. */
const STEP_FS = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uN;
uniform float uDamp;
uniform int uNS;
uniform vec4 uSeg[16];
uniform vec2 uPress[16];
uniform int uNI;
uniform vec4 uItems[${MAX_STONES}];
out vec4 o;
vec2 at(vec2 w) {
  vec2 uv = (w - uPrevRect.xy) / uPrevRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(0.0);
  return texture(uPrev, uv).rg;
}
void main() {
  vec2 w = uRect.xy + vUv * uRect.z;
  float t = uRect.z / uN;
  for (int i = 0; i < ${MAX_STONES}; i++) {
    if (i >= uNI) break;
    vec4 r = uItems[i];
    if (all(greaterThan(w, r.xy)) && all(lessThan(w, r.xy + r.zw))) { o = vec4(0.0); return; }
  }
  vec2 c = at(w);
  float n = at(w + vec2(t, 0.0)).r + at(w - vec2(t, 0.0)).r + at(w + vec2(0.0, t)).r + at(w - vec2(0.0, t)).r;
  float h = (n * 0.5 - c.g) * uDamp;
  for (int i = 0; i < 16; i++) {
    if (i >= uNS) break;
    vec2 a = uSeg[i].xy, b = uSeg[i].zw;
    vec2 pa = w - a, ba = b - a;
    float k = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * k);
    float r = max(uPress[i].x, t * 1.5);
    h -= uPress[i].y * (1.0 - smoothstep(0.0, r, d));
  }
  o = vec4(clamp(h, -2.0, 2.0), c.r, 0.0, 1.0);
}`;

const WATER_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
${HASH}
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uClock;
uniform sampler2D uSim;
uniform vec3 uSimRect;
uniform float uSimN;
uniform float uHasSim;
uniform int uNI;
uniform vec4 uItems[${MAX_STONES}];
uniform int uNK;
uniform vec4 uKoi[${MAX_KOI}];   // x, y, heading, size
uniform vec2 uKoiB[${MAX_KOI}];  // tail phase, seed
out vec4 o;

float height(vec2 w) {
  vec2 uv = (w - uSimRect.xy) / uSimRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uSim, uv).r;
}

// A koi's body in its own frame (x forward, units of its length): the signed
// distance to the body, and how much of a fin is here.
vec2 koi(vec2 q, float tail) {
  float bend = sin(tail) * 0.13 * smoothstep(0.15, -0.55, q.x);
  q.y -= bend * (0.35 - q.x);
  float taper = mix(1.0, 0.35, smoothstep(0.05, -0.5, q.x));
  float body = length(vec2(q.x / 0.5, q.y / (0.13 * taper))) - 1.0;
  float fx = -q.x - 0.44;
  float fin = step(0.0, fx) * step(fx, 0.26) * step(abs(q.y), 0.02 + fx * 0.85);
  fin = max(fin, step(length(vec2(q.x - 0.16, abs(q.y) - 0.15) / vec2(0.09, 0.05)), 1.0));
  return vec2(body, fin);
}

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  float px = 1.0 / uView.x;

  // The surface: height and slope.
  vec2 g = vec2(0.0);
  float h = 0.0;
  if (uHasSim > 0.5) {
    float e = uSimRect.z / uSimN;
    h = height(w);
    g = vec2(height(w + vec2(e, 0.0)) - height(w - vec2(e, 0.0)), height(w + vec2(0.0, e)) - height(w - vec2(0.0, e)));
  }

  // The bottom, seen through it.
  vec2 b = w + g * 14.0;
  float deep = vnoise(b, 512.0, 3u) * 0.5 + vnoise(b, 256.0, 4u) * 0.3 + vnoise(b, 128.0, 11u) * 0.2;
  vec3 c = mix(vec3(0.04, 0.11, 0.11), vec3(0.07, 0.16, 0.145), smoothstep(0.2, 0.8, deep));
  float peb = vnoise(b, 16.0, 5u) * 0.5 + vnoise(b, 8.0, 6u) * 0.3 + vnoise(b, 4.0, 12u) * 0.2;
  c *= 0.95 + 0.1 * smoothstep(0.3, 0.8, peb) * smoothstep(2.0, 6.0, 8.0 * uView.x);
  // Caustics: thin wavering threads of light on the bottom, drifting on the ambient clock.
  float c1 = 1.0 - abs(vnoise(b + vec2(uClock * 9.0, uClock * 5.0), 64.0, 7u) * 2.0 - 1.0);
  float c2 = 1.0 - abs(vnoise(b - vec2(uClock * 6.0, -uClock * 7.0), 32.0, 8u) * 2.0 - 1.0);
  c += vec3(0.05, 0.08, 0.065) * pow(c1 * c2, 5.0) * smoothstep(1.0, 4.0, 32.0 * uView.x);

  // The koi, under the surface, with their shadows on the bottom below.
  for (int i = 0; i < ${MAX_KOI}; i++) {
    if (i >= uNK) break;
    vec4 k = uKoi[i];
    vec2 d = b - k.xy;
    if (dot(d, d) > k.w * k.w * 1.2) continue;
    float cs = cos(k.z), sn = sin(k.z);
    vec2 q = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) / k.w;
    vec2 ds = d - vec2(5.0, 7.0);
    vec2 qs = vec2(ds.x * cs + ds.y * sn, -ds.x * sn + ds.y * cs) / k.w;
    float aa = 1.5 * px / k.w;
    vec2 sh = koi(qs, uKoiB[i].x);
    c *= 1.0 - 0.3 * max(smoothstep(0.25, -0.4, sh.x), sh.y * 0.5);
    vec2 f = koi(q, uKoiB[i].x);
    float s = uKoiB[i].y;
    float spot = vnoise(q * vec2(3.0, 5.0) * 64.0 + s * 4096.0, 64.0, 9u);
    vec3 white = vec3(0.92, 0.9, 0.84);
    vec3 orange = mix(vec3(0.93, 0.36, 0.08), vec3(0.98, 0.58, 0.16), fract(s * 7.31));
    vec3 col = s < 0.3 ? orange : mix(white, orange, smoothstep(0.42 + 0.2 * fract(s * 3.7), 0.5 + 0.2 * fract(s * 3.7), spot));
    if (fract(s * 5.3) > 0.7) col = mix(col, vec3(0.08, 0.07, 0.07), smoothstep(0.68, 0.72, vnoise(q * 160.0 + s * 999.0, 32.0, 10u)));
    float body = smoothstep(aa, -aa, f.x);
    c = mix(c, col * 0.82 + c * 0.1, body * 0.85);
    c = mix(c, mix(col, white, 0.4) * 0.8, f.y * (1.0 - body) * 0.45);
  }

  // Light on the water: every ripple's slope catches it.
  vec2 L = normalize(vec2(-0.6, -0.8));
  float lit = dot(g, L);
  c += vec3(0.42, 0.52, 0.5) * clamp(lit * 2.2, -0.12, 0.45);
  c += vec3(0.75, 0.85, 0.8) * smoothstep(0.08, 0.2, lit) * 0.18;
  // A faint sky on the surface, darker where the water is deep.
  c += vec3(0.02, 0.035, 0.04) * (1.0 - deep);

  // Stones: the water darkens where it laps at an item.
  for (int i = 0; i < ${MAX_STONES}; i++) {
    if (i >= uNI) break;
    float sd = rectSd(w, uItems[i]) * uView.x;
    c *= 1.0 - 0.4 * exp(-max(sd, 0.0) / 14.0);
    c += vec3(0.1, 0.13, 0.12) * exp(-abs(sd - 3.0) / 2.5) * 0.5;
  }
  o = vec4(c, 1.0);
}`;

export function createPond(): LivingGround {
  let sim: WebGLProgram | null = null;
  let water: WebGLProgram | null = null;
  let su: Record<string, WebGLUniformLocation | null> = {};
  let wu: Record<string, WebGLUniformLocation | null> = {};
  let vao: WebGLVertexArrayObject | null = null;
  let tex: WebGLTexture[] = [];
  let fbo: WebGLFramebuffer[] = [];
  let cur = 0;
  /** The rect the current state texture covers, or null when the water is flat. */
  let simAt: { x: number; y: number; size: number } | null = null;

  let clock = 0;
  let simClock = 0;
  let lastPress = -Infinity;
  let lastStep = 0;
  let acc = 0;
  let koi: Koi[] = [];
  const last = new Map<string, { x: number; y: number }>();
  /** The step the host asked for, run at the head of the next `draw`. */
  let pending: { dt: number; segs: Float32Array; press: Float32Array; n: number } | null = null;
  /** The view the last frame was drawn at, for the readback. */
  let view: Field["view"] | null = null;

  const alloc = (gl: WebGL2RenderingContext) => {
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SIM_N, SIM_N, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
        throw new Error("no float render target for the ripples");
      }
      tex.push(t);
      fbo.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const clear = (gl: WebGL2RenderingContext) => {
    for (const f of fbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const stones = (items: Float32Array) => {
    const n = Math.min(MAX_STONES, items.length / 4);
    return { n, data: items.subarray(0, n * 4) };
  };

  return {
    name: "pond",
    cursor: "fish",
    setup(gl) {
      if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("no float render targets for the ripples");
      sim = program(gl, FULLSCREEN_VS, STEP_FS);
      water = program(gl, FULLSCREEN_VS, WATER_FS);
      su = uniforms(gl, sim);
      wu = uniforms(gl, water);
      vao = gl.createVertexArray();
      tex = [];
      fbo = [];
      simAt = null;
      alloc(gl);
    },
    step(dt, f) {
      const now = performance.now();
      const { scale } = f.view;
      clock += dt * f.ambient;
      simClock += dt;

      // Every pointer that moved since the last step presses the water along
      // its path; its own last position is kept here, because the host has
      // already collapsed the trail's capsule by the time a ground steps.
      const segs = new Float32Array(64);
      const press = new Float32Array(32);
      let n = 0;
      const seen = new Set<string>();
      const stirs: Stir[] = [];
      for (const p of f.pointers) {
        seen.add(p.id);
        const was = last.get(p.id);
        if (was && p.at > lastStep && n < 16) {
          segs.set([was.x, was.y, p.x, p.y], n * 4);
          press.set([PRESS_PX / scale, Math.min(1, 0.35 + p.speed / 1800) * 0.5 * p.weight], n * 2);
          n++;
        }
        last.set(p.id, { x: p.x, y: p.y });
        stirs.push({ x: p.x, y: p.y, fresh: now - p.at < FRESH_MS });
      }
      for (const id of [...last.keys()]) if (!seen.has(id)) last.delete(id);
      lastStep = now;
      if (n > 0) lastPress = simClock;

      const bounds = { x: -f.view.tx / scale, y: -f.view.ty / scale, w: f.width / scale, h: f.height / scale };
      if (koi.length === 0 && f.width > 0) koi = spawnKoi(KOI_COUNT, bounds);
      swim(koi, dt, f.ambient, clock, stirs, f.items, bounds, scale);

      pending = { dt, segs, press, n };
      return f.ease > 0.002 || simClock - lastPress < RIPPLE_LIFE || stirred(koi);
    },
    draw(gl, f) {
      if (!sim || !water) return;
      view = f.view;
      gl.bindVertexArray(vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      const st = stones(f.items);

      // 1. The ripples move, while there are any.
      if (pending) {
        const { dt, segs, press, n } = pending;
        pending = null;
        const live = simClock - lastPress < RIPPLE_LIFE;
        if (!live) simAt = null;
        else {
          const rect = simRect(f.view, f.width, f.height, SIM_N);
          if (!simAt) {
            clear(gl);
            simAt = rect;
            acc = 0;
          }
          acc += dt * STEP_HZ;
          let steps = Math.min(4, Math.floor(acc));
          acc -= steps;
          if (n > 0 && steps === 0) steps = 1;
          gl.useProgram(sim);
          gl.viewport(0, 0, SIM_N, SIM_N);
          gl.uniform1f(su.uN!, SIM_N);
          gl.uniform1f(su.uDamp!, DAMP);
          gl.uniform1i(su.uNI!, st.n);
          if (st.n > 0) gl.uniform4fv(su.uItems!, st.data);
          gl.uniform4fv(su.uSeg!, segs);
          gl.uniform2fv(su.uPress!, press);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform1i(su.uPrev!, 0);
          for (let i = 0; i < steps; i++) {
            const next = 1 - cur;
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]!);
            gl.bindTexture(gl.TEXTURE_2D, tex[cur]!);
            gl.uniform3f(su.uRect!, rect.x, rect.y, rect.size);
            gl.uniform3f(su.uPrevRect!, simAt.x, simAt.y, simAt.size);
            gl.uniform1i(su.uNS!, i === 0 ? n : 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            cur = next;
            simAt = rect;
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
      }

      // 2. The water.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(water);
      gl.uniform1f(wu.uTile!, TILE);
      gl.uniform3f(wu.uView!, f.view.scale, f.view.tx, f.view.ty);
      gl.uniform2f(wu.uRes!, f.width, f.height);
      gl.uniform1f(wu.uClock!, clock);
      gl.uniform1f(wu.uSimN!, SIM_N);
      gl.uniform1f(wu.uHasSim!, simAt ? 1 : 0);
      if (simAt) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex[cur]!);
        gl.uniform1i(wu.uSim!, 0);
        gl.uniform3f(wu.uSimRect!, simAt.x, simAt.y, simAt.size);
      }
      gl.uniform1i(wu.uNI!, st.n);
      if (st.n > 0) gl.uniform4fv(wu.uItems!, st.data);
      const nk = Math.min(MAX_KOI, koi.length);
      gl.uniform1i(wu.uNK!, nk);
      if (nk > 0) {
        gl.uniform4fv(wu.uKoi!, new Float32Array(koi.slice(0, nk).flatMap((k) => [k.x, k.y, k.heading, k.size])));
        gl.uniform2fv(wu.uKoiB!, new Float32Array(koi.slice(0, nk).flatMap((k) => [k.tail, k.seed])));
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    /** The `pond` journey's readback: the tallest ripple near a screen point
     *  — |height| within `r` CSS px, 0 for flat water — as `count`. */
    readback(gl, sx, sy, r) {
      if (!simAt || !view || !fbo.length) return { count: 0, radial: 0 };
      const texel = simAt.size / SIM_N;
      const wx = (sx - view.tx) / view.scale;
      const wy = (sy - view.ty) / view.scale;
      const rw = r / view.scale;
      const i0 = Math.max(0, Math.floor((wx - rw - simAt.x) / texel));
      const j0 = Math.max(0, Math.floor((wy - rw - simAt.y) / texel));
      const i1 = Math.min(SIM_N, Math.ceil((wx + rw - simAt.x) / texel));
      const j1 = Math.min(SIM_N, Math.ceil((wy + rw - simAt.y) / texel));
      if (i1 <= i0 || j1 <= j0) return { count: 0, radial: 0 };
      const w = i1 - i0;
      const h = j1 - j0;
      const px = new Float32Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]!);
      gl.readPixels(i0, j0, w, h, gl.RGBA, gl.FLOAT, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      let top = 0;
      for (let k = 0; k < px.length; k += 4) top = Math.max(top, Math.abs(px[k]!));
      return { count: top, radial: 0 };
    },
    dispose(gl) {
      for (const t of tex) gl.deleteTexture(t);
      for (const f of fbo) gl.deleteFramebuffer(f);
      if (sim) gl.deleteProgram(sim);
      if (water) gl.deleteProgram(water);
      if (vao) gl.deleteVertexArray(vao);
      tex = [];
      fbo = [];
      sim = water = null;
      vao = null;
      simAt = null;
      koi = [];
    },
  };
}
