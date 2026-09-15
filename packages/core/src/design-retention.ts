import type { ItemVersion } from "./model.ts";
import { validateContextManifest } from "./canvas-group-context.ts";
import { parseDesignArtifactRef, type DesignArtifactRef } from "./design-partner.ts";
import { OpValidationError } from "./errors.ts";

/** Typed comment evidence uses flat, complete public versions, independently of pruned live item stacks. */
export function validateDesignRetainedReferences(value: unknown, canvasId: string, required: readonly DesignArtifactRef[], limit: number): void {
  const fail = (): never => { throw new OpValidationError("bad-op", "invalid or missing retained design reference metadata"); };
  const keys = (v: unknown, names: string[]): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => names.includes(k));
  const text = (v: unknown) => typeof v === "string" && v.length > 0;
  const identities = new Set<string>();
  const identity = (a: DesignArtifactRef) => JSON.stringify([a.home, a.canvasId, a.itemId, a.versionId, a.blobHash]);
  if (!Array.isArray(value) || value.length > limit) return fail();
  for (const row of value) {
    if (!keys(row, ["artifact", "version"])) return fail();
    const artifact = parseDesignArtifactRef(row.artifact), v = row.version;
    if (!keys(v, ["id", "blobHash", "mimeType", "filename", "size", "visual", "createdAt", "createdBy"]) || !keys(v.createdBy, ["id", "name"]) || !text(v.createdBy.id) || !text(v.createdBy.name) || !text(v.createdAt) || !text(v.mimeType) || !text(v.filename) || !Number.isSafeInteger(v.size) || (v.size as number) < 0 || artifact.canvasId !== canvasId || artifact.versionId !== v.id || artifact.blobHash !== v.blobHash) return fail();
    if (v.visual !== undefined && (!keys(v.visual, ["blobHash", "mimeType", "filename", "size"]) || !/^[a-f0-9]{64}$/.test(String(v.visual.blobHash)) || !text(v.visual.mimeType) || !text(v.visual.filename) || !Number.isSafeInteger(v.visual.size) || (v.visual.size as number) < 0)) return fail();
    const key = identity(artifact); if (identities.has(key)) return fail(); identities.add(key);
    const version = v as unknown as ItemVersion;
    validateContextManifest({ canvasId, revision: 0, rootIds: [artifact.itemId], expandedIds: [artifact.itemId], includeExcluded: false, ambient: false, entries: [{ itemId: artifact.itemId, parentId: null, depth: 0, title: "Retained reference", kind: version.mimeType, excluded: false, version, threadIds: [] }], counts: { included: 1, excluded: 0, unavailable: 0 } }, canvasId);
  }
  if (required.some((artifact) => !identities.has(identity(artifact)))) fail();
}
