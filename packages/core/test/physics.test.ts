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

import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
  CHROME_INFO_MIN_ZOOM,
  CHROME_TITLE_MIN_WIDTH_PX,
  DOCUMENT_WIDTH_BAND,
  ITEM_KINDS,
  KIND_SIZE_POLICY,
  LABEL_ROW_PX,
  MEDIA_CALIBRATED_LONG_EDGE,
  SNAP_DEFAULT_GAP,
  TITLE_SOURCES,
  actualSizeFor,
  buildContextMenuModel,
  calibratedSizeFor,
  canOverwriteTitle,
  computeMakeRoom,
  computeResizeBox,
  filterVisibleSnapTargets,
  inferGroupLayout,
  isTitleSource,
  nodeChromeVisibility,
  readTitleSource,
  resolveTitleUpdate,
  sizePolicyFor,
  sizeSnap,
  snapThresholdWorld,
  spacingCandidates,
  spacingSnapV2,
  type NamedRect,
  type Rect,
  type TitleSource,
} from "../src/index.ts";

describe("calibrated per-kind sizing (sizing.ts)", () => {
  it("defines a complete policy row for every built-in kind", () => {
    for (const kind of ITEM_KINDS) {
      const p = KIND_SIZE_POLICY[kind];
      expect(p).toBeDefined();
      expect(p.minWidth).toBeLessThanOrEqual(p.defaultWidth);
      expect(p.defaultWidth).toBeLessThanOrEqual(p.maxWidth);
      expect(p.minHeight).toBeLessThanOrEqual(p.defaultHeight);
      expect(p.defaultHeight).toBeLessThanOrEqual(p.maxHeight);
    }
    expect(sizePolicyFor("custom-module-kind")).toEqual(KIND_SIZE_POLICY.other);
  });

  it("places media at true pixels up to 1280 long edge and caps larger assets proportionally", () => {
    expect(calibratedSizeFor("image", { width: 1024, height: 768 })).toEqual({ width: 1024, height: 768 });
    expect(calibratedSizeFor("image", { width: 2560, height: 1280 })).toEqual({
      width: MEDIA_CALIBRATED_LONG_EDGE,
      height: 640,
    });
    expect(calibratedSizeFor("video", { width: 1920, height: 1080 })).toEqual({
      width: 1280,
      height: 720,
    });
    expect(calibratedSizeFor("image", { width: 20, height: 10 })).toEqual({ width: 128, height: 64 });
  });

  it("snaps documents to the 480/640/800 reading band and keeps screens at native viewport", () => {
    expect(DOCUMENT_WIDTH_BAND).toEqual([480, 640, 800]);
    expect(calibratedSizeFor("document", { width: 500, height: 700 })).toEqual({ width: 480, height: 700 });
    expect(calibratedSizeFor("document", { width: 620, height: 500 })).toEqual({ width: 640, height: 500 });
    expect(calibratedSizeFor("document", { width: 1100, height: 600 })).toEqual({ width: 800, height: 600 });
    expect(calibratedSizeFor("screen")).toEqual({ width: 1280, height: 800 });
    expect(calibratedSizeFor("screen", { width: 392, height: 846 })).toEqual({ width: 392, height: 846 });
    expect(calibratedSizeFor("text")).toEqual({ width: 240, height: 240 });
  });

  it("computes 100% actual size without the 1280 drop cap while respecting max bounds", () => {
    expect(actualSizeFor("image", { width: 1600, height: 1200 })).toEqual({ width: 1600, height: 1200 });
    expect(actualSizeFor("image", { width: 5120, height: 2560 })).toEqual({ width: 2560, height: 1280 });
    expect(actualSizeFor("document")).toEqual({ width: 640, height: 480 });
  });
});

