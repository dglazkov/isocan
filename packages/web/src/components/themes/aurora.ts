import { MAX_POINTERS } from "../../lib/groundfield.ts";
import { glowWrite } from "../../lib/fireflies.ts";
import { LEAN_SIGMA, easeEnergy, itemLight, leanAt, type Lean } from "../../lib/auroralight.ts";
import { FULLSCREEN_VS, program, uniforms, type LivingGround } from "./livingkit.ts";
import "./aurora.css";

/**
 * **Aurora** — a living ground (living grounds phase 4; design.md's proposed
 * grounds).
 *
 * > "ribbons of light over a dark landscape that lean toward the cursor"
 *
 * One full-screen pass. The sky and the far ridge are screen space, like
 * Night's (they are far away, so a pan barely moves them), and the land below
 * the ridge is ground space, faintly lit by the sky. The ribbons are three
 * curtains of light: each a bright lower edge that wanders along a layered
 * noise line, rays rising off it and fading up through green into violet.
 *
 * Every pointer carries an energy (`lib/auroralight.ts`) that rises while it
 * moves and ebbs within about two seconds of it stopping. Over a pointer's
 * column the curtains lean toward it — their lower edge pulled toward its
 * height, their folds drawn in toward its x — and brighten. That is a cursor
 * reaction, so it runs under Calm too; only the ribbons' own slow drift and
 * shimmer is ambient (it advances by `dt × ambient`), so a Calm or settled
 * aurora holds still until somebody moves.
 *
 * ## Items catch a faint cool light, cheaply
 *
 * Night's pattern with a cooler colour: an item under a lit column gets
 * `--aurora-glow` on its element (`aurora.css` makes it a cool shadow in
 * `--aurora-light`), written only when it moves by more than `GLOW_STEP`, and
 * removed once the light has gone — so a settled aurora has written nothing.
 */

/** Where the far ridge meets the sky, as a share of the screen's height. */
export const HORIZON = 0.62;
/** Items the land rims with cool light (the largest on screen). */
const MAX_RIMS = 16;

