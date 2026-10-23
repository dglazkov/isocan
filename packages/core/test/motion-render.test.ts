import { describe, expect, it } from "vitest";
import { MOTION_RENDER_ROUTE, motionRenderUrl } from "../src/address.ts";
import {
  MOTION_H264_CODECS,
  MOTION_RENDER_CAPS,
  motionBitrate,
  motionRenderedFrom,
  motionRenderPlan,
} from "../src/motion-render.ts";

/**
 * **What a movie of a motion is** (motion phase 1; `docs/projects/motion/design.md`
 * §4, §6) — the plan both the CLI (before it starts a browser) and the render
 * page (over the document it fetched) ask for, so the caps are one rule.
 */
describe("motionRenderPlan", () => {
  const once = { seconds: 2.4, loop: false };
  const loop = { seconds: 4, loop: true };

  it("is 60 fps, 1080 × 1080 on white, the motion's own length, when nothing is said", () => {
    expect(motionRenderPlan({}, once)).toEqual({ fps: 60, width: 1080, height: 1080, seconds: 2.4, frames: 144, background: "#ffffff" });
  });

  it("renders a loop once when no length is asked", () => {
    expect(motionRenderPlan({}, loop).seconds).toBe(4);
    expect(motionRenderPlan({}, loop).frames).toBe(240);
  });

  it("is Scene 3's movie: 6 s at 60 fps is 360 frames, past a motion's own 2.4 s", () => {
    const plan = motionRenderPlan({ fps: "60", seconds: "6", size: "1080" }, once);
    expect(plan.frames).toBe(360);
    expect([plan.width, plan.height]).toEqual([1080, 1080]);
  });

  it("takes WIDTHxHEIGHT and a #rrggbb background, lower-cased", () => {
    const plan = motionRenderPlan({ size: "1920x1080", background: "#1A2B3C" }, once);
    expect([plan.width, plan.height, plan.background]).toEqual([1920, 1080, "#1a2b3c"]);
  });

  it("refuses past each cap in words, rather than lowering it", () => {
    expect(() => motionRenderPlan({ fps: 61 }, once)).toThrow(`at most ${MOTION_RENDER_CAPS.fps} fps, not 61`);
    expect(() => motionRenderPlan({ seconds: 61 }, once)).toThrow(`at most ${MOTION_RENDER_CAPS.seconds} seconds, not 61`);
    expect(() => motionRenderPlan({ size: "1200" }, once)).toThrow("at most 1080p");
    expect(() => motionRenderPlan({ size: "2160x1080" }, once)).toThrow("at most 1080p");
  });

  it("refuses what is not a movie at all, in words", () => {
    expect(() => motionRenderPlan({ fps: "fast" }, once)).toThrow('--fps is a number, not "fast"');
    expect(() => motionRenderPlan({ fps: 29.97 }, once)).toThrow("whole number");
    expect(() => motionRenderPlan({ seconds: 0 }, once)).toThrow("more than 0");
    expect(() => motionRenderPlan({ size: "1081" }, once)).toThrow("even sides");
    expect(() => motionRenderPlan({ size: "big" }, once)).toThrow("--size is one number");
    expect(() => motionRenderPlan({ background: "white" }, once)).toThrow("#rrggbb");
  });

  it("names what it was rendered from, size as WIDTHxHEIGHT", () => {
    const plan = motionRenderPlan({ seconds: 6 }, once);
    expect(motionRenderedFrom("itm_a", "ver_b", plan)).toEqual({ item: "itm_a", version: "ver_b", fps: 60, size: "1080x1080", seconds: 6, background: "#ffffff" });
  });

  it("asks for H.264 only, and a bitrate that grows with the frame", () => {
    expect(MOTION_H264_CODECS.every((c) => c.startsWith("avc1."))).toBe(true);
    expect(motionBitrate({ width: 1080, height: 1080, fps: 60 })).toBeGreaterThan(motionBitrate({ width: 540, height: 540, fps: 30 }));
  });
});

describe("the render page's address", () => {
  it("lives under the canvas, matches its route, and leaves out what was not asked", () => {
    expect(MOTION_RENDER_ROUTE).toBe("/p/:canvasId/render/motion/:itemId");
    expect(motionRenderUrl("http://127.0.0.1:4441/", "prj_1", "itm_2")).toBe("http://127.0.0.1:4441/p/prj_1/render/motion/itm_2");
    const url = new URL(motionRenderUrl("https://isocan.io", "prj_1", "itm_2", { version: "ver_3", fps: 60, size: "1080x1080", background: "#ffffff", keep: "0,72" }));
    expect(url.pathname).toBe("/p/prj_1/render/motion/itm_2");
    expect(Object.fromEntries(url.searchParams)).toEqual({ version: "ver_3", fps: "60", size: "1080x1080", background: "#ffffff", keep: "0,72" });
  });
});
