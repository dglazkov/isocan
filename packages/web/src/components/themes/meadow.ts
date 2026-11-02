import { MAX_ITEMS } from "../../lib/groundfield.ts";
import { FULLSCREEN_VS, program, uniforms, type LivingGround } from "./livingkit.ts";

/**
 * **Meadow** — the first living ground (living grounds phase 1; journey.md
 * scene 1).
 *
 * > "the blades bend away from where it passes, then lift back up behind it
 * > over a second or so, leaving a fading trail like footsteps."
 *
 * Two draws a frame, both from `gl_VertexID` / `gl_InstanceID` with no vertex
 * buffers at all:
 *
 * 1. **The field** — a full-screen fragment pass: soil between the blades up
 *    close, and the whole meadow as a streaked green texture when you stand
 *    back, lightened where the trail has pressed it. It is what is left when
 *    the blades thin out with zoom, so the ground still parts "more broadly"
 *    at 10% (scene 1).
 * 2. **The blades** — one instance per blade on a world lattice, each a
 *    tapered strip bent in the vertex shader by the trail (away from where it
 *    is pressed, flatter the faster the cursor went), by the wind while awake,
 *    and flat under the items standing on it.
 *
 * ## The lattice repeats, on purpose
 *
 * Every random choice — where a blade stands, how tall, which way it leans —
 * is a hash of its lattice cell taken modulo `PERIOD`. That makes the field
 * repeat every `TILE` world units, which nobody can find in grass, and it is
 * what lets the still frame (`public/grounds/meadow.jpg`) be rendered from
 * THIS module and laid as a seamless world tile under reduced motion: the
 * still is the living field at rest, not a picture of something like it.
 */

/** World units between neighbouring blades at full density. */
export const SPACING = 7;
/** The lattice repeats every this many cells… */
export const PERIOD = 128;
/** …which is this many world units — the still frame's tile (`PAINTED`). */
export const TILE = SPACING * PERIOD;
/** How tall a typical blade stands, in world units. */
const BLADE = 24;
/** The most blades drawn in one frame. Past it, every other lattice row and
 *  column is skipped (and so on, in powers of two) — thinning rather than
 *  shrinking, so the blades that remain are the same blades. Phase 0's bench
 *  is where this number gets measured; this is the starting guess. */
export const MAX_BLADES = 40_000;
/** Strip segments per blade — 2 × SEGMENTS + 1 vertices. */
const SEGMENTS = 4;
/** Below this blade height on screen the blades are gone and the field
 *  texture alone is the meadow; above `FULL_PX` they are fully drawn. */
const GONE_PX = 5;
const FULL_PX = 12;

/* Shared GLSL: a hash that wraps every `period` cells, so the still tiles.
   Every caller picks a cell size that divides TILE and passes TILE / size. */
const HASH = `
uniform float uTile;
uint hash3(ivec2 c, uint salt, ivec2 period) {
  ivec2 w = ((c % period) + period) % period;
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, ivec2 period) { return float(hash3(c, salt, period) & 0xffffu) / 65535.0; }
// Value noise on a lattice of cell size s (world units, x and y apart) —
// periodic over TILE, because each s divides TILE and the hash wraps there.
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

const BLADE_VS = `#version 300 es
precision highp float;
precision highp int;
${HASH}
uniform vec3 uView;        // scale, tx, ty  (ground → CSS px)
uniform vec2 uRes;         // CSS px
uniform float uTime;
uniform float uAmbient;
uniform float uSpacing;
uniform float uBlade;
uniform ivec2 uOrigin;     // first lattice cell drawn
uniform int uCols;
uniform int uStride;
uniform sampler2D uTrail;
uniform vec3 uTrailRect;   // x, y, size
uniform float uHasTrail;
uniform vec4 uItems[${MAX_ITEMS}];
uniform int uItemCount;
uniform float uMinWidth;   // CSS px — a blade never thinner than a hair
out vec3 vColor;
out float vEdge;

