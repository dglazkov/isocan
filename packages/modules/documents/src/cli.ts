import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { documentsModule, documentsOn, isDocumentItem, outlineOf, outlineText, readingMinutes, wordCount } from "./core.ts";

/**
 * **Documents, from the terminal**: the same two readings the inspector and
 * the page give — every document with its size, and one document's outline —
 * as verbs, because an agent asked to `/outline` needs a verb to do it with
 * (`docs/projects/modules/design.md`, phase 4).
 */
function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  const docs = host.program.command("docs").description("Documents: every one on the canvas with its shape, and one document's outline");

  docs
    .command("ls", { isDefault: true })
    .description("Every document on this canvas — words, minutes, headings — newest edit first")
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const rows = [];
        for (const doc of documentsOn(snapshot.canvas)) {
          const current = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0]!;
          const text = (await ctx.client.downloadBlob(p.id, current.blobHash)).toString("utf8");
          const words = wordCount(text);
          rows.push({ id: doc.id, title: doc.title, filename: current.filename, words, minutes: readingMinutes(words), headings: outlineOf(text).length, updatedAt: doc.updatedAt });
        }
        if (ctx.json) return printJson(rows);
        if (rows.length === 0) return console.log("no documents here — `isocan add notes.md` brings one");
        for (const r of rows) {
          console.log(`${r.id}  ${r.title.padEnd(28).slice(0, 28)}  ${String(r.words).padStart(6)} words  ~${r.minutes} min  ${r.headings} heading${r.headings === 1 ? "" : "s"}`);
        }
      }),
    );

  docs
    .command("outline <item>")
    .description("A document's headings, indented by level, with the line each starts on")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        if (!isDocumentItem(item)) throw new Error(`"${item.title}" is not a document — docs outline reads markdown items`);
        const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
        const text = (await ctx.client.downloadBlob(p.id, current.blobHash)).toString("utf8");
        const headings = outlineOf(text);
        const words = wordCount(text);
        if (ctx.json) return printJson({ itemId: item.id, title: item.title, words, minutes: readingMinutes(words), headings });
        console.error(`${item.title} — ${words} words, about ${readingMinutes(words)} min`);
        console.log(outlineText(headings));
      }),
    );
}

export const documentsCli: CliModule = {
  core: documentsModule,
  register,
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};

export default documentsCli;
