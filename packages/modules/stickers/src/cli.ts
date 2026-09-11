import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CliModule, CliHost } from "@isocan/cli/modulehost";
import { STICKERS, STICKER_MIME, STICKER_SIZE, findSticker, stickerFile, stickersCore } from "./core.ts";

/**
 * **Anything a person can do, an agent can do** — the rule that decides this
 * file exists.
 *
 * The tray is a web gesture, and a gesture only one surface has is a feature
 * an agent cannot use. So the same act gets a verb: `isocan sticker drop
 * fire` puts one on the canvas, `isocan sticker ls` says which there are.
 *
 * The CLI half needs none of the module API this module was built to
 * exercise. `CliHost` has had `sendOp` and a blob path since modules landed,
 * which is exactly the asymmetry #156 found — the terminal could always write
 * from anywhere and the web could only write from a palette entry.
 */
export const stickersCli: CliModule = {
  core: stickersCore,
  register: (host: CliHost) => {
    const family = host.program.command("sticker").description("Emoji stickers on the canvas");

    family
      .command("ls")
      .description("The stickers this build can drop")
      .action(
        host.run(async () => {
          for (const s of STICKERS) console.log(`${s.emoji}  ${s.id.padEnd(10)} ${s.name}`);
        }),
      );

    family
      .command("drop <sticker>")
      .description("Put one on the canvas — by emoji, id or name")
      .option("--canvas <canvas>")
      .option("--at <x,y>", "where to put it")
      .action(
        host.run(async (which: string, opts: { at?: string }, cmd) => {
          const sticker = findSticker(which);
          if (!sticker) {
            throw new Error(
              `no sticker "${which}" — try one of ${STICKERS.map((s) => s.id).join(", ")}, or the emoji itself`,
            );
          }
          const ctx = await host.ctxOf(cmd);
          const canvas = await host.resolveCanvas(ctx);
          const file = stickerFile(sticker);
          const upload = await ctx.client.uploadBlob(canvas.id, Buffer.from(file.body, "utf8"), STICKER_MIME, file.filename);
          const snapshot = await ctx.client.snapshot(canvas.id);
          const placement = host.placementFor(snapshot, opts, { ...STICKER_SIZE });
          const result = await host.sendOp(ctx, canvas.id, {
            type: "item.add",
            itemId: `itm_${Math.random().toString(36).slice(2, 12)}`,
            version: {
              id: `ver_${Math.random().toString(36).slice(2, 12)}`,
              blobHash: upload.blobHash,
              mimeType: STICKER_MIME,
              filename: file.filename,
              size: upload.size,
            },
            width: STICKER_SIZE.width,
            height: STICKER_SIZE.height,
            placement,
            title: sticker.name,
          } as never);
          void result;
          console.log(`${sticker.emoji} ${sticker.name} on ${canvas.title}`);
        }),
      );
  },
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};

export default stickersCli;
