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
 * **OpenNode envelope validator** (Open Stitch Phase 4).
 *
 * Pure hand-written validator (zero runtime dependencies) for batches of nodes,
 * edges, and patches emitted by agent sessions or `isocan workbench emit`.
 * Rejects dangerous URL schemes (`javascript:`, `file:`) and strips
 * `terminal.command` unless `trustedProducer === TRUSTED_WORKBENCH_PRODUCER`.
 */

/** Producer tag required before `parseOpenNodeSpec` preserves `terminal.command`. */
export const TRUSTED_WORKBENCH_PRODUCER = "workbench_driver";

const OPEN_NODE_SCHEMAS = [
  "openstitch.node.v1",
  "openstitch.node.v2",
] as const;
type OpenNodeSchema = (typeof OPEN_NODE_SCHEMAS)[number];

const OPEN_NODE_KINDS = [
  "markdown",
  "sticky",
  "site",
  "image",
  "terminal",
  "session",
] as const;
type OpenNodeKind = (typeof OPEN_NODE_KINDS)[number];

/** Maximum nodes permitted in one OpenNode envelope. */
export const OPEN_NODE_MAX_NODES = 24;
/** Maximum edges permitted in one OpenNode envelope. */
export const OPEN_NODE_MAX_EDGES = 48;
/** Maximum patches permitted in one OpenNode envelope. */
export const OPEN_NODE_MAX_PATCHES = 24;

/** Single node specification emitted by a workbench session or CLI. */
export interface OpenNodeSpec {
  id?: string;
  kind: OpenNodeKind;
  title?: string;
  content?: string;
  url?: string;
  command?: string;
  driver?: string;
  sessionId?: string;
  workspace?: string;
  sourceRef?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, string>;
}

interface OpenEdgeSpec {
  from: string;
  to: string;
  key?: string;
  label?: string;
}

interface OpenPatchSpec {
  target: string;
  title?: string;
  description?: string;
  content?: string;
  properties?: Record<string, string>;
}

interface OpenNodeGroupSpec {
  id?: string;
  title?: string;
}

/** Validated OpenNode batch envelope (`nodes`, `edges`, `patches`, optional group). */
export interface OpenNodeEnvelope {
  $schema: OpenNodeSchema;
  nodes: OpenNodeSpec[];
  edges: OpenEdgeSpec[];
  patches: OpenPatchSpec[];
  upsertBySourceRef?: boolean;
  group?: OpenNodeGroupSpec;
}

const SCHEMA_SET: ReadonlySet<string> = new Set(OPEN_NODE_SCHEMAS);
const KIND_SET: ReadonlySet<string> = new Set(OPEN_NODE_KINDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDangerousUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (/^(javascript|file|vbscript):/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    return proto === "javascript:" || proto === "file:" || proto === "vbscript:";
  } catch {
    return false;
  }
}

function parseStringRecord(
  raw: unknown,
  label: string,
): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: `${label} must be an object` };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") {
      return { ok: false, error: `${label}.${k} must be a string` };
    }
    out[k] = v;
  }
  return { ok: true, value: out };
}

function optionalFiniteNumber(raw: unknown, label: string): { ok: true; value?: number } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true };
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, error: `${label} must be a finite number` };
  }
  return { ok: true, value: raw };
}

