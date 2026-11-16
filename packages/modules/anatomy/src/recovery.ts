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

import { newVersionId, type Item } from "@isocan/core";
import { CHECKPOINT_MIME, NODE_MIME, PROJECT_MIME, PROP } from "./manifest.ts";
import { checkpointSchema, nodeBodySchema, projectBodySchema, validateGraph } from "./schema.ts";
import type { AnatomyIO } from "./operations.ts";

/** Validate the chosen historical file body without accepting graph-wide partial data. */
export async function recoveryVersion(io: AnatomyIO, item: Item, versionId: string) {
  const version = item.versions.find(v => v.id === versionId);
  if (!version) throw new Error("This version is not on the selected file.");
  const text = await io.read(version.blobHash), value: unknown = JSON.parse(text);
  if (version.mimeType === NODE_MIME) nodeBodySchema.parse(value);
  else if (version.mimeType === PROJECT_MIME) {
    const body = projectBodySchema.parse(value);
    if (new Set(body.sources.map(s => s.id)).size !== body.sources.length) throw new Error("Duplicate source id.");
  } else if (version.mimeType === CHECKPOINT_MIME) {
    const checkpoint = checkpointSchema.parse(value); validateGraph(checkpoint.nodes, checkpoint.edges);
  } else throw new Error("Choose an Anatomy file version.");
  return { version, text };
}
/** Restore file contents as one guarded native edit, retaining every historical version. */
export async function recoverFile(io: AnatomyIO, analysisId: string, item: Item, versionId: string) {
  if (item.id !== analysisId && item.properties[PROP.project] !== analysisId) throw new Error("The file does not belong to this analysis.");
  const { version } = await recoveryVersion(io, item, versionId);
  await io.send([{ type: "item.edit", itemId: item.id, expectedVersionId: item.currentVersionId, expectedMetadata: { title: item.title, properties: item.properties }, patch: {}, version: { id: newVersionId(), blobHash: version.blobHash, size: version.size, mimeType: version.mimeType, filename: version.filename } }]);
}