describe("node chrome zoom degradation (node-chrome.ts)", () => {
  it("sheds info icons below 33% zoom and title below 56px screen room, never shedding kindIcon", () => {
    expect(nodeChromeVisibility(1.0, 200)).toEqual({
      kindIcon: true,
      title: true,
      infoIcons: true,
      labelRow: true,
    });

    expect(nodeChromeVisibility(CHROME_INFO_MIN_ZOOM - 0.01, 200)).toEqual({
      kindIcon: true,
      title: true,
      infoIcons: false,
      labelRow: true,
    });

    expect(nodeChromeVisibility(0.5, CHROME_TITLE_MIN_WIDTH_PX - 1)).toEqual({
      kindIcon: true,
      title: false,
      infoIcons: true,
      labelRow: true,
    });

    // Even at extreme zoom-out, the kind icon stays as the map marker.
    expect(nodeChromeVisibility(0.05, 8)).toEqual({
      kindIcon: true,
      title: false,
      infoIcons: false,
      labelRow: true,
    });
  });

  it("supports hoverReveal and hideBelowZoom modes cleanly", () => {
    expect(nodeChromeVisibility(1.0, 200, { hoverReveal: true })).toEqual({
      kindIcon: true,
      title: false,
      infoIcons: false,
      labelRow: true,
    });
    expect(nodeChromeVisibility(1.0, 200, { hoverReveal: true, hovered: true })).toEqual({
      kindIcon: true,
      title: true,
      infoIcons: true,
      labelRow: true,
    });
    expect(nodeChromeVisibility(0.5, 200, { hideBelowZoom: 0.6 })).toEqual({
      kindIcon: true,
      title: false,
      infoIcons: false,
      labelRow: true,
    });
    expect(nodeChromeVisibility(0.5, 200, { hideBelowZoom: 0.6, selected: true })).toEqual({
      kindIcon: true,
      title: true,
      infoIcons: true,
      labelRow: true,
    });
  });
});

describe("resize modifiers geometry (resize-geometry.ts)", () => {
  const start: Rect = { x: 100, y: 200, width: 200, height: 100 };

  it("anchors the opposite corner for each of the four corner handles", () => {
    const se = computeResizeBox(start, "se", { dx: 50, dy: 30 });
    expect(se).toEqual({ x: 100, y: 200, width: 250, height: 130 });

    const nw = computeResizeBox(start, "nw", { dx: -40, dy: -20 });
    expect(nw).toEqual({ x: 60, y: 180, width: 240, height: 120 });
    expect(nw.x + nw.width).toBe(start.x + start.width);
    expect(nw.y + nw.height).toBe(start.y + start.height);

    const ne = computeResizeBox(start, "ne", { dx: 40, dy: -20 });
    expect(ne).toEqual({ x: 100, y: 180, width: 240, height: 120 });

    const sw = computeResizeBox(start, "sw", { dx: -40, dy: 20 });
    expect(sw).toEqual({ x: 60, y: 200, width: 240, height: 120 });
  });

  it("supports Shift proportional, Option fromCenter, both together, and lockAspect", () => {
    const prop = computeResizeBox(start, "se", { dx: 100, dy: 10 }, { proportional: true });
    expect(prop.width / prop.height).toBeCloseTo(2, 6);
    expect(prop).toEqual({ x: 100, y: 200, width: 300, height: 150 });

    const centered = computeResizeBox(start, "se", { dx: 30, dy: 20 }, { fromCenter: true });
    expect(centered.x + centered.width / 2).toBeCloseTo(start.x + start.width / 2, 6);
    expect(centered.y + centered.height / 2).toBeCloseTo(start.y + start.height / 2, 6);
    expect(centered).toEqual({ x: 70, y: 180, width: 260, height: 140 });

    const both = computeResizeBox(start, "nw", { dx: -50, dy: -10 }, { proportional: true, fromCenter: true });
    expect(both.width / both.height).toBeCloseTo(2, 6);
    expect(both.x + both.width / 2).toBeCloseTo(start.x + start.width / 2, 6);
    expect(both.y + both.height / 2).toBeCloseTo(start.y + start.height / 2, 6);

    const locked = computeResizeBox(start, "se", { dx: 100, dy: 10 }, { lockAspect: true });
    expect(locked).toEqual(prop);
  });

  it("never drifts when toggling Shift/Option mid-drag and clamps cleanly to bounds", () => {
    const delta = { dx: 73, dy: 19 };
    const baseline = computeResizeBox(start, "se", delta);

    // Simulate a drag sequence that toggles Shift and Option on and off across frames.
    void computeResizeBox(start, "se", { dx: 20, dy: 5 }, { proportional: true });
    void computeResizeBox(start, "se", { dx: 45, dy: 12 }, { proportional: true, fromCenter: true });
    void computeResizeBox(start, "se", { dx: 60, dy: 15 }, { fromCenter: true });
    const released = computeResizeBox(start, "se", delta, {});
    expect(released).toEqual(baseline);

    const clamped = computeResizeBox(
      start,
      "se",
      { dx: 5000, dy: 5000 },
      { proportional: true },
      { minW: 64, minH: 64, maxW: 400, maxH: 300 },
    );
    expect(clamped.width).toBe(400);
    expect(clamped.height).toBe(200);
  });
});

