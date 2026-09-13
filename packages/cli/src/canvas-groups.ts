import { Command } from "commander";
import { CanvasGroups, resolveCanvas } from "@isocan/api";
import type { CanvasGroupResult, CanvasGroupView } from "@isocan/api";
import { GROUP_DEFAULT_SIZE, type GroupAnchor, type GroupLayout } from "@isocan/core";
import { makeCtx, type Ctx } from "./ctx.ts";
import { parseXY, printJson, printTable } from "./output.ts";
import { parseGroupCell } from "./group-placement.ts";

export function reportCanvasGroup(ctx: Ctx, result: CanvasGroupResult): void {
  if (ctx.json) return printJson(result);
  console.log(`${result.dryRun ? "preview" : "applied"} ${result.intent}${result.itemId ? ` ${result.itemId}` : ""}: ${result.changes.length} item${result.changes.length === 1 ? "" : "s"} affected`);
  printTable(result.changes.map((change) => ({ id: change.itemId, parent: change.parentAfter ?? "canvas", position: change.boxAfter ? `${change.boxAfter.x},${change.boxAfter.y}` : "trash", size: change.boxAfter ? `${change.boxAfter.width}x${change.boxAfter.height}` : "—" })));
}

function sizeOf(value: string): { width: number; height: number } {
  const parts = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(value);
  if (!parts || Number(parts[1]) <= 0 || Number(parts[2]) <= 0) throw new Error(`size expects positive WxH, got: ${value}`);
  return { width: Number(parts[1]), height: Number(parts[2]) };
}
const report = reportCanvasGroup;

function rows(groups: CanvasGroupView[]): Array<Record<string, string>> {
  return groups.map((group) => ({ id: group.id, title: group.title, parent: group.parentId ?? "canvas", direct: String(group.directCount), descendants: String(group.descendantCount) }));
}

