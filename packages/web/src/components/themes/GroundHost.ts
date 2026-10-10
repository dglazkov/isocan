import { ASLEEP, advance, touch, type GroundState, type Sleep } from "../../lib/groundsleep.ts";
import { PointerField, TRAIL_SIZE, trailRect } from "../../lib/groundfield.ts";
import { groundMode } from "../../lib/groundmode.ts";
import type { Viewport } from "../../lib/viewport.ts";
import { FULLSCREEN_VS, program, uniforms, type Field, type LivingGround } from "./livingkit.ts";

/**
 * **The host a living ground runs in** (living grounds phase 1, design.md §1).
 *
 * One `<canvas>` behind `.world`, one WebGL2 context, one frame loop — and the
 * loop is the only thing in here that ever schedules work. It runs only while
 * the sleep policy (`lib/groundsleep.ts`) says the ground is awake or
 * settling; asleep, there is no `requestAnimationFrame` and no timer, and the
 * canvas holds its last frame.
 *
 * Plain TypeScript rather than a component, on purpose: pan and zoom reach it
 * as `setView` — a uniform write and a wake — never as a React render. The
 * CSS grounds re-render on every viewport change, and theme.ts has warned
 * about that cost since #195; this is the ground that does not pay it.
 *
 * It owns the input field's shared half too — the pointers and the trail
 * texture every ground may read — so a ground module is only its own shaders.
 */

/** How fast a stamp fades, in trail units (0..1) per second. A full-strength
 *  press is gone in about 1.4 s — scene 1's "lift back up over a second or
 *  so", longer for a fast drag because a fast drag stamps harder. */
const TRAIL_DECAY = 0.7;
/** How long after the last stamp the trail can still hold anything. */
const TRAIL_LIFE_MS = 1000 / TRAIL_DECAY + 100;
/** The stamp's radius in SCREEN pixels: the cursor parts the same patch of
 *  grass whatever the zoom, so it parts "more broadly" zoomed out (scene 1). */
const STAMP_PX = 40;