const FS = `#version 300 es
precision highp float; precision highp int;
in vec2 vUv;
out vec4 o;
uniform vec3 uView; uniform vec2 uRes; uniform float uTime, uHorizon;
uniform vec4 uPtr[${MAX_POINTERS}]; uniform int uNP;   // screen x, y, energy, -
uniform vec4 uItems[${MAX_RIMS}]; uniform int uNI; uniform float uGlow[${MAX_RIMS}];
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash(ivec2 c, uint salt){ uint x = uint(c.x + 1073741824); uint y = uint(c.y + 1073741824);
  return float(pcg(x * 1973u + pcg(y * 9277u + salt))) * (1.0 / 4294967296.0); }
float vnoise(vec2 p, uint salt){ vec2 i = floor(p), f = fract(p); ivec2 c = ivec2(i);
  float a = hash(c, salt), b = hash(c + ivec2(1,0), salt), d = hash(c + ivec2(0,1), salt), e = hash(c + ivec2(1,1), salt);
  vec2 u = f * f * (3. - 2. * f); return mix(mix(a, b, u.x), mix(d, e, u.x), u.y); }
float fbm(vec2 p, uint salt){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += a * vnoise(p, salt); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
float rectSd(vec2 p, vec4 r){ vec2 c = r.xy + r.zw * .5; vec2 d = abs(p - c) - r.zw * .5; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }

// One curtain: its glow at screen point s, and how lit its column is.
vec3 curtain(vec2 s, float k, float base, float tall, vec3 lo, vec3 hi) {
  float x = s.x, pull = 0., lean = 0.;
  for (int i = 0; i < ${MAX_POINTERS}; i++) { if (i >= uNP) break;
    float dx = uPtr[i].x - s.x;
    float g = uPtr[i].z * exp(-dx * dx / ${(2 * LEAN_SIGMA * LEAN_SIGMA).toFixed(1)});
    lean += g;
    x += dx * g * .3;                                   // the folds draw in toward it
    pull += g * clamp(uPtr[i].y - base, -220., 220.) * .45;   // the edge reaches toward it
  }
  float t = uTime * (.035 + .012 * k);
  float edge = base + pull + (fbm(vec2(x * .0021 + k * 3.7 + t, k * 1.3 + t * .4), 3u + uint(k)) - .5) * 190.;
  float d = edge - s.y;                                 // > 0 above the lower edge
  float rays = pow(vnoise(vec2(x * .09 + k * 11., t * 3.), 9u + uint(k)), 1.6) * .85 + .15 * vnoise(vec2(x * .02 - t, k), 13u);
  float patch_ = smoothstep(.2, .75, fbm(vec2(x * .0013 + k * 5.1 - t * .5, k * 2.), 17u + uint(k)));
  float body = smoothstep(-14., 10., d) * exp(-max(d, 0.) / tall) * (1. + 1.4 * exp(-max(d, 0.) / 22.));
  float fringe = exp(-abs(d + 1.) / 5.);                // the bright hem
  vec3 c = mix(lo, hi, smoothstep(0., tall * 1.6, d));
  float bright = (body * (.2 + 1.1 * rays) + fringe * (.15 + .3 * rays)) * (.2 + .8 * patch_) * (1. + 1.3 * min(lean, 1.5));
  return c * bright;
}

void main(){
  vec2 scr = vec2(vUv.x, 1. - vUv.y) * uRes;
  float hz = uHorizon;
  // The night sky, a little lighter low down, with stars.
  vec3 c = mix(vec3(.006, .012, .03), vec3(.02, .04, .06), smoothstep(0., hz, scr.y));
  ivec2 sk = ivec2(floor(scr / 3.));
  c += vec3(.75, .8, .95) * step(.9978, hash(sk + ivec2(int(uView.y * .02), 0), 70u)) * .4 * (1. - smoothstep(0., hz, scr.y) * .7);
  // The ribbons.
  vec3 sky = vec3(0.);
  sky += curtain(scr, 0., uRes.y * .27, 160., vec3(.12, .95, .48), vec3(.42, .2, .78)) * .6;
  sky += curtain(scr, 1., uRes.y * .40, 110., vec3(.1, .85, .6), vec3(.2, .35, .85)) * .3;
  sky += curtain(scr, 2., uRes.y * .13, 130., vec3(.25, .9, .4), vec3(.6, .2, .6)) * .25;
  // The airglow low over the ridge, so the land stands dark against it.
  c += vec3(.02, .075, .06) * exp(-max(hz - scr.y, 0.) / (uRes.y * .12));
  float ridge = hz - 26. * fbm(vec2((scr.x - uView.y * .1) * .004, 0.), 21u) - 10. * vnoise(vec2((scr.x - uView.y * .2) * .03, 2.), 22u);
  if (scr.y < ridge) {
    c += sky;
  } else {
    // The land, in ground space: dark, with the sky's colour lying on it,
    // strongest just under the ridge and on the open ground.
    vec2 w = (scr - uView.yz) / uView.x;
    c = mix(vec3(.012, .02, .028), vec3(.03, .045, .055), fbm(w * .008, 31u));
    float fall = exp(-(scr.y - ridge) / (uRes.y * .25));
    vec3 glow = curtain(vec2(scr.x, hz - 60.), 0., uRes.y * .30, 120., vec3(.12, .95, .48), vec3(.42, .2, .78));
    c += glow * (.05 + .1 * fall);
  }
  // Items stand in the cool light: a faint rim round any the ribbons light.
  for (int i = 0; i < ${MAX_RIMS}; i++) { if (i >= uNI) break;
    vec4 r = vec4(uItems[i].xy * uView.x + uView.yz, uItems[i].zw * uView.x);
    float sd = rectSd(scr, r);
    c += vec3(.35, .95, .75) * uGlow[i] * .4 * exp(-max(sd, 0.) / 16.) * step(0., sd);
    c *= 1. - .3 * exp(-max(sd, 0.) / 10.) * (1. - uGlow[i]); }
  o = vec4(c, 1.);
}`;

/** Write (or clear) one item's cool light — the only DOM this ground touches. */
export type LightWriter = (itemId: string, glow: number) => void;

const domLight: LightWriter = (id, glow) => {
  const el = document.querySelector<HTMLElement>(`.item[data-item-id="${CSS.escape(id)}"]`);
  if (!el) return;
  if (glow > 0) el.style.setProperty("--aurora-glow", glow.toFixed(2));
  else el.style.removeProperty("--aurora-glow");
};

