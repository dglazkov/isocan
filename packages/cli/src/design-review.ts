import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Command } from "commander";
import { newItemId, newOpId, newVersionId, newThreadId, newCommentId } from "@isocan/core";
import { CanvasHandle, resolveCanvas, designReviewPort, readDesignReviews, prepareDesignReviewStart, prepareDesignReviewStep, prepareDesignVerifierOffer, prepareDesignReviewHandoff, prepareDesignReviewRepair, submitDesignReviewWrite, validatePreparedDesignReviewWrite, prepareDesignReviewCompletion, prepareDesignReviewReceipt, changeDesignRequest, publishDesignReceipt, designRequestPort, validatePreparedDesignRepair, submitDesignRepair, prepareDesignRepair, parseDesignRepairBasis, type PreparedDesignReviewWrite, type PreparedDesignRepair, type DesignChangeRequest, type DesignPublishRequest, type DesignReviewReadResult, type DesignReviewSubmission } from "@isocan/api";
import { parseDesignRequestOperation } from "@isocan/core/design-request";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";
import { designRepairCapture } from "./design-audit.ts";

type Journal = { actorId: string; canvasId: string; requestId: string; kind: "review"; payload: PreparedDesignReviewWrite } | { actorId: string; canvasId: string; requestId: string; kind: "repair"; payload: PreparedDesignRepair } | { actorId: string; canvasId: string; requestId: string; kind: "complete"; payload: DesignChangeRequest } | { actorId: string; canvasId: string; requestId: string; kind: "receipt"; payload: DesignPublishRequest };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const identities = () => ({ opId: newOpId(), versionId: newVersionId() });
async function fileJson(file: string): Promise<any> { return JSON.parse(await fs.readFile(file, "utf8")); }
function journalPath(ctx: Ctx, canvasId: string, requestId: string) { return path.join(ctx.home, "design-intents", digest(`${ctx.client.base}/${canvasId}/${ctx.actor.id}`), `${digest(requestId)}.json`); }
async function validateJournal(value: unknown): Promise<Journal> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid design intent journal.");
  const j = value as Journal;
  if (Object.keys(j).some(k => !["actorId", "canvasId", "requestId", "kind", "payload"].includes(k)) || !j.actorId || !j.canvasId || !j.requestId) throw new Error("Invalid design journal identity.");
  if (j.kind === "review") j.payload = await validatePreparedDesignReviewWrite(j.payload);
  else if (j.kind === "repair") j.payload = await validatePreparedDesignRepair(j.payload);
  else if (j.kind === "complete") parseDesignRequestOperation({ type: "design.request", action: j.payload.action });
  else if (j.kind === "receipt") parseDesignRequestOperation({ type: "design.receipt", itemId: j.payload.itemId, versionId: j.payload.versionId, receipt: j.payload.receipt });
  else throw new Error("Unsupported design journal act.");
  if (j.payload.canvasId !== j.canvasId || (j.kind === "review" || j.kind === "repair") && j.payload.actorId !== j.actorId) throw new Error("Design journal identity disagrees with its payload.");
  return j;
}
async function existing(file: string): Promise<Journal | null> { try { return await validateJournal(await fileJson(file)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; } }
async function persist(file: string, journal: Journal, retry: boolean): Promise<void> {
  await validateJournal(journal);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const bytes = JSON.stringify(journal, null, 2) + "\n";
  if (retry && JSON.stringify(await existing(file)) !== JSON.stringify(journal)) throw new Error("The saved design intent changed before retry; nothing was submitted.");
  const handle = await fs.open(file, retry ? "r+" : "wx");
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
async function archive(file: string, journal: Journal, result: { status: string }): Promise<void> {
  if (JSON.stringify(await existing(file)) !== JSON.stringify(journal)) throw new Error("Saved action is accepted/refused, but a different local journal now occupies its path; preserve both.");
  const target = path.join(path.dirname(file), "history", `${journal.payload.opId}-${result.status}.json`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(file, target); await fs.rm(file, { force: true });
}
async function deliver(ctx: Ctx, file: string, journal: Journal, retry: boolean) {
  if (journal.actorId !== ctx.actor.id) throw new Error("This pending design intent belongs to another actor; keep its original journal.");
  await persist(file, journal, retry);
  const io = designReviewPort(ctx);
  const delivered = journal.kind === "review" ? await submitDesignReviewWrite(io, journal.payload, { retry }) : journal.kind === "repair" ? await submitDesignRepair(io, journal.payload, { retry }) : journal.kind === "complete" ? await changeDesignRequest(designRequestPort(ctx), journal.payload) : await publishDesignReceipt(designRequestPort(ctx), journal.payload);
  const result = retry && (journal.kind === "complete" || journal.kind === "receipt") && delivered.status === "refused" ? { ...delivered, status: "pending" as const } : delivered;
  if (result.status !== "pending") {
    try { await archive(file, journal, result); }
    catch (error) { if (result.status === "accepted") return { ...result, journal: file, persistenceWarning: error instanceof Error ? error.message : String(error) }; throw error; }
  }
  return { ...result, ...(result.status === "pending" ? { journal: file } : {}) };
}
function printSubmission(ctx: Ctx, result: { status: string; opId: string | null; submittedOpId: string; reason?: string; consistency?: DesignReviewSubmission["consistency"] }) {
  if (ctx.json) printJson(result);
  else { console.log(`${result.status}: ${result.opId ? `operation ${result.opId}` : "operation identity unavailable"}; retry ${result.submittedOpId}`); if (result.reason) console.log(result.reason); if (result.consistency) console.log(`Current consistency: ${result.consistency.status}. ${result.consistency.reasons.join(" ")}`); }
  if (result.status !== "accepted") process.exitCode = result.status === "pending" ? 3 : 1;
}
function printReviews(read: DesignReviewReadResult) {
  for (const row of read.runs) {
    console.log(`${row.run.id} · ${row.status} · ${row.run.mode} · ${row.remainingRepairs === null ? "repair budget unavailable" : `${row.remainingRepairs}/2 repair attempts remain`}`);
    console.log(`Source ${row.readings.source}; Task checks ${row.readings.task}; Craft ${row.readings.craft}. Next: ${row.nextAction}.`);
    console.log(`Exact run ${row.ref.itemId}@${row.ref.versionId}; authored by ${row.author.name}`);
    console.log(`Output ${JSON.stringify(row.run.passes.at(-1)!.output)}`);
    for (const pass of row.passes) console.log(`  ${pass.id}: reserved by ${pass.reservedBy?.name ?? "unavailable"}; observations by ${pass.recordedBy?.name ?? "not recorded"}`);
    for (const reason of [...row.reasons, ...row.readings.limits]) console.log(`  ${reason}`);
    for (const missing of row.readings.missingObligationIds) console.log(`  Required observation missing or not passed: ${missing}`);
  }
  for (const offer of read.offers) console.log(`Verifier ${offer.offer.id}: ${offer.author.name} · ${offer.eligible ? "available and authorized" : offer.reasons.join(" ")} · expires ${offer.offer.expiresAt}`);
  for (const row of read.unavailable) console.log(`${row.itemId}: ${row.reason}`);
  if (!read.runs.length && !read.unavailable.length) console.log("No shared review yet. Derive the actual task/state/viewport obligations from the brief and start one inspection.");
}
async function finish(ctx: Ctx, handle: CanvasHandle, requestId: string, runId: string, file: string) {
  const io = designReviewPort(ctx), results: unknown[] = [];
  let row = (await handle.designReview(requestId, runId)).runs[0]; if (!row) throw new Error("No exact run to finish.");
  if (!row.run.finished) {
    const payload = await prepareDesignReviewStep(io, { canvasId: handle.id, runId, base: row.ref, action: "finish", ...identities() });
    const result = await deliver(ctx, file, { actorId: ctx.actor.id, canvasId: handle.id, requestId, kind: "review", payload }, false); results.push(result);
    if (result.status !== "accepted") return { results, result };
    row = (await handle.designReview(requestId, runId)).runs[0]!;
  }
  const request = (await handle.designBrief({ requestId })).requests[0]!;
  if (request.brief.progress !== "completed") {
    const payload = await prepareDesignReviewCompletion(io, { canvasId: handle.id, runId, base: row.ref, ...identities() });
    const result = await deliver(ctx, file, { actorId: ctx.actor.id, canvasId: handle.id, requestId, kind: "complete", payload }, false); results.push(result);
    if (result.status !== "accepted") return { results, result };
  }
  const fresh = (await handle.designBrief({ requestId })).requests[0]!;
  const prior = fresh.receipts.find(receipt => receipt.receipt.checks.some(check => check.evidence.some(ref => ref.itemId === row!.ref.itemId && ref.versionId === row!.ref.versionId && ref.blobHash === row!.ref.blobHash)));
  if (prior) return { results, result: { status: "accepted", opId: prior.marker.opId, submittedOpId: prior.marker.opId, consistency: { status: prior.status, reasons: prior.reasons } } };
  const payload = await prepareDesignReviewReceipt(io, { canvasId: handle.id, runId, base: row.ref, itemId: newItemId(), receiptId: newOpId(), ...identities() });
  const result = await deliver(ctx, file, { actorId: ctx.actor.id, canvasId: handle.id, requestId, kind: "receipt", payload }, false); results.push(result); return { results, result };
}

/** Native harnesses execute tools between these steps; journals retain identity while shared artifacts retain consumed work. */
export function registerDesignReviews(design: Command, contextOf: (command: Command) => Promise<Ctx>): void {
  design.command("review <request>")
    .description("Read or progress one shared source/task/craft review with at most two reserved repairs")
    .option("--run <id>", "exact existing run")
    .option("--start <file>", "JSON {runId,itemId?,passId,sessionId,output,obligations,mode?,preceding?}")
    .option("--record <file>", "JSON {base,record:{outcome,note,observations,findings,output?,repositorySource?}} from actual tools")
    .option("--begin-repair <pass>", "reserve the next attempt before generation; requires --run and --session")
    .option("--session <id>", "actual performing harness session")
    .option("--offer-verifier <file>", "fresh actual tool probe with exact run/output/session and expiry within five minutes")
    .option("--handoff <offer>", "request verification from this current authorized offer")
    .option("--thread <id>", "exact existing thread for a verifier handoff")
    .option("--finish", "finish the report, conditionally complete the brief, then publish its exact receipt")
    .option("--retry", "retry this actor's immutable pending intent; never changes IDs or payload")
    .addHelpText("after", "\nBoth entrances use this progression. Start reserves one initial inspection. Run real\nnative browser and craft tools, then record their exact observations/evidence. Source\nanalysis runs in the shared record path. Reserve before each repair attempt; invalid\nand no-op proposals count. Audit-only reserves no repair. An unavailable browser\nleaves task checks unverified. No ordinary edit invokes a model.\nRead --json before working and keep its exact ref as record.base. --retry uses the\nactor/canvas journal saved before sending, including completion and receipt acts.\n")
    .action(async (requestId: string, options: any, command: Command) => {
      try {
        const ctx = await contextOf(command), handle = new CanvasHandle(ctx, await resolveCanvas(ctx)), io = designReviewPort(ctx);
        const actions = [options.start, options.record, options.beginRepair, options.offerVerifier, options.handoff, options.finish, options.retry].filter(Boolean);
        if (actions.length > 1) throw new Error("Choose one review progression action.");
        if (!actions.length) { const read = await handle.designReview(requestId, options.run); if (ctx.json) printJson(read); else printReviews(read); return; }
        const file = journalPath(ctx, handle.id, requestId), pending = await existing(file);
        if (options.retry) { if (!pending) throw new Error("No pending intent exists for this actor and request."); return printSubmission(ctx, await deliver(ctx, file, pending, true)); }
        if (pending) throw new Error(`An immutable ${pending.kind} intent is pending. Use design review ${requestId} --retry; its journal is ${file}.`);
        if (options.finish) { if (!options.run) throw new Error("--finish needs --run."); const result = await finish(ctx, handle, requestId, options.run, file); if (ctx.json) printJson(result); else printSubmission(ctx, result.result); if (result.result.status !== "accepted") process.exitCode = result.result.status === "pending" ? 3 : 1; return; }
        let payload: PreparedDesignReviewWrite;
        if (options.start) { const value = await fileJson(options.start); payload = await prepareDesignReviewStart(io, { ...value, canvasId: handle.id, requestId, itemId: value.itemId ?? newItemId(), ...identities() }); }
        else if (options.offerVerifier) { const value = await fileJson(options.offerVerifier); if (value.requestId !== requestId) throw new Error("Verifier offer names a different request."); payload = await prepareDesignVerifierOffer(io, { canvasId: handle.id, itemId: newItemId(), offer: value, ...identities() }); }
        else {
          if (!options.run) throw new Error("This step needs --run.");
          const read = await handle.designReview(requestId, options.run), row = read.runs[0]; if (!row) throw new Error("No exact shared review run.");
          if (options.record) { const value = await fileJson(options.record); if (!value.base) throw new Error("Keep the exact prior read's ref as record.base; do not recapture after inspection."); payload = await prepareDesignReviewStep(io, { canvasId: handle.id, runId: row.run.id, base: value.base, action: "record", record: value.record, ...identities() }); }
          else if (options.beginRepair) payload = await prepareDesignReviewStep(io, { canvasId: handle.id, runId: row.run.id, base: row.ref, action: "begin-repair", passId: options.beginRepair, sessionId: options.session, ...identities() });
          else { const offer = read.offers.find(one => one.offer.id === options.handoff); if (!offer) throw new Error("No exact verifier offer."); const request = (await handle.designBrief({ requestId })).requests[0]!; payload = await prepareDesignReviewHandoff(io, { canvasId: handle.id, runId: row.run.id, offer: offer.ref, threadId: options.thread ?? (request.brief.source.entrance === "canvas-chat" ? request.brief.source.threadId : newThreadId()), commentId: newCommentId(), opId: newOpId() }); }
        }
        printSubmission(ctx, await deliver(ctx, file, { actorId: ctx.actor.id, canvasId: handle.id, requestId, kind: "review", payload }, false));
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
    });
}

/** Existing explicit repair captures metadata at audit time and keeps one actor-local exact retry journal. */
export async function runDesignRepair(ctx: Ctx, handle: CanvasHandle, itemId: string, sourceFile: string, options: { fromAudit?: string; review?: string; request?: string; retry?: boolean }) {
  const key = options.request ?? `repair:${itemId}`, file = journalPath(ctx, handle.id, key), pending = await existing(file);
  if (options.retry) { if (!pending || pending.kind !== "repair" || pending.payload.operation.repair.target.artifact.itemId !== itemId) throw new Error("No pending repair exists for this actor and target/request."); return deliver(ctx, file, pending, true); }
  if (pending) throw new Error("An immutable design intent is pending; retry it before preparing another repair.");
  const text = await fs.readFile(sourceFile, "utf8"); let payload: PreparedDesignRepair;
  if (options.review) {
    if (!options.request) throw new Error("--review requires its exact --request.");
    const row = (await handle.designReview(options.request, options.review)).runs[0]; if (!row) throw new Error("No exact review reservation.");
    payload = await prepareDesignReviewRepair(designReviewPort(ctx), { canvasId: handle.id, runId: row.run.id, base: row.ref, text, repairId: newOpId(), ...identities() });
    if (payload.operation.repair.target.artifact.itemId !== itemId) throw new Error("The review reserved a different output target.");
  } else {
    if (!options.fromAudit) throw new Error("An explicit repair requires --from-audit with its original metadata capture.");
    const capture = designRepairCapture(await fileJson(options.fromAudit), handle.id, itemId);
    const basis = parseDesignRepairBasis(capture.basis);
    payload = await prepareDesignRepair({ basis, text, actorId: ctx.actor.id, repairId: newOpId(), ...identities() });
  }
  return deliver(ctx, file, { actorId: ctx.actor.id, canvasId: handle.id, requestId: key, kind: "repair", payload }, false);
}
