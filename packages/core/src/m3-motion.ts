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
 * **Material Design 3 motion tokens (`@isocan/core/m3-motion`, also re-exported
 * from `@isocan/core/motion`).**
 *
 * Pure, dependency-free data and CSS helpers ported from Open Stitch (ADR 0250):
 * easing curves, durations (`short1..extraLong4`), spring configs, tactile scale
 * constants, and reduced-motion guards.
 */

/** A cubic-bezier curve as its four control-point numbers. */
type CubicBezier = readonly [number, number, number, number];

/**
 * M3 easing curves as cubic-bezier control points.
 *
 * - `emphasized`: most expressive, for significant UI transitions
 * - `emphasizedDecelerate`: smooth arrivals (dialogs, panels entering)
 * - `emphasizedAccelerate`: quick exits (elements leaving)
 * - `standard`: functional UI transitions
 * - `standardDecelerate`: entering elements
 * - `standardAccelerate`: exiting elements
 */
export const M3_EASING = {
  emphasized: [0.2, 0, 0, 1],
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15],
  standard: [0.2, 0, 0, 1],
  standardDecelerate: [0, 0, 0, 1],
  standardAccelerate: [0.3, 0, 1, 1],
} as const satisfies Record<string, CubicBezier>;

/** Name of a standard or emphasized M3 easing curve. */
type M3EasingName = keyof typeof M3_EASING;

/** M3 easing curves as CSS `cubic-bezier()` strings. */
export const M3_EASING_CSS = {
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  emphasizedAccelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  standardDecelerate: "cubic-bezier(0, 0, 0, 1)",
  standardAccelerate: "cubic-bezier(0.3, 0, 1, 1)",
} as const satisfies Record<M3EasingName, string>;

/**
 * M3 Expressive curves. Spatial curves (position, scale, rotation, radius)
 * may overshoot; effects curves (opacity, colour) never do.
 */
export const M3_EXPRESSIVE = {
  fastSpatial: [0.42, 1.67, 0.21, 0.9],
  defaultSpatial: [0.38, 1.21, 0.22, 1.0],
  slowSpatial: [0.39, 1.29, 0.35, 0.98],
  fastEffects: [0.31, 0.94, 0.34, 1.0],
  defaultEffects: [0.34, 0.8, 0.34, 1.0],
  slowEffects: [0.34, 0.88, 0.34, 1.0],
} as const satisfies Record<string, CubicBezier>;

/** M3 duration scale in seconds (`short1..extraLong4`). */
export const M3_DURATION = {
  short1: 0.05,
  short2: 0.1,
  short3: 0.15,
  short4: 0.2,
  medium1: 0.25,
  medium2: 0.3,
  medium3: 0.35,
  medium4: 0.4,
  long1: 0.45,
  long2: 0.5,
  long3: 0.55,
  long4: 0.6,
  extraLong1: 0.7,
  extraLong2: 0.8,
  extraLong3: 0.9,
  extraLong4: 1.0,
} as const;

/** Name of an M3 duration step. */
type M3DurationName = keyof typeof M3_DURATION;

/** M3 duration scale in milliseconds for CSS transitions and timers. */
export const M3_DURATION_MS = {
  short1: 50,
  short2: 100,
  short3: 150,
  short4: 200,
  medium1: 250,
  medium2: 300,
  medium3: 350,
  medium4: 400,
  long1: 450,
  long2: 500,
  long3: 550,
  long4: 600,
  extraLong1: 700,
  extraLong2: 800,
  extraLong3: 900,
  extraLong4: 1000,
} as const satisfies Record<M3DurationName, number>;

/** Tactile scale factors for small controls and large surfaces. */
export const M3_SCALE = {
  smallHover: 1.01,
  smallActive: 0.98,
  largeHover: 1.01,
  largeActive: 0.99,
} as const;

/** Plain-data spring parameters readable by any spring animator. */
interface M3SpringConfig {
  readonly type: "spring";
  readonly stiffness: number;
  readonly damping: number;
  readonly mass?: number;
}

/** Named M3 spring configurations for shell interactions and panels. */
export const M3_SPRING = {
  snappy: { type: "spring", stiffness: 400, damping: 25, mass: 0.8 },
  gentle: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  bouncy: { type: "spring", stiffness: 500, damping: 20, mass: 0.5 },
  stiff: { type: "spring", stiffness: 500, damping: 35 },
  panel: { type: "spring", stiffness: 660, damping: 45 },
} as const satisfies Record<string, M3SpringConfig>;

/** A `{ duration (s), ease }` transition preset pair. */
interface M3TransitionPreset {
  readonly duration: number;
  readonly ease: CubicBezier;
}

/** Pre-configured M3 transition presets for common shell moments. */
export const M3_TRANSITION = {
  panelEnter: { duration: M3_DURATION.medium2, ease: M3_EASING.emphasizedDecelerate },
  panelExit: { duration: M3_DURATION.short4, ease: M3_EASING.emphasizedAccelerate },
  standard: { duration: M3_DURATION.short4, ease: M3_EASING.standard },
  quick: { duration: M3_DURATION.short2, ease: M3_EASING.emphasized },
  modal: { duration: M3_DURATION.long2, ease: M3_EASING.emphasizedDecelerate },
  sharedAxis: { duration: M3_DURATION.medium2, ease: M3_EASING.emphasized },
  layout: { duration: M3_DURATION.medium1, ease: M3_EASING.emphasized },
} as const satisfies Record<string, M3TransitionPreset>;

/** Name of a pre-configured M3 transition preset. */
type M3TransitionName = keyof typeof M3_TRANSITION;

/** Format a cubic-bezier control-point tuple as a CSS `cubic-bezier()` string. */
export function cubicBezierCss(curve: CubicBezier): string {
  return `cubic-bezier(${curve.join(", ")})`;
}

/** Build a CSS `transition` shorthand for one or more properties using an M3 preset. */
export function m3TransitionCss(
  properties: string | readonly string[],
  preset: M3TransitionName = "standard",
): string {
  const { duration, ease } = M3_TRANSITION[preset];
  const timing = `${Math.round(duration * 1000)}ms ${cubicBezierCss(ease)}`;
  const list = typeof properties === "string" ? [properties] : properties;
  return list.map((p) => `${p} ${timing}`).join(", ");
}

/** Ready-made CSS transition shorthands (`surface` never transitions backdrop-filter). */
export const M3_TRANSITION_CSS = {
  standard: "all 200ms cubic-bezier(0.2, 0, 0, 1)",
  quick: "all 100ms cubic-bezier(0.2, 0, 0, 1)",
  panelEnter: "all 300ms cubic-bezier(0.05, 0.7, 0.1, 1)",
  panelExit: "all 200ms cubic-bezier(0.3, 0, 0.8, 0.15)",
  surface:
    "color 150ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms cubic-bezier(0.2, 0, 0, 1), border-color 150ms cubic-bezier(0.2, 0, 0, 1), box-shadow 150ms cubic-bezier(0.2, 0, 0, 1)",
} as const;

/**
 * Return `fallback` when the user prefers reduced motion, otherwise `motion`.
 * Keeps animated transitions and spring configs safe under `prefers-reduced-motion: reduce`.
 */
export function reducedMotionSafe<T, F = T>(motion: T, fallback: F, reduced: boolean): T | F {
  return reduced ? fallback : motion;
}

/** Return `0` ms when reduced motion is active, otherwise the given duration in ms. */
export function reducedMotionDurationMs(durationMs: number, reduced: boolean): number {
  return reduced ? 0 : Math.max(0, durationMs);
}