describe("Snap v2 (snap-v2.ts)", () => {
  it("computes zoom-responsive world threshold clamped to [2, 24] and drops <8px specks", () => {
    expect(snapThresholdWorld(1)).toBe(6);
    expect(snapThresholdWorld(0.5)).toBe(12);
    expect(snapThresholdWorld(0.1)).toBe(24);
    expect(snapThresholdWorld(4)).toBe(2);

    const targets: Rect[] = [
      { x: 0, y: 0, width: 100, height: 100 }, // 10px at zoom 0.1 → visible
      { x: 200, y: 0, width: 40, height: 40 }, // 4px at zoom 0.1 → speck, ignored
    ];
    expect(filterVisibleSnapTargets(targets, 0.1)).toEqual([targets[0]]);
    expect(filterVisibleSnapTargets(targets, 0.5)).toEqual(targets);
  });

  it("generates default (with 28px vertical label row), neighbour, and equal spacing candidates", () => {
    const a: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const b: Rect = { x: 160, y: 0, width: 100, height: 100 }; // neighbour gap = 60
    const movingH: Rect = { x: 317, y: 0, width: 100, height: 100 }; // 3px away from matching 60px gap after b
    const snapH = spacingSnapV2(movingH, [a, b], 6, "x");
    expect(snapH).not.toBeNull();
    expect(snapH!.kind).toBe("neighbour");
    expect(snapH!.gap).toBe(60);
    expect(snapH!.delta).toBe(3);

    // Vertical default gap counts LABEL_ROW_PX (24 + 28 = 52).
    const top: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const movingV: Rect = { x: 0, y: 150, width: 100, height: 100 }; // gap 50, 2px from 52
    const snapV = spacingSnapV2(movingV, [top], 6, "y");
    expect(snapV).not.toBeNull();
    expect(snapV!.kind).toBe("default");
    expect(snapV!.gap).toBe(SNAP_DEFAULT_GAP + LABEL_ROW_PX);
    expect(snapV!.delta).toBe(2);

    // Equal distribution beats default/neighbour when flanking.
    const cands = spacingCandidates({ x: 196, y: 0, width: 100, height: 100 }, [a, { x: 400, y: 0, width: 100, height: 100 }], "x");
    expect(cands.some((c) => c.kind === "equal" && c.delta === 4)).toBe(true);
  });

  it("matches sibling width and height via sizeSnap", () => {
    const siblings = [
      { id: "s1", x: 0, y: 0, width: 320, height: 240 },
      { id: "s2", x: 400, y: 0, width: 320, height: 180 },
    ];
    const snapped = sizeSnap({ x: 800, y: 0, width: 317, height: 183 }, siblings, 6);
    expect(snapped.dw).toBe(3);
    expect(snapped.dh).toBe(-3);
    expect(snapped.matchedWidth).toBe(320);
    expect(snapped.matchedHeight).toBe(180);
    expect(snapped.matchedWidthIds).toEqual(["s1", "s2"]);
    expect(snapped.matchedHeightIds).toEqual(["s2"]);
  });
});

