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
export declare const M3_EASING: {
    readonly emphasized: readonly [0.2, 0, 0, 1];
    readonly emphasizedDecelerate: readonly [0.05, 0.7, 0.1, 1];
    readonly emphasizedAccelerate: readonly [0.3, 0, 0.8, 0.15];
    readonly standard: readonly [0.2, 0, 0, 1];
    readonly standardDecelerate: readonly [0, 0, 0, 1];
    readonly standardAccelerate: readonly [0.3, 0, 1, 1];
};
/** M3 easing curves as CSS `cubic-bezier()` strings. */
export declare const M3_EASING_CSS: {
    readonly emphasized: "cubic-bezier(0.2, 0, 0, 1)";
    readonly emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)";
    readonly emphasizedAccelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)";
    readonly standard: "cubic-bezier(0.2, 0, 0, 1)";
    readonly standardDecelerate: "cubic-bezier(0, 0, 0, 1)";
    readonly standardAccelerate: "cubic-bezier(0.3, 0, 1, 1)";
};
/**
 * M3 Expressive curves. Spatial curves (position, scale, rotation, radius)
 * may overshoot; effects curves (opacity, colour) never do.
 */
export declare const M3_EXPRESSIVE: {
    readonly fastSpatial: readonly [0.42, 1.67, 0.21, 0.9];
    readonly defaultSpatial: readonly [0.38, 1.21, 0.22, 1];
    readonly slowSpatial: readonly [0.39, 1.29, 0.35, 0.98];
    readonly fastEffects: readonly [0.31, 0.94, 0.34, 1];
    readonly defaultEffects: readonly [0.34, 0.8, 0.34, 1];
    readonly slowEffects: readonly [0.34, 0.88, 0.34, 1];
};
/** M3 duration scale in seconds (`short1..extraLong4`). */
export declare const M3_DURATION: {
    readonly short1: 0.05;
    readonly short2: 0.1;
    readonly short3: 0.15;
    readonly short4: 0.2;
    readonly medium1: 0.25;
    readonly medium2: 0.3;
    readonly medium3: 0.35;
    readonly medium4: 0.4;
    readonly long1: 0.45;
    readonly long2: 0.5;
    readonly long3: 0.55;
    readonly long4: 0.6;
    readonly extraLong1: 0.7;
    readonly extraLong2: 0.8;
    readonly extraLong3: 0.9;
    readonly extraLong4: 1;
};
/** M3 duration scale in milliseconds for CSS transitions and timers. */
export declare const M3_DURATION_MS: {
    readonly short1: 50;
    readonly short2: 100;
    readonly short3: 150;
    readonly short4: 200;
    readonly medium1: 250;
    readonly medium2: 300;
    readonly medium3: 350;
    readonly medium4: 400;
    readonly long1: 450;
    readonly long2: 500;
    readonly long3: 550;
    readonly long4: 600;
    readonly extraLong1: 700;
    readonly extraLong2: 800;
    readonly extraLong3: 900;
    readonly extraLong4: 1000;
};
/** Tactile scale factors for small controls and large surfaces. */
export declare const M3_SCALE: {
    readonly smallHover: 1.01;
    readonly smallActive: 0.98;
    readonly largeHover: 1.01;
    readonly largeActive: 0.99;
};
/** Named M3 spring configurations for shell interactions and panels. */
export declare const M3_SPRING: {
    readonly snappy: {
        readonly type: "spring";
        readonly stiffness: 400;
        readonly damping: 25;
        readonly mass: 0.8;
    };
    readonly gentle: {
        readonly type: "spring";
        readonly stiffness: 300;
        readonly damping: 30;
        readonly mass: 1;
    };
    readonly bouncy: {
        readonly type: "spring";
        readonly stiffness: 500;
        readonly damping: 20;
        readonly mass: 0.5;
    };
    readonly stiff: {
        readonly type: "spring";
        readonly stiffness: 500;
        readonly damping: 35;
    };
    readonly panel: {
        readonly type: "spring";
        readonly stiffness: 660;
        readonly damping: 45;
    };
};
/** Pre-configured M3 transition presets for common shell moments. */
export declare const M3_TRANSITION: {
    readonly panelEnter: {
        readonly duration: 0.3;
        readonly ease: readonly [0.05, 0.7, 0.1, 1];
    };
    readonly panelExit: {
        readonly duration: 0.2;
        readonly ease: readonly [0.3, 0, 0.8, 0.15];
    };
    readonly standard: {
        readonly duration: 0.2;
        readonly ease: readonly [0.2, 0, 0, 1];
    };
    readonly quick: {
        readonly duration: 0.1;
        readonly ease: readonly [0.2, 0, 0, 1];
    };
    readonly modal: {
        readonly duration: 0.5;
        readonly ease: readonly [0.05, 0.7, 0.1, 1];
    };
    readonly sharedAxis: {
        readonly duration: 0.3;
        readonly ease: readonly [0.2, 0, 0, 1];
    };
    readonly layout: {
        readonly duration: 0.25;
        readonly ease: readonly [0.2, 0, 0, 1];
    };
};
/** Name of a pre-configured M3 transition preset. */
type M3TransitionName = keyof typeof M3_TRANSITION;
/** Format a cubic-bezier control-point tuple as a CSS `cubic-bezier()` string. */
export declare function cubicBezierCss(curve: CubicBezier): string;
/** Build a CSS `transition` shorthand for one or more properties using an M3 preset. */
export declare function m3TransitionCss(properties: string | readonly string[], preset?: M3TransitionName): string;
/** Ready-made CSS transition shorthands (`surface` never transitions backdrop-filter). */
export declare const M3_TRANSITION_CSS: {
    readonly standard: "all 200ms cubic-bezier(0.2, 0, 0, 1)";
    readonly quick: "all 100ms cubic-bezier(0.2, 0, 0, 1)";
    readonly panelEnter: "all 300ms cubic-bezier(0.05, 0.7, 0.1, 1)";
    readonly panelExit: "all 200ms cubic-bezier(0.3, 0, 0.8, 0.15)";
    readonly surface: "color 150ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms cubic-bezier(0.2, 0, 0, 1), border-color 150ms cubic-bezier(0.2, 0, 0, 1), box-shadow 150ms cubic-bezier(0.2, 0, 0, 1)";
};
/**
 * Return `fallback` when the user prefers reduced motion, otherwise `motion`.
 * Keeps animated transitions and spring configs safe under `prefers-reduced-motion: reduce`.
 */
export declare function reducedMotionSafe<T, F = T>(motion: T, fallback: F, reduced: boolean): T | F;
/** Return `0` ms when reduced motion is active, otherwise the given duration in ms. */
export declare function reducedMotionDurationMs(durationMs: number, reduced: boolean): number;
export {};
