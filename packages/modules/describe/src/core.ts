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

import type { Actor, CanvasContents, ContextPiece, CoreModule } from "@isocan/core";
import type { CredentialRef } from "@isocan/core/keys";

/** Item property holding the caption-first text description written for agents. */
export const AGENT_DESCRIPTION_PROP = "agentDescription";

/** Home route that generates and writes `agentDescription` on an item. */
export const DESCRIBE_ROUTE = "/api/m/describe/item";

/** Built-in item kinds that can be described for agents. */
export const DESCRIBABLE_KINDS = ["image", "video", "document", "screen"] as const;

export type DescribableKind = (typeof DESCRIBABLE_KINDS)[number];

/** Word ceiling for the opening plain-language caption sentence. */
export const CAPTION_MAX_WORDS = 12;

/** Whether `kind` is one of the kinds `@isocan/describe` knows how to describe. */
export function isDescribableKind(kind: string): kind is DescribableKind {
  return (DESCRIBABLE_KINDS as readonly string[]).includes(kind);
}

/** Request payload for `POST /api/m/describe/item`. */
export interface DescribeItemRequest {
  canvasId: string;
  itemId: string;
  actor?: Actor;
}

/** Response payload for `POST /api/m/describe/item`. */
export interface DescribeItemResponse {
  itemId: string;
  agentDescription: string;
  model: string;
  credentialRef: CredentialRef;
}

/** First sentence (or line) of an `agentDescription`, used as a concise caption in context summaries. */
export function captionOf(description: string): string {
  const cleaned = description.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const match = /^(.+?[.!?])(?:\s|$)/.exec(cleaned);
  const first = match ? match[1]! : cleaned;
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

function captionFirst(medium: string, example: string): string {
  return (
    `Begin with a caption: ONE plain sentence of at most ${CAPTION_MAX_WORDS} words naming what it is, ` +
    `the way a person would say it at a glance ("${example}"). ` +
    `No "This ${medium} shows" opener and no stacked adjectives. ` +
    `The caption is the first sentence of the paragraph; the detail follows it.`
  );
}

/**
 * Build a caption-first description prompt tailored to the item's kind and optional title.
 * Pure — shared across server, CLI, and tests.
 */
export function buildDescribePrompt(kind: string, title?: string): string {
  const label = title?.trim() ? `\nItem title: "${title.trim()}"` : "";
  if (kind === "image") {
    return (
      `Describe this image for an AI agent that cannot see it but must reason about it and reference it in creative work. ` +
      `${captionFirst("image", "Red fox asleep in fresh snow.")} ` +
      `Then cover: what it depicts, composition, style/medium, palette (name specific colors), lighting, mood, and any visible text. ` +
      `3-6 dense sentences after the caption.\n` +
      `After the prose paragraph, append three short lines on their own lines:\n` +
      `Style/medium: <concise medium, rendering style, and visual traits>\n` +
      `Palette: <dominant colors, specific color names or hex approximations, and contrast>\n` +
      `Lighting: <lighting direction, quality, and atmosphere>\n` +
      `Respond with the description only.${label}`
    );
  }
  if (kind === "video") {
    return (
      `Describe this video for an AI agent that cannot watch it but must reason about it and reference it in creative work. ` +
      `${captionFirst("video", "Drone shot rising over a foggy harbor.")} ` +
      `Then cover: the scenes/shots in order, subjects and their motion, camera work, visual style and palette (name specific colors), pacing, and mood. ` +
      `Transcribe any spoken words and on-screen text verbatim. Dense prose, no other preamble. Respond with the description only.${label}`
    );
  }
  if (kind === "screen") {
    return (
      `Describe this UI screen for an AI agent that cannot see it rendered but must reason about it and edit it accurately. ` +
      `${captionFirst("screen", "Checkout summary with itemized cart and pay button.")} ` +
      `Then cover: layout structure, primary sections and navigation, visual hierarchy, palette and typography cues, interactive controls, and key visible copy. ` +
      `3-6 dense sentences after the caption. Respond with the description only.${label}`
    );
  }
  return (
    `Describe this document for an AI agent that needs a fast, accurate semantic handle on its contents. ` +
    `${captionFirst("document", "Quarterly launch plan with dates and owners.")} ` +
    `Then cover: document structure, main sections or arguments, concrete decisions, numbers, names, and open questions. ` +
    `3-6 dense sentences after the caption. Respond with the description only.${label}`
  );
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Owns `agentDescription` and exposes items carrying one in canvas context so
 * agents see visual and structural handles without fetching every binary blob.
 */
export const describeModule: CoreModule = {
  name: "@isocan/describe",
  propertyKeys: [AGENT_DESCRIPTION_PROP],
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const described = Object.values(canvas.items)
      .filter((item) => Boolean(item.properties?.[AGENT_DESCRIPTION_PROP]?.trim()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (described.length === 0) return [];
    const previews = described
      .slice(0, 5)
      .map((item) => `${item.title}: ${captionOf(item.properties[AGENT_DESCRIPTION_PROP]!)}`)
      .join(" · ");
    const suffix = described.length > 5 ? ` (+${described.length - 5} more)` : "";
    return [
      {
        name: "Agent descriptions",
        source: "canvas",
        present: true,
        size: `${described.length} item${described.length === 1 ? "" : "s"} — ${previews}${suffix}`,
        updatedAt: described[0]!.updatedAt,
      },
    ];
  },
};

export default describeModule;
