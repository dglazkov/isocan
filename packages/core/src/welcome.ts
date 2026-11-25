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
 * **Welcome item seed specification** (`@isocan/core/welcome`, Open Stitch phase 1A).
 *
 * Pure helper generating a concise "Welcome to Open Stitch" markdown card
 * with example asks and a gesture primer. Opt-in on creation (`--welcome` in
 * the CLI, or Home's `+` flow) so empty-canvas tests keep asserting zero items.
 */

import { newItemId, newVersionId } from "./ids.ts";
import type { Operation } from "./ops.ts";

/** Canonical title of the seeded welcome card. */
const WELCOME_ITEM_TITLE = "Welcome to Open Stitch";

/** Canonical filename of the seeded welcome markdown blob. */
const WELCOME_ITEM_FILENAME = "welcome.md";

/** Canonical MIME type of the seeded welcome card. */
const WELCOME_ITEM_MIME = "text/markdown";

/** Default world geometry for the welcome card (reading-distance 480px band). */
const WELCOME_ITEM_BOUNDS = {
  x: 0,
  y: 0,
  width: 480,
  height: 360,
} as const;

/** Concise onboarding markdown: example asks and core canvas gestures. */
const WELCOME_ITEM_BODY = [
  "# Welcome to Open Stitch",
  "",
  "Drop files, sketch ideas, or ask an agent right from the prompt bar below.",
  "",
  "## Try asking",
  "- \"Draft a three-screen onboarding flow for Acme Notes\"",
  "- \"Compare two layouts for this card and keep the calmer one\"",
  "- \"Tidy this cluster into a clean row with equal gaps\"",
  "",
  "## Canvas gestures",
  "- **Space + drag** or two-finger pan — move around the board",
  "- **Pinch** or **⌘/Ctrl + scroll** — zoom at the pointer",
  "- **Shift** while resizing a corner — keep proportions; **⌥/Alt** — resize from centre",
  "- **⌥/Alt + drag** — push neighbours gently to make room",
  "- **Press and hold** (200 ms) — pick up a card; grab any edge ring to drag iframes",
  "- **⌘K** — command launcher · **⌘\\** — hide or restore the interface",
  "",
].join("\n");

/** Options overriding position, size, or title when building a welcome item spec. */
export interface WelcomeItemOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
}

/** Pure specification for seeding a welcome markdown document onto a fresh canvas. */
interface WelcomeItemSpec {
  readonly kind: "document";
  readonly title: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly body: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties: Readonly<Record<string, string>>;
}

/** Build the pure specification for a new canvas's welcome markdown card. */
export function welcomeItemSpec(opts: WelcomeItemOptions = {}): WelcomeItemSpec {
  return {
    kind: "document",
    title: opts.title ?? WELCOME_ITEM_TITLE,
    filename: WELCOME_ITEM_FILENAME,
    mimeType: WELCOME_ITEM_MIME,
    body: WELCOME_ITEM_BODY,
    x: opts.x ?? WELCOME_ITEM_BOUNDS.x,
    y: opts.y ?? WELCOME_ITEM_BOUNDS.y,
    width: opts.width ?? WELCOME_ITEM_BOUNDS.width,
    height: opts.height ?? WELCOME_ITEM_BOUNDS.height,
    properties: { role: "welcome" },
  };
}

/** Uploaded blob receipt needed to materialize a `WelcomeItemSpec` as an `item.add` op. */
interface UploadedWelcomeBlob {
  readonly blobHash: string;
  readonly size: number;
}

/** Turn a `WelcomeItemSpec` and its uploaded blob into a standard `item.add` op (zero new ops). */
export function buildWelcomeItemAddOp(
  spec: WelcomeItemSpec,
  blob: UploadedWelcomeBlob,
  ids: { itemId?: string; versionId?: string } = {},
): Extract<Operation, { type: "item.add" }> {
  return {
    type: "item.add",
    itemId: ids.itemId ?? newItemId(),
    title: spec.title,
    width: spec.width,
    height: spec.height,
    placement: { x: spec.x, y: spec.y, chosen: true },
    properties: { ...spec.properties },
    version: {
      id: ids.versionId ?? newVersionId(),
      blobHash: blob.blobHash,
      mimeType: spec.mimeType,
      filename: spec.filename,
      size: blob.size,
    },
  };
}
