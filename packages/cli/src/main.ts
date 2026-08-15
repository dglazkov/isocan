import { promises as fs } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import type { CanvasSnapshotResponse, Item, Operation, Project } from "@isocan/core";
import {
  newCommentId,
  newItemId,
  newProjectId,
  newThreadId,
  newVersionId,
} from "@isocan/core";
import { paths } from "@isocan/server";
import { type Ctx, makeCtx, metaPatch, readConfig, resolveProject, writeConfig } from "./ctx.ts";
import { readIdentity, writeIdentity } from "./identity.ts";
import { defaultSize, mimeFor } from "./mime.ts";
import {
  collectProp,
  formatProps,
  parseXY,
  printJson,
  printKeyValues,
  printTable,
  truncate,
} from "./output.ts";

const program = new Command();
program
  .name("isocan")
  .description("Isomorphic canvas — same ops as the web app, from your terminal")
  .version("0.1.0")
  .option("--json", "machine-readable JSON output")
  .option("--port <port>", "daemon port (default 4441)")
  .option("--project <ref>", "project id or title prefix (default: `isocan use` setting)");

/** Wrap actions: friendly errors, non-zero exit. */
function run(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  };
}

function ctxOf(cmd: Command): Promise<Ctx> {
  return makeCtx(cmd);
}

async function sendOp(ctx: Ctx, projectId: string | null, op: Operation) {
  return ctx.client.sendOp(projectId, ctx.actor, op);
}

/** Resolve an item by exact id, id prefix, or title prefix. */
function resolveItem(snapshot: CanvasSnapshotResponse, ref: string): Item {
  const items = Object.values(snapshot.canvas.items);
  const exact = items.find((i) => i.id === ref);
  if (exact) return exact;
  const matches = items.filter(
    (i) => i.id.startsWith(ref) || i.title.toLowerCase().startsWith(ref.toLowerCase()),
  );
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(
      `ambiguous item "${ref}": ${matches.map((i) => `${i.id} (${truncate(i.title, 20)})`).join(", ")}`,
    );
  }
  throw new Error(`no item matches "${ref}"`);
}

/** Resolve a trashed item by exact id, id prefix, or title prefix. */
function resolveTrashed(snapshot: CanvasSnapshotResponse, ref: string) {
  const entry =
    snapshot.canvas.trash.find((t) => t.item.id === ref) ??
    snapshot.canvas.trash.find(
      (t) =>
        t.item.id.startsWith(ref) || t.item.title.toLowerCase().startsWith(ref.toLowerCase()),
    );
  if (!entry) throw new Error(`no trashed item matches "${ref}"`);
  return entry;
}

async function projectAndSnapshot(ctx: Ctx): Promise<{ project: Project; snapshot: CanvasSnapshotResponse }> {
  const project = await resolveProject(ctx);
  const snapshot = await ctx.client.snapshot(project.id);
  return { project, snapshot };
}

// ---------- identity & daemon lifecycle ----------

program
  .command("identity")
  .description("Set (or show) your identity")
  .option("--name <name>", "display name")
  .action(
    run(async (opts: { name?: string }) => {
      const home = paths.isocanHome();
      if (opts.name) {
        const actor = await writeIdentity(home, opts.name);
        console.log(`identity saved: ${actor.name} (${actor.id})`);
      } else {
        const actor = await readIdentity(home);
        if (!actor) throw new Error("no identity configured — use --name");
        printKeyValues({ id: actor.id, name: actor.name });
      }
    }),
  );

program
  .command("whoami")
  .description("Show your identity")
  .action(
    run(async () => {
      const actor = await readIdentity(paths.isocanHome());
      if (!actor) throw new Error('no identity configured — run `isocan identity --name "You"`');
      console.log(`${actor.name} (${actor.id})`);
    }),
  );

