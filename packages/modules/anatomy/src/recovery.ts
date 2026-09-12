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
