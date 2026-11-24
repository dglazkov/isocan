/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from "vitest";
import {
  MediaControlController,
  buildVisionShareFunctionResponse,
  type MediaElementLike,
} from "../src/choreography.ts";

function fakeMediaElement(duration = 120): MediaElementLike {
  return {
    paused: true,
    currentTime: 0,
    duration,
    playbackRate: 1,
    volume: 1,
    play() {
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
  };
}

describe("MediaControlController (co-listening)", () => {
  it("controls play, pause, seek, rate, volume, and find_by_transcript ephemerally without ops", async () => {
    const controller = new MediaControlController();
    const emittedOps: unknown[] = [];
    const el = fakeMediaElement(90);

    const unregister = controller.register("acme-video-1", el, {
      title: "Acme Walkthrough",
      transcript: [
        { startSec: 5, endSec: 12, text: "Welcome to the Acme demo." },
        { startSec: 34, endSec: 45, text: "Here is the checkout flow." },
      ],
    });

    expect(controller.list()).toEqual(["acme-video-1"]);

    const played = await controller.execute({ action: "play", itemId: "acme-video-1" });
    expect(played).toMatchObject({ ok: true, action: "play", paused: false, ephemeral: true });

    const seeked = await controller.execute({ action: "seek", itemId: "acme-video-1", timeSec: 34 });
    expect(seeked).toMatchObject({ ok: true, action: "seek", currentTime: 34, ephemeral: true });

    const rated = await controller.execute({ action: "rate", itemId: "acme-video-1", rate: 1.5 });
    expect(rated).toMatchObject({ ok: true, action: "rate", playbackRate: 1.5, ephemeral: true });

    const vol = await controller.execute({ action: "volume", itemId: "acme-video-1", volume: 0.4 });
    expect(vol).toMatchObject({ ok: true, action: "volume", volume: 0.4, ephemeral: true });

    const found = await controller.execute({ action: "find_by_transcript", query: "checkout flow" });
    expect(found).toMatchObject({
      ok: true,
      action: "find_by_transcript",
      itemId: "acme-video-1",
      currentTime: 34,
      ephemeral: true,
    });
    expect(found.match?.text).toContain("checkout flow");

    const paused = await controller.execute({ action: "pause" });
    expect(paused).toMatchObject({ ok: true, action: "pause", paused: true, ephemeral: true });

    expect(emittedOps).toHaveLength(0);
    unregister();
    expect(controller.list()).toEqual([]);
  });
});

describe("Vision Share pull-only frame payload", () => {
  it("attaches downscaled frame strictly as inline functionResponse data", () => {
    const res = buildVisionShareFunctionResponse(
      { id: "call-vs-1", name: "get_screen_frame" },
      {
        mimeType: "image/jpeg",
        data: "AQIDBA==",
        width: 1024,
        height: 576,
        capturedAt: 1700000000000,
      },
    );

    expect(res.id).toBe("call-vs-1");
    expect(res.name).toBe("get_screen_frame");
    expect(res.response.ok).toBe(true);
    expect(res.response.pullOnly).toBe(true);
    expect(res.response.inlineData).toEqual({
      mimeType: "image/jpeg",
      data: "AQIDBA==",
    });
  });

  it("returns explicit unavailable payload when no frame is shared", () => {
    const res = buildVisionShareFunctionResponse({ id: "call-vs-2", name: "get_screen_frame" }, null);
    expect(res.response).toEqual({
      ok: false,
      available: false,
      reason: "no_screen_share_frame",
      pullOnly: true,
    });
  });
});
