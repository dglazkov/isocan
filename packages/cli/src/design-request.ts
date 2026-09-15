import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import type { Command } from "commander";
import { CanvasHandle, resolveCanvas, type DesignRequestFilter, type DesignRequestReadResult, type DesignRequestSubmission } from "@isocan/api";
import { parseDesignRequestAction, parseDesignRequestOperation } from "@isocan/core/design-request";
import { parseDesignArtifactRef } from "@isocan/core/design-partner";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

// Hash the whole stable version identity; a long shared prefix must not merge separate intents.
const operationId = (versionId: string) => `op_${createHash("sha256").update(`design-version:${versionId}`).digest("base64url").slice(0, 32)}`;

async function json(file: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The saved intent must be a JSON object.");
  return value as Record<string, unknown>;
}
function submitted(ctx: Ctx, result: DesignRequestSubmission): void {
  if (ctx.json) printJson(result);
  else console.log(`${result.status}: ${result.itemId}@${result.versionId} · ${result.opId ? `operation ${result.opId}` : "operation identity unavailable"} · retry ${result.submittedOpId}${result.reason ? `\n${result.reason}` : ""}`);
  if (result.status !== "accepted") process.exitCode = result.status === "pending" ? 3 : 1;
}
function printBriefs(result: DesignRequestReadResult): void {
  if (!result.requests.length && !result.unavailable.length) console.log("No admitted design requests.");
  for (const request of result.requests) {
    const brief = request.brief;
    console.log(`${brief.requestId} · ${brief.progress} · ${request.status} · next: ${request.nextAction}\n${brief.audience ?? "Audience not yet supplied"} · ${brief.primaryTask ?? "Primary task not yet supplied"}\n${brief.delivery} · ${brief.fidelity} · ${request.ref.itemId}@${request.ref.versionId}`);
    console.log(`  ${request.remainingInitialQuestions > 0 ? "Canvas discovery: initial batch unused (up to 3 questions)" : "Canvas initial batch already used"}; allowed: ${request.allowedActions.join(", ") || "read only"}`);
    if (request.missingFactIds.length) console.log(`  Missing facts: ${request.missingFactIds.join(", ")}; resolve from context, stated assumptions or consequential questions.`);
    if (request.governingBinding.explicitNone) console.log("  This canvas is exempt from requiring a design system; any incumbent still applies.");
    if (request.governing.status === "available") console.log(`  Using: ${request.governing.title} (${request.governing.artifact.itemId}@${request.governing.artifact.versionId})${request.governing.inherited ? " · inherited" : ""}`);
    else console.log(`  Design system: ${request.governing.reason}`);
    for (const constraint of brief.constraints) console.log(`  Constraint: ${constraint}`);
    for (const fact of brief.facts) console.log(`  ${fact.name}: ${fact.value} · ${fact.origin}`);
    for (const provenance of brief.continuation?.factProvenance ?? []) console.log(`  ${provenance.field}: ${provenance.kind} by ${provenance.actorId}${provenance.responseId ? ` · answer ${provenance.responseId}` : ""}`);
    for (const reason of request.reasons) console.log(`  ${reason}`);
    for (const question of request.questions) console.log(`  Questions ${question.questions.id}: ${question.status}; unresolved ${question.outstandingQuestionIds.join(", ") || "none"}`);
  }
  for (const failure of result.unavailable) console.log(`${failure.itemId} · unavailable: ${failure.reason}`);
}
function filter(request: string | undefined, options: { thread?: string; comment?: string; output?: string }): DesignRequestFilter {
  return { ...(request ? { requestId: request } : {}), ...(options.thread ? { threadId: options.thread } : {}), ...(options.comment ? { commentId: options.comment } : {}), ...(options.output ? { outputItemId: options.output } : {}) };
}

