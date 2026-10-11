import { RAKE_R, SOFTEN_S, TINE, rakeEdge, rakeStrength, simRect } from "../../lib/rake.ts";
import { FULLSCREEN_VS, program, uniforms, type Field, type LivingGround } from "./livingkit.ts";
import "./zen.css";

/**
 * **Zen garden** — raked sand (living grounds phase 4; design.md, "Proposed
 * next").
 *
 * > "the cursor rakes lines in sand that slowly soften; items sit like stones
 * > with rings raked around them"
 *
 * The garden at rest is straight parallel lines with a slow, wide waver, and
 * every item is a stone with concentric rings raked round it. Every cursor —
 * this viewer's, every presence cursor, an agent's at full weight — is a
 * rake: its path leaves seven parallel grooves that follow it, curving where
 * it curves and rounding where it stopped, over whatever was there.
 *
 * ## The rake's memory, and why it cannot keep the ground awake
 *
 * The rake writes into a float texture in ground space (`simRect`, so a pan
 * copies whole texels): for each texel a stroke owns, its signed offset across
 * the stroke (`rakeOffset`) and WHEN it was raked, on the garden's own clock.
 * That clock runs on the host's awake envelope (`ease`), so a line softens
 * back into the base pattern over `SOFTEN_S` (20 s) of time the ground was
 * awake — and not at all while it sleeps. Nothing about softening is a reason
 * to keep drawing: `step` reports at rest exactly when the envelope has eased
 * out, like Meadow's, so the garden sleeps within a second or so of the last
 * input with its lines half-softened, and resumes softening when somebody
 * comes back. Softening is a uniform (the clock), not a pass: the texture is
 * written only when a cursor rakes or the view pans.
 *
 * Every hash and every wave in the base pattern wraps at `TILE`, so the
 * still (`public/grounds/zen.jpg`, `scripts/ground-still.mjs zen`) is this
 * garden at rest, unraked, and tiles without a seam.
 */

/** The still frame's tile, in world units; the base pattern repeats here. */
export const TILE = 1024;
/** Texels a side of the rake's memory. */
const RAKE_N = 512;
/** How far round a stone the rings reach, in world units: six grooves. */
const RING = TINE * 6;
/** Stones the passes know about (the largest on screen). */
const MAX_STONES = 16;

/** One rake pass: copy the memory into this view's rect, then rake each
 *  stroke over it. */
