import type { CanvasCursor, CanvasTheme } from "@isocan/core";
import type { Pointer } from "../../lib/groundfield.ts";
import type { Viewport } from "../../lib/viewport.ts";

/**
 * **What a living ground is, to the host that runs it** (design.md §3).
 *
 * A ground is a small module: it compiles its programs once, advances its own
 * motion each frame and says whether anything it owns is still moving, and
 * draws. The host owns everything shared — the canvas, the frame loop, the
 * sleep policy, the input field and its trail texture — so a second ground is
 * shaders and a step function, not a second copy of the machinery.
 *
 * Kept free of React and of the host so that the still frame can be rendered
 * from the same module headlessly (`scripts/ground-still.mjs`), which is what
 * makes the still and the living field the same picture.
 */
export interface Field {
  /** Seconds since the ground mounted — the clock ambient motion reads. */
  time: number;
  /** The ground-space → screen transform, in CSS pixels. */
  view: Viewport;
  /** The drawing buffer's size in CSS pixels, and how many device pixels
   *  each one is (≤ 2). */
  width: number;
  height: number;
  dpr: number;
  /** 0 → 1: how much ambient motion (sway) to draw. Eases in while awake and
   *  out while settling, so a ground asleep is a ground at rest. */
  ambient: number;
  /** Every pointer touching the ground, in ground space. */
  pointers: readonly Pointer[];
  /** Item rectangles in ground space, packed x, y, w, h. */
  items: Float32Array;
  /** The id of the item under each rect in `items`, in the same order — for a
   *  ground that answers back to the items themselves (Night's glow). */
  itemIds?: readonly string[];
  /** The trail texture (R = how pressed, 0..1) and the ground rect it covers;
   *  `null` when nothing has ever been stamped (and in the still). */
  trail: WebGLTexture | null;
  trailRect: { x: number; y: number; size: number };
}

export interface LivingGround {
  name: CanvasTheme;
  cursor: CanvasCursor;
  /** Compile and allocate. Throws when a program will not compile or link —
   *  the host takes that as "draw the still frame instead". */
  setup(gl: WebGL2RenderingContext): void;
  /** Advance by `dt` seconds; `false` means nothing this ground owns is
   *  moving any more, which is what lets the host sleep. */
  step(dt: number, field: Field): boolean;
  draw(gl: WebGL2RenderingContext, field: Field): void;
  dispose(gl: WebGL2RenderingContext): void;
  /** How long, in ms, this viewer's pointer RESTING over the ground keeps it
   *  awake after its last move (the sleep policy's `Rest`). Orbit's eddy
   *  window; absent means a still pointer is not an input (Meadow). */
  restWindow?: number;
  /** A journey's readback of what the ground holds near a screen point (CSS
   *  px, relative to the canvas) — Orbit's stars within `r`: how many, and
   *  their mean radial speed (px/s, + = away from the point). Nothing in the
   *  app calls it. */
  readback?(gl: WebGL2RenderingContext, sx: number, sy: number, r: number): { count: number; radial: number } | null;
}

/** Compile and link one program, or throw with the driver's own words. */
export function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error("could not create a shader");
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`shader did not compile: ${log}`);
    }
    return s;
  };
  const v = shader(gl.VERTEX_SHADER, vs);
  const f = shader(gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram();
  if (!p) throw new Error("could not create a program");
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`program did not link: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

/** Every uniform location in a program, by name — looked up once at setup,
 *  not once a frame. */
export function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    out[name] = gl.getUniformLocation(p, info.name);
  }
  return out;
}

/** A triangle covering the screen, from `gl_VertexID` alone — no buffers. */
export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