describe("make-room push engine (make-room.ts)", () => {
  it("pushes colliding neighbours with minimal motion and cascades via BFS", () => {
    const all: NamedRect[] = [
      { id: "mover", x: 0, y: 0, width: 100, height: 100 },
      { id: "n1", x: 120, y: 0, width: 100, height: 100 },
      { id: "n2", x: 244, y: 0, width: 100, height: 100 },
      { id: "far", x: 1000, y: 1000, width: 100, height: 100 },
    ];
    // Move mover right to x=80 so it collides with n1, which cascades into n2.
    const moved: Rect = { x: 80, y: 0, width: 100, height: 100 };
    const result = computeMakeRoom(moved, new Set(["mover"]), all, { gap: 24 });

    expect(result.has("mover")).toBe(false);
    expect(result.has("far")).toBe(false);
    const n1 = result.get("n1");
    const n2 = result.get("n2");
    expect(n1).toBeDefined();
    expect(n1!.x).toBeGreaterThanOrEqual(80 + 100 + 24);
    expect(n2).toBeDefined();
    expect(n2!.x).toBeGreaterThanOrEqual(n1!.x + 100 + 24);
  });

  it("never moves protected/pinned IDs", () => {
    const all: NamedRect[] = [
      { id: "mover", x: 0, y: 0, width: 100, height: 100 },
      { id: "pinned", x: 50, y: 0, width: 100, height: 100 },
      { id: "free", x: 50, y: 60, width: 100, height: 100 },
    ];
    const result = computeMakeRoom(
      { x: 20, y: 20, width: 100, height: 100 },
      new Set(["mover"]),
      all,
      { gap: 24, protectedIds: new Set(["pinned"]) },
    );
    expect(result.has("pinned")).toBe(false);
    expect(result.has("free")).toBe(true);
  });

  it("resolves 500 boxes cleanly in sub-millisecond median time using the 512px spatial grid", () => {
    const boxes: NamedRect[] = [];
    for (let i = 0; i < 500; i++) {
      const col = i % 25;
      const row = Math.floor(i / 25);
      boxes.push({ id: `b${i}`, x: col * 160, y: row * 140, width: 120, height: 100 });
    }
    const movedIds = new Set(["b0"]);
    const moved: Rect = { x: 140, y: 10, width: 120, height: 100 };

    // Warm up JIT once, then measure 25 runs.
    const first = computeMakeRoom(moved, movedIds, boxes, { gap: 24 });
    expect(first.has("b1")).toBe(true);

    const timings: number[] = [];
    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      computeMakeRoom(moved, movedIds, boxes, { gap: 24 });
      timings.push(performance.now() - t0);
    }
    timings.sort((a, b) => a - b);
    const medianMs = timings[Math.floor(timings.length / 2)]!;
    // Sub-millisecond target on 500 boxes (generous CI ceiling 10ms to avoid flakes).
    expect(medianMs).toBeLessThan(10);
  });
});

describe("auto-layout inference (auto-layout-infer.ts)", () => {
  it("infers horizontal row, vertical column, grid, and freeform deterministically", () => {
    const row: NamedRect[] = [
      { id: "a", x: 10, y: 12, width: 120, height: 80 },
      { id: "b", x: 160, y: 4, width: 120, height: 80 },
      { id: "c", x: 310, y: 18, width: 120, height: 80 },
    ];
    const rowInf = inferGroupLayout(row);
    expect(rowInf.layout).toBe("horizontal");
    expect(rowInf.positions.get("a")!.y).toBe(rowInf.positions.get("b")!.y);
    expect(rowInf.positions.get("b")!.x - (rowInf.positions.get("a")!.x + 120)).toBe(rowInf.gap);

    const col: NamedRect[] = [
      { id: "a", x: 20, y: 0, width: 140, height: 80 },
      { id: "b", x: 12, y: 110, width: 140, height: 80 },
      { id: "c", x: 26, y: 225, width: 140, height: 80 },
    ];
    const colInf = inferGroupLayout(col);
    expect(colInf.layout).toBe("vertical");
    expect(colInf.positions.get("a")!.x).toBe(colInf.positions.get("c")!.x);
    expect(colInf.positions.get("b")!.y - (colInf.positions.get("a")!.y + 80)).toBe(colInf.gap);

    const grid: NamedRect[] = [
      { id: "g1", x: 0, y: 0, width: 120, height: 90 },
      { id: "g2", x: 150, y: 6, width: 120, height: 90 },
      { id: "g3", x: 4, y: 120, width: 120, height: 90 },
      { id: "g4", x: 148, y: 124, width: 120, height: 90 },
    ];
    const gridInf = inferGroupLayout(grid);
    expect(gridInf.layout).toBe("grid");
    expect(gridInf.columns).toBe(2);

    const scattered: NamedRect[] = [
      { id: "s1", x: 0, y: 0, width: 100, height: 80 },
      { id: "s2", x: 900, y: 400, width: 100, height: 80 },
      { id: "s3", x: 200, y: 1400, width: 100, height: 80 },
      { id: "s4", x: 1600, y: 1100, width: 100, height: 80 },
    ];
    const freeInf = inferGroupLayout(scattered);
    expect(freeInf.layout).toBe("freeform");
    expect(freeInf.positions.get("s2")).toEqual({ x: 900, y: 400 });
  });
});

