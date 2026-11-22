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

import { waitForFeedback, type DaemonRoutes } from "@isocan/api";
import {
  buildContextGraph,
  computeSuggestedFreeRegions,
  describeFailure,
  isAgentStation,
  mainThread,
  makeCommentReceipt,
  modelFor,
  newCommentId,
  newItemId,
  newVersionId,
  normalizeHandle,
  readStationMeta,
  stationProperties,
  stationTitle,
  summarizeOp,
  titleSlug,
  type Actor,
  type CanvasContents,
  type CommentReceipt,
  type CommentThread,
  type ContextGraph,
  type Operation,
  type PresenceSession,
  type ResolvedModel,
} from "@isocan/core";
import {
  HOUSE_HANDLE,
  HOUSE_ROLE,
  encodeHouseMeta,
  instantAck,
  type HouseCommentMeta,
  type HousePlanStepState,
} from "@isocan/core/house-agent";

/** One step in a model-proposed plan. */
export interface HouseModelPlanStep {
  id: string;
  label: string;
  state?: HousePlanStepState | undefined;
}

/** One canvas mutation requested by a {@link HouseModelAdapter}. */
export interface HouseModelOpRequest {
  kind: "item.add" | "item.update" | "text";
  itemId?: string | undefined;
  title?: string | undefined;
  text?: string | undefined;
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  expectVersionId?: string | undefined;
}

/** Structured response returned by a {@link HouseModelAdapter}. */
export interface HouseModelResponse {
  reply: string;
  thoughtTrace?: string[] | undefined;
  plan?: { title: string; steps: HouseModelPlanStep[] } | undefined;
  ops?: HouseModelOpRequest[] | undefined;
}

/** Injectable model backend so tests can run deterministically without network. */
export interface HouseModelAdapter {
  generate(input: {
    prompt: string;
    graph: ContextGraph;
    model: ResolvedModel;
    signal?: AbortSignal | undefined;
  }): Promise<HouseModelResponse>;
}

/** Options for constructing a {@link HouseAgent}. */
export interface HouseAgentOptions {
  client: DaemonRoutes;
  canvasId: string;
  actor: Actor;
  modelAdapter?: HouseModelAdapter | undefined;
  env?: Record<string, string | undefined> | undefined;
  waitTimeoutMs?: number | undefined;
  onLog?: ((message: string) => void) | undefined;
}

/** Result of one processed wake turn. */
export interface HouseAgentTurnResult {
  status: "completed" | "failed";
  threadId: string;
  ackCommentId: string;
  summary: string;
  receipts: CommentReceipt[];
}

/** Result of `HouseAgent.runOnce` or `HouseAgent.start`. */
export type HouseAgentRunResult =
  | { status: "yielded"; holderActorId: string; holderHandle: string }
  | { status: "timeout" }
  | { status: "cancelled" }
  | HouseAgentTurnResult;

/** Deterministic fake model adapter for tests and offline verification. */
export function createFakeModelAdapter(
  handler: (input: {
    prompt: string;
    graph: ContextGraph;
    model: ResolvedModel;
  }) => HouseModelResponse | Promise<HouseModelResponse>,
): HouseModelAdapter {
  return {
    async generate(input) {
      return await handler({
        prompt: input.prompt,
        graph: input.graph,
        model: input.model,
      });
    },
  };
}

class AdapterError extends Error {
  readonly kind?: string;
  readonly code?: string;
  readonly status?: number;
  readonly provider?: string;
  readonly model?: string;

  constructor(
    message: string,
    info: {
      kind?: string;
      code?: string;
      status?: number;
      provider?: string;
      model?: string;
    } = {},
  ) {
    super(message);
    this.name = "AdapterError";
    if (info.kind) this.kind = info.kind;
    if (info.code) this.code = info.code;
    if (info.status !== undefined) this.status = info.status;
    if (info.provider) this.provider = info.provider;
    if (info.model) this.model = info.model;
  }
}

function resolveApiKey(
  provider: ResolvedModel["provider"],
  env: Record<string, string | undefined>,
): string | undefined {
  if (provider === "gemini") return env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (provider === "anthropic") return env.ANTHROPIC_API_KEY || env.ISOCAN_TEXT_API_KEY;
  if (provider === "openai") return env.OPENAI_API_KEY || env.ISOCAN_TEXT_API_KEY;
  return undefined;
}

