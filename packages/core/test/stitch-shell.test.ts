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
  M3_DURATION,
  M3_DURATION_MS,
  M3_EASING,
  M3_EASING_CSS,
  M3_EXPRESSIVE,
  M3_SCALE,
  M3_SPRING,
  M3_TRANSITION,
  M3_TRANSITION_CSS,
  cubicBezierCss,
  m3TransitionCss,
  reducedMotionDurationMs,
  reducedMotionSafe,
} from "../src/motion.ts";
import {
  STITCH_GROUPS,
  STITCH_PALETTE,
  STITCH_PRESETS,
  STITCH_PRESET_IDS,
  STITCH_TOKENS,
  coerceStitchTokenValue,
  compileStitchTokensCss,
  findStitchPreset,
  findStitchToken,
  isStitchPresetId,
  stitchPresetToUiTweaks,
  stitchTokensInGroup,
} from "../src/stitch-tokens.ts";
import {
  PROJECT_TABS_STORAGE_KEY,
  activateProjectTab,
  closeProjectTab,
  emptyProjectTabs,
  focusNextProjectTab,
  openProjectTab,
  parseProjectTabs,
  renameProjectTab,
  reorderProjectTab,
  serializeProjectTabs,
  setProjectTabActivity,
} from "../src/project-tabs.ts";
import {
  buildHomeInbox,
  buildInlineReplyPayload,
  homeInboxFromResponse,
} from "../src/inbox-model.ts";
import {
  CONTRAST_BODY,
  contrastRatio,
} from "../src/contrast.ts";
import { GROUND_INK, GROUND_MEAN, toneOfGround } from "../src/groundtone.ts";
import {
  THEMES,
  isSurfaceTheme,
  isTheme,
  themeCursorName,
  themeLabel,
  themePatch,
} from "../src/theme.ts";
import type { InboxEntry } from "../src/inbox.ts";

describe("M3 motion tokens", () => {
  it("exposes all M3 durations (short1..extraLong4) in seconds and ms", () => {
    const names = Object.keys(M3_DURATION) as (keyof typeof M3_DURATION)[];
    expect(names).toHaveLength(16);
    expect(names[0]).toBe("short1");
    expect(names[names.length - 1]).toBe("extraLong4");
    for (const name of names) {
      expect(M3_DURATION_MS[name]).toBe(Math.round(M3_DURATION[name] * 1000));
    }
  });

  it("formats cubic-bezier curves, springs, tactile scales, and transition CSS", () => {
    expect(cubicBezierCss(M3_EASING.emphasized)).toBe(M3_EASING_CSS.emphasized);
    expect(M3_EXPRESSIVE.fastSpatial).toHaveLength(4);
    expect(M3_SPRING.panel.type).toBe("spring");
    expect(M3_SCALE.smallActive).toBeLessThan(1);
    expect(M3_SCALE.smallHover).toBeGreaterThan(1);
    expect(m3TransitionCss(["opacity", "transform"], "panelEnter")).toBe(
      "opacity 300ms cubic-bezier(0.05, 0.7, 0.1, 1), transform 300ms cubic-bezier(0.05, 0.7, 0.1, 1)",
    );
    expect(M3_TRANSITION.quick.duration).toBe(M3_DURATION.short2);
    expect(M3_TRANSITION_CSS.surface).not.toContain("backdrop-filter");
  });

  it("guards animations under prefers-reduced-motion", () => {
    expect(reducedMotionSafe(M3_SPRING.snappy, { duration: 0 }, false)).toEqual(M3_SPRING.snappy);
    expect(reducedMotionSafe(M3_SPRING.snappy, { duration: 0 }, true)).toEqual({ duration: 0 });
    expect(reducedMotionDurationMs(M3_DURATION_MS.medium2, false)).toBe(300);
    expect(reducedMotionDurationMs(M3_DURATION_MS.medium2, true)).toBe(0);
  });
});

