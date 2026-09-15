import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import type { Command } from "commander";
import { CanvasHandle, prepareDesignDecision, resolveCanvas, type DesignComparisonReadResult, type DesignDecisionSubmission } from "@isocan/api";
import { parseDesignComparison, parseDesignComparisonResponse, parseDesignDecisionInput } from "@isocan/core/design-decision";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

async function fileObject(file: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The saved intent must be a JSON object.");
  return value as Record<string, unknown>;
}
function envelope(value: Record<string, unknown>, kind: "comparison" | "response" | "decision", thread?: string) {
  const wrapped = Object.prototype.hasOwnProperty.call(value, kind);
  if (wrapped && Object.keys(value).some(key => ![kind, "threadId", "commentId", "opId", "retry"].includes(key))) throw new Error("A saved submission contains an unsupported field.");
  if (wrapped && thread && value.threadId !== thread) throw new Error("--thread disagrees with the saved intent.");
  const payload = wrapped ? value[kind] : value;
  const threadId = wrapped ? value.threadId : thread;
  if (typeof threadId !== "string" || !threadId.trim()) throw new Error("An exact existing thread ID is required in the file or --thread.");
  return { payload, threadId, ...(wrapped && value.commentId !== undefined ? { commentId: value.commentId } : {}), ...(wrapped && value.opId !== undefined ? { opId: value.opId } : {}), ...(wrapped && value.retry !== undefined ? { retry: value.retry } : {}) };
}
function identities(kind: string, id: string, saved: { commentId?: unknown; opId?: unknown; retry?: unknown }) {
  const hash = createHash("sha256").update(`design-${kind}:${id}`).digest("hex").slice(0, 32);
  const opId = saved.opId ?? `op_${hash}`, commentId = saved.commentId ?? `cmt_${hash}`;
  if (typeof opId !== "string" || !opId.trim() || typeof commentId !== "string" || !commentId.trim() || saved.retry !== undefined && typeof saved.retry !== "boolean") throw new Error("Invalid saved retry identities.");
  return { opId, commentId, ...(saved.retry === undefined ? {} : { retry: saved.retry }) };
}
function submitted(ctx: Ctx, result: DesignDecisionSubmission) {
  if (ctx.json) printJson(result);
  else {
    console.log(`${result.status}: ${result.payloadId} · ${result.opId ? `operation ${result.opId}` : "operation identity unavailable"} · retry ${result.submittedOpId}`);
    if (result.reason) console.log(result.reason);
    if (result.consistency) console.log(`Current consistency: ${result.consistency.status}${result.consistency.reasons.length ? ` · ${result.consistency.reasons.join(" ")}` : ""}`);
  }
  if (result.status !== "accepted") process.exitCode = result.status === "pending" ? 3 : 1;
}
function describe(read: DesignComparisonReadResult) {
  if (!read.comparisons.length && !read.decisions.length && !read.unavailable.length) console.log("No canonical comparisons or decisions.");
  for (const state of read.comparisons) {
    const c = state.comparison;
    console.log(`${c.id} · ${c.mode} · ${state.status} · ${c.uncertainty} / ${c.fidelity}\n${c.scenario}\nSource ${state.source.threadId} / ${state.source.commentId} / revision ${state.source.revision}`);
    console.log(c.audience.kind === "human" ? `For named human ${c.audience.respondentActorId}` : `Native dialogue reported by ${c.audience.reporterActorId} · ${c.audience.externalRequestId}`);
    for (const option of c.alternatives) console.log(`  ${option.id}: ${option.title}\n    ${option.hypothesis}\n    Tradeoff: ${option.tradeoff}\n    ${option.artifact.itemId}@${option.artifact.versionId}`);
    console.log(`Recommended ${c.recommendedAlternativeId} by ${state.author.name}: ${c.recommendation}`);
    for (const response of state.responses) console.log(`  ${response.response.id}: ${response.response.outcome.kind} · ${response.response.authority.kind} by ${response.author.name} · ${JSON.stringify(response.response.outcome)}`);
    for (const reason of state.reasons) console.log(`  ${reason}`);
  }
  for (const state of read.decisions) {
    const d = state.decision, a = d.input.authority;
    console.log(`${d.input.id} · ${state.standing} · consistency ${state.status}\nChosen ${d.input.chosenAlternativeId} · ${a.kind} by ${state.author.name}\nAdopted ${d.adopted.itemId}@${d.adopted.versionId}`);
    if (a.kind === "human-choice") console.log(`Human reason: ${a.reason ?? "not supplied"}`);
    else { console.log(`Agent rationale: ${a.rationale}`); if (a.kind === "external-report") console.log(`Reported ${a.reportedOutcome}: ${a.statement}\nReported reason: ${a.reportedReason ?? "not supplied"}`); }
    for (const reason of state.reasons) console.log(`  ${reason}`);
  }
  for (const unavailable of read.unavailable) console.log(`${unavailable.id}: unavailable · ${unavailable.reason}`);
}