/** The full three-word family is registered here, independently of the people-group namespace. */
export function registerCanvasGroups(canvas: Command, context: (cmd: Command) => Promise<Ctx> = makeCtx): void {
  const groups = canvas.command("group").description("Canvas groups: membership, transforms, frame fitting and label-safe layout");
  const act = (work: (handle: CanvasGroups, ctx: Ctx, args: any[]) => Promise<void>) => async (...args: any[]) => {
    try {
      const ctx = await context(args[args.length - 1] as Command);
      const target = await resolveCanvas(ctx);
      await work(new CanvasGroups(ctx.client, target.id, () => ctx.actor), ctx, args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };

  groups.command("new <title...>").description("Create an empty named group; requires an enabled canvas")
    .option("--at <x,y>", "world position; default: beside the current items")
    .option("--size <WxH>", `initial frame (default ${GROUP_DEFAULT_SIZE.width}x${GROUP_DEFAULT_SIZE.height})`)
    .option("--note <text>", "the group's Markdown brief, reserved above its members")
    .option("--dry-run", "validate and report final boxes without uploading or writing")
    .action(act(async (handle, ctx, [title, opts]) => {
      let size: { width: number; height: number } | undefined;
      if (opts.size) {
        const parsed = /^(\d+)x(\d+)$/i.exec(opts.size);
        if (!parsed) throw new Error(`--size expects WxH, got: ${opts.size}`);
        size = { width: Number(parsed[1]), height: Number(parsed[2]) };
      }
      report(ctx, await handle.new(title.join(" "), { ...opts, ...(opts.at ? { at: parseXY(opts.at) } : {}), ...(size ? { size } : {}) }));
    }));

  groups.command("wrap <items...>").description("Group selected roots in place, under their common containing group")
    .requiredOption("--title <title>", "the new group's name")
    .option("--note <text>", "the group's Markdown brief")
    .option("--dry-run", "validate and report membership and boxes without writing")
    .action(act(async (handle, ctx, [items, opts]) => report(ctx, await handle.wrap(items, opts.title, opts))));

  groups.command("ls").description("List groups with direct and descendant counts")
    .action(act(async (handle, ctx) => { const found = await handle.list(); if (ctx.json) printJson(found); else printTable(rows(found)); }));

  groups.command("show <group>").description("Inspect a group by ID or unique title prefix")
    .option("--recursive", "include every descendant in the member list")
    .action(act(async (handle, ctx, [ref, opts]) => {
      const found = await handle.show(ref, !!opts.recursive);
      if (ctx.json) return printJson(found);
      printTable(rows([found]));
      console.log(`frame ${found.outerBox.x},${found.outerBox.y} ${found.outerBox.width}x${found.outerBox.height}; content ${found.contentBox.x},${found.contentBox.y} ${found.contentBox.width}x${found.contentBox.height}`);
      printTable(found.members.map((item) => ({ id: item.id, title: item.title, parent: item.parentId ?? "canvas" })));
    }));

  groups.command("add <group> <items...>").description("Add or move items into a group in one undo; preserve positions by default")
    .option("--place", "place additions below existing members, growing the frame as needed")
    .option("--cell <row,column>", "place in this 1-based grid cell; refuse if the pieces do not fit")
    .option("--dry-run", "report resolved membership and boxes without writing")
    .action(act(async (handle, ctx, [ref, items, opts]) => report(ctx, await handle.add(ref, items, { ...opts, ...(opts.cell ? { cell: parseGroupCell(opts.cell), place: true } : {}) }))));

  groups.command("remove <items...>").description("Leave each item's group for its parent, preserving world geometry")
    .option("--to-root", "move directly to the canvas root, even from nested groups")
    .option("--dry-run", "report resolved parent changes without writing")
    .action(act(async (handle, ctx, [items, opts]) => report(ctx, await handle.remove(items, opts))));

  groups.command("ungroup <groups...>").description("Dissolve selected frames, preserving their children and nested groups")
    .option("--dry-run", "report promoted members and trashed frames without writing")
    .action(act(async (handle, ctx, [refs, opts]) => report(ctx, await handle.ungroup(refs, opts))));

  groups.command("resize <group> <WxH>").description("Scale contents and attached ink; --anchor names the fixed corner")
    .option("--anchor <corner>", "nw | ne | sw | se", "nw")
    .option("--dry-run", "report constrained final geometry without writing")
    .action(act(async (handle, ctx, [ref, size, opts]) => {
      if (!["nw", "ne", "sw", "se"].includes(opts.anchor)) throw new Error("--anchor expects nw, ne, sw or se");
      report(ctx, await handle.resize(ref, sizeOf(size), { ...opts, anchor: opts.anchor as GroupAnchor }));
    }));

  groups.command("frame <groups...>").description("Fit frames around contents, or change one frame without scaling its members")
    .option("--fit", "fit frame to the saved member footprints")
    .option("--size <WxH>", "frame size; members retain their boxes")
    .option("--at <x,y>", "frame origin in world coordinates")
    .option("--dry-run", "report final frames without writing")
    .action(act(async (handle, ctx, [refs, opts]) => report(ctx, await handle.frame(refs, { ...opts, ...(opts.size ? { size: sizeOf(opts.size) } : {}), ...(opts.at ? { at: parseXY(opts.at) } : {}) }))));

  groups.command("layout <group>").description("Save label bands, padding and grid gutters; optionally tidy members")
    .option("--title-height <n>", "title band height")
    .option("--brief-height <n>", "Markdown brief band height")
    .option("--inset <n>", "content padding")
    .option("--row-gutter <n>", "reserved row-label gutter")
    .option("--column-gutter <n>", "reserved column-label gutter")
    .option("--tidy", "arrange direct member placement units")
    .option("--dry-run", "report layout effects without writing")
    .action(act(async (handle, ctx, [ref, opts]) => {
      const layout: GroupLayout = {};
      for (const key of ["titleHeight", "briefHeight", "inset", "rowGutter", "columnGutter"] as const) if (opts[key] !== undefined) layout[key] = Number(opts[key]);
      if (!Object.keys(layout).length && !opts.tidy) throw new Error("choose a layout setting or --tidy");
      report(ctx, await handle.layout(ref, layout, opts));
    }));

  groups.command("grid <group> <RxC>").description("Set the grid's counts and optional comma-separated row and column names")
    .option("--rows <names>", "comma-separated row labels")
    .option("--cols <names>", "comma-separated column labels")
    .option("--tidy", "place direct members in the saved grid")
    .option("--dry-run", "report grid and frame effects without writing")
    .action(act(async (handle, ctx, [ref, dimensions, opts]) => {
      const parts = /^(\d+)x(\d+)$/i.exec(dimensions);
      if (!parts || Number(parts[1]) < 1 || Number(parts[2]) < 1) throw new Error("grid expects positive RxC, e.g. 2x3");
      report(ctx, await handle.grid(ref, { rows: Number(parts[1]), columns: Number(parts[2]) }, { dryRun: !!opts.dryRun, tidy: !!opts.tidy, ...(opts.rows !== undefined ? { rows: opts.rows.split(",").map((name: string) => name.trim()) } : {}), ...(opts.cols !== undefined ? { columns: opts.cols.split(",").map((name: string) => name.trim()) } : {}) }));
    }));
}