program
  .command("serve")
  .description("Run the daemon")
  .option("--foreground", "run in the foreground (default: detach)")
  .action(
    run(async (opts: { foreground?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as { port?: string };
      if (opts.foreground) {
        const { runDaemon } = await import("@isocan/server");
        const port = globals.port ?? process.env.ISOCAN_PORT;
        await runDaemon(port ? { port: Number(port) } : {});
        return new Promise<void>(() => {}); // runs until signaled
      }
      const { DaemonClient } = await import("./client.ts");
      const home = paths.isocanHome();
      const port = globals.port ?? String(process.env.ISOCAN_PORT ?? 4441);
      const client = new DaemonClient(`http://127.0.0.1:${port}`, home);
      if (await client.health()) {
        console.log(`daemon already running on ${client.base}`);
        return;
      }
      await client.ensureDaemon();
      console.log(`daemon started on ${client.base}`);
    }),
  );

program
  .command("status")
  .description("Show daemon status")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as { port?: string; json?: boolean };
      const port = globals.port ?? String(process.env.ISOCAN_PORT ?? 4441);
      const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
        signal: AbortSignal.timeout(500),
      }).catch(() => null);
      if (!res?.ok) {
        console.log(`daemon: not running (port ${port})`);
        return;
      }
      const health = (await res.json()) as { pid: number; startedAt: string; version: string };
      if (globals.json) return printJson(health);
      printKeyValues({
        daemon: `running on http://127.0.0.1:${port}`,
        pid: String(health.pid),
        since: health.startedAt,
        version: health.version,
      });
    }),
  );

program
  .command("stop")
  .description("Stop the daemon")
  .action(
    run(async () => {
      const home = paths.isocanHome();
      try {
        const daemon = JSON.parse(await fs.readFile(paths.daemonFile(home), "utf8")) as {
          pid: number;
        };
        process.kill(daemon.pid, "SIGTERM");
        console.log(`sent SIGTERM to daemon (pid ${daemon.pid})`);
      } catch {
        console.log("daemon not running");
      }
    }),
  );

program
  .command("open")
  .description("Open the project in your browser")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const project = await resolveProject(ctx);
      const url = `${ctx.client.base}/p/${project.id}`;
      spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
        stdio: "ignore",
        detached: true,
      }).unref();
      console.log(url);
    }),
  );

// ---------- projects ----------

const project = program.command("project").description("Manage projects (canvases)");

project
  .command("create <title>")
  .description("Create a project")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .action(
    run(async (title: string, opts: { description?: string; prop: Record<string, string> }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const projectId = newProjectId();
      await sendOp(ctx, null, {
        type: "project.create",
        projectId,
        title,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        ...(Object.keys(opts.prop).length > 0 ? { properties: opts.prop } : {}),
      });
      if (ctx.json) return printJson({ projectId });
      console.log(`created project ${projectId} — "${title}"`);
      const config = await readConfig(ctx.home);
      if (!config.defaultProjectId) {
        await writeConfig(ctx.home, { ...config, defaultProjectId: projectId });
        console.log(`(set as default project)`);
      }
    }),
  );

project
  .command("list")
  .description("List projects")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const projects = await ctx.client.listProjects();
      if (ctx.json) return printJson(projects);
      const config = await readConfig(ctx.home);
      printTable(
        projects.map((p) => ({
          id: p.id + (p.id === config.defaultProjectId ? " *" : ""),
          title: truncate(p.title, 30),
          description: truncate(p.description, 40),
          updated: p.updatedAt,
          by: p.updatedBy.name,
        })),
      );
    }),
  );

project
  .command("show [ref]")
  .description("Show project details")
  .action(
    run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (ref !== undefined) ctx.projectRef = ref;
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      if (ctx.json) return printJson({ ...p, itemCount: Object.keys(snapshot.canvas.items).length });
      printKeyValues({
        id: p.id,
        title: p.title,
        description: p.description || "(none)",
        properties: formatProps(p.properties) || "(none)",
        items: String(Object.keys(snapshot.canvas.items).length),
        threads: String(Object.keys(snapshot.canvas.threads).length),
        trash: String(snapshot.canvas.trash.length),
        created: `${p.createdAt} by ${p.createdBy.name}`,
        updated: `${p.updatedAt} by ${p.updatedBy.name}`,
      });
    }),
  );

