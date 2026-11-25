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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadedWith } from "./cssrules.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const preview = read("../src/components/TransitionPreview.tsx");
const header = read("../src/components/FocusHeader.tsx");
const full = read("../src/components/FullScreen.tsx");
const focusCss = loadedWith("focus.css");
const css = loadedWith("transition-preview.css");

/**
 * **The Transition menu shows what each one does** (25 Nov 2026): a
 * miniature of two slides plays whichever row the pointer or keyboard is on.
 * The promise worth guarding is that the miniature is the REAL motion — the
 * same keyframes and the same core plans the deck plays — so the preview can
 * never drift into a drawing of something the deck does not do.
 */
describe("the transition preview", () => {
  it("plays the deck's own choreography, not a drawing of it", () => {
    expect(preview).toContain("pieceSwapPlan(");
    expect(preview).toContain("morphPlan(");
    expect(preview).toContain('stage.className = "tp-world deck-moving"');
    expect(preview).toContain('out.className = "tp-slide deck-out"');
    expect(preview).toContain('into.className = "tp-slide deck-in"');
    expect(preview).toContain("DECK_TRANSITION_MS[transition]");
  });

  it("is a whole slide scaled down, so stage pixels mean stage pixels", () => {
    // 1280×800 at 0.175 is exactly the 224×140 stage.
    expect(css).toContain("width: 1280px; height: 800px;");
    expect(css).toContain("transform: scale(0.175)");
    expect(css).toContain("width: 224px; height: 140px;");
    expect(css).toMatch(/\.tp-ground \{[^}]*transform-origin: 0 0/);
    expect(css).toMatch(/\.tp-piece \{[^}]*transform-origin: 0 0/);
  });

  it("pins a footer that sits in the same place on both miniature slides", () => {
    expect(preview).toMatch(/SLIDE_A: Block\[\] = \[[\s\S]*FOOTER,\n\];/);
    expect(preview).toMatch(/SLIDE_B: Block\[\] = \[[\s\S]*FOOTER,\n\];/);
  });

  it("sits still for somebody who asked for less motion", () => {
    expect(preview).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });
});

describe("the Transition menu", () => {
  it("loads the preview only when it opens", () => {
    expect(header).toContain('const TransitionPreview = lazy(() => import("./TransitionPreview.tsx"));');
  });

  it("previews the row under the pointer, and the row the keyboard is on", () => {
    expect(header).toContain("onMouseEnter={() => setPreviewed(transition)}");
    expect(header).toContain("onFocus={() => setPreviewed(transition)}");
    expect(header).toContain('if (e.key === "ArrowDown") go(at + 1);');
  });

  it("keeps the chrome awake while it is open, so a preview can be watched", () => {
    expect(full).toContain(`if (document.querySelector('.fs-bar [role="menu"]')) {`);
  });

  it("keeps its keys from the deck underneath", () => {
    // Full screen listens in capture: without this, ↓ in the menu flips a slide.
    expect(full).toContain(`if ((e.target as Element | null)?.closest?.('[role="menu"]')) return;`);
  });

  it("wraps preview copy, prevents horizontal scrolling, and uses an opaque card ground", () => {
    // `.focus-header-right` sets `white-space: nowrap` and `.floats` creates a
    // backdrop root; without resetting both, the preview description overflows
    // into the list, scrolls the menu right on focus, and bleeds slide text.
    expect(focusCss).toMatch(/\.focus-version-menu \{[^}]*white-space:\s*normal/);
    expect(focusCss).toMatch(/\.focus-version-menu \{[^}]*background:\s*var\(--card\)/);
    expect(focusCss).toMatch(/\.focus-transition-menu\.with-preview \{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.tp-panel \{[^}]*white-space:\s*normal/);
    expect(css).toMatch(/\.tp-copy \{[^}]*white-space:\s*normal/);
  });
});
