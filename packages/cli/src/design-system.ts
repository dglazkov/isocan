import { promises as fs } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { designSystemPort, readDesignSystem, projectDesignSystem, parseDesignProjection, prepareDesignReconciliation, reconcileDesignProjection, writeDesignDirection, designRecipes, readDesignRecipe, resolveCanvas, resolveCanvasGroupRef, type DesignSystemTarget, type DesignReconcileRequest, type DesignReconcileResult } from "@isocan/api";
import { findArea, newOpId, newVersionId } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

const manifestName = "DESIGN.projection.json", intentName = "DESIGN.intent.json";
const json = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"));
async function target(ctx: Ctx, canvasId: string, options: { in?: string; item?: string }): Promise<DesignSystemTarget> {
  if (options.in && options.item) throw new Error("Choose --in or --item.");
  if (options.item) return { kind: "item", itemId: options.item };
  if (!options.in) return { kind: "canvas" };
  const snapshot = await ctx.client.snapshot(canvasId);
  const group = snapshot.project.groupMode === "groups" ? resolveCanvasGroupRef(snapshot.canvas, options.in) : findArea(snapshot.canvas, options.in);
  if (!group) throw new Error(`No scope ${options.in}.`);
  return { kind: "group", groupId: group.id };
}
function result(ctx: Ctx, value: DesignReconcileResult): void {
  if (ctx.json) printJson(value);
  else console.log(`${value.status}: ${value.source.itemId}@${value.source.versionId} · ${value.opId ? `operation ${value.opId}` : "operation identity unavailable"}${value.reason ? `\n${value.reason}` : ""}${value.consistency ? `\nConsistency: ${value.consistency.status}${value.consistency.reasons.length ? ` · ${value.consistency.reasons.join("; ")}` : ""}` : ""}`);
  if (value.status !== "accepted") process.exitCode = value.status === "pending" ? 3 : 1;
}