project
  .command("edit [ref]")
  .description("Edit project details")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .option("--rm-prop <key>", "remove a property (repeatable)", (v: string, prev: string[]) => [...prev, v], [])
  .action(
    run(
      async (
        ref: string | undefined,
        opts: { title?: string; description?: string; prop: Record<string, string>; rmProp: string[] },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        if (ref !== undefined) ctx.projectRef = ref;
        const p = await resolveProject(ctx);
        const patch = metaPatch(opts);
        if (Object.keys(patch).length === 0) throw new Error("nothing to change");
        await sendOp(ctx, p.id, { type: "project.update", patch });
        console.log(`updated project ${p.id}`);
      },
    ),
  );

project
  .command("delete [ref]")
  .description("Delete a project (requires --force; not undoable)")
  .option("--force", "confirm deletion")
  .action(
    run(async (ref: string | undefined, opts: { force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      if (ref !== undefined) ctx.projectRef = ref;
      const p = await resolveProject(ctx);
      if (!opts.force) {
        throw new Error(`deleting "${p.title}" is not undoable — re-run with --force`);
      }
      await sendOp(ctx, p.id, { type: "project.delete" });
      const config = await readConfig(ctx.home);
      if (config.defaultProjectId === p.id) {
        await writeConfig(ctx.home, {});
      }
      console.log(`deleted project ${p.id} (recoverable by hand in deleted-projects/)`);
    }),
  );

program
  .command("use <ref>")
  .description("Set the default project")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      ctx.projectRef = ref;
      const p = await resolveProject(ctx);
      await writeConfig(ctx.home, { ...(await readConfig(ctx.home)), defaultProjectId: p.id });
      console.log(`default project: ${p.id} — "${p.title}"`);
    }),
  );

// ---------- items ----------

program
  .command("add <file>")
  .description("Add a file to the canvas as a new item")
  .option("--at <x,y>", "place at world coordinates")
  .option("--anchor <item>", "place to the left of this item")
  .option("--size <WxH>", "display size, e.g. 480x360")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .action(
    run(
      async (
        file: string,
        opts: {
          at?: string;
          anchor?: string;
          size?: string;
          title?: string;
          description?: string;
          prop: Record<string, string>;
        },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { project: p, snapshot } = await projectAndSnapshot(ctx);
        const data = await fs.readFile(file);
        const filename = path.basename(file);
        const mimeType = mimeFor(filename);
        const upload = await ctx.client.uploadBlob(p.id, data, mimeType, filename);

        let { width, height } = defaultSize(mimeType);
        if (opts.size) {
          const match = opts.size.match(/^(\d+)x(\d+)$/);
          if (!match) throw new Error(`--size expects WxH, got: ${opts.size}`);
          width = Number(match[1]);
          height = Number(match[2]);
        }

        const items = Object.values(snapshot.canvas.items);
        const leftmost = items.reduce<Item | null>(
          (best, item) => (best === null || item.x < best.x ? item : best),
          null,
        );
        const placement = opts.at
          ? parseXY(opts.at)
          : opts.anchor
            ? { anchorItemId: resolveItem(snapshot, opts.anchor).id }
            : leftmost
              ? { anchorItemId: leftmost.id }
              : { x: 0, y: 0 };

        const itemId = newItemId();
        const result = await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: {
            id: newVersionId(),
            blobHash: upload.blobHash,
            mimeType,
            filename,
            size: upload.size,
          },
          width,
          height,
          placement,
          ...(opts.title !== undefined ? { title: opts.title } : {}),
          ...(opts.description !== undefined ? { description: opts.description } : {}),
          ...(Object.keys(opts.prop).length > 0 ? { properties: opts.prop } : {}),
        });
        const placed = (result.envelope.op as { placement: { x: number; y: number } }).placement;
        if (ctx.json) return printJson({ itemId, placement: placed });
        console.log(`added ${itemId} (${filename}) at ${placed.x},${placed.y}`);
      },
    ),
  );

