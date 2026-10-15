import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAWING_MIME, DRAWING_PROPERTIES, TEXT_MIME, TEXT_PROPERTIES, type Item } from "@isocan/core";
import { ItemView } from "../src/components/ItemView.tsx";
import {
  applyLookahead,
  cameraVelocity,
  clearLookahead,
  LOOKAHEAD_GRACE_MS,
  lookaheadCandidates,
  lookaheadVector,
  MAX_HELD_LOOKAHEAD,
  MAX_LOOKAHEAD_ITEMS,
  needsLookahead,
} from "../src/lib/lookahead.ts";

const actor = { id: "usr_acme", name: "Acme" };
const stamp = {
  createdAt: "2026-09-12T00:00:00Z",
  createdBy: actor,
  updatedAt: "2026-09-12T00:00:00Z",
  updatedBy: actor,
};

function makeItem(
  id: string,
  x: number,
  y: number,
  mimeType = "text/html",
  properties: Record<string, string> = {},
): Item {
  return {
    id,
    title: `Acme ${id}`,
    description: "",
    x,
    y,
    width: 800,
    height: 600,
    properties,
    currentVersionId: `ver_${id}`,
    versions: [
      {
        id: `ver_${id}`,
        blobHash: `hash_${id}`,
        mimeType,
        filename: `${id}.html`,
        size: 100,
        ...stamp,
      },
    ],
    ...stamp,
  };
}

afterEach(() => {
  clearLookahead();
  vi.useRealTimers();
});