describe("Stitch surface tokens and presets", () => {
  it("ships 33 tokens across 4 groups and 4 surface presets", () => {
    expect(STITCH_GROUPS.map((g) => g.id)).toEqual(["surface", "outline", "typography", "layout"]);
    expect(STITCH_TOKENS).toHaveLength(33);
    expect(stitchTokensInGroup("surface").length).toBe(7);
    expect(stitchTokensInGroup("outline").length).toBe(9);
    expect(stitchTokensInGroup("typography").length).toBe(14);
    expect(stitchTokensInGroup("layout").length).toBe(3);
    expect(STITCH_PRESET_IDS).toEqual(["clear", "frosted", "subtle", "dense"]);
    expect(STITCH_PRESETS).toHaveLength(4);
    for (const id of STITCH_PRESET_IDS) {
      expect(isStitchPresetId(id)).toBe(true);
      expect(findStitchPreset(id)?.values.light["surface-blur"]).toBe(40);
    }
    expect(isStitchPresetId("glass")).toBe(false);
  });

  it("carries Stitch grey floors, #6056f0 accent, and solid node frames", () => {
    expect(STITCH_PALETTE.light.floor).toBe("#f1f3f4");
    expect(STITCH_PALETTE.dark.floor).toBe("#202124");
    expect(STITCH_PALETTE.light.accent).toBe("#6056f0");
    expect(STITCH_PALETTE.light.solidNodeFrame).toBe(true);
    expect(STITCH_PALETTE.dark.solidNodeFrame).toBe(true);
  });

  it("compiles light and dark CSS blocks and clamps token overrides", () => {
    const css = compileStitchTokensCss("dense", { "surface-blur": 999, radius: 12 });
    expect(css).toContain(':root, :root[data-theme="light"]');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain("--stitch-floor: #f1f3f4;");
    expect(css).toContain("--stitch-floor: #202124;");
    expect(css).toContain("--stitch-accent: #6056f0;");
    expect(css).toContain("--stitch-surface-alpha: 96%;");
    expect(css).toContain("--stitch-surface-alpha: 92%;");
    expect(css).toContain("--stitch-blur: 60px;"); // clamped to max 60
    expect(css).toContain("--stitch-radius: 12px;");

    const blurDef = findStitchToken("surface-blur")!;
    expect(coerceStitchTokenValue(blurDef, "24px")).toBe(24);
    expect(coerceStitchTokenValue(blurDef, -10)).toBe(0);
    expect(coerceStitchTokenValue(blurDef, "nope")).toBeNull();
  });

  it("maps presets onto existing UiTweaks glass knobs", () => {
    const clear = stitchPresetToUiTweaks("clear", "light");
    expect(clear["glass.opacity"]).toBe(0.3);
    expect(clear["glass.blur"]).toBe(40);
    expect(clear["glass.borderOpacity"]).toBe(0.2);

    const denseDark = stitchPresetToUiTweaks("dense", "dark");
    expect(denseDark["glass.opacity"]).toBe(0.92);
  });
});