/** Validate and normalize an untrusted OpenNode envelope payload. */
export function parseOpenNodeSpec(
  raw: unknown,
  opts?: { trustedProducer?: string },
): { ok: true; spec: OpenNodeEnvelope } | { ok: false; error: string } {
  if (!isRecord(raw)) {
    return { ok: false, error: "OpenNode envelope must be an object" };
  }

  const schema = raw.$schema;
  if (typeof schema !== "string" || !SCHEMA_SET.has(schema)) {
    return {
      ok: false,
      error: `$schema must be one of ${OPEN_NODE_SCHEMAS.join(", ")}`,
    };
  }

  const rawNodes = raw.nodes ?? [];
  if (!Array.isArray(rawNodes)) {
    return { ok: false, error: "nodes must be an array" };
  }
  if (rawNodes.length > OPEN_NODE_MAX_NODES) {
    return {
      ok: false,
      error: `nodes exceeds maximum of ${OPEN_NODE_MAX_NODES} (got ${rawNodes.length})`,
    };
  }

  const rawEdges = raw.edges ?? [];
  if (!Array.isArray(rawEdges)) {
    return { ok: false, error: "edges must be an array" };
  }
  if (rawEdges.length > OPEN_NODE_MAX_EDGES) {
    return {
      ok: false,
      error: `edges exceeds maximum of ${OPEN_NODE_MAX_EDGES} (got ${rawEdges.length})`,
    };
  }

  const rawPatches = raw.patches ?? [];
  if (!Array.isArray(rawPatches)) {
    return { ok: false, error: "patches must be an array" };
  }
  if (rawPatches.length > OPEN_NODE_MAX_PATCHES) {
    return {
      ok: false,
      error: `patches exceeds maximum of ${OPEN_NODE_MAX_PATCHES} (got ${rawPatches.length})`,
    };
  }

  const trusted = opts?.trustedProducer === TRUSTED_WORKBENCH_PRODUCER;
  const nodes: OpenNodeSpec[] = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const entry = rawNodes[i];
    if (!isRecord(entry)) {
      return { ok: false, error: `nodes[${i}] must be an object` };
    }
    if (typeof entry.kind !== "string" || !KIND_SET.has(entry.kind)) {
      return {
        ok: false,
        error: `nodes[${i}].kind must be one of ${OPEN_NODE_KINDS.join(", ")}`,
      };
    }

    if (entry.url !== undefined) {
      if (typeof entry.url !== "string" || !entry.url.trim()) {
        return { ok: false, error: `nodes[${i}].url must be a non-empty string` };
      }
      if (isDangerousUrl(entry.url)) {
        return { ok: false, error: `nodes[${i}].url uses a disallowed URL scheme` };
      }
    }

    const x = optionalFiniteNumber(entry.x, `nodes[${i}].x`);
    if (!x.ok) return x;
    const y = optionalFiniteNumber(entry.y, `nodes[${i}].y`);
    if (!y.ok) return y;
    const width = optionalFiniteNumber(entry.width, `nodes[${i}].width`);
    if (!width.ok) return width;
    const height = optionalFiniteNumber(entry.height, `nodes[${i}].height`);
    if (!height.ok) return height;

    let props: Record<string, string> | undefined;
    if (entry.properties !== undefined) {
      const parsedProps = parseStringRecord(entry.properties, `nodes[${i}].properties`);
      if (!parsedProps.ok) return parsedProps;
      props = parsedProps.value;
    }

    const node: OpenNodeSpec = {
      kind: entry.kind as OpenNodeKind,
      ...(typeof entry.id === "string" && entry.id.trim() ? { id: entry.id.trim() } : {}),
      ...(typeof entry.title === "string" ? { title: entry.title } : {}),
      ...(typeof entry.content === "string" ? { content: entry.content } : {}),
      ...(typeof entry.url === "string" ? { url: entry.url.trim() } : {}),
      ...(trusted && typeof entry.command === "string" ? { command: entry.command } : {}),
      ...(typeof entry.driver === "string" ? { driver: entry.driver } : {}),
      ...(typeof entry.sessionId === "string" ? { sessionId: entry.sessionId } : {}),
      ...(typeof entry.workspace === "string" ? { workspace: entry.workspace } : {}),
      ...(typeof entry.sourceRef === "string" && entry.sourceRef.trim() ? { sourceRef: entry.sourceRef.trim() } : {}),
      ...(x.value !== undefined ? { x: x.value } : {}),
      ...(y.value !== undefined ? { y: y.value } : {}),
      ...(width.value !== undefined ? { width: width.value } : {}),
      ...(height.value !== undefined ? { height: height.value } : {}),
      ...(props ? { properties: props } : {}),
    };
    nodes.push(node);
  }

  const edges: OpenEdgeSpec[] = [];
  for (let i = 0; i < rawEdges.length; i++) {
    const entry = rawEdges[i];
    if (!isRecord(entry)) {
      return { ok: false, error: `edges[${i}] must be an object` };
    }
    if (typeof entry.from !== "string" || !entry.from.trim()) {
      return { ok: false, error: `edges[${i}].from must be a non-empty string` };
    }
    if (typeof entry.to !== "string" || !entry.to.trim()) {
      return { ok: false, error: `edges[${i}].to must be a non-empty string` };
    }
    edges.push({
      from: entry.from.trim(),
      to: entry.to.trim(),
      ...(typeof entry.key === "string" && entry.key.trim() ? { key: entry.key.trim() } : {}),
      ...(typeof entry.label === "string" ? { label: entry.label } : {}),
    });
  }

  const patches: OpenPatchSpec[] = [];
  for (let i = 0; i < rawPatches.length; i++) {
    const entry = rawPatches[i];
    if (!isRecord(entry)) {
      return { ok: false, error: `patches[${i}] must be an object` };
    }
    if (typeof entry.target !== "string" || !entry.target.trim()) {
      return { ok: false, error: `patches[${i}].target must be a non-empty string` };
    }
    let props: Record<string, string> | undefined;
    if (entry.properties !== undefined) {
      const parsedProps = parseStringRecord(entry.properties, `patches[${i}].properties`);
      if (!parsedProps.ok) return parsedProps;
      props = parsedProps.value;
    }
    patches.push({
      target: entry.target.trim(),
      ...(typeof entry.title === "string" ? { title: entry.title } : {}),
      ...(typeof entry.description === "string" ? { description: entry.description } : {}),
      ...(typeof entry.content === "string" ? { content: entry.content } : {}),
      ...(props ? { properties: props } : {}),
    });
  }

  let group: OpenNodeGroupSpec | undefined;
  if (raw.group !== undefined) {
    if (!isRecord(raw.group)) {
      return { ok: false, error: "group must be an object" };
    }
    group = {
      ...(typeof raw.group.id === "string" && raw.group.id.trim() ? { id: raw.group.id.trim() } : {}),
      ...(typeof raw.group.title === "string" && raw.group.title.trim() ? { title: raw.group.title.trim() } : {}),
    };
  }

  if (raw.upsertBySourceRef !== undefined && typeof raw.upsertBySourceRef !== "boolean") {
    return { ok: false, error: "upsertBySourceRef must be a boolean" };
  }

  return {
    ok: true,
    spec: {
      $schema: schema as OpenNodeSchema,
      nodes,
      edges,
      patches,
      ...(raw.upsertBySourceRef !== undefined ? { upsertBySourceRef: raw.upsertBySourceRef } : {}),
      ...(group ? { group } : {}),
    },
  };
}