program
  .command("ls")
  .description("List items on the canvas")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await projectAndSnapshot(ctx);
      const items = Object.values(snapshot.canvas.items);
      if (ctx.json) return printJson(items);
      printTable(
        items.map((i) => ({
          id: i.id,
          title: truncate(i.title, 24),
          mime: i.versions.find((v) => v.id === i.currentVersionId)?.mimeType ?? "?",
          pos: `${i.x},${i.y}`,
          size: `${i.width}x${i.height}`,
          vers: String(i.versions.length),
          "updated by": i.updatedBy.name,
        })),
      );
    }),
  );

program
  .command("show <item>")
  .description("Show item details")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      if (ctx.json) return printJson(item);
      const current = item.versions.find((v) => v.id === item.currentVersionId);
      printKeyValues({
        id: item.id,
        title: item.title,
        description: item.description || "(none)",
        filename: current?.filename ?? "?",
        mime: current?.mimeType ?? "?",
        position: `${item.x},${item.y}`,
        size: `${item.width}x${item.height}`,
        properties: formatProps(item.properties) || "(none)",
        versions: `${item.versions.length} (current: ${item.currentVersionId})`,
        created: `${item.createdAt} by ${item.createdBy.name}`,
        updated: `${item.updatedAt} by ${item.updatedBy.name}`,
      });
    }),
  );

program
  .command("mv <item> <x> <y>")
  .description("Move an item")
  .allowUnknownOption() // lets negative coordinates through: isocan mv itm -80 420
  .action(
    run(async (ref: string, x: string, y: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      await sendOp(ctx, p.id, { type: "item.move", itemId: item.id, x: Number(x), y: Number(y) });
      console.log(`moved ${item.id} to ${x},${y}`);
    }),
  );

program
  .command("set <item>")
  .description("Update item metadata")
  .option("--title <title>")
  .option("-d, --description <text>")
  .option("--prop <k=v>", "set a property (repeatable)", collectProp, {})
  .option("--rm-prop <key>", "remove a property (repeatable)", (v: string, prev: string[]) => [...prev, v], [])
  .option("--size <WxH>", "resize, e.g. 480x360")
  .action(
    run(
      async (
        ref: string,
        opts: { title?: string; description?: string; prop: Record<string, string>; rmProp: string[]; size?: string },
        cmd: Command,
      ) => {
        const ctx = await ctxOf(cmd);
        const { project: p, snapshot } = await projectAndSnapshot(ctx);
        const item = resolveItem(snapshot, ref);
        const patch = metaPatch(opts);
        let did = false;
        if (Object.keys(patch).length > 0) {
          await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch });
          did = true;
        }
        if (opts.size) {
          const match = opts.size.match(/^(\d+)x(\d+)$/);
          if (!match) throw new Error(`--size expects WxH, got: ${opts.size}`);
          await sendOp(ctx, p.id, {
            type: "item.resize",
            itemId: item.id,
            width: Number(match[1]),
            height: Number(match[2]),
          });
          did = true;
        }
        if (!did) throw new Error("nothing to change");
        console.log(`updated ${item.id}`);
      },
    ),
  );