/** CLI files carry stable public intents; this layer adds argv and readable output, never private authority. */
export function registerDesignRequests(design: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const act = (work: (handle: CanvasHandle, ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try {
      const ctx = await contextOf(args.at(-1) as Command);
      await work(new CanvasHandle(ctx, await resolveCanvas(ctx)), ctx, args);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  };
  const selectors = (command: Command) => command.option("--thread <id>", "source conversation thread").option("--comment <id>", "source comment").option("--output <id>", "request owning this output item");

  selectors(design.command("workflow [request]"))
    .description("Read the shared design procedure, canvas rollout policy and current next step")
    .action(act(async (handle, ctx, [request, options]) => {
      const result = await handle.designWorkflow(filter(request, options));
      if (ctx.json) return printJson(result);
      console.log(`Automatic design workflow: ${result.policy}\n\n${result.procedure}`);
      printBriefs(result);
    }));

  design.command("start <file>")
    .description("Admit a stable design request from public JSON facts and its actual source")
    .option("--automatic", "require this canvas's adaptive-v1 automatic enrollment policy")
    .option("--op-id <id>", "stable retry operation ID; otherwise derived from the saved versionId")
    .addHelpText("after", "\nThe file contains {requestId,itemId,versionId,source,fields}; kind:'start' and\nadmission:'explicit' are optional defaults. --automatic requires automatic admission.\nSource is {entrance:'canvas-chat',threadId,commentId} or\n{entrance:'external-agent',externalRequestId}; the writer supplies actual authorship.\nFields: intent,fidelity,delivery,targetItemId,groupId,audience,primaryTask,\nconstraints,facts,references,outstandingDecisionIds,outputIds.\nRead design workflow first. Retain all IDs and this file after uncertain delivery.\n")
    .action(act(async (handle, ctx, [file, options]) => {
      const value = await json(file);
      if (value.kind !== undefined && value.kind !== "start") throw new Error("design start needs a start intent.");
      if (options.automatic && value.admission !== undefined && value.admission !== "automatic") throw new Error("--automatic conflicts with the saved admission mode.");
      const action = parseDesignRequestAction({ ...value, kind: "start", admission: value.admission ?? (options.automatic ? "automatic" : "explicit") });
      if (action.kind !== "start") throw new Error("Expected a start intent.");
      submitted(ctx, await handle.designStart({ action, opId: options.opId ?? operationId(action.versionId) }));
    }));

  selectors(design.command("brief [request]"))
    .description("Read a compact brief or conditionally update, resume, cancel or complete its saved intent")
    .option("--update <file>", "update intent with captured brief, epoch, new versionId and patch")
    .option("--resume <file>", "resume intent with captured brief, epoch, new versionId and reason")
    .option("--cancel <file>", "cancel intent with captured brief, epoch and new versionId")
    .option("--complete <file>", "complete intent with captured brief, epoch, new versionId and real outputs")
    .option("--op-id <id>", "stable retry operation ID; otherwise derived from the saved versionId")
    .option("--reference <file>", "open an exact DesignArtifactRef JSON identified by this request")
    .option("--face <face>", "reference source or visual face", "source")
    .option("--out <file>", "save complete reference bytes to a new file")
    .option("--offset <bytes>", "printed reference byte offset", "0")
    .option("--limit <bytes>", "printed reference byte limit, at most 262144", "16384")
    .addHelpText("after", "\nLifecycle files contain {brief,epoch,versionId,patch?,acceptedResponses?}; resume\nalso requires reason. The selected option supplies kind. brief is the exact\n{home,canvasId,itemId,versionId,blobHash} returned by design brief --json.\nA stale refusal preserves your file: reconcile before preparing a new intent.\n")
    .action(act(async (handle, ctx, [request, options]) => {
      const changes = ["update", "resume", "cancel", "complete"].filter(kind => options[kind]);
      if (changes.length > 1 || changes.length && options.reference) throw new Error("Choose one lifecycle action or one reference read.");
      if (changes.length) {
        if (options.thread || options.comment || options.output || options.out) throw new Error("Lifecycle files already identify their exact brief; read filters cannot change that intent.");
        const kind = changes[0]!, value = await json(options[kind]);
        if (value.kind !== undefined && value.kind !== kind) throw new Error("The lifecycle option conflicts with the saved intent kind.");
        const action = parseDesignRequestAction({ ...value, kind });
        if (action.kind === "start") throw new Error("Use design start for a new request.");
        if (request) {
          const found = (await handle.designBrief({ requestId: request })).requests;
          if (!found.some(one => one.ref.itemId === action.brief.itemId)) throw new Error("This saved intent belongs to a different request.");
        }
        submitted(ctx, await handle.designChange({ action, opId: options.opId ?? operationId(action.versionId) }));
        return;
      }
      if (options.opId) throw new Error("--op-id requires a lifecycle action.");
      if (options.reference) {
        if (!request || options.thread || options.comment || options.output) throw new Error("Reference reads require one request ID.");
        if (!["source", "visual"].includes(options.face)) throw new Error("--face is source or visual.");
        const offset = Number(options.offset), limit = Number(options.limit);
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 262144) throw new Error("Reference offsets are nonnegative; limits are 1–262144 bytes.");
        const content = await handle.designRequestReference({ requestId: request, artifact: parseDesignArtifactRef(await json(options.reference)), face: options.face });
        const { bytes, ...metadata } = content;
        if (options.out) {
          if (offset !== 0 || limit !== 16384) throw new Error("--out writes the whole reference; omit paging options.");
          await fs.writeFile(options.out, bytes, { flag: "wx" });
          if (ctx.json) printJson({ ...metadata, bytesWritten: bytes.length, file: options.out });
          else console.log(`${options.out} · ${bytes.length} bytes · ${content.artifact.versionId}`);
          return;
        }
        if (offset > bytes.length) throw new Error("Reference offset exceeds its byte length.");
        const chunk = Buffer.from(bytes.subarray(offset, offset + limit));
        const result = { ...metadata, offset, bytesRead: chunk.length, totalBytes: bytes.length, nextOffset: offset + chunk.length < bytes.length ? offset + chunk.length : null, encoding: "base64", data: chunk.toString("base64") };
        if (ctx.json) printJson(result); else console.log(`${content.title} · ${content.artifact.itemId}@${content.artifact.versionId}\n${result.data}`);
        return;
      }
      if (options.out || options.face !== "source" || options.offset !== "0" || options.limit !== "16384") throw new Error("Reference output options require --reference.");
      const result = await handle.designBrief(filter(request, options));
      if (ctx.json) printJson(result); else printBriefs(result);
    }));

  selectors(design.command("receipt [request]"))
    .description("Read saved evidence and freshness, or publish an attributed receipt for a completed brief")
    .option("--publish <file>", "public {itemId,versionId,receipt} JSON with exact output and evidence")
    .option("--op-id <id>", "stable retry operation ID; otherwise derived from the saved versionId")
    .addHelpText("after", "\nPublication: {itemId,versionId,receipt}. Receipt fields: schemaVersion:1,kind:'receipt',\nid,requestId,epoch,brief,output,context,governing,fidelity,status,checks,unresolved.\nbrief and canvas output artifact are exact {home,canvasId,itemId,versionId,blobHash}.\nCanvas output: {kind:'canvas',artifact}; governing uses the selected output's\noutputGovernings binding from design brief. contextReferences supplies live inputs.\nA no-browser draft uses status:'draft',checks:[],unresolved:[{severity:'critical',\ndescription:'Browser inspection unavailable'}]. Never manufacture a passed check.\nA check names id,kind ('source'|'browser-task'|'craft'),tool,toolVersion,result\n('passed'|'failed'|'unavailable'),coverage,state,viewport (null or {width,height}),evidence.\nRepository output: {kind:'repository',repository,revision,buildId,runtimeUrl};\nits freshness is attributed unless actually rechecked. Keep all IDs for retry.\n")
    .action(act(async (handle, ctx, [request, options]) => {
      if (options.publish) {
        if (options.thread || options.comment || options.output) throw new Error("A receipt publication names its exact brief; omit read filters.");
        const value = await json(options.publish);
        if (value.type !== undefined && value.type !== "design.receipt") throw new Error("Expected a design receipt publication.");
        const op = parseDesignRequestOperation({ ...value, type: "design.receipt" });
        if (op.type !== "design.receipt") throw new Error("Expected a receipt operation.");
        if (request && op.receipt.requestId !== request) throw new Error("The receipt belongs to a different request.");
        const { type: _type, effect: _effect, ...publication } = op;
        submitted(ctx, await handle.designPublishReceipt({ ...publication, opId: options.opId ?? operationId(op.versionId) }));
        return;
      }
      if (options.opId) throw new Error("--op-id requires --publish.");
      const result = await handle.designReceipt(filter(request, options));
      if (ctx.json) return printJson(result);
      if (!result.receipts.length) console.log("No published design receipts.");
      for (const saved of result.receipts) {
        console.log(`${saved.receipt.id} · ${saved.receipt.status} · evidence ${saved.status}\n${saved.ref.itemId}@${saved.ref.versionId}`);
        for (const check of saved.receipt.checks) console.log(`  ${check.id}: ${check.kind} · reported ${check.result} · ${check.coverage}`);
        for (const freshness of saved.checkFreshness) if (freshness.status !== "current") console.log(`  ${freshness.checkId}: evidence ${freshness.status} · ${freshness.reasons.join(" ")}`);
        for (const reason of saved.reasons) console.log(`  ${reason}`);
        for (const limit of saved.receipt.unresolved) console.log(`  ${limit.severity}: ${limit.description}`);
        if (saved.runtimeFreshness === "reported") console.log("  Repository build/runtime is an attributed observation; it has not been independently rechecked by this read.");
      }
      for (const failure of result.unavailable) console.log(`${failure.itemId} · unavailable: ${failure.reason}`);
    }));
}