const STAMP_FS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPrev;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uN;
uniform float uR;
uniform float uNow;
uniform int uNS;
uniform vec4 uSeg[16];
out vec4 o;
void main() {
  vec2 w = uRect.xy + gl_FragCoord.xy / uN * uRect.z;
  ivec2 pi = ivec2(floor((w - uPrevRect.xy) / uPrevRect.z * uN));
  vec4 v = vec4(0.0);
  if (all(greaterThanEqual(pi, ivec2(0))) && all(lessThan(pi, ivec2(int(uN))))) v = texelFetch(uPrev, pi, 0);
  for (int i = 0; i < 16; i++) {
    if (i >= uNS) break;
    vec2 a = uSeg[i].xy, ba = uSeg[i].zw - a;
    float l2 = dot(ba, ba);
    if (l2 < 1e-6) continue;
    vec2 q = w - a;
    float along = dot(q, ba);
    if (along < 0.0) continue;
    vec2 e = q - ba * min(1.0, along / l2);
    float dist = length(e);
    if (dist >= uR) continue;
    v = vec4((ba.x * q.y - ba.y * q.x >= 0.0 ? 1.0 : -1.0) * dist, uNow + 1.0, 0.0, 1.0);
  }
  o = v;
}`;

const SAND_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uTile;
uniform float uClock;
uniform float uSoften;
uniform float uR;
uniform highp sampler2D uRake;
uniform vec3 uRakeRect;
uniform float uRakeN;
uniform float uHasRake;
uniform int uNI;
uniform vec4 uItems[${MAX_STONES}];
out vec4 o;
const float TAU = 6.2831853;
const float TINE = ${TINE.toFixed(1)};
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

// How raked a point is (x) and its offset across the stroke (y), blended
// from the four nearest texels by how raked each one still is.
vec2 rake(vec2 w) {
  if (uHasRake < 0.5) return vec2(0.0);
  vec2 pc = (w - uRakeRect.xy) / uRakeRect.z * uRakeN - 0.5;
  ivec2 i0 = ivec2(floor(pc));
  vec2 f = fract(pc);
  float sw = 0.0, sd = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 c = i0 + ivec2(k & 1, k >> 1);
    if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, ivec2(int(uRakeN))))) continue;
    vec4 t = texelFetch(uRake, c, 0);
    if (t.g < 0.5) continue;
    float s = clamp(1.0 - (uClock - (t.g - 1.0)) / uSoften, 0.0, 1.0);
    s *= 1.0 - smoothstep(0.75 * uR, uR, abs(t.r));
    float wt = ((k & 1) == 1 ? f.x : 1.0 - f.x) * ((k >> 1) == 1 ? f.y : 1.0 - f.y);
    sw += wt * s;
    sd += wt * s * t.r;
  }
  return vec2(sw, sw > 1e-4 ? sd / sw : 0.0);
}

// The sand's height: the base lines, the rings round each stone, the rake on top.
float sand(vec2 w, out float raked) {
  float off = 2.5 * sin(w.x * TAU / 512.0) + 1.5 * sin(w.y * TAU / 1024.0 + 1.3);
  float h = cos(TAU * (w.y + off) / TINE);
  float sdm = 1e9;
  for (int i = 0; i < ${MAX_STONES}; i++) { if (i >= uNI) break; sdm = min(sdm, rectSd(w, uItems[i])); }
  h = mix(h, cos(TAU * max(sdm, 0.0) / TINE), 1.0 - smoothstep(${(RING * 0.8).toFixed(1)}, ${RING.toFixed(1)}, sdm));
  vec2 r = rake(w);
  raked = r.x;
  return mix(h, cos(TAU * r.y / TINE), r.x);
}

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  float px = 1.0 / uView.x;
  float raked;
  float h0 = sand(w, raked);
  float e = max(px, 0.6);
  float tmp;
  vec2 g = vec2(sand(w + vec2(e, 0.0), tmp) - h0, sand(w + vec2(0.0, e), tmp) - h0) / e * (TINE / TAU);
  // Lines this fine alias when you stand back; the sand goes smooth instead.
  float amp = smoothstep(2.5, 6.0, TINE * uView.x);

  float big = vnoise(w, 256.0, 3u) * 0.6 + vnoise(w, 64.0, 4u) * 0.4;
  vec3 c = mix(vec3(0.68, 0.645, 0.575), vec3(0.75, 0.715, 0.645), big);
  float grain = rnd(ivec2(floor(w / 2.0)), 5u, ivec2(int(uTile / 2.0)));
  c *= 1.0 + (grain - 0.5) * 0.08 * smoothstep(1.5, 3.0, 2.0 * uView.x);
  vec2 L = normalize(vec2(-0.6, -0.8));
  c *= 1.0 + amp * (0.2 * clamp(dot(g, L), -1.0, 1.0) + 0.05 * h0);
  // Zoomed out, a fresh raking still shows: a faint darkening where it went.
  c *= 1.0 - 0.07 * raked * (1.0 - amp);

  // Stones: each item stands in a little shadow of its own.
  for (int i = 0; i < ${MAX_STONES}; i++) {
    if (i >= uNI) break;
    float sd = rectSd(w, uItems[i]) * uView.x;
    c *= 1.0 - 0.3 * exp(-max(sd, 0.0) / 8.0);
  }
  o = vec4(c, 1.0);
}`;

