import type { Actor, DesignArtifactRef, DesignBrief, DesignReference, Operation } from "@isocan/core";
import { defaultSize } from "@isocan/core";
import { parseDesignBrief } from "@isocan/core/design-brief";
import { questionnaireFailureStatus, type QuestionnairePort } from "@isocan/api/questionnaire";
import { getSnapshot, postOp, readBlob, readBlobText, uploadBlob } from "./api.ts";
import { authoritativeHome } from "./personal.ts";
import { creationDestination } from "./groupplacement.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { canEditNow } from "./capability.ts";
import type { QuestionUploadDraft } from "./questionnairedraft.ts";

function writable(canvasId: string): void {
  const current = useCanvasStore.getState();
  if (current.canvasId === canvasId && current.past) throw new Error("Return to now before answering questions.");
  if (current.canvasId === canvasId && !canEditNow()) throw new Error("This canvas is read-only.");
}
/** Saved form IDs own retries. A network interruption remains pending until a matching receipt arrives. */
export function questionnaireIO(actor: Actor): QuestionnairePort {
  return {
    actorId: actor.id,
    snapshot: getSnapshot,
    send: async (canvasId, operation, options) => {
      writable(canvasId);
      options.signal?.throwIfAborted();
      try {
        const receipt = await postOp(canvasId, actor, operation, options.opId, undefined, creationDestination().originGroupMode);
        return { status: "accepted", receipt };
      } catch (error) {
        return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : "The home did not confirm this submission. Retry uses the same answer IDs." };
      }
    },
  };
}
/** An available, current brief paired with its exact canvas version for publishing. */
export interface BrowserDesignBrief { title: string; brief: DesignBrief; artifact: DesignArtifactRef; request?: import("@isocan/api/design-request").DesignRequestView | undefined }
/** Existing brief items are the phase-1 publishing bootstrap; ordinary request creation comes next. */
export async function browserDesignBriefs(canvasId: string, signal?: AbortSignal): Promise<BrowserDesignBrief[]> {
  const [{ canvas }, home] = await Promise.all([getSnapshot(canvasId, signal), authoritativeHome(canvasId, signal)]);
  const choices: BrowserDesignBrief[] = [];
  for (const item of Object.values(canvas.items)) {
    const version = item.versions.find((v) => v.id === item.currentVersionId);
    if (!version || version.mimeType !== "application/json") continue;
    let contents: string;
    try { contents = await readBlobText(canvasId, version.blobHash, signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(`Could not read ${item.title || "an item"} while loading design briefs. ${error instanceof Error ? error.message : "Try loading the briefs again."}`);
    }
    try {
      const brief = parseDesignBrief(JSON.parse(contents));
      if (brief.progress !== "active") continue;
      choices.push({ title: item.title, brief, artifact: { home, canvasId, itemId: item.id, versionId: version.id, blobHash: version.blobHash } });
    } catch { /* Successfully read ordinary JSON remains an ordinary item. */ }
  }
  if (Object.values(canvas.items).some((item) => item.versions.find((version) => version.id === item.currentVersionId)?.designRecord?.kind === "brief")) {
    const [{ readDesignRequests }, { designRequestReadIO }] = await Promise.all([import("@isocan/api/design-request"), import("./design-request.ts")]);
    const admitted = await readDesignRequests(designRequestReadIO, { canvasId, ...(signal ? { signal } : {}) });
    for (const choice of choices) choice.request = admitted.requests.find((one) => one.ref.itemId === choice.artifact.itemId);
  }
  return choices;
}
/** The existing blob + item.add vocabulary, with identity retained before either network call. */
export async function uploadQuestionReference(canvasId: string, actor: Actor, upload: QuestionUploadDraft, file: Blob | null,
  checkpoint: (patch: Partial<QuestionUploadDraft>) => void,
): Promise<DesignReference> {
  writable(canvasId);
  const destination = upload.destination;
  let blobHash = upload.blobHash;
  if (!blobHash) {
    if (!file) throw new Error("The saved file bytes are unavailable. Remove this attachment and choose the file again.");
    const result = await uploadBlob(canvasId, file, upload.name);
    blobHash = result.blobHash;
    checkpoint({ blobHash });
  }
  const operation: Extract<Operation, { type: "item.add" }> = {
    type: "item.add", itemId: upload.itemId,
    ...(destination.originGroupMode === "groups" ? { containerId: destination.containerId ?? null, groupPlacement: "auto" } : {}),
    version: { id: upload.versionId, blobHash, mimeType: upload.mimeType, filename: upload.name, size: upload.size },
    // No chosen canvas point: groups place automatically; legacy canvases use
    // these coordinates only as the existing collision-layout seed.
    ...defaultSize(upload.mimeType), placement: { x: 80, y: 80 }, title: upload.name,
  };
  const result = await postOp(canvasId, actor, operation, upload.opId, undefined, destination.originGroupMode);
  const accepted = result.envelope;
  if (accepted.id !== upload.opId || accepted.actor.id !== actor.id || accepted.canvasId !== canvasId || !["item.add", "group.change"].includes(accepted.op.type)) throw new Error("The home did not acknowledge this upload. Retry to check the saved item.");
  // Group canvases normalize item.add into group.change. Read the accepted resulting item,
  // so canonical placement remains the existing reducer's responsibility on both modes.
  const { canvas } = await getSnapshot(canvasId);
  const version = canvas.items[upload.itemId]?.versions.find((one) => one.id === upload.versionId);
  if (!version || version.blobHash !== blobHash || version.size !== upload.size || version.filename !== upload.name || version.mimeType !== upload.mimeType) throw new Error("The saved item does not contain this exact upload. Retry before answering.");
  // Read the actual accepted bytes before calling this a reference. This also exercises current read permission.
  const bytes = await readBlob(canvasId, blobHash);
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await bytes.arrayBuffer())), (b) => b.toString(16).padStart(2, "0")).join("");
  if (actual !== blobHash) throw new Error("The downloaded attachment did not match its saved version. Retry before answering.");
  const home = await authoritativeHome(canvasId);
  return { id: upload.id, state: "fetched", artifact: { home, canvasId, itemId: upload.itemId, versionId: upload.versionId, blobHash } };
}
