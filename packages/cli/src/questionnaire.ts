import { promises as fs } from "node:fs";
import type { Command } from "commander";
import { CanvasHandle, resolveCanvas, questionnaireSubmissionIds, type QuestionnaireSubmission } from "@isocan/api";
import { parseDesignQuestionSet, parseDesignReference, parseDesignResponse, type DesignResolution, type DesignResponse } from "@isocan/core/design-partner";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
async function jsonFile(file: string): Promise<unknown> { return JSON.parse(await fs.readFile(file, "utf8")); }
async function referenceFile(file: string) {
  const value = await jsonFile(file);
  if (!Array.isArray(value)) throw new Error("A references file must contain a JSON array of versioned references.");
  return value.map(parseDesignReference);
}
function record(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`Expected an object with only ${allowed.join(", ")}.`);
  return value as Record<string, unknown>;
}
function reportSubmission(ctx: Ctx, result: QuestionnaireSubmission): void {
  if (ctx.json) printJson(result);
  else console.log(`${result.status}: ${result.payloadId} · thread ${result.threadId} · comment ${result.commentId} · ${result.opId ? `operation ${result.opId}` : "operation receipt unavailable"} · retry ${result.submittedOpId}${result.reason ? `\n${result.reason}` : ""}`);
  if (result.status !== "accepted") process.exitCode = 1;
}
const collect = (value: string, previous: string[]) => [...previous, value];

