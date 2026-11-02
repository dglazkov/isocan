import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import { resolveKey, resolveTextKey } from "@isocan/core/keystore";
import { homeAnswerer, homeOrStub, jevAnswerer, stubAnswerer, type Answerer } from "./answerer.ts";
import type { WirePort } from "./port.ts";

/**
 * **The composer's canvas, from the terminal** — a `WirePort` over the CLI's
 * host and daemon client. Blobs go through `ctx.client`, ops through
 * `sendOp` (so `--json`, the narration and the error shapes are the CLI's),
 * and where an added item landed is read off the op's receipt.
 */
export function cliPort(host: CliHost, ctx: Ctx, canvasId: string): WirePort {
  return {
    canvasId,
    // Read lazily: the actor is a getter that demands a name, and a read-only verb has no need of one.
    get actor() {
      try {
        return { id: ctx.actor.id, name: ctx.actor.name };
      } catch {
        return undefined;
      }
    },
    canvas: async () => (await ctx.client.snapshot(canvasId)).canvas,
    readText: async (blobHash) => Buffer.from(await ctx.client.downloadBlob(canvasId, blobHash)).toString("utf8"),
    put: async (text, mimeType, filename) => {
      const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), mimeType, filename);
      return { blobHash: upload.blobHash, size: upload.size };
    },
    send: async (op, group) => {
      const result = await host.sendOp(ctx, canvasId, op, group);
      if (op.type !== "item.add") return;
      const at = host.insertionReceiptPlacement(result.envelope.op, op.itemId) as { x?: number; y?: number };
      return { x: at.x ?? 0, y: at.y ?? 0 };
    },
  };
}

/**
 * **This machine's Jev key** — `TYPESAFE_API_KEY`, else `~/.isocan/keys.json`
 * (`isocan keys set typesafe`), read now (keys phase 1). A keys.json refused
 * for its mode throws, in words that say so: on a terminal, the refusal is
 * the useful answer.
 */
export function localJevKey(): string | undefined {
  return resolveKey("typesafe")?.key;
}

/** This machine's text-model key, provider and model — `ISOCAN_TEXT_API_KEY`, else keys.json's Anthropic, else its OpenAI key. */
export function localTextKey(): ReturnType<typeof resolveTextKey> {
  return resolveTextKey();
}

/** Where the CLI says which answerer it is using, before it asks. */
export type Say = (line: string) => void;

/**
 * **Which answerer the CLI composes with.** `--answerer` if given; else Jev
 * with a key of this machine's own; else the home — Jev through the canvas's
 * home, with the home's key — and, when the home has no key either, the
 * seeded stub, said out loud. An explicit `--answerer home` never falls back.
 */
export function cliAnswerer(ctx: Ctx, canvasId: string, name: string | undefined, seed: number, say: Say): Answerer {
  const key = localJevKey();
  const chosen = name ?? (key ? "jev" : "home");
  if (chosen === "stub") return stubAnswerer(seed);
  if (chosen === "jev") return jevAnswerer({ key });
  if (chosen !== "home") throw new Error(`--answerer must be jev, home, stub or agent — got: ${chosen}`);
  const home = homeAnswerer((question) => ctx.client.judgment(question), canvasId);
  if (name === "home") return home;
  return homeOrStub(home, stubAnswerer(seed), () => say(`the home has no judge either (judgment-unavailable) — answering with the stub (seed ${seed}), random and honest about it`));
}
