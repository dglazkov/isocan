import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CanvasSnapshotResponse } from "@isocan/core";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import type { Ctx } from "@isocan/cli/modulehost";
import {
  TEXT_FILENAME,
  TEXT_MIME,
  TEXT_PROPERTIES,
  newItemId,
  newVersionId,
  textBox,
  textTitle,
  type Item,
} from "@isocan/core";
import {
  MAP_PARENT_PROP,
  MAP_PROP,
  mapChildren,
  mapOf,
  mapOutline,
  mapsOn,
  mindmap,
  newMapId,
  tidyMap,
} from "./core.ts";

/**
 * **Mind maps: a graph you can drag, from the terminal.**
 *
 * A node is a text item and an edge is a property naming the parent, so every
 * command here is `item.add` or `item.update` — nothing new reaches the wire,
 * and undo, replay and presence work on a map without being told maps exist.
 *
 * The layout is deliberately simple and deliberately here rather than in the
 * daemon's placement: an agent building thirty nodes from one sentence must
 * land something legible, and `nearestFreeSpot`'s ring search knows nothing
 * about which node is whose child. A child goes to the right of its parent and
 * stacks under its siblings, which is a tree somebody can read and then drag
 * into whatever shape they actually wanted.
 *
 * **A module's verbs** (`docs/projects/modules/design.md`): the family hangs
 * on the CLI's own program through the host it is handed, so `--json`, the
 * error shapes and the door are the CLI's. Remove this module from the list
 * and `map` is not in `--help`.
 */
const MAP_GAP_X = 60;
const MAP_GAP_Y = 24;

function mapNodeSpot(snapshot: CanvasSnapshotResponse, mapId: string, parent: Item): { x: number; y: number } {
  const siblings = mapChildren(snapshot.canvas, mapId, parent.id);
  const x = parent.x + parent.width + MAP_GAP_X;
  if (siblings.length === 0) return { x, y: parent.y };
  // Under the lowest sibling, not under the newest: they are ordered by
  // creation and a re-parented node could be anywhere in that list.
  const lowest = siblings.reduce((low, s) => (s.y + s.height > low.y + low.height ? s : low));
  return { x, y: lowest.y + lowest.height + MAP_GAP_Y };
}

/** The map a reference names — an id, or the map a node belongs to, or the
 *  only one there is. Ambiguity is refused rather than guessed. */
function resolveMap(snapshot: CanvasSnapshotResponse, ref?: string): string {
  const maps = mapsOn(snapshot.canvas);
  if (ref) {
    const byId = maps.find((m) => m.id === ref || m.id.startsWith(ref));
    if (byId) return byId.id;
    const byTitle = maps.filter((m) => m.title.toLowerCase().startsWith(ref.toLowerCase()));
    if (byTitle.length === 1) return byTitle[0]!.id;
    if (byTitle.length > 1) {
      throw new Error(`"${ref}" matches ${byTitle.length} maps: ${byTitle.map((m) => m.title).join(", ")}`);
    }
    // A node's id names the map it is in, which is how `map add --to <node>`
    // knows which map it is adding to without being told twice.
    const item = snapshot.canvas.items[ref];
    const viaItem = item ? mapOf(item) : null;
    if (viaItem) return viaItem;
    throw new Error(`no map called "${ref}"`);
  }
  if (maps.length === 1) return maps[0]!.id;
  if (maps.length === 0) throw new Error("no maps on this canvas — `isocan map new <title>` starts one");
  throw new Error(`which map? ${maps.map((m) => m.title).join(", ")} — name one, or use its id`);
}

async function addMapNode(
  host: CliHost,
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  words: string,
  mapId: string,
  parent: Item | null,
): Promise<{ itemId: string; x: number; y: number }> {
  const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(words, "utf8"), TEXT_MIME, TEXT_FILENAME);
  const { width, height } = host.sizeFor(undefined, textBox(words, "body"));
  const itemId = newItemId();
  const at = parent ? mapNodeSpot(snapshot, mapId, parent) : { x: 0, y: 0 };
  await host.sendOp(ctx, canvasId, {
    type: "item.add",
    itemId,
    version: {
      id: newVersionId(),
      blobHash: upload.blobHash,
      mimeType: TEXT_MIME,
      filename: TEXT_FILENAME,
      size: upload.size,
    },
    width,
    height,
    placement: at,
    title: textTitle(words),
    properties: {
      ...TEXT_PROPERTIES,
      [MAP_PROP]: mapId,
      ...(parent ? { [MAP_PARENT_PROP]: parent.id } : {}),
    },
  });
  return { itemId, ...at };
}