float sdBox(vec2 p, vec4 r, out vec2 n) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 d = abs(p - c) - r.zw * 0.5;
  vec2 s = sign(p - c);
  if (d.x > d.y) n = vec2(s.x, 0.0); else n = vec2(0.0, s.y);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float trailAt(vec2 w) {
  vec2 uv = (w - uTrailRect.xy) / uTrailRect.z;
  if (uHasTrail < 0.5 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uTrail, uv).r;
}

void main() {
  int id = gl_InstanceID;
  ivec2 cell = uOrigin + ivec2(id % uCols, id / uCols) * uStride;
  ivec2 P = ivec2(int(uTile / uSpacing + 0.5));
  float h1 = rnd(cell, 1u, P), h2 = rnd(cell, 2u, P), h3 = rnd(cell, 3u, P), h4 = rnd(cell, 4u, P), h5 = rnd(cell, 5u, P);
  vec2 root = (vec2(cell) + vec2(h1, h2) * 0.95) * uSpacing;
  float H = uBlade * (0.55 + 0.8 * h3 * h3);

  // How pressed the grass is here, and which way is "away".
  float tex = uTrailRect.z / 256.0;
  float tv = trailAt(root);
  vec2 grad = vec2(trailAt(root + vec2(tex * 1.5, 0.0)) - trailAt(root - vec2(tex * 1.5, 0.0)),
                   trailAt(root + vec2(0.0, tex * 1.5)) - trailAt(root - vec2(0.0, tex * 1.5)));
  vec2 away = length(grad) > 1e-4 ? -normalize(grad) : normalize(vec2(h4 - 0.5, h5 - 0.5) + 1e-3);
  float press = smoothstep(0.0, 0.55, tv);

  // Items press the grass flat in their footprint, and lean it away near the edge.
  float shade = 1.0;
  float margin = H * 0.9;
  for (int i = 0; i < ${MAX_ITEMS}; i++) {
    if (i >= uItemCount) break;
    vec2 n;
    float d = sdBox(root, uItems[i], n);
    if (d < margin) {
      float f = d <= 0.0 ? 1.0 : 1.0 - d / margin;
      f = f * f;
      if (f > press) { press = f; away = n; }
      shade = min(shade, 0.55 + 0.45 * smoothstep(0.0, margin * 1.4, max(d, 0.0)));
    }
  }

  // At rest: a gentle natural lean. Awake: the wind on top of it.
  float lean = (h4 - 0.5) * 0.55 * H;
  float gust = sin(uTime * 0.7 + root.x * 0.004 - root.y * 0.002) * 0.5 + 0.5;
  float sway = uAmbient * (sin(uTime * 1.9 + root.x * 0.021 + root.y * 0.009 + h1 * 6.283) * 0.12
                           + gust * 0.16) * H;
  vec2 upright = vec2(lean + sway, -H);
  vec2 flat_ = away * H * 0.85 + vec2(0.0, -H * 0.12);
  vec2 tip = mix(upright, flat_, press * 0.94);
  vec2 ctrl = mix(vec2(lean * 0.2, -H * 0.6), flat_ * 0.45, press);

  int k = gl_VertexID;
  float t = float(k / 2) / ${SEGMENTS.toFixed(1)};
  float side = (k & 1) == 0 ? -1.0 : 1.0;
  if (k >= ${2 * SEGMENTS}) { t = 1.0; side = 0.0; }
  vec2 p = (1.0 - t) * (1.0 - t) * vec2(0.0) + 2.0 * t * (1.0 - t) * ctrl + t * t * tip;
  vec2 tan_ = 2.0 * (1.0 - t) * ctrl + 2.0 * t * (tip - ctrl);
  vec2 nrm = normalize(vec2(-tan_.y, tan_.x) + 1e-5);
  float w = max(H * 0.085 * uView.x, uMinWidth) / uView.x * pow(1.0 - t, 0.8);
  vec2 world = root + p + nrm * side * w * 0.5;

  vec2 screen = world * uView.x + uView.yz;
  gl_Position = vec4(screen / uRes * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);

  // Lusher and drier patches across the field — the same noise the field
  // pass uses, so the blades and the ground under them agree.
  float patch_ = vnoise(root, vec2(uSpacing * 32.0), 11u) * 0.6 + vnoise(root, vec2(uSpacing * 8.0), 12u) * 0.4;
  vec3 base = mix(vec3(0.055, 0.12, 0.05), vec3(0.11, 0.2, 0.07), h5);
  vec3 top = mix(vec3(0.3, 0.48, 0.15), vec3(0.55, 0.66, 0.24), h4 * h4);
  top = mix(top * vec3(0.8, 0.95, 0.8), top * vec3(1.18, 1.08, 0.82), smoothstep(0.25, 0.8, patch_));
  vec3 col = mix(base, top, pow(t, 0.75));
  // A pressed blade shows its paler side to the sky.
  col = mix(col, col * 1.25 + vec3(0.04, 0.05, 0.02), press * t);
  vColor = col * shade;
  vEdge = side;
}`;

const BLADE_FS = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vEdge;
uniform float uFade;
out vec4 o;
void main() {
  float a = uFade;
  o = vec4(vColor * (0.92 + 0.08 * (1.0 - abs(vEdge))) * a, a);
}`;

