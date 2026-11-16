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

import type { Item, WalkGraph } from "@isocan/core";

/**
 * **The flow a prototype plays, for a walk** (proactive-agent phase 9,
 * design §11: "a walk follows a real path: a wire flow's prototype links").
 * `assemblePrototype` embeds its table — the screen it opens on, the kept
 * screens, and where each hotspot goes — as JSON in the file; this reads it
 * back and hands core the graph (`CoreModule.walkFlow`), which walks it. Not
 * a prototype, or a table it cannot read: null, and core walks the item as
 * whatever else it is.
 *
 * The marker is `PROTOTYPE_MARKER`, spelled out: importing `prototype.ts`
 * would carry the renderer into the CLI's start and the web's first paint,
 * and this is registered by both (`test/walk-flow.test.ts` holds the two equal).
 */
const MARKER = "<!-- isocan:wireframe-prototype -->";

export function prototypeWalkFlow(_item: Item, html: string): WalkGraph | null {
  if (!html.includes(MARKER)) return null;
  const raw = /<script type="application\/json" id="isocan-prototype">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!raw) return null;
  try {
    const table = JSON.parse(raw) as { start?: unknown; screens?: { id?: unknown }[]; links?: { from?: unknown; to?: unknown }[] };
    if (typeof table.start !== "string" || !Array.isArray(table.screens)) return null;
    const screens = table.screens.flatMap((s) => (typeof s.id === "string" ? [s.id] : []));
    const links = (table.links ?? []).flatMap((l) => (typeof l.from === "string" && typeof l.to === "string" && l.to !== "back" ? [{ from: l.from, to: l.to }] : []));
    return { start: table.start, screens, links };
  } catch {
    return null;
  }
}