function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson, sizeFor, placementFor, truncate } = host;
  const map = host.program.command("map").description("Mind maps: nodes you can drag, links that follow");

  map
    .command("new <words...>")
    .description("Start a map with a root node")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "place the root at world coordinates")
    .action(
      run(async (words: string[], opts: { at?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const title = words.join(" ");
        const mapId = newMapId();
        const upload = await ctx.client.uploadBlob(p.id, Buffer.from(title, "utf8"), TEXT_MIME, TEXT_FILENAME);
        const { width, height } = sizeFor(undefined, textBox(title, "body"));
        const itemId = newItemId();
        await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType: TEXT_MIME,
            filename: TEXT_FILENAME,
            size: upload.size,
          },
          width,
          height,
          placement: placementFor(snapshot, opts) as never,
          title: textTitle(title),
          properties: { ...TEXT_PROPERTIES, [MAP_PROP]: mapId },
        });
        if (ctx.json) return printJson({ mapId, rootId: itemId, title: textTitle(title) });
        console.log(`started ${mapId} with root ${itemId} ("${textTitle(title)}")`);
      }),
    );

  map
    .command("add <words...>")
    .description("Add a node under another one")
    .requiredOption("--to <node>", "the parent node")
    .option("--canvas <canvas>")
    .action(
      run(async (words: string[], opts: { to: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const parent = resolveItem(snapshot, opts.to);
        const mapId = mapOf(parent);
        if (mapId === null) {
          throw new Error(
            `"${parent.title}" is not part of a map — \`isocan map new\` starts one, or link it into an existing map`,
          );
        }
        const made = await addMapNode(host, ctx, p.id, snapshot, words.join(" "), mapId, parent);
        if (ctx.json) return printJson(made);
        console.log(`added ${made.itemId} under "${parent.title}" at ${made.x},${made.y}`);
      }),
    );

  map
    .command("link <node> <parent>")
    .description("Hang a node from a different parent — the line follows")
    .option("--canvas <canvas>")
    .action(
      run(async (nodeRef: string, parentRef: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const node = resolveItem(snapshot, nodeRef);
        const parent = resolveItem(snapshot, parentRef);
        if (node.id === parent.id) throw new Error("a node cannot hang from itself");
        const mapId = mapOf(parent);
        if (mapId === null) throw new Error(`"${parent.title}" is not part of a map`);
        // Both properties, because moving a node between maps is the same
        // gesture as re-parenting inside one and a half-moved node would be in
        // one map's set while drawing a line in another's.
        await sendOp(ctx, p.id, {
          type: "item.update",
          itemId: node.id,
          patch: { properties: { ...node.properties, [MAP_PROP]: mapId, [MAP_PARENT_PROP]: parent.id } },
        });
        if (ctx.json) return printJson({ itemId: node.id, parentId: parent.id, mapId });
        console.log(`"${node.title}" now hangs from "${parent.title}"`);
      }),
    );

  map
    .command("show [map]")
    .description("Print the map as a tree")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const mapId = resolveMap(snapshot, ref);
        const outline = mapOutline(snapshot.canvas, mapId);
        if (ctx.json) return printJson({ mapId, outline });
        console.log(outline);
      }),
    );

  map
    .command("tidy [map]")
    .description("Lay the map out as a tree — one column per depth, parents centred on their children")
    .option("--canvas <canvas>")
    .option("--dry-run", "say what would move, and move nothing")
    .action(
      run(async (ref: string | undefined, opts: { dryRun?: boolean }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const mapId = resolveMap(snapshot, ref);
        const moves = tidyMap(snapshot.canvas, mapId);
        if (ctx.json) return printJson({ mapId, moves });
        if (moves.length === 0) return console.log("already tidy — nothing moved");
        if (opts.dryRun) {
          for (const m of moves) {
            const node = snapshot.canvas.items[m.itemId];
            console.log(`  ${truncate(node?.title ?? m.itemId, 30).padEnd(30)} ${node?.x},${node?.y} → ${m.x},${m.y}`);
          }
          return console.log(`\n${moves.length} would move — run without --dry-run to do it`);
        }
        /**
         * **One op, so it is one undo.** The first thing anybody does after an
         * automatic layout is decide they preferred it before, and a tidy that
         * arrived as forty separate moves would need forty ⌘Zs to take back.
         */
        await sendOp(ctx, p.id, { type: "items.move", moves });
        console.log(`tidied ${moves.length} node${moves.length === 1 ? "" : "s"} — \`isocan undo\` puts them back`);
      }),
    );

  map
    .command("ls")
    .description("Every map on this canvas")
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const maps = mapsOn(snapshot.canvas);
        if (ctx.json) return printJson(maps);
        if (maps.length === 0) {
          console.log("no maps here — `isocan map new <title>` starts one");
          return;
        }
        for (const m of maps) {
          console.log(`${m.id}  ${m.title} (${m.nodes} node${m.nodes === 1 ? "" : "s"})`);
        }
      }),
    );
}

export const mindmapCli: CliModule = {
  core: mindmap,
  register,
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};
