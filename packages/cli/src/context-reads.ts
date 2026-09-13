import type { Command } from "commander";
import { CanvasHandle, resolveCanvas } from "@isocan/api";
import type { ContextManifest, PostOpResponse } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

/** A successful send reports the writer's frozen scope, even if it changed during upload. */
export function contextReceipt(receipt: PostOpResponse): { context?: ContextManifest } {
  const op = receipt.envelope.op;
  const context = op.type === "thread.create" || op.type === "thread.reply" ? op.comment.context : op.type === "comment.update" ? op.context : undefined;
  return context ? { context } : {};
}

export function reportContext(ctx: Ctx, manifest: ContextManifest): void {
  if (ctx.json) return printJson(manifest);
  const { included, excluded, unavailable } = manifest.counts;
  console.log(`Context at revision ${manifest.revision}: ${included} included, ${excluded} excluded, ${unavailable} unavailable`);
  for (const entry of manifest.entries) {
    console.log(`${"  ".repeat(entry.depth)}${entry.excluded ? "excluded" : entry.unavailable ? "unavailable" : "included"} ${entry.itemId} ${entry.title} · ${entry.version?.id ?? "no version"}${entry.unavailable ? ` · ${entry.unavailable}` : ""}`);
  }
}

/** These reads never post an operation or change the caller's selection. */
export function registerContextReads(context: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const act = (work: (handle: CanvasHandle, ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try {
      const ctx = await contextOf(args.at(-1) as Command);
      const canvas = await resolveCanvas(ctx);
      await work(new CanvasHandle(ctx, canvas), ctx, args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };
  context.command("request <thread> <comment>")
    .description("Read the complete frozen context saved with a message")
    .action(act(async (handle, ctx, [thread, comment]) => reportContext(ctx, await handle.contextOfComment(thread, comment))));
  context.command("content <thread> <comment> <item>")
    .description("Read a saved source or visual version in bounded byte pages")
    .option("--face <face>", "source | visual", "source")
    .option("--offset <bytes>", "byte offset, starting at zero", "0")
    .option("--limit <bytes>", "bytes to return, at most 262144", "16384")
    .action(act(async (handle, ctx, [thread, comment, item, options]) => {
      if (!["source", "visual"].includes(options.face)) throw new Error("--face expects source or visual");
      const result = await handle.contextItem(thread, comment, item, { face: options.face, offset: Number(options.offset), limit: Number(options.limit) });
      if (ctx.json) return printJson(result);
      console.log(`${result.itemId} ${result.versionId ?? "no version"} ${result.face}: ${result.status}${result.reason ? ` — ${result.reason}` : ""}`);
      if (result.data !== undefined) {
        console.log(`${result.bytesRead} of ${result.totalBytes} bytes from offset ${result.offset}; ${result.encoding}${result.nextOffset !== null ? `; next --offset ${result.nextOffset}` : "; complete"}`);
        console.log(result.data);
      }
    }));
}