program
  .command("edit <item> [file]")
  .description("Create a new version — from a file, or in $EDITOR")
  .action(
    run(async (ref: string, file: string | undefined, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      const current = item.versions.find((v) => v.id === item.currentVersionId)!;

      let data: Buffer;
      let filename: string;
      let mimeType: string;
      if (file) {
        data = await fs.readFile(file);
        filename = path.basename(file);
        mimeType = mimeFor(filename);
      } else {
        const editor = process.env.EDITOR ?? process.env.VISUAL;
        if (!editor) throw new Error("no $EDITOR set — pass a file instead");
        const original = await ctx.client.downloadBlob(p.id, current.blobHash);
        const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "isocan-edit-")), current.filename);
        await fs.writeFile(tmp, original);
        const status = spawnSync(editor, [tmp], { stdio: "inherit", shell: false });
        if (status.status !== 0) throw new Error(`${editor} exited with ${status.status}`);
        data = await fs.readFile(tmp);
        if (data.equals(original)) {
          console.log("no changes — no new version created");
          return;
        }
        filename = current.filename;
        mimeType = current.mimeType;
      }

      const upload = await ctx.client.uploadBlob(p.id, data, mimeType, filename);
      const versionId = newVersionId();
      await sendOp(ctx, p.id, {
        type: "item.addVersion",
        itemId: item.id,
        version: { id: versionId, blobHash: upload.blobHash, mimeType, filename, size: upload.size },
      });
      console.log(`new version ${versionId} of ${item.id} (${item.versions.length + 1} total)`);
    }),
  );

program
  .command("versions <item>")
  .description("List an item's version stack")
  .action(
    run(async (ref: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      if (ctx.json) return printJson(item.versions);
      printTable(
        item.versions.map((v, index) => ({
          "": v.id === item.currentVersionId ? "▶" : "",
          id: v.id,
          n: String(index + 1),
          filename: v.filename,
          size: String(v.size),
          created: `${v.createdAt} by ${v.createdBy.name}`,
        })),
      );
    }),
  );

const version = program.command("version").description("Version operations");
version
  .command("promote <item> <versionId>")
  .description("Bring a version to the top of the stack")
  .action(
    run(async (ref: string, versionId: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const item = resolveItem(snapshot, ref);
      const match =
        item.versions.find((v) => v.id === versionId) ??
        item.versions.find((v) => v.id.startsWith(versionId));
      if (!match) throw new Error(`no version matches "${versionId}"`);
      await sendOp(ctx, p.id, {
        type: "item.setCurrentVersion",
        itemId: item.id,
        versionId: match.id,
      });
      console.log(`current version of ${item.id}: ${match.id}`);
    }),
  );

program
  .command("rm <items...>")
  .description("Delete item(s) to the trash — several at once is one undo step")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveItem(snapshot, ref).id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.delete", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.delete", itemIds: ids });
      }
      console.log(`moved ${ids.join(", ")} to trash (isocan restore ${ids.join(" ")})`);
    }),
  );

program
  .command("restore <items...>")
  .description("Restore item(s) from the trash")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveTrashed(snapshot, ref).item.id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.restore", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.restore", itemIds: ids });
      }
      console.log(`restored ${ids.join(", ")}`);
    }),
  );

// ---------- comments ----------

const comment = program.command("comment").description("Comment threads on the canvas");