export function createZen(): LivingGround {
  let stamp: WebGLProgram | null = null;
  let sandProg: WebGLProgram | null = null;
  let ku: Record<string, WebGLUniformLocation | null> = {};
  let su: Record<string, WebGLUniformLocation | null> = {};
  let vao: WebGLVertexArrayObject | null = null;
  let tex: WebGLTexture[] = [];
  let fbo: WebGLFramebuffer[] = [];
  let cur = 0;
  /** The rect the rake's memory covers, or null when nothing is raked. */
  let rakeAt: { x: number; y: number; size: number } | null = null;

  /** The garden's clock: seconds of AWAKE time (the host's envelope). */
  let clock = 0;
  let lastRake = -Infinity;
  let lastStep = 0;
  const last = new Map<string, { x: number; y: number }>();
  let pending: { segs: Float32Array; n: number } | null = null;
  let view: Field["view"] | null = null;

  const alloc = (gl: WebGL2RenderingContext) => {
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, RAKE_N, RAKE_N, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
        throw new Error("no float render target for the rake");
      }
      tex.push(t);
      fbo.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const clear = (gl: WebGL2RenderingContext) => {
    for (const f of fbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  return {
    name: "zen",
    cursor: "crescent",
    setup(gl) {
      if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("no float render targets for the rake");
      stamp = program(gl, FULLSCREEN_VS, STAMP_FS);
      sandProg = program(gl, FULLSCREEN_VS, SAND_FS);
      ku = uniforms(gl, stamp);
      su = uniforms(gl, sandProg);
      vao = gl.createVertexArray();
      tex = [];
      fbo = [];
      rakeAt = null;
      alloc(gl);
    },
    step(dt, f) {
      clock += dt * f.ease;
      const segs = new Float32Array(64);
      let n = 0;
      const seen = new Set<string>();
      for (const p of f.pointers) {
        seen.add(p.id);
        const was = last.get(p.id);
        if (was && p.at > lastStep && n < 16 && (was.x !== p.x || was.y !== p.y)) {
          segs.set([was.x, was.y, p.x, p.y], n * 4);
          n++;
        }
        last.set(p.id, { x: p.x, y: p.y });
      }
      for (const id of [...last.keys()]) if (!seen.has(id)) last.delete(id);
      lastStep = performance.now();
      if (n > 0) lastRake = clock;
      pending = { segs, n };
      // Softening is a clock, not motion: at rest exactly when the envelope is.
      return f.ease > 0.002;
    },
    draw(gl, f) {
      if (!stamp || !sandProg) return;
      view = f.view;
      gl.bindVertexArray(vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      const ns = Math.min(MAX_STONES, f.items.length / 4);

      // 1. The rake writes, when a cursor raked or the view moved under a raking.
      const n = pending?.n ?? 0;
      const segs = pending?.segs;
      pending = null;
      if (clock - lastRake >= SOFTEN_S && n === 0) rakeAt = null;
      const rect = simRect(f.view, f.width, f.height, RAKE_N);
      const moved = !!rakeAt && (rakeAt.x !== rect.x || rakeAt.y !== rect.y || rakeAt.size !== rect.size);
      if (n > 0 || moved) {
        if (!rakeAt) {
          clear(gl);
          rakeAt = rect;
        }
        const next = 1 - cur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]!);
        gl.viewport(0, 0, RAKE_N, RAKE_N);
        gl.useProgram(stamp);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex[cur]!);
        gl.uniform1i(ku.uPrev!, 0);
        gl.uniform3f(ku.uRect!, rect.x, rect.y, rect.size);
        gl.uniform3f(ku.uPrevRect!, rakeAt.x, rakeAt.y, rakeAt.size);
        gl.uniform1f(ku.uN!, RAKE_N);
        gl.uniform1f(ku.uR!, RAKE_R);
        gl.uniform1f(ku.uNow!, clock);
        gl.uniform1i(ku.uNS!, n);
        if (segs) gl.uniform4fv(ku.uSeg!, segs);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        cur = next;
        rakeAt = rect;
      }

      // 2. The sand.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(sandProg);
      gl.uniform3f(su.uView!, f.view.scale, f.view.tx, f.view.ty);
      gl.uniform2f(su.uRes!, f.width, f.height);
      gl.uniform1f(su.uTile!, TILE);
      gl.uniform1f(su.uClock!, clock);
      gl.uniform1f(su.uSoften!, SOFTEN_S);
      gl.uniform1f(su.uR!, RAKE_R);
      gl.uniform1f(su.uRakeN!, RAKE_N);
      gl.uniform1f(su.uHasRake!, rakeAt ? 1 : 0);
      if (rakeAt) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex[cur]!);
        gl.uniform1i(su.uRake!, 0);
        gl.uniform3f(su.uRakeRect!, rakeAt.x, rakeAt.y, rakeAt.size);
      }
      gl.uniform1i(su.uNI!, ns);
      if (ns > 0) gl.uniform4fv(su.uItems!, f.items.subarray(0, ns * 4));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    /** The `zen` journey's readback: how raked the sand is near a screen
     *  point — the strongest raking within `r` CSS px, 1 fresh → 0 softened —
     *  as `count`, and its age in awake seconds as `radial`. */
    readback(gl, sx, sy, r) {
      if (!rakeAt || !view || !fbo.length) return { count: 0, radial: 0 };
      const texel = rakeAt.size / RAKE_N;
      const wx = (sx - view.tx) / view.scale;
      const wy = (sy - view.ty) / view.scale;
      const rw = r / view.scale;
      const i0 = Math.max(0, Math.floor((wx - rw - rakeAt.x) / texel));
      const j0 = Math.max(0, Math.floor((wy - rw - rakeAt.y) / texel));
      const i1 = Math.min(RAKE_N, Math.ceil((wx + rw - rakeAt.x) / texel));
      const j1 = Math.min(RAKE_N, Math.ceil((wy + rw - rakeAt.y) / texel));
      if (i1 <= i0 || j1 <= j0) return { count: 0, radial: 0 };
      const px = new Float32Array((i1 - i0) * (j1 - j0) * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]!);
      gl.readPixels(i0, j0, i1 - i0, j1 - j0, gl.RGBA, gl.FLOAT, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      let top = 0;
      let age = 0;
      for (let k = 0; k < px.length; k += 4) {
        if (px[k + 1]! < 0.5) continue;
        const a = clock - (px[k + 1]! - 1);
        const s = rakeStrength(a) * rakeEdge(px[k]!);
        if (s > top) [top, age] = [s, a];
      }
      return { count: top, radial: age };
    },
    dispose(gl) {
      for (const t of tex) gl.deleteTexture(t);
      for (const f of fbo) gl.deleteFramebuffer(f);
      if (stamp) gl.deleteProgram(stamp);
      if (sandProg) gl.deleteProgram(sandProg);
      if (vao) gl.deleteVertexArray(vao);
      tex = [];
      fbo = [];
      stamp = sandProg = null;
      vao = null;
      rakeAt = null;
    },
  };
}
