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

import { useEffect, useState } from "react";
import type { Item, RendererFacts } from "@isocan/core";
import { EXACT_PROPS } from "./core.ts";
import { HOST_NAMES, parseWall, type Wall, type WallCell } from "./hosts.ts";
import { ExactScreen } from "./live.tsx";

/**
 * **The device wall** (exact phase 3; design §7, journey scene 3): one
 * route on every host and device, side by side, for a review or a slide.
 * Each cell is drawn as its screen is — the capture, or, for a web cell this
 * viewer set Live, the running page — so Alt-click points in any of them,
 * the outline shows in every live one, and any cell can be driven.
 */

/** A cell's screen, as `ExactScreen` reads one: only its id and the properties a screen carries. */
function cellItem(wall: Wall, cell: WallCell): Item {
  return {
    id: cell.itemId,
    title: cell.title,
    properties: {
      [EXACT_PROPS.app]: JSON.stringify({ id: wall.app.id }),
      [EXACT_PROPS.route]: wall.route,
      [EXACT_PROPS.host]: cell.host,
      [EXACT_PROPS.device]: cell.device,
      [EXACT_PROPS.scheme]: cell.scheme,
      [EXACT_PROPS.url]: cell.url,
      ...(cell.shots !== undefined ? { [EXACT_PROPS.reached]: cell.shots } : {}),
      ...(cell.points !== undefined ? { [EXACT_PROPS.points]: cell.points } : {}),
    },
  } as unknown as Item;
}

export function WallCard(facts: RendererFacts) {
  const { blobHash, readText, url } = facts;
  const [state, setState] = useState<{ hash: string; wall?: Wall; problem?: string } | null>(null);
  useEffect(() => {
    let live = true;
    readText()
      .then((t) => { if (live) setState({ hash: blobHash, wall: parseWall(t) }); })
      .catch((err: unknown) => { if (live) setState({ hash: blobHash, problem: err instanceof Error ? err.message : String(err) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobHash]);
  if (!state || state.hash !== blobHash) return <div className="exact-index exact-note">Reading the wall…</div>;
  if (!state.wall) return <div className="exact-index exact-problem">{state.problem}</div>;
  const wall = state.wall;
  // Every blob of a canvas is served beside this one: the cell's bytes are the same address with its own hash.
  const urlOf = (hash: string) => (url.includes(blobHash) ? url.replace(blobHash, hash) : url);
  return (
    <div className="exact-wall" data-exact-wall={wall.route}>
      <h3>{wall.app.name} · {wall.route} — {wall.cells.length} screens, {[...new Set(wall.cells.map((c) => HOST_NAMES[c.host]))].join(", ")}</h3>
      <div className="exact-wall-row">
        {wall.cells.map((cell) => (
          <div key={cell.itemId} className="exact-wall-cell" data-exact-cell={`${cell.host}-${cell.device}`}>
            <span>{HOST_NAMES[cell.host]} · {cell.device}</span>
            <div className="exact-wall-frame" style={{ aspectRatio: `${cell.width} / ${cell.height}` }}>
              <ExactScreen {...facts} item={cellItem(wall, cell)} blobHash={cell.blobHash} mimeType="image/png" filename={cell.title} url={urlOf(cell.blobHash)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