function parseModelJson(raw: string): HouseModelResponse {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && typeof parsed.reply === "string") {
      return {
        reply: parsed.reply,
        ...(Array.isArray(parsed.thoughtTrace)
          ? { thoughtTrace: parsed.thoughtTrace.filter((s): s is string => typeof s === "string") }
          : {}),
        ...(parsed.plan && typeof parsed.plan === "object"
          ? { plan: parsed.plan as HouseModelResponse["plan"] }
          : {}),
        ...(Array.isArray(parsed.ops)
          ? { ops: parsed.ops as HouseModelOpRequest[] }
          : {}),
      };
    }
  } catch {
    // Fall back to plain prose reply when the model did not emit JSON.
  }
  return { reply: trimmed || "Done." };
}

/**
 * Default {@link HouseModelAdapter} backed by `modelFor("chat")` and `fetch`
 * over Gemini, Anthropic, or OpenAI.
 */
export function createDefaultModelAdapter(
  env: Record<string, string | undefined> = process.env,
): HouseModelAdapter {
  return {
    async generate({ prompt, graph, model, signal }) {
      const apiKey = resolveApiKey(model.provider, env);
      if (!apiKey) {
        throw new AdapterError(
          `No API key configured for ${model.provider} (${model.id}).`,
          { kind: "missing-key", code: "missing-key", provider: model.provider, model: model.id },
        );
      }

      const systemPrompt =
        "You are @house, the helpful canvas collaborator. Respond ONLY with a JSON object " +
        'matching {"reply": string, "thoughtTrace": string[], "plan": {"title": string, "steps": [{"id": string, "label": string, "state": "done"}]}, "ops": [{"kind": "item.add"|"item.update"|"text", "itemId"?: string, "title"?: string, "text"?: string}]}.';
      const userContent = JSON.stringify({
        prompt,
        canvasTitle: graph.canvas.title,
        items: graph.items.slice(0, 40),
        suggestedFreeRegions: graph.suggestedFreeRegions,
      });

      if (model.provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          ...(signal ? { signal } : {}),
        });
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          throw new AdapterError(data?.error?.message ?? `Gemini HTTP ${res.status}`, {
            status: res.status,
            provider: "gemini",
            model: model.id,
          });
        }
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        return parseModelJson(String(text));
      }

      if (model.provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model.id,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          }),
          ...(signal ? { signal } : {}),
        });
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          throw new AdapterError(data?.error?.message ?? `Anthropic HTTP ${res.status}`, {
            status: res.status,
            provider: "anthropic",
            model: model.id,
          });
        }
        const text = data?.content?.[0]?.text ?? "";
        return parseModelJson(String(text));
      }

      if (model.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model.id,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
            response_format: { type: "json_object" },
          }),
          ...(signal ? { signal } : {}),
        });
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          throw new AdapterError(data?.error?.message ?? `OpenAI HTTP ${res.status}`, {
            status: res.status,
            provider: "openai",
            model: model.id,
          });
        }
        const text = data?.choices?.[0]?.message?.content ?? "";
        return parseModelJson(String(text));
      }

      throw new AdapterError(`Unsupported provider "${model.provider}" for chat role.`, {
        kind: "validation",
        provider: model.provider,
        model: model.id,
      });
    },
  };
}

function isHouseSession(session: PresenceSession): boolean {
  if (normalizeHandle(session.handle ?? "") === HOUSE_HANDLE) return true;
  return normalizeHandle(session.actor.name) === HOUSE_HANDLE;
}

function findPendingThread(
  canvas: CanvasContents,
  selfActorId: string,
): { thread: CommentThread; prompt: string } | null {
  const main = mainThread(canvas);
  if (main && main.comments.length > 0) {
    const last = main.comments[main.comments.length - 1]!;
    if (last.author.id !== selfActorId && !last.record) {
      return { thread: main, prompt: last.body };
    }
  }
  for (const thread of Object.values(canvas.threads)) {
    if (thread.comments.length === 0) continue;
    const last = thread.comments[thread.comments.length - 1]!;
    if (last.author.id === selfActorId || last.record) continue;
    if (last.mentions?.includes(selfActorId) || /@house\b/i.test(last.body)) {
      return { thread, prompt: last.body };
    }
  }
  return null;
}

/**
 * The canonical `@house` agent runner: behaves like an ordinary isocan agent
 * over `DaemonRoutes`, yields cleanly if a BYO agent already holds `@house`,
 * and follows the Open Stitch Phase 2A/2B work-visible & metadata contracts.
 */
export class HouseAgent {
  private readonly client: DaemonRoutes;
  private readonly canvasId: string;
  private readonly actor: Actor;
  private readonly modelAdapter: HouseModelAdapter;
  private readonly env: Record<string, string | undefined>;
  private readonly waitTimeoutMs: number;
  private readonly onLog: (message: string) => void;
  private sessionId: string | null = null;
  private stopped = false;

