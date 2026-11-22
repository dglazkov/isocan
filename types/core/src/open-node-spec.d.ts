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
export declare const TRUSTED_WORKBENCH_PRODUCER = "workbench_driver";
declare const OPEN_NODE_SCHEMAS: readonly ["openstitch.node.v1", "openstitch.node.v2"];
type OpenNodeSchema = (typeof OPEN_NODE_SCHEMAS)[number];
declare const OPEN_NODE_KINDS: readonly ["markdown", "sticky", "site", "image", "terminal", "session"];
type OpenNodeKind = (typeof OPEN_NODE_KINDS)[number];
/** Maximum nodes permitted in one OpenNode envelope. */
export declare const OPEN_NODE_MAX_NODES = 24;
/** Maximum edges permitted in one OpenNode envelope. */
export declare const OPEN_NODE_MAX_EDGES = 48;
/** Maximum patches permitted in one OpenNode envelope. */
export declare const OPEN_NODE_MAX_PATCHES = 24;
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
/** Validate and normalize an untrusted OpenNode envelope payload. */
export declare function parseOpenNodeSpec(raw: unknown, opts?: {
    trustedProducer?: string;
}): {
    ok: true;
    spec: OpenNodeEnvelope;
} | {
    ok: false;
    error: string;
};
export {};
