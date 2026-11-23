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

import { useRef, useState, type ComponentType, type PointerEvent } from "react";
import type { InspectorFacts, RendererFacts, WebModule } from "@isocan/core";
import {
  DEFAULT_CAMERA_POSE,
  GLB_MIME,
  MODEL3D_KIND,
  MODEL3D_PROPS,
  formatCameraPose,
  model3dModule,
  parseCameraPose,
  type CameraPose,
} from "./core.ts";

/** Project a 3D point onto a 2D viewport using a lightweight orbit rotation (zero WebGL/Three.js deps). */
function projectPoint(
  x: number,
  y: number,
  z: number,
  azDeg: number,
  elDeg: number,
  distance: number,
): [number, number] {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const cosA = Math.cos(az);
  const sinA = Math.sin(az);
  const cosE = Math.cos(el);
  const sinE = Math.sin(el);

  const rx = x * cosA - z * sinA;
  const rz1 = x * sinA + z * cosA;
  const ry = y * cosE - rz1 * sinE;
  const rz = y * sinE + rz1 * cosE;

  const scale = 120 / Math.max(1.2, distance + rz * 0.45);
  return [100 + rx * scale, 70 - ry * scale];
}

const CUBE_VERTS: readonly [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

const CUBE_EDGES: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function Model3dCardRenderer(facts: RendererFacts) {
  const saved = parseCameraPose(facts.item?.properties?.[MODEL3D_PROPS.camera]) ?? DEFAULT_CAMERA_POSE;
  const [pose, setPose] = useState<CameraPose>(saved);
  const dragRef = useRef<{ x: number; y: number; az: number; el: number } | null>(null);

  const projected = CUBE_VERTS.map(([x, y, z]) =>
    projectPoint(x, y, z, pose.azimuth, pose.elevation, pose.distance),
  );

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!facts.entered) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, az: pose.azimuth, el: pose.elevation };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPose((prev) => ({
      ...prev,
      azimuth: Math.round((dragRef.current!.az + dx * 0.6) % 360),
      elevation: Math.max(-85, Math.min(85, Math.round(dragRef.current!.el + dy * 0.4))),
    }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div
      className="model3d-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        padding: "12px",
        boxSizing: "border-box",
        userSelect: "none",
        cursor: facts.entered ? "grab" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", opacity: 0.85 }}>
        <span
          className="model3d-badge"
          style={{
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            border: "1px solid currentColor",
          }}
        >
          GLB 2.0
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: "8px" }}>
          {facts.filename}
        </span>
      </div>

      <svg
        viewBox="0 0 200 140"
        role="img"
        aria-label={`3D orbit preview for ${facts.filename}`}
        style={{ width: "100%", flex: 1, minHeight: "88px" }}
      >
        {CUBE_EDGES.map(([a, b], idx) => {
          const p1 = projected[a]!;
          const p2 = projected[b]!;
          return (
            <line
              key={idx}
              x1={p1[0]}
              y1={p1[1]}
              x2={p2[0]}
              y2={p2[1]}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeOpacity={0.75}
            />
          );
        })}
      </svg>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", opacity: 0.75 }}>
        <code data-testid="model3d-pose">{formatCameraPose(pose)}</code>
        <span>{facts.entered ? "Drag to orbit" : "Enter to orbit"}</span>
      </div>
    </div>
  );
}

function Model3dInspector({ item, host }: InspectorFacts) {
  const initial = parseCameraPose(item.properties[MODEL3D_PROPS.camera]) ?? DEFAULT_CAMERA_POSE;
  const posterItem = item.properties[MODEL3D_PROPS.posterItem] ?? "";
  const [azimuth, setAzimuth] = useState(String(initial.azimuth));
  const [elevation, setElevation] = useState(String(initial.elevation));
  const [distance, setDistance] = useState(String(initial.distance));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onSavePose() {
    if (busy) return;
    const raw = `${azimuth.trim()},${elevation.trim()},${distance.trim()}`;
    const parsed = parseCameraPose(raw);
    if (!parsed) {
      setProblem("Enter finite numbers for azimuth, elevation, and positive distance.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await host.send([
        {
          type: "item.update",
          itemId: item.id,
          patch: { properties: { [MODEL3D_PROPS.camera]: formatCameraPose(parsed) } },
        },
      ]);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save camera pose.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="model3d-inspector" aria-label="3D model view">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
        <label>
          Azimuth
          <input type="number" value={azimuth} onChange={(e) => setAzimuth(e.target.value)} disabled={busy} />
        </label>
        <label>
          Elevation
          <input type="number" value={elevation} onChange={(e) => setElevation(e.target.value)} disabled={busy} />
        </label>
        <label>
          Distance
          <input type="number" step="0.1" min="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} disabled={busy} />
        </label>
      </div>
      {posterItem ? (
        <p className="model3d-poster">
          Poster item: <code>{posterItem}</code>
        </p>
      ) : null}
      {problem ? (
        <p className="model3d-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <button type="button" className="btn" disabled={busy} onClick={() => void onSavePose()}>
        {busy ? "Saving…" : "Save camera pose"}
      </button>
    </section>
  );
}

export const model3dWeb: WebModule<
  never,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>
> = {
  core: model3dModule,
  renderers: [
    {
      mimes: [GLB_MIME],
      component: Model3dCardRenderer,
    },
  ],
  inspectors: [
    {
      kinds: [MODEL3D_KIND.id],
      label: "3D Model",
      component: Model3dInspector,
    },
  ],
};

export default model3dWeb;
