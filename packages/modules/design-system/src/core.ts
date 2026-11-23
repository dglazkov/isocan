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

import type { Actor, CanvasContents, ContextPiece, CoreModule, ModuleKind } from "@isocan/core";
import type { CredentialRef } from "@isocan/core/keys";

/** MIME type for structured design system specification items. */
export const DESIGN_SYSTEM_MIME = "application/vnd.isocan.design-system+json";

/** Property keys owned by this module. */
export const DESIGN_PROPS = {
  role: "design.role",
  tokens: "design.tokens",
} as const;

/** Server routes mounted under `/api/m/design-system/`. */
export const DESIGN_SYSTEM_ROUTE = "/api/m/design-system/system";
export const DESIGN_CRITIQUE_ROUTE = "/api/m/design-system/critique";
export const DESIGN_MOCKUPS_ROUTE = "/api/m/design-system/mockups";

export const DESIGN_SYSTEM_KIND: ModuleKind = {
  id: "design-system",
  mimes: [DESIGN_SYSTEM_MIME],
  extensions: ["design-system.json"],
  label: "Design systems",
  noun: "design system",
};

/** One named color token in a design system specification. */
export interface DesignColorToken {
  name: string;
  hex: string;
  usage?: string;
}

/** Typography scale entry. */
export interface DesignTypeToken {
  role: string;
  family: string;
  size: string;
  weight?: string;
}

/** Structured design system specification rendered by the sticker-sheet card and compiled to `DESIGN.md`. */
export interface DesignSystemSpec {
  name: string;
  summary: string;
  palette: DesignColorToken[];
  typography: DesignTypeToken[];
  spacing?: string[];
  radii?: string[];
  principles?: string[];
}

export interface DesignSystemRequest {
  canvasId: string;
  prompt: string;
  title?: string;
  actor?: Actor;
}

export interface DesignSystemResponse {
  systemItemId: string;
  designMdItemId: string;
  spec: DesignSystemSpec;
  designMd: string;
  model: string;
  credentialRef: CredentialRef;
}

export interface DesignCritiqueRequest {
  canvasId: string;
  itemId: string;
  systemItemId?: string;
  actor?: Actor;
}

export interface DesignCritiqueResponse {
  reviewItemId: string;
  targetItemId: string;
  critique: string;
  model: string;
  credentialRef: CredentialRef;
}

export interface DesignMockupsRequest {
  canvasId: string;
  systemItemId: string;
  prompt?: string;
  count?: number;
  actor?: Actor;
}

export interface DesignMockupsResponse {
  systemItemId: string;
  mockupItemIds: string[];
  directions: string[];
  model: string;
  credentialRef: CredentialRef;
}

/**
 * Compile a `DesignSystemSpec` into clean, deterministic `DESIGN.md` markdown.
 * Pure — shared across server, web, CLI, and tests.
 */
export function compileDesignMd(spec: DesignSystemSpec): string {
  const lines: string[] = [];
  lines.push(`# ${spec.name.trim() || "Design System"}`);
  lines.push("");
  if (spec.summary.trim()) {
    lines.push(spec.summary.trim());
    lines.push("");
  }

  lines.push("## Color Palette");
  lines.push("");
  if (spec.palette.length > 0) {
    lines.push("| Token | Hex | Usage |");
    lines.push("| --- | --- | --- |");
    for (const color of spec.palette) {
      lines.push(`| ${color.name} | \`${color.hex}\` | ${color.usage ?? "—"} |`);
    }
  } else {
    lines.push("_No palette tokens defined._");
  }
  lines.push("");

  lines.push("## Typography");
  lines.push("");
  if (spec.typography.length > 0) {
    lines.push("| Role | Family | Size | Weight |");
    lines.push("| --- | --- | --- | --- |");
    for (const t of spec.typography) {
      lines.push(`| ${t.role} | ${t.family} | ${t.size} | ${t.weight ?? "400"} |`);
    }
  } else {
    lines.push("_No typography tokens defined._");
  }
  lines.push("");

  if (spec.spacing && spec.spacing.length > 0) {
    lines.push("## Spacing Scale");
    lines.push("");
    lines.push(spec.spacing.map((s) => `\`${s}\``).join(" · "));
    lines.push("");
  }

  if (spec.radii && spec.radii.length > 0) {
    lines.push("## Border Radii");
    lines.push("");
    lines.push(spec.radii.map((r) => `\`${r}\``).join(" · "));
    lines.push("");
  }

  if (spec.principles && spec.principles.length > 0) {
    lines.push("## Principles");
    lines.push("");
    for (const p of spec.principles) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Parse a serialized `DesignSystemSpec` JSON string, returning null when malformed. */
export function parseDesignSystemSpec(raw: string): DesignSystemSpec | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DesignSystemSpec>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    return {
      name: parsed.name.trim(),
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      palette: Array.isArray(parsed.palette)
        ? parsed.palette.filter(
            (c): c is DesignColorToken =>
              Boolean(c && typeof c === "object" && typeof c.name === "string" && typeof c.hex === "string"),
          )
        : [],
      typography: Array.isArray(parsed.typography)
        ? parsed.typography.filter(
            (t): t is DesignTypeToken =>
              Boolean(t && typeof t === "object" && typeof t.role === "string" && typeof t.family === "string" && typeof t.size === "string"),
          )
        : [],
      ...(Array.isArray(parsed.spacing) ? { spacing: parsed.spacing.filter((s): s is string => typeof s === "string") } : {}),
      ...(Array.isArray(parsed.radii) ? { radii: parsed.radii.filter((r): r is string => typeof r === "string") } : {}),
      ...(Array.isArray(parsed.principles) ? { principles: parsed.principles.filter((p): p is string => typeof p === "string") } : {}),
    };
  } catch {
    return null;
  }
}

/** Short token summary stored in `properties["design.tokens"]`. */
export function summarizeTokens(spec: DesignSystemSpec): string {
  const swatches = spec.palette.slice(0, 4).map((c) => c.hex).join(",");
  const font = spec.typography[0]?.family ?? "system-ui";
  return `${spec.palette.length} colors (${swatches || "none"}); ${spec.typography.length} type styles (${font})`;
}

export const designSystemModule: CoreModule = {
  name: "@isocan/design-system",
  kinds: [DESIGN_SYSTEM_KIND],
  propertyKeys: [DESIGN_PROPS.role, DESIGN_PROPS.tokens],
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const systems = Object.values(canvas.items)
      .filter((item) => item.properties?.[DESIGN_PROPS.role] === "system")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (systems.length === 0) return [];
    const names = systems.slice(0, 4).map((i) => i.title).join(", ");
    return [
      {
        name: "Design systems",
        source: "canvas",
        present: true,
        size: `${systems.length} system${systems.length === 1 ? "" : "s"} — ${names}`,
        updatedAt: systems[0]!.updatedAt,
      },
    ];
  },
};

export default designSystemModule;
