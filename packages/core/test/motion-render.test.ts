import { describe, expect, it } from "vitest";
import { MOTION_RENDER_ROUTE, motionRenderUrl } from "../src/address.ts";
import {
  isMotionFormat,
  MOTION_FORMAT_FACTS,
  MOTION_FORMATS,
  MOTION_GIF,
  MOTION_H264_CODECS,
  MOTION_RENDER_CAPS,
  MOTION_VP9_CODECS,
  motionBitrate,
  motionGifEstimate,
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
    expect(motionRenderPlan({}, once)).toEqual({ format: "mp4", fps: 60, width: 1080, height: 1080, seconds: 2.4, frames: 144, background: "#ffffff" });
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
    expect(motionRenderedFrom("itm_a", "ver_b", plan)).toEqual({ item: "itm_a", version: "ver_b", fps: 60, size: "1080x1080", seconds: 6, background: "#ffffff", format: "mp4" });
    expect(motionRenderedFrom("itm_a", "ver_b", motionRenderPlan({ format: "gif" }, once)).format).toBe("gif");
  });

  it("asks for H.264 only, and a bitrate that grows with the frame", () => {
    expect(MOTION_H264_CODECS.every((c) => c.startsWith("avc1."))).toBe(true);
    expect(motionBitrate({ width: 1080, height: 1080, fps: 60 })).toBeGreaterThan(motionBitrate({ width: 540, height: 540, fps: 30 }));
  });
});

/** Motion phase 3: the same frames into a WebM or a GIF. */
describe("the formats", () => {
  const once = { seconds: 2.4, loop: false };

  it("are an MP4, a WebM and a GIF, each with its file's type", () => {
    expect([...MOTION_FORMATS]).toEqual(["mp4", "webm", "gif"]);
    expect(MOTION_FORMATS.map((f) => MOTION_FORMAT_FACTS[f].mimeType)).toEqual(["video/mp4", "video/webm", "image/gif"]);
    expect(isMotionFormat("webm")).toBe(true);
    expect(isMotionFormat("mov")).toBe(false);
    expect(() => motionRenderPlan({ format: "mov" }, once)).toThrow('a movie is mp4, webm, gif, not "mov"');
  });

  it("asks for VP9 only for a WebM", () => {
    expect(MOTION_VP9_CODECS.every((c) => c.startsWith("vp09."))).toBe(true);
    expect(motionRenderPlan({ format: "WebM" }, once)).toMatchObject({ format: "webm", fps: 60, frames: 144 });
  });

  it("makes a GIF at 30 fps unless asked, and refuses one past 50 in words", () => {
    expect(motionRenderPlan({ format: "gif" }, once)).toMatchObject({ format: "gif", fps: MOTION_GIF.fps, frames: 72 });
    expect(motionRenderPlan({ format: "gif", fps: 50 }, once).fps).toBe(50);
    expect(() => motionRenderPlan({ format: "gif", fps: 60 }, once)).toThrow("a GIF is at most 50 fps, not 60");
  });

  it("refuses a GIF its estimate says would pass the cap, before a frame is drawn — and not a movie of the same", () => {
    const long = { seconds: 60, loop: false };
    const plan = motionRenderPlan({ format: "gif", size: "720" }, { seconds: 2.4, loop: false });
    expect(motionGifEstimate(plan)).toBe(Math.round(720 * 720 * 72 * MOTION_GIF.bytesPerPixel));
    expect(() => motionRenderPlan({ format: "gif" }, long)).toThrow(/a GIF of 1800 frames at 1080x1080 would be about [\d.]+ MB, past a GIF's 64 MB/);
    expect(motionRenderPlan({ format: "webm" }, long).frames).toBe(3600);
  });
});

describe("the render page's address", () => {
  it("lives under the canvas, matches its route, and leaves out what was not asked", () => {
    expect(MOTION_RENDER_ROUTE).toBe("/p/:canvasId/render/motion/:itemId");
    expect(motionRenderUrl("http://127.0.0.1:4441/", "prj_1", "itm_2")).toBe("http://127.0.0.1:4441/p/prj_1/render/motion/itm_2");
    const url = new URL(motionRenderUrl("https://isocan.io", "prj_1", "itm_2", { format: "webm", version: "ver_3", fps: 60, size: "1080x1080", background: "#ffffff", keep: "0,72" }));
    expect(url.pathname).toBe("/p/prj_1/render/motion/itm_2");
    expect(Object.fromEntries(url.searchParams)).toEqual({ format: "webm", version: "ver_3", fps: "60", size: "1080x1080", background: "#ffffff", keep: "0,72" });
  });
});
