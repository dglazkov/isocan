import { describe, expect, it } from "vitest";
import { STICKER_MIME } from "../src/core.ts";
import { stickersWeb } from "../src/web.tsx";

describe("stickers web module", () => {
  it("claims the sticker mime in renderers", () => {
    expect(stickersWeb.renderers?.map((r) => r.mimes)).toEqual([[STICKER_MIME]]);
  });

  it("provides an overlay for the sticker tray", () => {
    expect(stickersWeb.overlays).toHaveLength(1);
    expect(typeof stickersWeb.overlays![0]).toBe("function");
  });

  it("provides an inspector for the sticker kind", () => {
    expect(stickersWeb.inspectors).toHaveLength(1);
    expect(stickersWeb.inspectors![0]!.kinds).toEqual(["sticker"]);
    expect(stickersWeb.inspectors![0]!.label).toBe("Sticker");
    expect(typeof stickersWeb.inspectors![0]!.component).toBe("function");
  });
});