/** Aurora can say how far its ribbons lean over a screen column — read by
 *  the `aurora` journey through the canvas's probe. */
export type AuroraGround = LivingGround & { lean(sx: number): number };

export function createAurora(writeLight: LightWriter = domLight): AuroraGround {
  let prog: WebGLProgram | null = null;
  let u: Record<string, WebGLUniformLocation | null> = {};
  let vao: WebGLVertexArrayObject | null = null;

  let clock = 0;
  const energy = new Map<string, number>();
  let leans: Lean[] = [];
  const ptrs = new Float32Array(MAX_POINTERS * 4);
  let nPtrs = 0;
  const rimGlow = new Float32Array(MAX_RIMS);
  const written = new Map<string, number>();

  return {
    name: "aurora",
    cursor: "crescent",
    lean: (sx) => leanAt(sx, leans),
    setup(gl) {
      prog = program(gl, FULLSCREEN_VS, FS);
      u = uniforms(gl, prog);
      vao = gl.createVertexArray();
    },
    step(dt, f) {
      const { scale, tx, ty } = f.view;
      const now = performance.now();
      clock += dt * f.ambient;

      // Every pointer's energy: up while it moves, ebbing once it stops.
      const seen = new Set<string>();
      leans = [];
      nPtrs = 0;
      ptrs.fill(0);
      for (const p of f.pointers) {
        seen.add(p.id);
        const e = easeEnergy(energy.get(p.id) ?? 0, now - p.at < 250, p.weight, dt);
        if (e === 0) {
          energy.delete(p.id);
          continue;
        }
        energy.set(p.id, e);
        const sx = p.x * scale + tx;
        const sy = p.y * scale + ty;
        leans.push({ x: sx, e });
        if (nPtrs < MAX_POINTERS) ptrs.set([sx, sy, e, 0], 4 * nPtrs++);
      }
      for (const id of [...energy.keys()]) if (!seen.has(id)) energy.delete(id);

      // Items catch the light under a lit column — written only on change.
      const n = f.items.length / 4;
      const ids = f.itemIds ?? [];
      rimGlow.fill(0);
      const touched = new Set<string>();
      for (let k = 0; k < n; k++) {
        const g = leans.length > 0 ? itemLight(f.items[k * 4]! * scale + tx, f.items[k * 4 + 2]! * scale, leans) : 0;
        if (k < MAX_RIMS) rimGlow[k] = g;
        const id = ids[k];
        if (!id) continue;
        touched.add(id);
        const out = glowWrite(written.get(id) ?? 0, g);
        if (out === null) continue;
        writeLight(id, out);
        if (out === 0) written.delete(id);
        else written.set(id, out);
      }
      for (const id of [...written.keys()]) {
        if (touched.has(id)) continue;
        writeLight(id, 0);
        written.delete(id);
      }
      return f.ambient > 0.002 || energy.size > 0;
    },
    draw(gl, f) {
      if (!prog) return;
      const { view, width, height } = f;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(vao);
      gl.useProgram(prog);
      gl.uniform3f(u.uView!, view.scale, view.tx, view.ty);
      gl.uniform2f(u.uRes!, width, height);
      gl.uniform1f(u.uTime!, clock);
      gl.uniform1f(u.uHorizon!, Math.round(height * HORIZON));
      gl.uniform1i(u.uNP!, nPtrs);
      gl.uniform4fv(u.uPtr!, ptrs);
      const nItems = Math.min(f.items.length / 4, MAX_RIMS);
      gl.uniform1i(u.uNI!, nItems);
      if (nItems > 0) {
        gl.uniform4fv(u.uItems!, f.items.subarray(0, nItems * 4));
        gl.uniform1fv(u.uGlow!, rimGlow.subarray(0, nItems));
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    dispose(gl) {
      for (const id of written.keys()) writeLight(id, 0);
      written.clear();
      if (prog) gl.deleteProgram(prog);
      if (vao) gl.deleteVertexArray(vao);
      prog = null;
      vao = null;
      energy.clear();
      leans = [];
    },
  };
}
