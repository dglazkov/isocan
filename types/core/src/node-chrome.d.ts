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
/**
 * **Node chrome zoom degradation** (Open Stitch phase 1B, ADR 0146).
 *
 * "A zoomed-out board is a map, and a map of info icons is noise." Every card
 * has a screen-constant label row holding three pieces: the kind icon (the map
 * marker and drag handle), the title, and auxiliary info icons. As zoom falls:
 *
 * 1. Info icons shed below 33% zoom.
 * 2. The title sheds when the card has less than 56 screen pixels of width.
 * 3. The kind icon NEVER sheds.
 *
 * Pure arithmetic so both the canvas renderer and tests share one answer.
 */
/** Zoom floor below which secondary info icons (badges, timestamps, counts) shed. */
export declare const CHROME_INFO_MIN_ZOOM = 0.33;
/** Screen-pixel width floor below which the item title sheds. */
export declare const CHROME_TITLE_MIN_WIDTH_PX = 56;
/** Optional interaction state and user preferences affecting chrome visibility. */
interface NodeChromeOptions {
    /** Pointer is currently over the card. */
    hovered?: boolean;
    /** Card is currently selected. */
    selected?: boolean;
    /** When true, title and info icons stay hidden until hovered or selected. */
    hoverReveal?: boolean;
    /** Optional user-configured zoom threshold below which non-hovered labels hide. */
    hideBelowZoom?: number;
}
/** Which parts of a card's label row should render at the current zoom and screen width. */
interface NodeChromeVisibility {
    /** The map marker — always true; never sheds at any zoom. */
    kindIcon: true;
    /** Whether the title text has room and is permitted to render. */
    title: boolean;
    /** Whether secondary info icons (version badge, status pills, comment counts) render. */
    infoIcons: boolean;
    /** True whenever any chrome piece renders (always true because `kindIcon` never sheds). */
    labelRow: true;
}
/**
 * Compute which parts of a node's label row should show at `zoom` and
 * `screenWidthPx`. Pure arithmetic with no DOM or framework coupling.
 */
export declare function nodeChromeVisibility(zoom: number, screenWidthPx: number, opts?: NodeChromeOptions): NodeChromeVisibility;
export {};