describe("group titleSource CAS (title-source.ts)", () => {
  it("enforces user > agent > auto precedence across every transition", () => {
    expect(TITLE_SOURCES).toEqual(["user", "agent", "auto"]);
    expect(isTitleSource("user")).toBe(true);
    expect(isTitleSource("bogus")).toBe(false);
    expect(readTitleSource({ titleSource: "agent" })).toBe("agent");
    expect(readTitleSource({ titleSource: "invalid" })).toBeUndefined();

    const expected: Record<string, Record<TitleSource, boolean>> = {
      undefined: { user: true, agent: true, auto: true },
      auto: { user: true, agent: true, auto: true },
      agent: { user: true, agent: true, auto: false },
      user: { user: true, agent: false, auto: false },
    };

    for (const current of [undefined, "auto", "agent", "user"] as const) {
      for (const incoming of TITLE_SOURCES) {
        expect(canOverwriteTitle(current, incoming), `${String(current)} -> ${incoming}`).toBe(
          expected[String(current)]![incoming],
        );
      }
    }

    expect(resolveTitleUpdate("Human Name", "user", "Auto Name", "auto")).toEqual({
      applied: false,
      title: "Human Name",
      source: "user",
    });
    expect(resolveTitleUpdate("Auto Name", "auto", "Agent Name", "agent")).toEqual({
      applied: true,
      title: "Agent Name",
      source: "agent",
    });
  });
});

describe("pure context-menu model (context-menu-model.ts)", () => {
  it("follows hide-never-grey across pane, item, group, and multi-select targets", () => {
    const paneEmpty = buildContextMenuModel({ targetKind: "pane", selectionCount: 0, hasClipboard: false });
    expect(paneEmpty.map((a) => a.id)).toEqual(["select-all"]);

    const paneClip = buildContextMenuModel({ targetKind: "pane", selectionCount: 0, hasClipboard: true });
    expect(paneClip.map((a) => a.id)).toEqual(["paste", "select-all"]);

    const image = buildContextMenuModel({ targetKind: "image", selectionCount: 1, inGroup: true });
    const imageIds = image.map((a) => a.id);
    expect(imageIds).toContain("actual-size");
    expect(imageIds).toContain("download");
    expect(imageIds).toContain("remove-from-group");
    expect(imageIds).not.toContain("edit");
    expect(imageIds).not.toContain("ungroup");

    const groupStacked = buildContextMenuModel({ targetKind: "group", selectionCount: 1, isStacked: true });
    const groupIds = groupStacked.map((a) => a.id);
    expect(groupIds).toContain("ungroup");
    expect(groupIds).toContain("spread");
    expect(groupIds).not.toContain("stack");
    expect(groupIds).not.toContain("download");
    expect(groupIds).not.toContain("actual-size");

    const multi = buildContextMenuModel({ targetKind: "screen", selectionCount: 3 });
    const multiIds = multi.map((a) => a.id);
    expect(multiIds).toContain("group");
    expect(multiIds).toContain("auto-layout");
    expect(multiIds).toContain("tidy");
    expect(multiIds).not.toContain("rename");
    expect(multiIds).not.toContain("actual-size");
  });
});