describe("stitch named theme", () => {
  it("registers stitch in THEMES as a CSS surface ground with passing light contrast", () => {
    expect(THEMES).toContain("stitch");
    expect(isTheme("stitch")).toBe(true);
    expect(isSurfaceTheme("stitch")).toBe(true);
    expect(isSurfaceTheme("galaxy")).toBe(false);
    expect(themeLabel("stitch")).toBe("Stitch");
    expect(themeCursorName("stitch")).toBe("sparkle");

    const canvas = { properties: themePatch("stitch").properties as Record<string, string> };
    expect(toneOfGround(canvas, "light")).toBe("light");
    expect(GROUND_MEAN.stitch).toBe("#f1f3f4");
    expect(contrastRatio(GROUND_INK.light.ink, GROUND_MEAN.stitch)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
    expect(contrastRatio(GROUND_INK.light.muted, GROUND_MEAN.stitch)!).toBeGreaterThanOrEqual(CONTRAST_BODY);
  });
});

describe("project-tabs state machine", () => {
  it("opens, activates without duplicating, closes to neighbour or Home, and reorders", () => {
    let state = emptyProjectTabs();
    state = openProjectTab(state, { id: "prj_alpha", title: "Acme Alpha", now: 100 });
    state = openProjectTab(state, { id: "prj_beta", title: "Acme Beta", now: 200 });
    state = openProjectTab(state, { id: "prj_gamma", title: "Acme Gamma", now: 300 });
    expect(state.tabs.map((t) => t.id)).toEqual(["prj_alpha", "prj_beta", "prj_gamma"]);
    expect(state.activeId).toBe("prj_gamma");

    // Re-opening existing tab activates in place and refreshes title without duplicating.
    state = openProjectTab(state, { id: "prj_alpha", title: "Acme Alpha v2", now: 400 });
    expect(state.tabs.map((t) => t.id)).toEqual(["prj_alpha", "prj_beta", "prj_gamma"]);
    expect(state.activeId).toBe("prj_alpha");
    expect(state.tabs[0]!.title).toBe("Acme Alpha v2");

    // Reorder first tab to the end.
    state = reorderProjectTab(state, 0, 2);
    expect(state.tabs.map((t) => t.id)).toEqual(["prj_beta", "prj_gamma", "prj_alpha"]);

    // Arrow-key traversal wraps around cleanly.
    expect(focusNextProjectTab(state, "prj_alpha", 1)).toBe("prj_beta");
    expect(focusNextProjectTab(state, "prj_beta", -1)).toBe("prj_alpha");

    // Closing the active last tab selects its left neighbour.
    state = closeProjectTab(state, "prj_alpha");
    expect(state.activeId).toBe("prj_gamma");
    // Closing an inactive tab keeps activeId.
    state = closeProjectTab(state, "prj_beta");
    expect(state.activeId).toBe("prj_gamma");
    // Closing the final tab returns Home (`null`).
    state = closeProjectTab(state, "prj_gamma");
    expect(state.activeId).toBeNull();
    expect(state.tabs).toHaveLength(0);
  });

  it("renames, tracks activity, and serializes/restores safely", () => {
    expect(PROJECT_TABS_STORAGE_KEY).toBe("isocan.openTabs.v1");
    let state = openProjectTab(emptyProjectTabs(), { id: "prj_one", title: "Acme One" });
    state = renameProjectTab(state, "prj_one", "Acme Renamed");
    state = setProjectTabActivity(state, "prj_one", "working");
    expect(state.tabs[0]!.title).toBe("Acme Renamed");
    expect(state.tabs[0]!.activity).toBe("working");

    const restored = parseProjectTabs(serializeProjectTabs(state));
    expect(restored.activeId).toBe("prj_one");
    expect(restored.tabs[0]!.title).toBe("Acme Renamed");
    // Activity resets to idle on fresh restore so stale spinners never stick.
    expect(restored.tabs[0]!.activity).toBe("idle");

    expect(parseProjectTabs("not-json")).toEqual(emptyProjectTabs());
    expect(activateProjectTab(restored, "prj_missing").activeId).toBe("prj_one");
  });
});

describe("cross-canvas Home Inbox model", () => {
  const mkEntry = (
    canvasId: string,
    threadId: string,
    id: string,
    reason: InboxEntry["reason"],
    createdAt: string,
    body: string,
  ): InboxEntry => ({
    canvasId,
    canvasTitle: canvasId === "prj_a" ? "Acme Alpha" : "Acme Beta",
    threadId,
    reason,
    comment: {
      id,
      author: { id: "usr_sam", name: "Sam" },
      body,
      createdAt,
    },
  });

  it("prioritizes live agent asks above unread mentions, folds threads, and builds comment.add replies", () => {
    const model = buildHomeInbox({
      canvases: [
        {
          canvasId: "prj_a",
          canvasTitle: "Acme Alpha",
          entries: [
            mkEntry("prj_a", "thr_1", "cmt_1", "mentioned", "2026-11-19T10:00:00.000Z", "@Ada check spacing"),
            mkEntry("prj_a", "thr_1", "cmt_2", "mentioned", "2026-11-19T10:05:00.000Z", "@Ada updated hero"),
            mkEntry("prj_a", "thr_old", "cmt_0", "mentioned", "2026-11-19T08:00:00.000Z", "@Ada already read"),
          ],
        },
        {
          canvasId: "prj_b",
          canvasTitle: "Acme Beta",
          askedAgents: [
            {
              canvasId: "prj_b",
              canvasTitle: "Acme Beta",
              sessionId: "ses_agent_1",
              actorId: "usr_bot",
              actorName: "Acme Bot",
              question: "Keep light or dark cards?",
              threadId: "thr_ask",
              createdAt: "2026-11-19T09:30:00.000Z",
            },
          ],
        },
      ],
      marks: { prj_a: { seq: 1, at: "2026-11-19T09:00:00.000Z" } },
    });

    expect(model.items).toHaveLength(2);
    expect(model.askCount).toBe(1);
    expect(model.mentionCount).toBe(1);
    expect(model.items[0]!.kind).toBe("ask");
    expect(model.items[0]!.canvasHref).toBe("/p/prj_b");
    expect(model.items[1]!.kind).toBe("mention");
    expect(model.items[1]!.body).toBe("@Ada updated hero");
    expect(model.items[1]!.earlierCount).toBe(1);
    expect(model.items[1]!.href).toContain("/p/prj_a");

    const reply = buildInlineReplyPayload(model.items[0]!, "  Keep light cards  ", "cmt_fixed");
    expect(reply).toEqual({
      canvasId: "prj_b",
      op: {
        type: "thread.reply",
        threadId: "thr_ask",
        comment: {
          id: "cmt_fixed",
          body: "Keep light cards",
        },
      },
    });
    expect(buildInlineReplyPayload(model.items[0]!, "   ")).toBeNull();
  });

  it("adapts an authoritative InboxResponse cleanly", () => {
    const model = homeInboxFromResponse({
      entries: [mkEntry("prj_a", "thr_1", "cmt_1", "mentioned", "2026-11-19T12:00:00.000Z", "@Ada ping")],
      marks: {},
      homes: { prj_a: null },
      unavailable: [],
    });
    expect(model.items).toHaveLength(1);
    expect(model.items[0]!.canvasTitle).toBe("Acme Alpha");
  });
});