comment
  .command("add <text>")
  .description("Start a thread — anchored to an item or freestanding at --at")
  .option("--item <item>", "anchor to this item")
  .option("--at <x,y>", "freestanding at world coordinates")
  .action(
    run(async (text: string, opts: { item?: string; at?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      if (!opts.item && !opts.at) throw new Error("pass --item <item> or --at <x,y>");
      let x: number, y: number, anchorItemId: string | null;
      if (opts.item) {
        const item = resolveItem(snapshot, opts.item);
        anchorItemId = item.id;
        // Anchored pins store an offset from the item origin: just off the
        // item's top-right corner.
        x = item.width + 12;
        y = 0;
      } else {
        ({ x, y } = parseXY(opts.at!));
        anchorItemId = null;
      }
      const threadId = newThreadId();
      await sendOp(ctx, p.id, {
        type: "thread.create",
        threadId,
        x,
        y,
        anchorItemId,
        comment: { id: newCommentId(), body: text },
      });
      console.log(`started thread ${threadId}`);
    }),
  );

comment
  .command("reply <thread> <text>")
  .description("Reply to a thread")
  .action(
    run(async (threadRef: string, text: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const threads = Object.values(snapshot.canvas.threads);
      const thread =
        threads.find((t) => t.id === threadRef) ?? threads.find((t) => t.id.startsWith(threadRef));
      if (!thread) throw new Error(`no thread matches "${threadRef}"`);
      await sendOp(ctx, p.id, {
        type: "thread.reply",
        threadId: thread.id,
        comment: { id: newCommentId(), body: text },
      });
      console.log(`replied to ${thread.id}`);
    }),
  );

comment
  .command("list")
  .description("List comment threads")
  .option("--item <item>", "only threads anchored to this item")
  .action(
    run(async (opts: { item?: string }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await projectAndSnapshot(ctx);
      let threads = Object.values(snapshot.canvas.threads);
      if (opts.item) {
        const item = resolveItem(snapshot, opts.item);
        threads = threads.filter((t) => t.anchorItemId === item.id);
      }
      if (ctx.json) return printJson(threads);
      if (threads.length === 0) return printTable([]);
      for (const t of threads) {
        const anchor = t.anchorItemId ? `on ${t.anchorItemId}` : `at ${t.x},${t.y}`;
        console.log(`${t.id} (${anchor})`);
        for (const c of t.comments) {
          console.log(`  ${c.author.name} · ${c.createdAt}`);
          console.log(`    ${c.body}`);
        }
      }
    }),
  );

comment
  .command("rm <thread>")
  .description("Delete a thread")
  .action(
    run(async (threadRef: string, _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const threads = Object.values(snapshot.canvas.threads);
      const thread =
        threads.find((t) => t.id === threadRef) ?? threads.find((t) => t.id.startsWith(threadRef));
      if (!thread) throw new Error(`no thread matches "${threadRef}"`);
      await sendOp(ctx, p.id, { type: "thread.delete", threadId: thread.id });
      console.log(`deleted thread ${thread.id}`);
    }),
  );

// ---------- undo/redo & trash ----------

program
  .command("undo")
  .description("Undo the last operation on the project")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const entry = await ctx.client.undo(p.id, ctx.actor);
      console.log(`undid: applied ${entry.envelope.op.type}`);
    }),
  );

program
  .command("redo")
  .description("Redo the last undone operation")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveProject(ctx);
      const entry = await ctx.client.redo(p.id, ctx.actor);
      console.log(`redid: applied ${entry.envelope.op.type}`);
    }),
  );

const trash = program.command("trash").description("The project's trash bin");

trash
  .command("list")
  .description("List trashed items")
  .action(
    run(async (_opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { snapshot } = await projectAndSnapshot(ctx);
      if (ctx.json) return printJson(snapshot.canvas.trash);
      printTable(
        snapshot.canvas.trash.map((t) => ({
          id: t.item.id,
          title: truncate(t.item.title, 30),
          deleted: `${t.deletedAt} by ${t.deletedBy.name}`,
        })),
      );
    }),
  );

trash
  .command("restore <items...>")
  .description("Restore trashed item(s)")
  .action(
    run(async (refs: string[], _opts: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      const ids = [...new Set(refs.map((ref) => resolveTrashed(snapshot, ref).item.id))];
      if (ids.length === 1) {
        await sendOp(ctx, p.id, { type: "item.restore", itemId: ids[0]! });
      } else {
        await sendOp(ctx, p.id, { type: "items.restore", itemIds: ids });
      }
      console.log(`restored ${ids.join(", ")}`);
    }),
  );

trash
  .command("empty")
  .description("Empty the trash (requires --force; not undoable)")
  .option("--force", "confirm")
  .action(
    run(async (opts: { force?: boolean }, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const { project: p, snapshot } = await projectAndSnapshot(ctx);
      if (!opts.force) {
        throw new Error(
          `emptying the trash (${snapshot.canvas.trash.length} items) is not undoable — re-run with --force`,
        );
      }
      await sendOp(ctx, p.id, { type: "trash.empty" });
      console.log("trash emptied");
    }),
  );

program.parseAsync().catch((err: unknown) => {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
});
