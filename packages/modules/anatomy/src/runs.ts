import { z } from "zod";
import { mainThread, newCommentId, newGroupId, newThreadId, newVersionId, type Actor, type Canvas, type CanvasContents, type Item } from "@isocan/core";
import { currentVersion, hasMime, PROJECT_MIME, projectsOn, PROP, RUN_MIME } from "./manifest.ts";
import { projectBodySchema } from "./schema.ts";
import { readProject } from "./core.ts";
import type { AnatomyIO } from "./operations.ts";


const runSchema = z.object({
  repository: z.string().min(1), analysisId: z.string().nullable(), analysisTitle: z.string(),
  baseVersionId: z.string().nullable(), threadId: z.string(), commentId: z.string(),
  status: z.enum(["requested", "running", "completed", "failed", "cancelled"]),
  retryOf: z.string().optional(), cancelRequested: z.boolean().default(false),
  executor: z.object({ id: z.string(), name: z.string() }).optional(),
  revision: z.string().optional(), resultId: z.string().optional(), message: z.string().optional(),
}).strict();
export type AnalysisRun = z.infer<typeof runSchema>;
export type TargetOptions = { repository?: string; analysis?: string; create?: boolean };
const normalize = (repo: string) => repo.trim().replace(/\/+$/, "");
/** Explicit selection and defaults have exactly the same precedence in both clients. */
export function resolveAnalysisItem(canvas: CanvasContents, record: Canvas, options: TargetOptions = {}): Item | undefined {
  if (options.create && options.analysis) throw new Error("Choose an analysis or create a new one, not both.");
  if (options.create) return undefined;
  const candidates = projectsOn(canvas);
  const ref = options.analysis ?? record.properties[PROP.analysis];
  if (ref) {
    const matches = candidates.filter(i => i.id === ref || (options.analysis && i.title.toLowerCase() === ref.toLowerCase()));
    if (matches.length !== 1) throw new Error(`Analysis ${ref} is missing or ambiguous. Choose an analysis explicitly, attach another, or request a new analysis.`);
    return matches[0];
  }
  if (candidates.length > 1) throw new Error("Several analyses exist. Choose one explicitly or attach a default analysis.");
  return candidates[0];
}
/** Validate the repository against the selected file before recording work. */
export async function resolveAnalysisTarget(io: AnatomyIO, options: TargetOptions = {}) {
  const record = await io.record();
  const item = resolveAnalysisItem(await io.snapshot(), record, options);
  const body = item ? projectBodySchema.parse(JSON.parse(await io.read(currentVersion(item).blobHash))) : undefined;
  const repository = (options.repository ?? record.properties[PROP.repository] ?? record.properties.repository ?? body?.repoPath ?? "").trim();
  if (!repository) throw new Error("Associate a repository path or URL first");
  if (item && body?.repoPath && normalize(body.repoPath) !== normalize(repository))
    throw new Error(`Repository mismatch: “${item.title}” describes ${body.repoPath}, but this request targets ${repository}. Choose the matching analysis or request a new analysis.`);
  return { repository, analysisId: item?.id ?? null, analysisTitle: item?.title ?? "New analysis", baseVersionId: item?.currentVersionId ?? null };
}
/** Native receipt plus dispatch evidence; a missing Chat comment is never called queued. */
export async function readRun(io: AnatomyIO, id: string) {
  const canvas = await io.snapshot(), item = canvas.items[id];
  if (!item || !hasMime(item, RUN_MIME)) throw new Error(`Unknown analysis request: ${id}`);
  const run = runSchema.parse(JSON.parse(await io.read(currentVersion(item).blobHash)));
  const thread = Object.values(canvas.threads).find(t => t.comments.some(c => c.id === run.commentId));
  return { id, item, run, dispatched: Boolean(thread), threadId: thread?.id ?? run.threadId };
}
/** Report malformed receipts independently, just like malformed analysis files. */
export async function listRuns(io: AnatomyIO) {
  const canvas = await io.snapshot();
  return Promise.all(Object.values(canvas.items).filter(i => hasMime(i, RUN_MIME)).reverse().map(async item => {
    try { return { ...(await readRun(io, item.id)), error: null }; }
    catch (error) { return { id: item.id, item, run: null, dispatched: false, threadId: "", error: error instanceof Error ? error.message : String(error) }; }
  }));
}
async function runVersion(io: AnatomyIO, run: AnalysisRun) {
  return { ...(await io.put(JSON.stringify(runSchema.parse(run), null, 2) + "\n", RUN_MIME, "analysis-request.json")), id: newVersionId(), mimeType: RUN_MIME, filename: "analysis-request.json" };
}
async function writeRun(io: AnatomyIO, item: Item, run: AnalysisRun) {
  const version = await runVersion(io, run);
  await io.send([{ type: "item.edit", itemId: item.id, version, expectedVersionId: item.currentVersionId, expectedMetadata: { title: item.title, properties: item.properties }, patch: {} }]);
  return readRun(io, item.id);
}
/** Resume a failed dispatch with the original comment identity; do not create another request. */
export async function dispatchRun(io: AnatomyIO, id: string, group?: string) {
  const receipt = await readRun(io, id), { run } = receipt;
  if (receipt.dispatched) return receipt;
  if (run.status !== "requested" || run.cancelRequested) throw new Error("This request is no longer awaiting dispatch.");
  const body = `/anatomy ${run.repository}\nRequest #${id}. ${run.analysisId ? `Update analysis #${run.analysisId}.` : "Create a new analysis."}\nClaim with isocan anatomy run ${id} --start before doing work. Report completion with --complete <analysis-item> --revision <reviewed-revision>, or --fail <reason>. Inspect this request regularly for cancelRequested and acknowledge with --cancelled when stopped.`;
  const comment = { id: run.commentId, body, items: [id, ...(run.analysisId ? [run.analysisId] : [])] };
  const existing = mainThread(await io.snapshot());
  try {
    if (existing) await io.send([{ type: "thread.reply", threadId: existing.id, comment }], group);
    else await io.send([{ type: "thread.create", threadId: run.threadId, x: 0, y: 0, main: true, anchorItemId: null, comment }], group);
  } catch (error) {
    const now = await readRun(io, id);
    if (now.dispatched) return now;
    const winner = mainThread(await io.snapshot());
    if (!existing && winner) {
      try { await io.send([{ type: "thread.reply", threadId: winner.id, comment }], group); }
      catch (retryError) { if (!(await readRun(io, id)).dispatched) throw retryError; }
    }
    else throw new Error(`Request ${id} was saved but Chat dispatch failed. Resume with anatomy run ${id} --dispatch. ${error instanceof Error ? error.message : String(error)}`);
  }
  return readRun(io, id);
}
/** Record a request before dispatch. Repeated active requests reuse their native receipt. */
export async function requestAnalysis(io: AnatomyIO, options: TargetOptions = {}, retryOf?: string, dispatch = true) {
  const target = await resolveAnalysisTarget(io, options);
  const receipts = await listRuns(io);
  const existing = receipts.find(r => r.run && ["requested", "running"].includes(r.run.status) && r.run.analysisId === target.analysisId && normalize(r.run.repository) === normalize(target.repository));
  if (existing) return dispatch && !existing.dispatched ? dispatchRun(io, existing.id) : readRun(io, existing.id);
  const canvas = await io.snapshot();
  // Identical concurrent requests contend on one native item.add, whose duplicate
  // guard is authoritative. Prior receipts (including trash) distinguish later runs.
  const targetKey = JSON.stringify([normalize(target.repository), target.analysisId]);
  const history = [...receipts.filter(r => r.run && r.run.analysisId === target.analysisId && normalize(r.run.repository) === normalize(target.repository)).map(r => r.id), ...Object.values(canvas.trash).filter(entry => entry.item.properties[PROP.requestTarget] === targetKey).map(entry => entry.item.id)].sort();
  const key = JSON.stringify([normalize(target.repository), target.analysisId, history]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const id = `itm_${Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24)}`;
  const run: AnalysisRun = { ...target, threadId: mainThread(canvas)?.id ?? newThreadId(), commentId: newCommentId(), status: "requested", cancelRequested: false, ...(retryOf ? { retryOf } : {}) };
  const group = newGroupId();
  try { await io.send([{ type: "item.add", itemId: id, properties: { [PROP.requestTarget]: targetKey }, title: `Analysis request: ${target.analysisTitle}`, width: 320, height: 180, placement: { x: 0, y: -600 - Object.values(canvas.items).filter(i => hasMime(i, RUN_MIME)).length * 220, chosen: true }, version: await runVersion(io, run) }], group); }
  catch (error) { if (!(await io.snapshot()).items[id]) throw error; }
  return dispatch ? dispatchRun(io, id, group) : readRun(io, id);
}
export type RunAction = { type: "start" } | { type: "complete"; resultId: string; revision: string; message?: string } | { type: "fail"; message: string } | { type: "cancel-request" } | { type: "cancelled" };
/** Conditional native versions arbitrate claims and preserve concurrent cancellation. */
export async function updateRun(io: AnatomyIO, id: string, action: RunAction, actor?: Actor) {
  const { item, run } = await readRun(io, id);
  if (action.type === "cancel-request") {
    if (!["requested", "running"].includes(run.status)) throw new Error("This request has already finished.");
    if (run.cancelRequested) return readRun(io, id);
    return writeRun(io, item, { ...run, cancelRequested: true });
  }
  if (!actor) throw new Error("An executor identity is required.");
  if (action.type === "start") {
    if (run.status !== "requested" || run.cancelRequested) throw new Error("This request is already claimed, finished, or has cancellation requested.");
    return writeRun(io, item, { ...run, status: "running", executor: actor });
  }
  if (run.status === "running" && run.executor?.id !== actor.id) throw new Error("Only the executor that claimed this request can report its outcome.");
  if (action.type === "cancelled") {
    if (!run.cancelRequested || !["requested", "running"].includes(run.status)) throw new Error("There is no active cancellation request to acknowledge.");
    return writeRun(io, item, { ...run, status: "cancelled", executor: run.executor ?? actor });
  }
  if (run.status !== "running") throw new Error("Claim this request before reporting an outcome.");
  if (action.type === "fail") {
    if (!action.message.trim()) throw new Error("Give a failure reason.");
    return writeRun(io, item, { ...run, status: "failed", message: action.message.trim() });
  }
  if (!action.revision.trim()) throw new Error("Record the reviewed repository revision.");
  const canvas = await io.snapshot(), result = canvas.items[action.resultId];
  if (!result || !hasMime(result, PROJECT_MIME) || (run.analysisId && run.analysisId !== result.id)) throw new Error("The result must be the requested analysis, or a new analysis for a create request.");
  const project = await readProject(canvas, result, io.read);
  if (normalize(project.repoPath) !== normalize(run.repository)) throw new Error("The result repository does not match the request.");
  return writeRun(io, item, { ...run, status: "completed", resultId: result.id, revision: action.revision.trim(), ...(action.message ? { message: action.message } : {}) });
}
/** A retry is another receipt linked to a terminal attempt, preserving its original target. */
export async function retryRun(io: AnatomyIO, id: string) {
  const { run } = await readRun(io, id);
  if (!["failed", "cancelled"].includes(run.status)) throw new Error("Only failed or cancelled requests can be retried.");
  return requestAnalysis(io, { repository: run.repository, ...(run.analysisId ? { analysis: run.analysisId } : { create: true }) }, id);
}
