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

import type { CanvasContents, CoreModule, ModuleEdge, ModuleKind } from "@isocan/core";

/** Binary glTF 2.0 MIME type. */
export const GLB_MIME = "model/gltf-binary";

/** 3D Model item kind registered with core. */
export const MODEL3D_KIND: ModuleKind = {
  id: "model3d",
  mimes: [GLB_MIME],
  extensions: ["glb"],
  label: "3D Model",
  noun: "3D model",
  icon: "drawing",
};

/** Item property keys owned by this module. */
export const MODEL3D_PROPS = {
  camera: "model3d.camera",
  posterItem: "model3d.posterItem",
} as const;

/** GLB 2.0 binary container constants (glTF 2.0 §4.4). */
export const GLB_MAGIC = 0x46546c67; // "glTF" little-endian
export const GLB_JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
export const GLB_BIN_CHUNK_TYPE = 0x004e4942; // "BIN\0"
export const MAX_GLB_JSON_BYTES = 8 * 1024 * 1024;
const MAX_GLB_JSON_NODES = 250_000;
const MAX_GLB_TRAILING_CHUNKS = 32;

/** Parsed GLB 2.0 header and containment check result. */
export interface GlbHeaderResult {
  valid: boolean;
  version?: number;
  byteLength?: number;
  jsonByteLength?: number;
  binByteLength?: number;
  meshCount?: number;
  nodeCount?: number;
  hasExternalRefs?: boolean;
  error?: string;
}

/**
 * Pure GLB 2.0 container & containment validator.
 *
 * Verifies the `glTF` magic (`0x46546C67`), version 2, exact byte length,
 * 4-byte aligned JSON chunk, `asset.version === "2.0"`, trailing chunk layout,
 * embedded buffer bounds, and rejects external `uri` references (anything other
 * than `data:` URIs, ignoring `extras`) so uploaded GLBs are self-contained.
 */
export function parseGlbHeader(bytes: Uint8Array): GlbHeaderResult {
  const size = bytes.byteLength;
  if (size < 24 || size % 4 !== 0) {
    return {
      valid: false,
      byteLength: size,
      error: "GLB must be at least 24 bytes and 4-byte aligned",
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    return {
      valid: false,
      byteLength: size,
      error: `invalid GLB magic 0x${magic.toString(16).padStart(8, "0")} (expected 0x46546c67)`,
    };
  }

  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);
  if (version !== 2) {
    return {
      valid: false,
      version,
      byteLength: declaredLength,
      error: `unsupported GLB version ${version} (expected 2)`,
    };
  }
  if (declaredLength !== size) {
    return {
      valid: false,
      version,
      byteLength: declaredLength,
      error: `GLB header length ${declaredLength} does not match buffer size ${size}`,
    };
  }

  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== GLB_JSON_CHUNK_TYPE) {
    return {
      valid: false,
      version,
      byteLength: declaredLength,
      error: "first GLB chunk must be JSON (0x4e4f534a)",
    };
  }
  if (jsonLength === 0 || jsonLength % 4 !== 0 || 20 + jsonLength > size) {
    return {
      valid: false,
      version,
      byteLength: declaredLength,
      error: "invalid GLB JSON chunk length",
    };
  }
  if (jsonLength > MAX_GLB_JSON_BYTES) {
    return {
      valid: false,
      version,
      byteLength: declaredLength,
      jsonByteLength: jsonLength,
      error: "GLB JSON chunk exceeds the 8 MiB limit",
    };
  }

  let scene: Record<string, unknown>;
  try {
    const jsonBytes = bytes.subarray(20, 20 + jsonLength);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(jsonBytes);
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { valid: false, version, byteLength: declaredLength, error: "GLB JSON chunk must be a JSON object" };
    }
    scene = parsed as Record<string, unknown>;
  } catch {
    return { valid: false, version, byteLength: declaredLength, error: "GLB JSON chunk is not valid UTF-8 JSON" };
  }

  const asset = scene.asset as { version?: unknown } | undefined;
  if (!asset || typeof asset !== "object" || asset.version !== "2.0") {
    return {
      valid: false,
      version,
      byteLength: declaredLength,
      error: 'GLB scene JSON must declare asset.version === "2.0"',
    };
  }

  // Containment check: no external URI references (skipping `extras` metadata).
  const queue: unknown[] = [scene];
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.pop();
    if (++visited > MAX_GLB_JSON_NODES) {
      return {
        valid: false,
        version,
        byteLength: declaredLength,
        error: "GLB scene JSON exceeds maximum node traversal limit",
      };
    }
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current)) {
      if (key === "extras") continue;
      if (key === "uri") {
        if (typeof child !== "string" || !/^data:[^,]+,/i.test(child)) {
          return {
            valid: false,
            version,
            byteLength: declaredLength,
            jsonByteLength: jsonLength,
            hasExternalRefs: true,
            error: "GLB contains external URI references; only self-contained GLB 2.0 files are allowed",
          };
        }
      }
      if (child && typeof child === "object") queue.push(child);
    }
  }

  // Validate trailing chunks (optional BIN chunk must be first trailing chunk).
  let offset = 20 + jsonLength;
  let binLength: number | undefined;
  let trailingChunks = 0;
  while (offset < size) {
    if (++trailingChunks > MAX_GLB_TRAILING_CHUNKS || offset + 8 > size) {
      return { valid: false, version, byteLength: declaredLength, error: "malformed trailing GLB chunks" };
    }
    const chunkLen = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    if (chunkLen % 4 !== 0 || offset + 8 + chunkLen > size || chunkType === GLB_JSON_CHUNK_TYPE) {
      return { valid: false, version, byteLength: declaredLength, error: "invalid trailing GLB chunk header" };
    }
    if (chunkType === GLB_BIN_CHUNK_TYPE) {
      if (trailingChunks !== 1 || binLength !== undefined) {
        return { valid: false, version, byteLength: declaredLength, error: "duplicate or misplaced BIN chunk in GLB" };
      }
      binLength = chunkLen;
    }
    offset += 8 + chunkLen;
  }

  // Validate embedded buffer lengths against BIN chunk.
  if (scene.buffers !== undefined) {
    if (!Array.isArray(scene.buffers)) {
      return { valid: false, version, byteLength: declaredLength, error: "GLB scene.buffers must be an array" };
    }
    for (const [index, rawBuf] of scene.buffers.entries()) {
      const buf = rawBuf as { byteLength?: unknown; uri?: unknown } | null;
      if (!buf || typeof buf !== "object" || !Number.isSafeInteger(buf.byteLength) || (buf.byteLength as number) < 1) {
        return { valid: false, version, byteLength: declaredLength, error: "GLB buffer entry has invalid byteLength" };
      }
      if (
        buf.uri === undefined &&
        (index !== 0 ||
          binLength === undefined ||
          (buf.byteLength as number) > binLength ||
          binLength - (buf.byteLength as number) > 3)
      ) {
        return { valid: false, version, byteLength: declaredLength, error: "GLB embedded buffer length does not match BIN chunk" };
      }
    }
  }

  const meshCount = Array.isArray(scene.meshes) ? scene.meshes.length : 0;
  const nodeCount = Array.isArray(scene.nodes) ? scene.nodes.length : 0;

  return {
    valid: true,
    version,
    byteLength: declaredLength,
    jsonByteLength: jsonLength,
    ...(binLength !== undefined ? { binByteLength: binLength } : {}),
    meshCount,
    nodeCount,
    hasExternalRefs: false,
  };
}

