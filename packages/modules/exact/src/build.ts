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
 * **Building the index** (exact phases 0–1; design §3): from what the bridge
 * read to the index, the capture key and the design system's DESIGN.md.
 * Only the CLI's verbs need it, so it is kept apart from `core.ts`, which
 * every CLI start-up reads.
 */

import { designSystemProperties, serializeDesign, type DesignTokens } from "@isocan/core";
import type { ExactIndex, Readings } from "./core.ts";
import { core } from "./core-ref.ts";
import { DEVICES, anatomy, flowEdges, indexDesign, type Device, type IndexDesign, type Scheme } from "./map.ts";

const own = (def: { file: string }) => def.file.endsWith(".contract") && !def.file.includes(":");

/** The index of design §3, from the readings alone. */
export function buildIndex(readings: Readings): ExactIndex {
  const { router, routes } = core.contractRoutes(readings.symbols, readings.sources);
  const defs = readings.symbols.definitions.filter(own);
  const names = (kind: string) => [...new Set(defs.filter((d) => d.kind === kind).map((d) => d.name))].sort();
  const flow = flowEdges(readings.symbols, readings.sources, routes, router);
  const files = [...new Set([...Object.keys(readings.sources), ...(readings.tests ?? []).map((t) => t.file)])];
  return {
    format: core.EXACT_INDEX_FORMAT,
    app: readings.app,
    exact: readings.exact,
    plan: readings.plan,
    routes,
    router,
    components: names("component"),
    actions: defs.filter((d) => d.kind === "action").map((d) => ({ name: d.name, component: d.component ?? null, writes: d.writes ?? [] })),
    sources: [...new Set(readings.symbols.definitions.filter((d) => d.kind === "source" && own(d)).map((d) => d.name))].sort(),
    routesJson: core.checkRoutes(routes, readings.routesJson),
    edges: flow.edges,
    unplaced: flow.unplaced,
    anatomy: anatomy(readings.symbols, files, readings.tests ?? []),
    grants: readings.grants ?? null,
    design: indexDesign(readings.design ?? null),
    inputs: readings.inputs ?? null,
  };
}

/**
 * **What a capture depends on**, in a fixed order — the CLI digests it into
 * `exact.key`. Equal parts, equal picture: the capture is skipped.
 */
export function captureKeyParts(index: ExactIndex, route: string, device: Device, scheme: Scheme, shots: string): string {
  // "points": a capture carries its nodes' boxes since exact phase 2, so an older capture is taken again once.
  return JSON.stringify([index.inputs, route, device, scheme, "web", core.CAPTURE_AT, DEVICES[device], shots, "points"]);
}

/**
 * **`app.tamber` as the canvas's design system** (design §3): a DESIGN.md —
 * isocan's own format, so `isocan style`, `design check` and the DTCG export
 * read it with nothing of ours — whose colours are each token's light value,
 * and whose body says, per token, its light and dark values and every place
 * the app reads it (`tamber uses`). The full IR rides in `isocan.exact`.
 */
export function designMarkdown(index: ExactIndex): string | null {
  const design = index.design;
  if (!design) return null;
  const colors: Record<string, string> = {};
  const spacing: Record<string, string | number> = {};
  for (const t of design.tokens) {
    if (t.kind === "color" && t.light && /^#[0-9a-f]{6}$/.test(t.light)) colors[t.name] = t.light;
    else if ((t.kind === "number" || t.kind === "length") && t.values.length === 1 && /^\d+(\.\d+)?(px)?$/.test(t.values[0]!)) spacing[t.name] = /px$/.test(t.values[0]!) ? t.values[0]! : Number(t.values[0]);
  }
  const tokens: DesignTokens = {
    name: `${index.app.name} (app.tamber)`,
    description: `The design of the Exact app ${index.app.id}, read from its app.tamber by \`tamber ir\` (digest ${design.digest}). Edit app.tamber, not this file: the next capture rewrites it.`,
    ...(Object.keys(colors).length ? { colors } : {}),
    ...(Object.keys(spacing).length ? { spacing } : {}),
    isocan: { exact: { app: index.app.id, digest: design.digest, tokens: design.tokens.map((t) => ({ name: t.name, kind: t.kind, values: t.values })) } },
  };
  const where = (t: IndexDesign["tokens"][number]) => t.uses.length === 0 ? "not used" : t.uses.map((u) => `${u.file}:${u.line}${u.component ? ` (${u.component})` : ""}`).join(", ");
  const rows = design.tokens.map((t) => `| \`${t.name}\` | ${t.kind} | ${t.light ?? t.values.join(" ")} | ${t.dark ?? ""} | ${where(t)} |`);
  const body = [
    "## Overview",
    "",
    `The tokens of ${index.app.name}'s \`app.tamber\`, as the app's own compiler folds them, with where each is used.`,
    "",
    "## Colors",
    "",
    "| Token | Kind | Light | Dark | Used at |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
  return serializeDesign(tokens, body);
}

export function designItemProperties(index: ExactIndex): Record<string, string> {
  return { ...designSystemProperties(), [core.EXACT_PROPS.app]: JSON.stringify({ id: index.app.id }), [core.EXACT_PROPS.tamber]: index.design?.digest ?? "" };
}