const FIELD_FS = `#version 300 es
precision highp float;
precision highp int;
${HASH}
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uSpacing;
uniform float uBladeFade;
uniform sampler2D uTrail;
uniform vec3 uTrailRect;
uniform float uHasTrail;
out vec4 o;

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  // Large soft patches: drier and lusher ground, so the field is not flat.
  float big = vnoise(w, vec2(uSpacing * 32.0), 11u) * 0.6 + vnoise(w, vec2(uSpacing * 8.0), 12u) * 0.4;
  // Fine vertical streaks: grass seen from too far to resolve a blade.
  float streak = vnoise(w, uSpacing * vec2(1.0, 4.0), 13u) * 0.6 + vnoise(w, vec2(uSpacing * 2.0), 14u) * 0.4;
  vec3 soil = mix(vec3(0.07, 0.1, 0.05), vec3(0.1, 0.14, 0.06), big);
  vec3 far = mix(vec3(0.13, 0.22, 0.08), vec3(0.24, 0.36, 0.12), big) * (0.78 + 0.34 * streak);
  vec3 col = mix(far, soil, uBladeFade);
  if (uHasTrail > 0.5) {
    vec2 uv = (w - uTrailRect.xy) / uTrailRect.z;
    if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
      float tv = texture(uTrail, uv).r;
      col = mix(col, col * 1.35 + vec3(0.05, 0.07, 0.02), tv * (1.0 - 0.6 * uBladeFade));
    }
  }
  o = vec4(col, 1.0);
}`;

/** How quickly ambient motion eases in and out, per second. */
const AMBIENT_RATE = 1.4;

