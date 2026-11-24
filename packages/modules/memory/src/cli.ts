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

import { z } from "zod";
import type { Command } from "commander";
import { buildContextGraph } from "@isocan/core/context-graph";
import { MEMORY_FACETS, packMemoryContext, type MemoryFacet } from "@isocan/core/context-budget";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import guideText from "../agent-guide.md";
import {
  MEMORY_FORGET_ROUTE,
  MEMORY_LEARN_ROUTE,
  MEMORY_PLACE_ROUTE,
  MEMORY_PROPS,
  MEMORY_REFLECT_ROUTE,
  MEMORY_SEARCH_ROUTE,
  memoryModule,
  type MemoryForgetResponse,
  type MemoryLearnResponse,
  type MemoryPlaceResponse,
  type MemoryReflectResponse,
  type MemorySearchResponse,
} from "./core.ts";

function register(host: CliHost): void {
  const memory = host.program
    .command("memory")
    .description("Project reflections, personal observations, memory pointers, and cross-canvas search");

  memory
    .command("reflect")
    .description("Create or update the canvas's role=reflection document item")
    .option("--focus <text>", "optional current intent summary")
    .option("--canvas <canvas>")
    .action(
      host.run(async (opts: { focus?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<MemoryReflectResponse>("POST", MEMORY_REFLECT_ROUTE, {
          canvasId: canvas.id,
          ...(opts.focus?.trim() ? { focus: opts.focus.trim() } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (${answer.created ? "created" : "updated"} ${answer.versionId}, ${answer.updatedAt})`);
      }),
    );

  memory
    .command("learn <text>")
    .description("Append project guidance or record a faceted personal observation")
    .option("--personal", "save as a personal observation on your About you canvas")
    .option("--facet <facet>", `observation facet (${MEMORY_FACETS.join("|")})`)
    .option("--personal-canvas <id>", "target personal canvas id")
    .option("--confidence <n>", "confidence score 0..1")
    .option("--proofs <n>", "supporting proof count")
    .option("--canvas <canvas>")
    .action(
      host.run(
        async (
          text: string,
          opts: {
            personal?: boolean;
            facet?: string;
            personalCanvas?: string;
            confidence?: string;
            proofs?: string;
            canvas?: string;
          },
          cmd: Command,
        ) => {
          if (opts.facet && !(MEMORY_FACETS as readonly string[]).includes(opts.facet)) {
            throw new Error(`--facet must be one of ${MEMORY_FACETS.join(", ")}`);
          }
          const ctx = await host.ctxOf(cmd);
          const canvas = await host.resolveCanvas(ctx);
          const target = opts.personal || opts.facet || opts.personalCanvas ? "personal" : "project";
          const answer = await ctx.client.moduleRequest<MemoryLearnResponse>("POST", MEMORY_LEARN_ROUTE, {
            canvasId: canvas.id,
            text,
            target,
            ...(opts.facet ? { facet: opts.facet as MemoryFacet } : {}),
            ...(opts.personalCanvas ? { personalCanvasId: opts.personalCanvas } : {}),
            ...(opts.confidence !== undefined ? { confidence: Number(opts.confidence) } : {}),
            ...(opts.proofs !== undefined ? { proofs: Number(opts.proofs) } : {}),
            actor: ctx.actor,
          });
          if (ctx.json) return host.printJson(answer);
          console.log(`${answer.itemId} (${answer.target}, ${answer.canvasId})`);
        },
      ),
    );

  memory
    .command("search <query>")
    .description("Search admitted canvases with 3-way RRF (k=60) within CONTEXT_BUDGETS.history")
    .option("--limit <n>", "maximum hits to return")
    .option("--canvas <canvas>")
    .action(
      host.run(async (query: string, opts: { limit?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<MemorySearchResponse>("POST", MEMORY_SEARCH_ROUTE, {
          canvasId: canvas.id,
          query,
          ...(opts.limit !== undefined ? { limit: Number(opts.limit) } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        if (answer.hits.length === 0) {
          console.log("No matching memory items.");
          return;
        }
        for (const hit of answer.hits) {
          console.log(`${hit.itemId} [${hit.canvasTitle}] (${hit.score.toFixed(4)}) — ${hit.title}`);
        }
      }),
    );

  memory
    .command("place <ref>")
    .description("Place a pointer item referencing a private observation (zero private text)")
    .option("--label <text>", "optional non-sensitive card label")
    .option("--facet <facet>", `optional facet (${MEMORY_FACETS.join("|")})`)
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { label?: string; facet?: string; canvas?: string }, cmd: Command) => {
        if (opts.facet && !(MEMORY_FACETS as readonly string[]).includes(opts.facet)) {
          throw new Error(`--facet must be one of ${MEMORY_FACETS.join(", ")}`);
        }
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<MemoryPlaceResponse>("POST", MEMORY_PLACE_ROUTE, {
          canvasId: canvas.id,
          ref,
          ...(opts.label ? { label: opts.label } : {}),
          ...(opts.facet ? { facet: opts.facet as MemoryFacet } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (pointer -> ${answer.pointer.ref}, owner ${answer.pointer.ownerId})`);
      }),
    );

  memory
    .command("forget <itemId>")
    .description("Delete a memory item and record a durable exclusion tombstone")
    .option("--reason <text>", "optional reason recorded in the exclusion tombstone")
    .option("--canvas <canvas>")
    .action(
      host.run(async (itemId: string, opts: { reason?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<MemoryForgetResponse>("POST", MEMORY_FORGET_ROUTE, {
          canvasId: canvas.id,
          itemId,
          ...(opts.reason?.trim() ? { reason: opts.reason.trim() } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.exclusion.itemId} (forgotten at ${answer.exclusion.forgottenAt})`);
      }),
    );

  memory
    .command("graph")
    .description("Print Tier-0/Tier-1 memory context for this canvas packed within CONTEXT_BUDGETS")
    .option("--canvas <canvas>")
    .action(
      host.run(async (_opts: { canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const graph = buildContextGraph(snapshot, { mode: "nav" });
        const reflectionItem = Object.values(snapshot.canvas.items).find(
          (i) => i.properties?.[MEMORY_PROPS.role] === "reflection",
        );
        const reflectionText = reflectionItem
          ? await ctx.client
              .downloadBlob(
                canvas.id,
                (reflectionItem.versions.find((v) => v.id === reflectionItem.currentVersionId) ??
                  reflectionItem.versions[reflectionItem.versions.length - 1]!)
                  .blobHash,
              )
              .then((bytes) => new TextDecoder().decode(bytes))
              .catch(() => "")
          : "";
        const packed = packMemoryContext({
          ...(reflectionText ? { reflection: reflectionText } : {}),
        });
        const out = { graph, memory: packed };
        if (ctx.json) return host.printJson(out);
        console.log(`Canvas: ${graph.canvas.title} (${graph.canvas.itemCount} items)`);
        console.log(`Project memory tokens: ${packed.tokens.project}`);
        if (packed.project) console.log(packed.project);
      }),
    );
}

export const memoryCli: CliModule = {
  core: memoryModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "reflect",
      title: "Update project reflection",
      description:
        "Create or update the canvas's role=reflection document item citing #item and comment: threads while preserving Your project guidance. The same act as `isocan memory reflect`.",
      inputSchema: {
        focus: z.string().trim().min(1).optional().describe("Optional current intent summary to record in the reflection."),
      },
      run: async ({ focus }: { focus?: string }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<MemoryReflectResponse>(
          "POST",
          MEMORY_REFLECT_ROUTE,
          {
            canvasId: canvas.id,
            ...(focus ? { focus } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "learn",
      title: "Record project guidance or personal observation",
      description:
        "Append explicit guidance to the project reflection or record a faceted observation on your private About you canvas. The same act as `isocan memory learn`.",
      inputSchema: {
        text: z.string().trim().min(1).describe("Guidance or personal observation text to record."),
        target: z.enum(["project", "personal"]).optional().describe("Whether to store on the project reflection or personal About you canvas."),
        facet: z.enum(MEMORY_FACETS).optional().describe("Optional personal observation facet."),
        personalCanvasId: z.string().trim().min(1).optional().describe("Optional explicit personal canvas id."),
      },
      run: async (
        {
          text,
          target,
          facet,
          personalCanvasId,
        }: { text: string; target?: "project" | "personal"; facet?: MemoryFacet; personalCanvasId?: string },
        host,
      ) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<MemoryLearnResponse>(
          "POST",
          MEMORY_LEARN_ROUTE,
          {
            canvasId: canvas.id,
            text,
            ...(target ? { target } : {}),
            ...(facet ? { facet } : {}),
            ...(personalCanvasId ? { personalCanvasId } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "search",
      title: "Search memory across admitted canvases",
      description:
        "Search admitted canvases using 3-way RRF (k=60) and pack matching passages within CONTEXT_BUDGETS.history. The same act as `isocan memory search`.",
      inputSchema: {
        query: z.string().trim().min(1).describe("Search query across admitted canvases."),
        limit: z.number().int().positive().max(25).optional().describe("Maximum number of hits to return."),
      },
      run: async ({ query, limit }: { query: string; limit?: number }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<MemorySearchResponse>(
          "POST",
          MEMORY_SEARCH_ROUTE,
          {
            canvasId: canvas.id,
            query,
            ...(limit !== undefined ? { limit } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "place",
      title: "Place a private memory pointer on the canvas",
      description:
        "Place a pointer item on the canvas containing only { ref, ownerId, facet?, label? } with zero private observation text. The same act as `isocan memory place`.",
      inputSchema: {
        ref: z.string().trim().min(1).describe("Reference to the private observation (canvasId:itemId or itemId)."),
        label: z.string().trim().min(1).optional().describe("Optional non-sensitive label for the pointer card."),
        facet: z.enum(MEMORY_FACETS).optional().describe("Optional memory facet."),
      },
      run: async ({ ref, label, facet }: { ref: string; label?: string; facet?: MemoryFacet }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<MemoryPlaceResponse>(
          "POST",
          MEMORY_PLACE_ROUTE,
          {
            canvasId: canvas.id,
            ref,
            ...(label ? { label } : {}),
            ...(facet ? { facet } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "forget",
      title: "Forget a memory item permanently",
      description:
        "Delete an observation or memory item and record a durable exclusion tombstone so reflection, cross-canvas search, and pointer hydration permanently exclude it. The same act as `isocan memory forget`.",
      inputSchema: {
        itemId: z.string().trim().min(1).describe("Item id of the observation or memory item to forget."),
        reason: z.string().trim().min(1).optional().describe("Optional reason recorded in the exclusion tombstone."),
      },
      run: async ({ itemId, reason }: { itemId: string; reason?: string }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<MemoryForgetResponse>(
          "POST",
          MEMORY_FORGET_ROUTE,
          {
            canvasId: canvas.id,
            itemId,
            ...(reason ? { reason } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default memoryCli;
