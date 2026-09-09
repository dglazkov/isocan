import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { newItemId, newVersionId } from "@isocan/core";
import {
  STICKER_MIME,
  STICKER_SIZE,
  STICKERS,
  findSticker,
  stickersModule,
  stickersOn,
} from "./core.ts";

function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  const sticker = host.program
    .command("sticker")
    .description("Emoji stickers: drop one of 5 emoji onto the canvas, or list them");

  sticker
    .command("drop <emoji>")
    .description("Drop an emoji sticker onto the canvas (⭐, ❤️, 🔥, 👍, 🎉, or by name)")
    .option("--canvas <canvas>", "canvas id or title")
    .option("--at <x,y>", "coordinates in world units")
    .option("--anchor <item>", "place beside this item")
    .action(
      run(async (emojiInput: string, _opts: unknown, cmd: Command) => {
        const found = findSticker(emojiInput);
        if (!found) {
          const valid = STICKERS.map((s) => `${s.emoji} (${s.id})`).join(", ");
          throw new Error(`unknown sticker "${emojiInput}" — choose one of: ${valid}`);
        }

        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const buffer = Buffer.from(`${found.emoji}\n`, "utf8");
        const upload = await ctx.client.uploadBlob(p.id, buffer, STICKER_MIME, found.filename);
        const itemId = newItemId();
        const placement = host.placementFor(snapshot, cmd.opts(), STICKER_SIZE) as any;

        await host.sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType: STICKER_MIME,
            filename: found.filename,
            size: upload.size,
          },
          ...STICKER_SIZE,
          placement,
          title: found.emoji,
        });

        if (ctx.json) {
          return printJson({
            itemId,
            emoji: found.emoji,
            name: found.name,
            placement,
          });
        }
        console.log(`${found.emoji} dropped (${itemId})`);
      }),
    );

  sticker
    .command("ls", { isDefault: true })
    .description("List available emoji stickers and those currently placed on the canvas")
    .option("--canvas <canvas>", "canvas id or title")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const placed = stickersOn(snapshot.canvas).map((item) => ({
          id: item.id,
          emoji: item.title,
          x: item.x,
          y: item.y,
        }));

        if (ctx.json) {
          return printJson({ available: STICKERS, placed });
        }

        console.log("Available stickers:");
        for (const s of STICKERS) {
          console.log(`  ${s.emoji}  ${s.id.padEnd(12)}  ${s.name}`);
        }

        if (placed.length > 0) {
          console.log(`\nPlaced on this canvas (${placed.length}):`);
          for (const item of placed) {
            console.log(`  ${item.emoji}  ${item.id}  at (${item.x}, ${item.y})`);
          }
        }
      }),
    );
}

export const stickersCli: CliModule = {
  core: stickersModule,
  register,
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};

export default stickersCli;