  constructor(options: HouseAgentOptions) {
    this.client = options.client;
    this.canvasId = options.canvasId;
    this.actor = options.actor;
    this.env = options.env ?? process.env;
    this.modelAdapter = options.modelAdapter ?? createDefaultModelAdapter(this.env);
    this.waitTimeoutMs = options.waitTimeoutMs ?? 30_000;
    this.onLog = options.onLog ?? (() => {});
  }

  /**
   * Check live presence for `@house`: yield if another actor already holds
   * the role; otherwise open our presence session and ensure our station exists.
   */
  async claimOrYield(): Promise<
    | { claimed: true; sessionId: string }
    | { claimed: false; holderActorId: string; holderHandle: string }
  > {
    const sessions = await this.client.listSessions(this.canvasId);
    const holder = sessions.find(
      (s) => s.actor.id !== this.actor.id && isHouseSession(s),
    );
    if (holder) {
      const holderHandle = normalizeHandle(holder.handle ?? holder.actor.name) ?? HOUSE_HANDLE;
      this.onLog(`@house already held by ${holder.actor.name} (${holder.actor.id}); yielding.`);
      return {
        claimed: false,
        holderActorId: holder.actor.id,
        holderHandle,
      };
    }

    if (!this.sessionId) {
      const created = await this.client.createSession(
        this.canvasId,
        this.actor,
        `@${HOUSE_HANDLE} · ${HOUSE_ROLE}`,
        HOUSE_HANDLE,
        "cli",
        HOUSE_HANDLE,
      );
      this.sessionId = created.sessionId;
      await this.client.updateSession(this.canvasId, this.sessionId, {
        action: "idle",
        handle: HOUSE_HANDLE,
      });
    }

    await this.ensureStation();
    return { claimed: true, sessionId: this.sessionId };
  }

  private async ensureStation(): Promise<void> {
    const snap = await this.client.snapshot(this.canvasId);
    const existing = Object.values(snap.canvas.items).find(
      (item) => isAgentStation(item) && readStationMeta(item)?.handle === HOUSE_HANDLE,
    );
    if (existing) return;

    const free = computeSuggestedFreeRegions(Object.values(snap.canvas.items), 320, 180)[0];
    const title = stationTitle(HOUSE_HANDLE, HOUSE_ROLE);
    const props = stationProperties({
      handle: HOUSE_HANDLE,
      role: HOUSE_ROLE,
      phase: "waiting",
      goal: "Ready for canvas requests",
    });
    const text = "Waiting for requests…";
    const bytes = new TextEncoder().encode(text);
    const uploaded = await this.client.uploadBlob(
      this.canvasId,
      bytes,
      "text/markdown",
      "house-station.md",
    );
    await this.client.sendOp(this.canvasId, this.actor, {
      type: "item.add",
      itemId: newItemId(),
      title,
      width: 320,
      height: 180,
      placement: { x: free?.x ?? 40, y: free?.y ?? 40 },
      properties: props,
      version: {
        id: newVersionId(),
        blobHash: uploaded.blobHash,
        mimeType: "text/markdown",
        filename: "house-station.md",
        size: uploaded.size,
      },
    });
  }

  /** Process one pending wake or wait for the next wake once. */
  async runOnce(signal?: AbortSignal): Promise<HouseAgentRunResult> {
    const claim = await this.claimOrYield();
    if (!claim.claimed) {
      return {
        status: "yielded",
        holderActorId: claim.holderActorId,
        holderHandle: claim.holderHandle,
      };
    }

    const snap = await this.client.snapshot(this.canvasId, signal);
    const pending = findPendingThread(snap.canvas, this.actor.id);
    if (pending) {
      return await this.processTurn(pending.thread.id, pending.prompt, signal);
    }

    const wake = await waitForFeedback(this.client, this.canvasId, this.actor, {
      since: snap.lastSeq,
      timeoutMs: this.waitTimeoutMs,
      ...(signal ? { signal } : {}),
    });

    if (wake.status === "cancelled") return { status: "cancelled" };
    if (wake.status === "timeout" || wake.entries.length === 0) return { status: "timeout" };

    const entry = wake.entries[wake.entries.length - 1]!;
    const op = entry.envelope.op;
    const threadId =
      op.type === "thread.create"
        ? op.threadId
        : op.type === "thread.reply"
          ? op.threadId
          : mainThread(snap.canvas)?.id;
    const prompt =
      op.type === "thread.create" || op.type === "thread.reply"
        ? op.comment.body
        : "Follow up on the latest canvas activity.";

    if (!threadId) return { status: "timeout" };
    return await this.processTurn(threadId, prompt, signal);
  }