/** argv adds no authority: the API and serialized writer own question semantics. */
export function registerQuestionnaires(design: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const act = (work: (handle: CanvasHandle, ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try {
      const ctx = await contextOf(args.at(-1) as Command);
      const canvas = await resolveCanvas(ctx);
      await work(new CanvasHandle(ctx, canvas), ctx, args);
    } catch (error) { console.error(errorText(error)); process.exitCode = 1; }
  };

  design.command("questions [payload]")
    .description("Read structured questions, exact sources and answers; unrelated comments never close them")
    .option("--thread <id>", "filter by exact thread ID")
    .option("--request <id>", "filter by design request ID")
    .option("--respondent <id>", "filter by intended respondent ID")
    .option("--respondents", "list writer-resolved human, agent and unknown actor eligibility")
    .action(act(async (handle, ctx, [payload, options]) => {
      if (options.respondents) {
        if (payload || options.thread || options.request || options.respondent) throw new Error("--respondents lists eligibility and cannot be combined with question filters.");
        const result = await handle.designRespondents();
        if (ctx.json) printJson(result);
        else for (const actor of result.actors) console.log(`${actor.id} ${actor.name} · ${actor.kind}${actor.kind === "human" ? " · can answer" : ""}`);
        return;
      }
      const states = await handle.designQuestions({ ...(options.thread ? { threadId: options.thread } : {}), ...(options.request ? { requestId: options.request } : {}), ...(options.respondent ? { respondentActorId: options.respondent } : {}) });
      const result = payload ? states.filter(state => state.questions.id === payload) : states;
      if (payload && !result.length) throw new Error(`No typed question set ${payload} exists on this canvas.`);
      if (ctx.json) return printJson(result);
      if (!result.length) console.log("No structured design questions.");
      for (const state of result) {
        console.log(`${state.questions.id} · ${state.status} · for ${state.questions.respondentActorId}\n${state.questions.headline}\nSource ${state.source.threadId} / ${state.source.commentId} / revision ${state.source.revision}`);
        for (const question of state.questions.questions) {
          console.log(`  ${question.id}: ${question.title}${state.outstandingQuestionIds.includes(question.id) ? " · open" : " · resolved"}\n    ${question.consequence}`);
          for (const option of question.options) console.log(`    ${option.id}: ${option.title} — ${option.consequence}${option.preview ? ` · preview ${option.preview.itemId}@${option.preview.versionId}` : ""}`);
        }
        for (const { response, commentId } of state.responses) console.log(`  Answer ${response.id} · comment ${commentId}: ${JSON.stringify(response.resolutions)}`);
      }
    }));

  design.command("ask <file>")
    .description("Publish a validated question set from JSON with a named human respondent and current brief")
    .option("--thread <id>", "existing thread; required when the file is a bare question-set record")
    .addHelpText("after", "\nThe file is a DesignQuestionSet record, or {threadId, questions, legacySource?}.\nKeep its payload id when retrying. Stable comment/operation IDs are derived from it.\nLegacy adoption explicitly names the original threadId, commentId and unchanged body.\nThe current phase requires an existing valid design brief and thread.\n")
    .action(act(async (handle, ctx, [file, options]) => {
      const input = await jsonFile(file);
      let raw: unknown = input, threadId: unknown = options.thread, legacySource: { threadId: string; commentId: string; body: string } | undefined;
      if (input && typeof input === "object" && "questions" in input && !("kind" in input)) {
        const wrapper = record(input, ["threadId", "questions", "legacySource"]);
        if (threadId && threadId !== wrapper.threadId) throw new Error("--thread disagrees with the saved submission.");
        threadId = wrapper.threadId; raw = wrapper.questions;
        if (wrapper.legacySource !== undefined) {
          const source = record(wrapper.legacySource, ["threadId", "commentId", "body"]);
          if (![source.threadId, source.commentId, source.body].every(value => typeof value === "string" && value.trim())) throw new Error("Legacy adoption requires the exact original thread, comment and body.");
          legacySource = source as typeof legacySource;
        }
      }
      if (typeof threadId !== "string" || !threadId.trim()) throw new Error("An existing --thread is required.");
      const questions = parseDesignQuestionSet(raw);
      const ids = await questionnaireSubmissionIds("ask", questions.id);
      reportSubmission(ctx, await handle.designAsk({ threadId, questions, ...ids, ...(legacySource ? { legacySource } : {}) }));
    }));

  design.command("answer [payload]")
    .description("Answer an exact question with choices, text, references, skip, dismiss or delegation")
    .option("--file <file>", "saved DesignResponse JSON; retain its id when retrying")
    .option("--id <id>", "stable response ID for a flag-based answer; required without --file")
    .option("--question <id>", "exact question ID for a flag-based answer")
    .option("--option <id>", "selected option ID; repeat for a multi-select question", collect, [])
    .option("--text <text>", "freeform answer, including Other for choices")
    .option("--references <file>", "JSON array of versioned DesignReference records")
    .option("--skip", "explicitly skip a skippable question")
    .option("--dismiss", "explicitly dismiss the question")
    .option("--delegate <actor>", "delegate this question to the named agent")
    .option("--supersedes <id>", "explicitly replace an earlier response; retain every resolved question")
    .action(act(async (handle, ctx, [payload, options]) => {
      let response: DesignResponse;
      const modes = [options.option.length > 0, options.text !== undefined, options.references !== undefined, !!options.skip, !!options.dismiss, options.delegate !== undefined].filter(Boolean).length;
      if (options.file) {
        if (modes || options.question || options.id || options.supersedes) throw new Error("A saved --file answer cannot be mixed with answer-building flags.");
        response = parseDesignResponse(await jsonFile(options.file));
        if (payload && payload !== response.question.payloadId) throw new Error("The requested payload disagrees with the saved answer.");
      } else {
        if (!payload || !options.id || !options.question || modes !== 1) throw new Error("Provide payload, --id, --question and exactly one answer form, or use --file with a saved response.");
        const state = (await handle.designQuestions()).find(one => one.questions.id === payload);
        if (!state) throw new Error(`No typed question set ${payload} exists.`);
        let resolution: DesignResolution;
        if (options.skip) resolution = { questionId: options.question, state: "skipped" };
        else if (options.dismiss) resolution = { questionId: options.question, state: "dismissed" };
        else if (options.delegate) resolution = { questionId: options.question, state: "delegated", agentActorId: options.delegate };
        else resolution = { questionId: options.question, state: "answered", value: options.references ? { kind: "references", references: await referenceFile(options.references) } : options.text !== undefined ? { kind: "text", text: options.text } : { kind: "options", optionIds: options.option } };
        response = parseDesignResponse({ schemaVersion: 1, kind: "response", id: options.id, requestId: state.questions.requestId, epoch: state.questions.epoch, question: state.source, respondentActorId: ctx.actor.id, resolutions: [resolution], supersedesResponseId: options.supersedes ?? null });
      }
      const ids = await questionnaireSubmissionIds("answer", response.id);
      reportSubmission(ctx, await handle.designAnswer({ threadId: response.question.threadId, response, ...ids }));
    }));

  design.command("reference <thread> <comment> <reference>")
    .description("Open exact retained answer-reference bytes, even after the source item changes")
    .option("--out <file>", "write exact bytes to a new file; refuses overwriting an existing file")
    .option("--offset <bytes>", "byte offset for a bounded printed page", "0")
    .option("--limit <bytes>", "printed byte limit, at most 262144", "16384")
    .action(act(async (handle, ctx, [thread, comment, reference, options]) => {
      const offset = Number(options.offset), limit = Number(options.limit);
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 262144) throw new Error("--offset must be nonnegative; --limit must be 1–262144 bytes.");
      const content = await handle.designReference({ threadId: thread, commentId: comment, referenceId: reference });
      if (offset > content.bytes.length) throw new Error("--offset exceeds the reference size.");
      const { bytes, ...metadata } = content;
      if (options.out) {
        if (offset !== 0 || limit !== 16384) throw new Error("--out writes the complete reference and cannot use page offsets or limits.");
        await fs.writeFile(options.out, bytes, { flag: "wx" });
        if (ctx.json) printJson({ ...metadata, bytesWritten: bytes.length, file: options.out });
        else console.log(`${options.out} · ${bytes.length} bytes · ${content.artifact.versionId} · ${content.artifact.blobHash}`);
        return;
      }
      const chunk = Buffer.from(bytes.subarray(offset, offset + limit));
      let encoding = "base64", data = chunk.toString("base64");
      if (/^(text\/|application\/(json|[^;]+\+json|xml|javascript|[^;]+\+xml)(;|$))/.test(content.version.mimeType)) {
        try { data = new TextDecoder("utf-8", { fatal: true }).decode(chunk); encoding = "utf8"; } catch { /* preserve a split code point losslessly */ }
      }
      const result = { ...metadata, offset, bytesRead: chunk.length, totalBytes: bytes.length, nextOffset: offset + chunk.length < bytes.length ? offset + chunk.length : null, encoding, data };
      if (ctx.json) printJson(result);
      else console.log(`${content.referenceId} · ${content.artifact.itemId}@${content.artifact.versionId} · ${encoding} · ${chunk.length}/${bytes.length} bytes\n${data}`);
    }));
}
