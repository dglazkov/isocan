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

import { createHash } from "node:crypto";
import { applyOperation, invertOperation, type CanvasState, type Operation } from "@isocan/core";
import type { AnatomyIO } from "../src/operations.ts";

export function memory() {
  let seq = 0;
  let state: CanvasState | null = null;
  const actor = { id: "usr_test", name: "Test writer" };
  const blobs = new Map<string, string>();
  const batches: Operation[][] = [];
  const undo: Operation[][] = [];
  function apply(op: Operation) {
    state = applyOperation(state, {
      id: `op_${++seq}`,
      canvasId: op.type === "project.create" ? null : "prj_test",
      actor,
      ts: new Date(1780000000000 + seq * 1000).toISOString(),
      op,
    });
  }
  apply({
    type: "project.create",
    canvasId: "prj_test",
    title: "Synthetic test",
  });
  const io: AnatomyIO = {
    read: async (hash) => {
      if (!blobs.has(hash)) throw new Error("Missing blob");
      return blobs.get(hash)!;
    },
    put: async (text) => {
      const blobHash = createHash("sha256").update(text).digest("hex");
      blobs.set(blobHash, text);
      return { blobHash, size: Buffer.byteLength(text) };
    },
    snapshot: async () => state!.canvas,
    record: async () => state!.project,
    send: async (ops) => {
      const inverses: Operation[] = [];
      for (const op of ops) {
        const inverse = invertOperation(state, op);
        if (inverse) inverses.unshift(inverse);
        apply(op);
      }
      batches.push([...ops]);
      undo.push(inverses);
    },
  };
  return {
    io,
    batches,
    blobs,
    canvas: () => state!.canvas,
    project: () => state!.project,
    undo: () => {
      for (const op of undo.pop() ?? []) apply(op);
    },
  };
}