describe("directional camera lookahead", () => {
  it("computes screen-space camera velocity opposite world translation and ignores pure zooms", () => {
    // Panning to see content to the right shifts world tx negatively.
    const vRight = cameraVelocity({ tx: 0, ty: 0, scale: 1 }, { tx: -32, ty: 0, scale: 1 }, 16);
    expect(vRight.vx).toBeCloseTo(2000, 1);
    expect(vRight.vy).toBe(0);

    // Zooming changes scale and does not project a directional pan vector.
    const vZoom = cameraVelocity({ tx: 0, ty: 0, scale: 1 }, { tx: -100, ty: -100, scale: 1.2 }, 16);
    expect(vZoom).toEqual({ vx: 0, vy: 0 });

    // Below speed floor returns null lookahead vector.
    expect(lookaheadVector({ vx: 40, vy: 30 })).toBeNull();
  });

  it.each([
    {
      dir: "right (+x)",
      velocity: { vx: 1800, vy: 0 },
      aheadNear: [1500, 100] as const,
      aheadFar: [2500, 100] as const,
      behind: [-1200, 100] as const,
      side: [1500, 1600] as const,
    },
    {
      dir: "left (-x)",
      velocity: { vx: -1800, vy: 0 },
      aheadNear: [-1100, 100] as const,
      aheadFar: [-2100, 100] as const,
      behind: [1600, 100] as const,
      side: [-1100, 1600] as const,
    },
    {
      dir: "down (+y)",
      velocity: { vx: 0, vy: 1800 },
      aheadNear: [200, 1100] as const,
      aheadFar: [200, 1900] as const,
      behind: [200, -1000] as const,
      side: [2000, 1100] as const,
    },
    {
      dir: "up (-y)",
      velocity: { vx: 0, vy: -1800 },
      aheadNear: [200, -900] as const,
      aheadFar: [200, -1700] as const,
      behind: [200, 1200] as const,
      side: [2000, -900] as const,
    },
  ])(
    "selects offscreen screens ahead in arrival order and ignores items behind or perpendicular when panning $dir",
    ({ velocity, aheadNear, aheadFar, behind, side }) => {
      const items = [
        makeItem("behind", behind[0], behind[1]),
        makeItem("side", side[0], side[1]),
        makeItem("far", aheadFar[0], aheadFar[1]),
        makeItem("near", aheadNear[0], aheadNear[1]),
      ];

      const hits = lookaheadCandidates(
        items,
        { tx: 0, ty: 0, scale: 1 },
        { width: 1200, height: 800 },
        velocity,
      );

      expect(hits.map((h) => h.itemId)).toEqual(["near", "far"]);
      expect(hits[0]!.tEnter).toBeGreaterThan(0);
      expect(hits[0]!.tEnter).toBeLessThan(hits[1]!.tEnter);
      expect(hits[0]!.htmlBlob?.blobHash).toBe("hash_near");
    },
  );

  it("sweeps diagonally and excludes items outside the diagonal corridor", () => {
    const items = [
      makeItem("diag_hit", 1800, 1200),
      makeItem("x_only_miss", 2200, -900),
      makeItem("y_only_miss", -1000, 1600),
    ];
    const hits = lookaheadCandidates(
      items,
      { tx: 0, ty: 0, scale: 1 },
      { width: 1200, height: 800 },
      { vx: 1600, vy: 1200 },
    );
    expect(hits.map((h) => h.itemId)).toEqual(["diag_hit"]);
  });

  it("only allocates lookahead slots to items that standby offscreen, capped at MAX_LOOKAHEAD_ITEMS", () => {
    expect(needsLookahead(makeItem("html", 0, 0, "text/html"))).toBe(true);
    expect(needsLookahead(makeItem("md", 0, 0, "text/markdown"))).toBe(true);
    expect(needsLookahead(makeItem("img", 0, 0, "image/png"))).toBe(false);
    expect(needsLookahead(makeItem("vid", 0, 0, "video/mp4"))).toBe(false);
    expect(needsLookahead(makeItem("txt", 0, 0, TEXT_MIME, TEXT_PROPERTIES))).toBe(false);
    expect(needsLookahead(makeItem("ink", 0, 0, DRAWING_MIME, DRAWING_PROPERTIES))).toBe(false);
    expect(needsLookahead(makeItem("area", 0, 0, "text/plain", { kind: "area" }))).toBe(false);

    const row = Array.from({ length: 14 }, (_, i) => makeItem(`s_${i}`, 1300 + i * 160, 100));
    const hits = lookaheadCandidates(
      row,
      { tx: 0, ty: 0, scale: 1 },
      { width: 1200, height: 800 },
      { vx: 3200, vy: 0 },
    );
    expect(hits).toHaveLength(MAX_LOOKAHEAD_ITEMS);
    expect(hits[0]!.itemId).toBe("s_0");
  });

  it("mounts snapshotOnly HTML shell instead of item-standby when an offscreen item enters lookahead, and releases after grace", () => {
    vi.useFakeTimers();
    const item = makeItem("ahead_1", 2000, 100, "text/html");
    const originalError = console.error;
    const errors = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) return;
      originalError(message, ...args);
    });

    try {
      // Before lookahead: offscreen item renders standby shell.
      const beforeHtml = renderToStaticMarkup(
        h(MemoryRouter, null, h(ItemView, { item, canvasId: "prj_acme", actor })),
      );
      expect(beforeHtml).toContain("item-standby");

      // Enter lookahead: renders HtmlItemView surface without mounting a live iframe.
      applyLookahead("prj_acme", [{ itemId: item.id, tEnter: 0.4 }]);
      const duringHtml = renderToStaticMarkup(
        h(MemoryRouter, null, h(ItemView, { item, canvasId: "prj_acme", actor })),
      );
      expect(duringHtml).not.toContain("item-standby");
      expect(duringHtml).toContain('class="html-view"');
      expect(duringHtml).not.toContain("<iframe");

      // Leave lookahead: held during grace window, then released back to standby.
      applyLookahead("prj_acme", []);
      vi.advanceTimersByTime(LOOKAHEAD_GRACE_MS - 100);
      const graceHtml = renderToStaticMarkup(
        h(MemoryRouter, null, h(ItemView, { item, canvasId: "prj_acme", actor })),
      );
      expect(graceHtml).not.toContain("item-standby");

      vi.advanceTimersByTime(200);
      const afterHtml = renderToStaticMarkup(
        h(MemoryRouter, null, h(ItemView, { item, canvasId: "prj_acme", actor })),
      );
      expect(afterHtml).toContain("item-standby");
    } finally {
      errors.mockRestore();
    }
  });

  it("enforces MAX_HELD_LOOKAHEAD ceiling by evicting oldest grace items when flinging rapidly", () => {
    vi.useFakeTimers();
    for (let batch = 0; batch < 4; batch++) {
      const hits = Array.from({ length: 6 }, (_, i) => ({
        itemId: `batch_${batch}_${i}`,
        tEnter: i * 0.1,
      }));
      applyLookahead("prj_acme", hits);
    }
    // Earliest batch should have been evicted immediately once total exceeded MAX_HELD_LOOKAHEAD (12).
    const firstItem = makeItem("batch_0_0", 2000, 100, "text/html");
    const lastItem = makeItem("batch_3_5", 2000, 100, "text/html");
    const originalError = console.error;
    const errors = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) return;
      originalError(message, ...args);
    });
    try {
      const firstHtml = renderToStaticMarkup(
        h(MemoryRouter, null, h(ItemView, { item: firstItem, canvasId: "prj_acme", actor })),
      );
      const lastHtml = renderToStaticMarkup(
        h(MemoryRouter, null, h(ItemView, { item: lastItem, canvasId: "prj_acme", actor })),
      );
      expect(firstHtml).toContain("item-standby");
      expect(lastHtml).not.toContain("item-standby");
      expect(MAX_HELD_LOOKAHEAD).toBeGreaterThanOrEqual(MAX_LOOKAHEAD_ITEMS);
    } finally {
      errors.mockRestore();
    }
  });
});