/** Native design commands share exact governing reads and prepared edits with the browser. */
export function registerDesignSystems(design: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  const act = (work: (ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try { await work(await contextOf(args.at(-1)), args); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  };
  const scope = (command: Command) => command.option("--in <scope>", "governing system of this exact group or area").option("--item <id>", "governing system of this actual item");
  scope(design.command("direction [file]"))
    .description("Read authored direction and actual author, or apply a captured direction edit")
    .addHelpText("after", "\nWrite file: {projection,direction,opId,versionId,retry?}. projection comes from design project;\ndirection is a version:1 authored rationale, hierarchy, layout, density, typography,\npalettePurpose and named treatments/states, with stage provisional or accepted.\nAn authored accepted stage does not claim an authenticated human preference.\nAfter uncertain delivery, retain projection/direction/opId/versionId unchanged and\nset retry:true to recover the original receipt even after later pruning or deletion.\nCreate a first DESIGN.md with design set; this edits the identified source.\n")
    .action(act(async (ctx, [file, options]) => {
      if (file) {
        if (options.in || options.item) throw new Error("The saved projection already names its target.");
        return result(ctx, await writeDesignDirection(designSystemPort(ctx), await json(file)));
      }
      const canvasId = (await resolveCanvas(ctx)).id, read = await readDesignSystem(designSystemPort(ctx), { canvasId, target: await target(ctx, canvasId, options) });
      if (ctx.json) return printJson(read);
      const governing = read.governing;
      console.log(governing.status === "available" ? `${governing.title} · ${governing.artifact.itemId}@${governing.artifact.versionId} · by ${read.author?.name}\n${JSON.stringify(read.direction, null, 2)}${governing.exempt ? "\nThis canvas is exempt from requiring a system; this incumbent still applies." : ""}` : governing.reason);
    }));
  scope(design.command("project <directory>"))
    .description("Export permitted governing DESIGN.md and its exact source manifest to a working folder")
    .option("--refresh", "explicitly capture today's governing source while preserving the working DESIGN.md")
    .action(act(async (ctx, [directory, options]) => {
      const canvasId = (await resolveCanvas(ctx)).id, folder = path.resolve(directory), manifest = path.join(folder, manifestName), file = path.join(folder, "DESIGN.md");
      await fs.mkdir(folder, { recursive: true });
      if (options.refresh) {
        try { await fs.access(path.join(folder, intentName)); throw new Error("A prepared reconciliation is pending; resolve it before refreshing the base."); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        await fs.access(file);
      } else {
        for (const name of [file, manifest, path.join(folder, intentName)]) { try { await fs.access(name); throw new Error(`Refusing to overwrite ${name}.`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
      }
      const previous = options.refresh ? await parseDesignProjection(await json(manifest)) : null;
      if (previous && previous.destination.canvasId !== canvasId) throw new Error("This projection belongs to another canvas; select it before refreshing.");
      const selectedTarget = previous && !options.in && !options.item ? previous.destination.target : await target(ctx, canvasId, options);
      const projection = await projectDesignSystem(designSystemPort(ctx), { canvasId, target: selectedTarget });
      if (!options.refresh) await fs.writeFile(file, projection.baseText, { flag: "wx" });
      await fs.writeFile(manifest, JSON.stringify(projection, null, 2) + "\n", { flag: options.refresh ? "w" : "wx" });
      if (ctx.json) printJson({ file, manifest, projection }); else console.log(`${file}\n${manifest}\nSource: ${projection.source.itemId}@${projection.source.versionId}${options.refresh ? " · working draft preserved" : ""}`);
    }));
  design.command("reconcile <directory>")
    .description("Conditionally save a working DESIGN.md to its captured source, preserving uncertain retries")
    .action(act(async (ctx, [directory]) => {
      const folder = path.resolve(directory), manifest = path.join(folder, manifestName), journal = path.join(folder, intentName);
      const text = await fs.readFile(path.join(folder, "DESIGN.md"), "utf8");
      let intent: DesignReconcileRequest, retry = false;
      try { intent = await json(journal); retry = true; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        intent = await prepareDesignReconciliation({ projection: await json(manifest), text, opId: newOpId(), versionId: newVersionId() });
        await fs.writeFile(journal, JSON.stringify(intent, null, 2) + "\n", { flag: "wx" });
      }
      if (intent.text !== text) throw new Error("DESIGN.md changed after preparation. The original DESIGN.intent.json remains pending; restore that content to retry before preparing another edit.");
      const saved = await reconcileDesignProjection(designSystemPort(ctx), { ...intent, retry });
      if (saved.status === "accepted") {
        await fs.writeFile(manifest, JSON.stringify(saved.savedProjection, null, 2) + "\n");
        await fs.rm(journal, { force: true });
      } else if (saved.status === "refused") await fs.rm(journal, { force: true });
      result(ctx, saved);
    }));
  design.command("recipes")
    .description("List the small runnable reference kit by task, without loading its bodies")
    .action(act(async (ctx) => { const values = designRecipes(); if (ctx.json) printJson(values); else for (const value of values) console.log(`${value.id} · ${value.title}\n  ${value.summary}\n  ${value.states.join(", ")}`); }));
  design.command("recipe <id>")
    .description("Inspect or export one installed HTML reference and its authored DESIGN.md")
    .option("--out <directory>", "write both runnable files into a new directory")
    .option("--design", "print the reference DESIGN.md instead of HTML")
    .action(act(async (ctx, [id, options]) => {
      const recipe = await readDesignRecipe(id);
      if (options.out) {
        if (options.design) throw new Error("--out exports both files; omit --design.");
        const folder = path.resolve(options.out); await fs.mkdir(folder);
        await fs.writeFile(path.join(folder, recipe.htmlFilename), recipe.html, { flag: "wx" });
        await fs.writeFile(path.join(folder, recipe.designFilename), recipe.design, { flag: "wx" });
        if (ctx.json) printJson({ id: recipe.id, directory: folder, files: [recipe.htmlFilename, recipe.designFilename] }); else console.log(`${folder}\n${recipe.htmlFilename}\n${recipe.designFilename}`);
      } else if (ctx.json) printJson(recipe); else process.stdout.write(options.design ? recipe.design : recipe.html);
    }));
}