const TRAIL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uDecay;
uniform int uCount;
uniform vec4 uSeg[16];
uniform vec2 uStamp[16];
out vec4 o;
void main() {
  vec2 w = uRect.xy + vUv * uRect.z;
  vec2 puv = (w - uPrevRect.xy) / uPrevRect.z;
  float v = 0.0;
  if (all(greaterThanEqual(puv, vec2(0.0))) && all(lessThanEqual(puv, vec2(1.0)))) v = texture(uPrev, puv).r;
  v = max(v - uDecay, 0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uCount) break;
    vec2 a = uSeg[i].xy, b = uSeg[i].zw;
    vec2 pa = w - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * h);
    float r = uStamp[i].x;
    v = max(v, uStamp[i].y * (1.0 - smoothstep(r * 0.3, r, d)));
  }
  o = vec4(v, 0.0, 0.0, 1.0);
}`;

export interface HostOptions {
  /** Called once the ground cannot be drawn live any more — no WebGL2, a
   *  program that will not compile, or a context lost `MAX_LOSSES` times. */
  onStill: (why: string) => void;
}

export class GroundHost {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private ground: LivingGround;
  private opts: HostOptions;
  private raf = 0;
  private sleep: Sleep = ASLEEP;
  private last = 0;
  private start = performance.now();
  private ambient = 0;
  private view: Viewport = { scale: 1, tx: 0, ty: 0 };
  private items: Float32Array = new Float32Array(0);
  private itemIds: readonly string[] = [];
  readonly field = new PointerField();
  private lastStamp = -Infinity;
  private lastFrame = 0;
  private losses = 0;
  private dead = false;
  /** Is this viewer's pointer resting over the ground (the eddy window)? */
  private resting = false;
  /** Frames drawn since mount — read by the `meadow` journey to prove the
   *  loop ran while awake and stopped while asleep. */
  frames = 0;

  // The trail: two textures, read one and write the other each frame.
  private trailTex: WebGLTexture[] = [];
  private trailFbo: WebGLFramebuffer[] = [];
  private trailRead = 0;
  private trailAt = { x: 0, y: 0, size: 1 };
  private trailEver = false;
  private trailProg: WebGLProgram | null = null;
  private tu: Record<string, WebGLUniformLocation | null> = {};
  private vao: WebGLVertexArrayObject | null = null;

  constructor(canvas: HTMLCanvasElement, ground: LivingGround, opts: HostOptions) {
    this.canvas = canvas;
    this.ground = ground;
    this.opts = opts;
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.setState("asleep");
    if (this.build()) this.wake();
  }

  /** The ground-space → screen transform. A uniform and a wake, nothing else. */
  setView(view: Viewport): void {
    const v = this.view;
    if (v.scale === view.scale && v.tx === view.tx && v.ty === view.ty) return;
    this.view = view;
    this.wake();
  }

  get currentView(): Viewport {
    return this.view;
  }

  /** The items standing on the ground, packed x, y, w, h in ground space,
   *  and (optionally) the id under each rect, in the same order. */
  setItems(items: Float32Array, ids?: readonly string[]): void {
    if (ids) this.itemIds = ids;
    const a = this.items;
    if (a.length === items.length && a.every((v, i) => v === items[i])) return;
    this.items = items;
    this.wake();
  }

  /** This viewer's pointer moved (`id` "self"). */
  pointer(id: string, x: number, y: number, screenDist: number, held: boolean): void {
    this.field.setPointer(id, x, y, screenDist, held, performance.now());
    this.wake();
  }

  /**
   * A presence cursor moved — somebody else's, a person's or an agent's, at
   * the ground-space point CursorLayer has eased it to. It wakes a sleeping
   * ground exactly as this viewer's own pointer does (design.md §4's
   * "presence cursor moved"), and when it stops the ground settles the same
   * way. A hidden tab stays asleep: `wake` will not start the loop there.
   */
  presence(id: string, x: number, y: number, agent: boolean): void {
    this.field.setPresence(id, x, y, this.view.scale, agent, performance.now());
    this.wake();
  }

  /**
   * This viewer's pointer is (or stops being) at rest over the ground, having
   * moved there. Only a ground that declares a `restWindow` cares; leaving
   * counts as an input, so a ground mid-eddy gets its ordinary settle rather
   * than freezing on the spot.
   */
  rest(on: boolean): void {
    if (on === this.resting) return;
    this.resting = on;
    if (!on && this.sleep.state !== "asleep" && this.ground.restWindow) this.wake();
  }

  get isResting(): boolean {
    return this.resting;
  }

  /** The ground's own readback near a screen point, for a journey. */
  readback(sx: number, sy: number, r: number): { count: number; radial: number } | null {
    const gl = this.gl;
    if (!gl || !this.ground.readback) return null;
    return this.ground.readback(gl, sx, sy, r);
  }

  /** A presence cursor is gone from the canvas. Nothing to draw, so no wake. */
  forget(id: string): void {
    this.field.removePointer(id);
  }

  /** The canvas changed size: re-fit the drawing buffer and draw again. */
  resize(): void {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.wake();
  }

  /** Something touched the ground — start the loop if it was asleep. */
  wake(): void {
    if (this.dead || !this.gl || document.hidden) return;
    this.sleep = touch(this.sleep, performance.now());
    this.setState("awake");
    if (this.raf === 0) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  /**
   * How pressed the trail is at a ground-space point, 0..1 — read back from
   * the GPU. For the `meadow` journey ("the trail texture shows a stamp at
   * that world point"); nothing in the app calls it.
   */
  trailValue(x: number, y: number): number {
    const gl = this.gl;
    if (!gl || !this.trailEver) return 0;
    const r = this.trailAt;
    const u = Math.floor(((x - r.x) / r.size) * TRAIL_SIZE);
    const v = Math.floor(((y - r.y) / r.size) * TRAIL_SIZE);
    if (u < 0 || v < 0 || u >= TRAIL_SIZE || v >= TRAIL_SIZE) return 0;
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbo[this.trailRead]!);
    gl.readPixels(u, v, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px[0]! / 255;
  }

  dispose(): void {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      this.ground.dispose(gl);
      this.freeTrail(gl);
    }
    this.gl = null;
  }

  // ---- internals ---------------------------------------------------------

  private setState(state: GroundState): void {
    if (this.canvas.dataset.groundState !== state) this.canvas.dataset.groundState = state;
  }

  /** Get a context and compile everything. False, and the still frame, if
   *  any of it fails. */
  private build(): boolean {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = this.canvas.getContext("webgl2", {
        alpha: false,
        antialias: (window.devicePixelRatio || 1) < 2,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      this.fail("no WebGL2");
      return false;
    }
    this.gl = gl;
    try {
      this.ground.setup(gl);
      this.trailProg = program(gl, FULLSCREEN_VS, TRAIL_FS);
      this.tu = uniforms(gl, this.trailProg);
      this.vao = gl.createVertexArray();
      this.makeTrail(gl);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err));
      return false;
    }
    this.resize();
    return true;
  }

  private fail(why: string): void {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.setState("asleep");
    this.canvas.dataset.groundStill = why;
    this.opts.onStill(why);
  }

  private makeTrail(gl: WebGL2RenderingContext): void {
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TRAIL_SIZE, TRAIL_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.trailTex.push(tex);
      this.trailFbo.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private freeTrail(gl: WebGL2RenderingContext): void {
    for (const t of this.trailTex) gl.deleteTexture(t);
    for (const f of this.trailFbo) gl.deleteFramebuffer(f);
    if (this.trailProg) gl.deleteProgram(this.trailProg);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.trailTex = [];
    this.trailFbo = [];
    this.trailProg = null;
    this.vao = null;
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const gl = this.gl;
    if (this.dead || !gl || gl.isContextLost()) return;
    // A long gap is a wake from sleep, not a frame that took a second.
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 0.1);
    this.last = now;

    const awake = this.sleep.state === "awake";
    this.ambient = Math.max(0, Math.min(1, this.ambient + (awake ? 1 : -1) * dt * 1.4));
    const css = { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
    const trailLive = now - this.lastStamp < TRAIL_LIFE_MS;

    this.stampTrail(gl, dt, css.w, css.h, now);
    const field: Field = {
      time: (now - this.start) / 1000,
      view: this.view,
      width: css.w,
      height: css.h,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      ambient: this.ambient,
      pointers: [...this.field.pointers.values()],
      items: this.items,
      itemIds: this.itemIds,
      trail: this.trailEver ? this.trailTex[this.trailRead]! : null,
      trailRect: this.trailAt,
    };
    const moving = this.ground.step(dt, field) || trailLive;
    const rest = this.ground.restWindow ? { window: this.ground.restWindow, resting: this.resting } : undefined;
    const next = advance(this.sleep, now, moving, document.hidden, rest);
    this.sleep = next.sleep;
    if (next.draw) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.ground.draw(gl, field);
      this.frames++;
    }
    this.setState(next.sleep.state);
    if (next.again) this.raf = requestAnimationFrame(this.frame);
  };

  /**
   * One pass of the trail: copy the history into this frame's rect (whole
   * texels when only panning), fade it by `dt`, and stamp a capsule for each
   * pointer that moved since the last frame. Skipped entirely — no draw, no
   * texture swap — when nothing has been stamped for longer than a stamp lives
   * and the rect has not moved, which is every frame of a settled canvas.
   */
  private stampTrail(gl: WebGL2RenderingContext, dt: number, w: number, h: number, now: number): void {
    const rect = trailRect(this.view, w, h);
    const moved = this.field.moving(this.lastFrame);
    this.lastFrame = now;
    const live = now - this.lastStamp < TRAIL_LIFE_MS;
    // A dead trail is all zeros, so there is nothing to carry to a new rect.
    if (moved.length === 0 && !live) {
      this.trailAt = rect;
      return;
    }
    const prev = this.trailAt;
    const seg = new Float32Array(64);
    const stamp = new Float32Array(32);
    const n = Math.min(moved.length, 16);
    for (let i = 0; i < n; i++) {
      const p = moved[i]!;
      seg.set([p.px, p.py, p.x, p.y], i * 4);
      // Faster is flatter: a slow drift bends the grass, a flick lays it down.
      // An agent presses with its weight (`AGENT_WEIGHT`, 1 today).
      stamp.set([STAMP_PX / this.view.scale, Math.min(1, 0.6 + p.speed / 1500) * p.weight], i * 2);
    }
    if (n > 0) {
      this.lastStamp = now;
      this.trailEver = true;
    }
    if (!this.trailEver) {
      this.trailAt = rect;
      return;
    }
    const write = 1 - this.trailRead;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbo[write]!);
    gl.viewport(0, 0, TRAIL_SIZE, TRAIL_SIZE);
    gl.disable(gl.BLEND);
    gl.useProgram(this.trailProg);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTex[this.trailRead]!);
    gl.uniform1i(this.tu.uPrev!, 0);
    gl.uniform3f(this.tu.uRect!, rect.x, rect.y, rect.size);
    gl.uniform3f(this.tu.uPrevRect!, prev.x, prev.y, prev.size);
    gl.uniform1f(this.tu.uDecay!, dt * TRAIL_DECAY);
    gl.uniform1i(this.tu.uCount!, n);
    gl.uniform4fv(this.tu.uSeg!, seg);
    gl.uniform2fv(this.tu.uStamp!, stamp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.trailRead = write;
    this.trailAt = rect;
    this.field.settle();
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.losses++;
    this.trailTex = [];
    this.trailFbo = [];
    this.trailEver = false;
    if (groundMode({ reducedMotion: false, webgl2: true, compiled: true, losses: this.losses }) === "still") {
      this.fail(`context lost ${this.losses} times`);
    }
  };

  private onRestored = (): void => {
    if (this.dead || !this.gl) return;
    try {
      this.ground.setup(this.gl);
      this.trailProg = program(this.gl, FULLSCREEN_VS, TRAIL_FS);
      this.tu = uniforms(this.gl, this.trailProg);
      this.vao = this.gl.createVertexArray();
      this.makeTrail(this.gl);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err));
      return;
    }
    this.wake();
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      // Hidden is asleep, always — and at once, not at the next frame the
      // browser was going to throttle anyway.
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.sleep = { ...this.sleep, state: "asleep" };
      this.setState("asleep");
    }
  };
}