  /** Run the continuous wake loop until `stop()` or `signal` aborts. */
  async start(signal?: AbortSignal): Promise<HouseAgentRunResult> {
    this.stopped = false;
    while (!this.stopped && !signal?.aborted) {
      const result = await this.runOnce(signal);
      if (result.status === "yielded" || result.status === "cancelled") {
        return result;
      }
    }
    return { status: "cancelled" };
  }

  /** End the presence session cleanly. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.sessionId) {
      const id = this.sessionId;
      this.sessionId = null;
      await this.client.endSession(this.canvasId, id).catch(() => {});
    }
  }

  /** Execute one full turn on `threadId` for `prompt`. */
  async processTurn(
    threadId: string,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<HouseAgentTurnResult> {
    const ackText = instantAck(prompt);
    const ackCommentId = newCommentId();
    const initialMeta: HouseCommentMeta = {
      ack: ackText,
      goal: { state: "running", wave: 1 },
    };

    await this.client.sendOp(this.canvasId, this.actor, {
      type: "thread.reply",
      threadId,
      comment: {
        id: ackCommentId,
        body: encodeHouseMeta(ackText, initialMeta),
      },
    });

    const resolvedModel = modelFor("chat", { env: this.env });

    try {
      if (this.sessionId) {
        await this.client.updateSession(this.canvasId, this.sessionId, {
          action: "reading",
          status: "Reading context graph",
        });
      }

      const [snap, sessions, leasesRes] = await Promise.all([
        this.client.snapshot(this.canvasId, signal),
        this.client.listSessions(this.canvasId),
        this.client.leases(this.canvasId).catch(() => ({ leases: [] })),
      ]);

      const graph = buildContextGraph(snap, {
        presence: sessions,
        leases: leasesRes.leases,
        mode: "full",
      });

      const response = await this.modelAdapter.generate({
        prompt,
        graph,
        model: resolvedModel,
        signal,
      });

      const receipts: CommentReceipt[] = [];
      const opSummaries: string[] = [];

      if (response.ops && response.ops.length > 0) {
        if (this.sessionId) {
          await this.client.updateSession(this.canvasId, this.sessionId, {
            action: "writing",
            status: "Applying canvas changes",
          });
        }

        let currentCanvas = snap.canvas;
        for (const req of response.ops) {
          const applied = await this.applyModelOp(currentCanvas, req);
          if (applied) {
            opSummaries.push(applied.summary);
            if (applied.receipt) receipts.push(applied.receipt);
            const refreshed = await this.client.snapshot(this.canvasId, signal);
            currentCanvas = refreshed.canvas;
          }
        }
      }

      if (this.sessionId) {
        await this.client.updateSession(this.canvasId, this.sessionId, {
          action: "done",
          status: "Completed turn",
        });
      }

      const summaryLines = [
        ...opSummaries,
        response.reply.trim(),
      ].filter(Boolean);
      const finalBody = summaryLines.join("\n\n") || "Done.";

      const finalMeta: HouseCommentMeta = {
        ack: ackText,
        ...(response.thoughtTrace?.length ? { thoughtTrace: response.thoughtTrace } : {}),
        ...(response.plan
          ? {
              plan: {
                title: response.plan.title,
                steps: response.plan.steps.map((s) => ({
                  id: s.id,
                  label: s.label,
                  state: s.state ?? "done",
                })),
              },
            }
          : {}),
        goal: { state: "done", wave: 1 },
      };

      await this.client.sendOp(this.canvasId, this.actor, {
        type: "comment.update",
        threadId,
        commentId: ackCommentId,
        body: encodeHouseMeta(finalBody, finalMeta),
      });

      for (const receipt of receipts) {
        await this.client.sendOp(this.canvasId, this.actor, {
          type: "thread.reply",
          threadId,
          comment: {
            id: newCommentId(),
            body: `Receipt for #${receipt.itemId}: ${receipt.summary}`,
            items: [receipt.itemId],
            receipt,
          },
        });
      }

      return {
        status: "completed",
        threadId,
        ackCommentId,
        summary: finalBody,
        receipts,
      };
    } catch (err) {
      const errObj = err as Partial<AdapterError> & { message?: string };
      const failure = describeFailure({
        kind: errObj.kind,
        code: errObj.code,
        status: errObj.status,
        message: err instanceof Error ? err.message : String(err),
        provider: errObj.provider ?? resolvedModel.provider,
        model: errObj.model ?? resolvedModel.id,
      });

      const failureBody = `${failure.headline}: ${failure.why}\n\nNext: ${failure.next}`;
      await this.client
        .sendOp(this.canvasId, this.actor, {
          type: "comment.update",
          threadId,
          commentId: ackCommentId,
          body: encodeHouseMeta(failureBody, {
            ack: ackText,
            goal: { state: "stalled" },
          }),
        })
        .catch(() => {});

      if (this.sessionId) {
        await this.client
          .updateSession(this.canvasId, this.sessionId, {
            action: "idle",
            status: failure.headline,
          })
          .catch(() => {});
      }

      return {
        status: "failed",
        threadId,
        ackCommentId,
        summary: failureBody,
        receipts: [],
      };
    }
  }

  private async applyModelOp(
    canvas: CanvasContents,
    req: HouseModelOpRequest,
  ): Promise<{ summary: string; receipt?: CommentReceipt } | null> {
    if (req.kind === "item.add" || (req.kind === "text" && !req.itemId)) {
      const itemId = newItemId();
      const versionId = newVersionId();
      const title = req.title?.trim() || "Note";
      const text = req.text ?? title;
      const width = req.width ?? 280;
      const height = req.height ?? 160;
      const free = computeSuggestedFreeRegions(Object.values(canvas.items), width, height)[0];
      const filename = `${titleSlug(title, { ascii: true }) || "note"}.md`;
      const uploaded = await this.client.uploadBlob(
        this.canvasId,
        new TextEncoder().encode(text),
        "text/markdown",
        filename,
      );
      const op: Operation = {
        type: "item.add",
        itemId,
        title,
        width,
        height,
        placement: { x: req.x ?? free?.x ?? 80, y: req.y ?? free?.y ?? 80 },
        version: {
          id: versionId,
          blobHash: uploaded.blobHash,
          mimeType: "text/markdown",
          filename,
          size: uploaded.size,
        },
      };
      await this.client.sendOp(this.canvasId, this.actor, op);
      const summary = summarizeOp(op, { canvas, itemTitle: title });
      const receipt = makeCommentReceipt(
        {
          id: itemId,
          title,
          currentVersionId: versionId,
          versions: [
            {
              id: versionId,
              blobHash: uploaded.blobHash,
              mimeType: "text/markdown",
              filename,
              size: uploaded.size,
              createdAt: new Date().toISOString(),
              createdBy: this.actor,
            },
          ],
        },
        summary,
      );
      return { summary, receipt };
    }

    if ((req.kind === "item.update" || req.kind === "text") && req.itemId) {
      const existing = canvas.items[req.itemId];
      if (!existing) return null;
      const expectVersionId = req.expectVersionId ?? existing.currentVersionId;
      if (req.text !== undefined) {
        const versionId = newVersionId();
        const currentVer = existing.versions.find((v) => v.id === existing.currentVersionId);
        const filename = currentVer?.filename || "note.md";
        const uploaded = await this.client.uploadBlob(
          this.canvasId,
          new TextEncoder().encode(req.text),
          "text/markdown",
          filename,
        );
        const op: Operation = {
          type: "item.edit",
          itemId: existing.id,
          expectedVersionId: expectVersionId,
          patch: req.title ? { title: req.title } : {},
          version: {
            id: versionId,
            blobHash: uploaded.blobHash,
            mimeType: "text/markdown",
            filename,
            size: uploaded.size,
          },
        };
        await this.client.sendOp(this.canvasId, this.actor, op);
        const summary = summarizeOp(op, { canvas, itemTitle: req.title ?? existing.title });
        const receipt = makeCommentReceipt(
          {
            id: existing.id,
            title: req.title ?? existing.title,
            currentVersionId: versionId,
            versions: [
              ...existing.versions,
              {
                id: versionId,
                blobHash: uploaded.blobHash,
                mimeType: "text/markdown",
                filename,
                size: uploaded.size,
                createdAt: new Date().toISOString(),
                createdBy: this.actor,
              },
            ],
          },
          summary,
          existing.currentVersionId,
        );
        return { summary, receipt };
      }

      if (req.title) {
        const op: Operation = {
          type: "item.update",
          itemId: existing.id,
          patch: { title: req.title },
          expect: { versionId: expectVersionId },
        };
        await this.client.sendOp(this.canvasId, this.actor, op);
        const summary = summarizeOp(op, { canvas });
        return { summary };
      }
    }

    return null;
  }
}