/** Native files retain exact public intent; readable output and argv never supply decision authority. */
export function registerDesignDecisions(design: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const act = (work: (handle: CanvasHandle, ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try { const ctx = await contextOf(args.at(-1) as Command); await work(new CanvasHandle(ctx, await resolveCanvas(ctx)), ctx, args); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  };
  design.command("compare [request]")
    .description("Read exact options and decision history, or publish an immutable comparison")
    .option("--publish <file>", "saved comparison or {threadId,comparison,opId?,commentId?,retry?}")
    .option("--thread <id>", "source thread, or exact thread for a bare publication")
    .option("--comment <id>", "filter by exact comparison comment")
    .option("--target <id>", "read accepted rationale and comparisons for this output")
    .option("--key <id>", "stable brief decision key")
    .option("--option <id>", "read exact retained bytes of one option; requires one unambiguous source")
    .option("--face <face>", "option source or visual face", "source")
    .option("--out <file>", "write complete exact option bytes to a new file")
    .option("--offset <bytes>", "printed byte offset", "0")
    .option("--limit <bytes>", "printed byte limit, at most 262144", "16384")
    .option("--retry", "retry a saved publication after uncertain delivery without changing its payload")
    .addHelpText("after", "\nA comparison names its current admitted brief/epoch, decisionKey, audience, scenario,\nfidelity, 1–3 exact alternative versions, recommendation and captured target/governing\nbasis. Use mode:'comparison' for 2–3 options; mode:'direct' or 'delegated' for one.\nA reissue is a new comparison with supersedes naming the prior exact source.\nRead --json and retain approvalBases before choosing; the final click must not\nrecapture current target metadata. Trying --option only reads; it never adopts.\n")
    .action(act(async (handle, ctx, [request, options]) => {
      if (options.publish) {
        if (options.comment || options.target || options.key || options.option || options.out) throw new Error("A publication cannot be mixed with read selectors.");
        const saved = envelope(await fileObject(options.publish), "comparison", options.thread), comparison = parseDesignComparison(saved.payload);
        if (request && comparison.requestId !== request) throw new Error("The comparison belongs to a different request.");
        return submitted(ctx, await handle.designCompare({ threadId: saved.threadId, comparison, ...identities("compare", comparison.id, saved), ...(options.retry ? { retry: true } : {}) }));
      }
      if (options.retry) throw new Error("--retry requires --publish.");
      const result = await handle.designComparisons({ ...(request ? { requestId: request } : {}), ...(options.thread ? { threadId: options.thread } : {}), ...(options.comment ? { commentId: options.comment } : {}), ...(options.target ? { targetItemId: options.target } : {}), ...(options.key ? { decisionKey: options.key } : {}) });
      if (options.option) {
        const sources = new Map<string, typeof result.comparisons[number]["source"]>();
        for (const source of [...result.comparisons.map(one => one.source), ...result.decisions.map(one => one.decision.input.source.kind === "comparison" ? one.decision.input.source.source : one.source)]) {
          if (options.thread && source.threadId !== options.thread || options.comment && source.commentId !== options.comment) continue;
          sources.set(JSON.stringify([source.threadId, source.commentId, source.payloadId, source.revision]), source);
        }
        if (sources.size !== 1) throw new Error("Select one exact live or historical comparison source with --thread and --comment before reading an option.");
        if (!["source", "visual"].includes(options.face)) throw new Error("--face is source or visual.");
        const offset = Number(options.offset), limit = Number(options.limit);
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 262144) throw new Error("Invalid reference page: offset is nonnegative and limit is 1–262144 bytes.");
        const content = await handle.designComparisonReference({ source: [...sources.values()][0]!, optionId: options.option, face: options.face });
        const { bytes, ...metadata } = content;
        if (options.out) {
          if (offset !== 0 || limit !== 16384) throw new Error("--out writes complete bytes; omit paging options.");
          await fs.writeFile(options.out, bytes, { flag: "wx" });
          if (ctx.json) printJson({ ...metadata, bytesWritten: bytes.length, file: options.out }); else console.log(`${options.out} · ${bytes.length} bytes · ${content.artifact.versionId}`);
        } else {
          if (offset > bytes.length) throw new Error("Reference offset exceeds its byte length.");
          const chunk = bytes.subarray(offset, offset + limit), page = { ...metadata, offset, bytesRead: chunk.length, totalBytes: bytes.length, nextOffset: offset + chunk.length < bytes.length ? offset + chunk.length : null, encoding: "base64", data: Buffer.from(chunk).toString("base64") };
          if (ctx.json) printJson(page); else console.log(`${content.title} · ${content.artifact.itemId}@${content.artifact.versionId}\n${page.data}`);
        }
        return;
      }
      if (options.out || options.face !== "source" || options.offset !== "0" || options.limit !== "16384") throw new Error("Reference output options require --option.");
      if (ctx.json) printJson(result); else describe(result);
    }));
  design.command("respond <file>")
    .description("Delegate, request more/combine, skip or dismiss an exact comparison without adopting")
    .option("--thread <id>", "exact source thread for a bare response")
    .option("--retry", "retain the exact earlier submission after uncertain delivery")
    .addHelpText("after", "\nFile: {threadId,response,opId?,commentId?,retry?}, or a bare comparison-response.\nresponse names requestId/epoch and exact comparison source, authority human or\nexternal-report, closed outcome delegate/more/combine/skip/dismiss, and\nsupersedesResponseId (null initially). External reports require the original\nreporter or an explicit reasoned resume; they never create a canvas-human answer.\n")
    .action(act(async (handle, ctx, [file, options]) => {
      const saved = envelope(await fileObject(file), "response", options.thread), response = parseDesignComparisonResponse(saved.payload);
      submitted(ctx, await handle.designRespond({ threadId: saved.threadId, response, ...identities("respond", response.id, saved), ...(options.retry ? { retry: true } : {}) }));
    }));
  design.command("decide <file>")
    .description("Adopt one exact option and record its actual decision authority in one undoable act")
    .option("--thread <id>", "exact thread for a bare decision")
    .option("--retry", "retry immutable accepted/pending intent, including after later drift or removal")
    .addHelpText("after", "\nFile: {threadId,decision,opId?,commentId?,retry?}. decision contains id,requestId,\ndecisionKey,source,basis,chosenAlternativeId,versionId,supersedesDecisionId,authority.\nCopy basis from the option's already reviewed approvalBases in design compare --json.\nAuthority: human-choice with nullable reason; canvas-delegation with responseId\nand rationale; external-report with externalRequestId,reportedOutcome,statement,\nreportedReason and rationale; or agent-judgment with rationale. Do not reuse an\nagent recommendation as human words. Keep the exact file/IDs after pending;\n--retry never refreshes them. A changed basis requires a newly reviewed intent.\n")
    .action(act(async (handle, ctx, [file, options]) => {
      const saved = envelope(await fileObject(file), "decision", options.thread), decision = parseDesignDecisionInput(saved.payload);
      const prepared = prepareDesignDecision({ canvasId: handle.id, threadId: saved.threadId, decision, ...identities("decide", decision.id, saved), ...(options.retry ? { retry: true } : {}) });
      const { canvasId: _canvas, ...intent } = prepared;
      submitted(ctx, await handle.designDecide(intent));
    }));
}