export function createMeadow(): LivingGround {
  let blade: WebGLProgram | null = null;
  let field: WebGLProgram | null = null;
  let bu: Record<string, WebGLUniformLocation | null> = {};
  let fu: Record<string, WebGLUniformLocation | null> = {};
  let vao: WebGLVertexArrayObject | null = null;

  return {
    name: "meadow",
    cursor: "ladybird",
    setup(gl) {
      blade = program(gl, BLADE_VS, BLADE_FS);
      field = program(gl, FULLSCREEN_VS, FIELD_FS);
      bu = uniforms(gl, blade);
      fu = uniforms(gl, field);
      vao = gl.createVertexArray();
    },
    step(_dt, f) {
      // The grass itself holds no state between frames: everything it shows
      // is the trail (which the host fades) and the sway (which the host
      // eases). So the meadow is moving exactly while the host's envelope is
      // — `ease`, not `ambient`, which is 0 under Calm while the trail fades.
      return f.ease > 0.002;
    },
    draw(gl, f) {
      if (!blade || !field) return;
      const { view, width, height } = f;
      const bladePx = BLADE * view.scale;
      const fade = Math.min(1, Math.max(0, (bladePx - GONE_PX) / (FULL_PX - GONE_PX)));

      gl.bindVertexArray(vao);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      if (f.trail) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, f.trail);
      }

      gl.useProgram(field);
      gl.uniform1f(fu.uTile!, TILE);
      gl.uniform3f(fu.uView!, view.scale, view.tx, view.ty);
      gl.uniform2f(fu.uRes!, width, height);
      gl.uniform1f(fu.uSpacing!, SPACING);
      gl.uniform1f(fu.uBladeFade!, fade);
      gl.uniform1i(fu.uTrail!, 0);
      gl.uniform3f(fu.uTrailRect!, f.trailRect.x, f.trailRect.y, f.trailRect.size);
      gl.uniform1f(fu.uHasTrail!, f.trail ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (fade <= 0) return;
      // The lattice cells whose blades can reach the screen: a blade grows up
      // (−y) and leans sideways by up to its height, so the range reaches one
      // blade further left, right and below than the view.
      const reach = BLADE * 1.6;
      const x0 = (-view.tx) / view.scale - reach;
      const x1 = (width - view.tx) / view.scale + reach;
      const y0 = (-view.ty) / view.scale - reach * 0.3;
      const y1 = (height - view.ty) / view.scale + reach;
      let stride = 1;
      let cols = 0;
      let rows = 0;
      for (;;) {
        const cell = SPACING * stride;
        cols = Math.ceil((x1 - x0) / cell) + 1;
        rows = Math.ceil((y1 - y0) / cell) + 1;
        if (cols * rows <= MAX_BLADES || stride >= 1 << 12) break;
        stride *= 2;
      }
      const ox = Math.floor(x0 / (SPACING * stride)) * stride;
      const oy = Math.floor(y0 / (SPACING * stride)) * stride;

      gl.useProgram(blade);
      gl.uniform1f(bu.uTile!, TILE);
      gl.uniform3f(bu.uView!, view.scale, view.tx, view.ty);
      gl.uniform2f(bu.uRes!, width, height);
      gl.uniform1f(bu.uTime!, f.time);
      gl.uniform1f(bu.uAmbient!, f.ambient);
      gl.uniform1f(bu.uSpacing!, SPACING);
      gl.uniform1f(bu.uBlade!, BLADE);
      gl.uniform2i(bu.uOrigin!, ox, oy);
      gl.uniform1i(bu.uCols!, cols);
      gl.uniform1i(bu.uStride!, stride);
      gl.uniform1i(bu.uTrail!, 0);
      gl.uniform3f(bu.uTrailRect!, f.trailRect.x, f.trailRect.y, f.trailRect.size);
      gl.uniform1f(bu.uHasTrail!, f.trail ? 1 : 0);
      gl.uniform1f(bu.uMinWidth!, 0.9);
      gl.uniform1f(bu.uFade!, fade);
      const n = f.items.length / 4;
      gl.uniform1i(bu.uItemCount!, n);
      if (n > 0) gl.uniform4fv(bu.uItems!, f.items);
      if (fade < 1) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * SEGMENTS + 1, cols * rows);
      gl.disable(gl.BLEND);
    },
    dispose(gl) {
      if (blade) gl.deleteProgram(blade);
      if (field) gl.deleteProgram(field);
      if (vao) gl.deleteVertexArray(vao);
      blade = field = null;
      vao = null;
    },
  };
}

/** The rate the host eases ambient motion at — exported for the host, which
 *  owns the easing because it owns awake and settling. */
export const MEADOW_AMBIENT_RATE = AMBIENT_RATE;