/** Orbit camera pose stored on `model3d.camera` as `"az,el,dist"`. */
export interface CameraPose {
  azimuth: number;
  elevation: number;
  distance: number;
}

/** Default orbit camera pose when `model3d.camera` is unset. */
export const DEFAULT_CAMERA_POSE: CameraPose = {
  azimuth: 35,
  elevation: 20,
  distance: 3,
};

/** Parse `"az,el,dist"` into a validated `CameraPose`, or `null` when invalid. */
export function parseCameraPose(raw: string | undefined): CameraPose | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 3 || parts.some((p) => !p)) return null;
  const [azimuth, elevation, distance] = parts.map(Number);
  if (
    azimuth === undefined ||
    elevation === undefined ||
    distance === undefined ||
    !Number.isFinite(azimuth) ||
    !Number.isFinite(elevation) ||
    !Number.isFinite(distance) ||
    distance <= 0
  ) {
    return null;
  }
  return { azimuth, elevation, distance };
}

/** Format a `CameraPose` into the canonical `"az,el,dist"` property string. */
export function formatCameraPose(pose: CameraPose): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${round(pose.azimuth)},${round(pose.elevation)},${round(pose.distance)}`;
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Adds the `model3d` kind (`model/gltf-binary`, `.glb`), owns `model3d.camera`
 * and `model3d.posterItem`, remaps `model3d.posterItem` on copy, and emits an
 * edge from a 3D model to its captured poster image.
 */
export const model3dModule: CoreModule = {
  name: "@isocan/model3d",
  kinds: [MODEL3D_KIND],
  propertyKeys: [MODEL3D_PROPS.camera, MODEL3D_PROPS.posterItem],
  itemReferenceProperties: [MODEL3D_PROPS.posterItem],
  edges(canvas: CanvasContents): ModuleEdge[] {
    const out: ModuleEdge[] = [];
    for (const item of Object.values(canvas.items)) {
      const posterId = item.properties?.[MODEL3D_PROPS.posterItem];
      if (!posterId) continue;
      const poster = canvas.items[posterId];
      if (poster) out.push({ from: item, to: poster });
    }
    return out;
  },
};

export default model3dModule;
