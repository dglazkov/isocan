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

export const PROTOTYPE_PROPS = {
  tier: "prototype.tier",
  prompt: "prototype.prompt",
  delegatedSession: "prototype.delegatedSession",
} as const;

export const PROTOTYPE_TIERS = ["quick", "standard", "app"] as const;
export type PrototypeTier = (typeof PROTOTYPE_TIERS)[number];

export const PROTOTYPE_BUILD_ROUTE = "/api/m/prototype/build";

export function isPrototypeTier(value: unknown): value is PrototypeTier {
  return typeof value === "string" && (PROTOTYPE_TIERS as readonly string[]).includes(value);
}

export interface PrototypeBuildRequest {
  canvasId: string;
  prompt: string;
  tier?: PrototypeTier;
  title?: string;
  itemId?: string;
  actor?: Actor;
}

export interface PrototypeBuiltResponse {
  delegated: false;
  itemId: string;
  versionId: string;
  tier: "quick" | "standard";
  model: string;
  credentialRef: CredentialRef;
}

export interface PrototypeDelegatedResponse {
  delegated: true;
  tier: "app";
  route: "/api/m/workbench/start";
  hint: string;
}

export type PrototypeBuildResponse = PrototypeBuiltResponse | PrototypeDelegatedResponse;

/**
 * Extract and validate self-contained HTML output from a model response.
 * Rejects empty output or external `<script src>` / `<link href>` pointing outside allowed origins.
 */
export function validateSelfContainedHtml(
  raw: string,
): { ok: true; html: string } | { ok: false; error: string } {
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = (fenced ? fenced[1]! : raw).trim();
  if (!candidate) {
    return { ok: false, error: "prototype HTML output is empty" };
  }
  if (!/<(?:!doctype\s+html|html|body|main|div|section)\b/i.test(candidate)) {
    return { ok: false, error: "prototype output does not look like an HTML document" };
  }
  // Disallow arbitrary external script URLs (self-contained HTML only; jsdelivr CDN is permitted by content CSP).
  for (const match of candidate.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const src = match[1]!;
    if (!src.startsWith("https://cdn.jsdelivr.net/")) {
      return { ok: false, error: `external script "${src}" is not allowed in self-contained prototypes` };
    }
  }
  const html = /^<!doctype\s+html>/i.test(candidate) ? candidate : `<!doctype html>\n${candidate}`;
  return { ok: true, html };
}

export const prototypeModule: CoreModule = {
  name: "@isocan/prototype",
  propertyKeys: [
    PROTOTYPE_PROPS.tier,
    PROTOTYPE_PROPS.prompt,
    PROTOTYPE_PROPS.delegatedSession,
  ],
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const protos = Object.values(canvas.items)
      .filter((item) => Boolean(item.properties?.[PROTOTYPE_PROPS.tier]))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (protos.length === 0) return [];
    const list = protos
      .slice(0, 4)
      .map((i) => `${i.title} (${i.properties[PROTOTYPE_PROPS.tier]})`)
      .join(", ");
    return [
      {
        name: "Prototypes",
        source: "canvas",
        present: true,
        size: `${protos.length} prototype${protos.length === 1 ? "" : "s"} — ${list}`,
        updatedAt: protos[0]!.updatedAt,
      },
    ];
  },
};

export default prototypeModule;
