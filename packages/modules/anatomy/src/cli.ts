import { recoverFile } from "./recovery.ts";
import { dispatchRun, listRuns, readRun, retryRun, updateRun } from "./runs.ts";
import { inspectProject } from "./diagnostics.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { newId } from "@isocan/core";
import {
  anatomyModule,
  convergence,
  currentVersion,
  decisions,
  DISCIPLINES,
  projectsOn,
  nodesOn,
  originId,
  nodeSchema,
  readProject,
  projectNeighborhood,
  PROP,
} from "./core.ts";
import {
  attachSource,
  emptyProject,
  importProject,
  layoutProject,
  loadProject,
  findProject,
  requestAnalysis,
  promoteMock,
  restoreCheckpoint,
  saveCheckpoint,
  saveEdge,
  saveNode,
  saveProject,
  type AnatomyIO,
} from "./operations.ts";

function runReceipt(receipt: Awaited<ReturnType<typeof readRun>>) {
  return { requestId: receipt.id, ...receipt.run, threadId: receipt.threadId, dispatched: receipt.dispatched, createdAt: receipt.item.createdAt, updatedAt: currentVersion(receipt.item).createdAt };
}
function register(host: CliHost): void {
  const family = host.program
    .command("anatomy")
    .description(
      "Explore project concepts, decisions, evidence and checkpoints on this canvas",
    );
  async function context(cmd: Command) {
    const ctx = await host.ctxOf(cmd);
    const canvas = await host.resolveCanvas(ctx);
    const io: AnatomyIO = {
      read: async (hash) =>
        (await ctx.client.downloadBlob(canvas.id, hash)).toString("utf8"),
      put: (text, mime, filename) =>
        ctx.client.uploadBlob(canvas.id, Buffer.from(text), mime, filename),
      send: async (ops, group) => {
        for (const op of ops) await host.sendOp(ctx, canvas.id, op, group);
      },
      snapshot: async () => (await ctx.client.snapshot(canvas.id)).canvas,
      record: async () => (await ctx.client.snapshot(canvas.id)).project,
    };
    return { ctx, io };
  }
  const command = (name: string, description: string) =>
    family.command(name).description(description).option("--canvas <canvas>");
  command(
    "repository <path-or-url>",
    "Associate a repository with this canvas for Anatomy analysis",
  ).action(
    host.run(async (repository: string, _opts: unknown, cmd: Command) => {
      const { io } = await context(cmd);
      if (!repository.trim())
        throw new Error("Provide a repository path or URL");
      await io.send([
        {
          type: "project.update",
          patch: { properties: { [PROP.repository]: repository.trim() } },
        },
      ]);
    }),
  );
  command(
    "attach <project>",
    "Make an Anatomy analysis this canvas's View Anatomy destination",
  ).action(
    host.run(async (ref: string, _opts: unknown, cmd: Command) => {
      const { io } = await context(cmd);
      const { item } = await findProject(io, ref);
      await io.send([
        {
          type: "project.update",
          patch: { properties: { [PROP.analysis]: item.id } },
        },
      ]);
    }),
  );
  command("analyze [repository]", "Record a targeted analysis request and ask an agent in Chat")
    .option("--analysis <id>", "Update this analysis explicitly")
    .option("--new", "Request a new analysis without replacing the attached analysis")
    .option("--record-only", "Record work already requested directly in Chat, without posting another message")
    .action(host.run(async (repository: string | undefined, opts: { analysis?: string; new?: boolean; recordOnly?: boolean }, cmd: Command) => {
      const { io, ctx } = await context(cmd);
      const receipt = await requestAnalysis(io, { ...(repository !== undefined ? { repository } : {}), ...(opts.analysis ? { analysis: opts.analysis } : {}), ...(opts.new ? { create: true } : {}) }, undefined, !opts.recordOnly);
      if (ctx.json) host.printJson(runReceipt(receipt));
      else console.log(`Request ${receipt.id}: ${receipt.run.status}; ${receipt.run.repository} → ${receipt.run.analysisTitle}. ${receipt.dispatched ? "Posted in Chat; awaiting an agent claim does not guarantee a worker is available." : "Recorded without Chat dispatch."}`);
    }));
  command("runs", "List durable analysis requests, dispatch evidence and reported outcomes").action(host.run(async (_opts: unknown, cmd: Command) => {
    const { io } = await context(cmd);
    host.printJson((await listRuns(io)).map(r => r.run ? runReceipt({ ...r, run: r.run }) : { requestId: r.id, error: r.error }));
  }));
  command("run <request>", "Inspect, claim, finish, cancel, retry or resume an analysis request")
    .option("--start", "Claim this request as the current actor before working")
    .option("--complete <analysis>", "Report the resulting analysis item")
    .option("--revision <revision>", "Repository revision actually reviewed")
    .option("--message <text>", "Completion findings or limitations")
    .option("--fail <reason>", "Report failure with a reason")
    .option("--cancel-request", "Ask the worker to stop; does not undo its work")
    .option("--cancelled", "Acknowledge cancellation after stopping")
    .option("--retry", "Create a linked retry of a failed or cancelled request")
    .option("--dispatch", "Resume Chat delivery of this existing request")
    .action(host.run(async (id: string, opts: { start?: boolean; complete?: string; revision?: string; message?: string; fail?: string; cancelRequest?: boolean; cancelled?: boolean; retry?: boolean; dispatch?: boolean }, cmd: Command) => {
      const { io, ctx } = await context(cmd);
      const actions = [opts.start, opts.complete, opts.fail, opts.cancelRequest, opts.cancelled, opts.retry, opts.dispatch].filter(v => v !== undefined && v !== false);
      if (actions.length > 1) throw new Error("Choose one request action at a time.");
      const receipt = opts.retry ? await retryRun(io, id) : opts.dispatch ? await dispatchRun(io, id) : opts.cancelRequest ? await updateRun(io, id, { type: "cancel-request" }) : opts.start ? await updateRun(io, id, { type: "start" }, ctx.actor) : opts.cancelled ? await updateRun(io, id, { type: "cancelled" }, ctx.actor) : opts.fail !== undefined ? await updateRun(io, id, { type: "fail", message: opts.fail }, ctx.actor) : opts.complete ? await updateRun(io, id, { type: "complete", resultId: opts.complete, revision: opts.revision ?? "", ...(opts.message ? { message: opts.message } : {}) }, ctx.actor) : await readRun(io, id);
      host.printJson(runReceipt(receipt));
    }));
  command(
    "new <title>",
    "Create an empty Anatomy project on this canvas",
  ).action(
    host.run(async (title: string, _opts: unknown, cmd: Command) => {
      const { io, ctx } = await context(cmd);
      const itemId = await importProject(io, emptyProject(title));
      if (ctx.json) host.printJson({ itemId });
      else console.log(itemId);
    }),
  );
  command(
    "import <file>",
    "Import a prototype .anatomy.json as native canvas items; never replace an existing project",
  ).action(
    host.run(async (file: string, _opts: unknown, cmd: Command) => {
      const { io, ctx } = await context(cmd);
      const itemId = await importProject(
        io,
        JSON.parse(readFileSync(file, "utf8")),
      );
      if (ctx.json) host.printJson({ itemId });
      else console.log(itemId);
    }),
  );
  command("ls", "List the Anatomy projects on this canvas").action(
    host.run(async (_opts: unknown, cmd: Command) => {
      const { io, ctx } = await context(cmd);
      const canvas = await io.snapshot();
      const rows = projectsOn(canvas).map((p) => ({
        id: p.id,
        title: p.title,
        concepts: nodesOn(canvas, p.id).length,
      }));
      if (ctx.json) host.printJson(rows);
      else
        for (const row of rows)
          console.log(`${row.id}  ${row.title}  ${row.concepts} concepts`);
    }),
  );
  command(
    "show <project>",
    "Read a project or a concept's immediate neighborhood",
  )
    .option(
      "--node <id>",
      "Focus a concept by its original ID, including parent, children and connections",
    )
    .action(
      host.run(async (ref: string, opts: { node?: string }, cmd: Command) => {
        const { io, ctx } = await context(cmd);
        const { canvas, item } = await findProject(io, ref);
        const report = await inspectProject(canvas, item, io.read);
        const project = report.project;
        if (!project) { host.printJson(report); return; }
        const view = opts.node
          ? projectNeighborhood(project, opts.node)
          : project;
        if (ctx.json) host.printJson(report.diagnostics.length ? { ...view, diagnostics: report.diagnostics, items: report.items } : view);
        else if (report.diagnostics.length) console.error(`${report.diagnostics.length} file problems; run anatomy validate ${ref} for repair details.`);
        if (!ctx.json) {
          console.log(
            `${project.projectName}: ${convergence(project.nodes)}% settled\n${project.goalStatement}`,
          );
          for (const n of view.nodes)
            console.log(`${n.id}  ${n.category}  ${n.status}  ${n.title}`);
        }
      }),
    );
  command("recover <project> <item> <version>", "Restore a validated historical file body as one guarded native edit").action(host.run(async (ref: string, itemId: string, versionId: string, _opts: unknown, cmd: Command) => {
    const { io } = await context(cmd);
    const { canvas, item: analysis } = await findProject(io, ref);
    const item = canvas.items[itemId];
    if (!item) throw new Error("Unknown file.");
    await recoverFile(io, analysis.id, item, versionId);
    host.printJson({ itemId, restoredFrom: versionId, versionId: (await io.snapshot()).items[itemId]!.currentVersionId });
  }));
  command("validate <project>", "Read item-scoped diagnostics and native IDs without modifying files").action(host.run(async (ref: string, _opts: unknown, cmd: Command) => {
    const { io } = await context(cmd);
    const { canvas, item } = await findProject(io, ref);
    const report = await inspectProject(canvas, item, io.read);
    host.printJson({ analysisId: item.id, valid: report.diagnostics.length === 0, ...report });
  }));
  command(
    "export <project> <file>",
    "Export portable Anatomy JSON, including source citations and checkpoints",
  ).action(
    host.run(
      async (ref: string, file: string, _opts: unknown, cmd: Command) => {
        const { io } = await context(cmd);
        const { canvas, item } = await loadProject(io, ref);
        writeFileSync(
          file,
          JSON.stringify(
            await readProject(canvas, item, io.read, true),
            null,
            2,
          ) + "\n",
        );
        console.log(file);
      },
    ),
  );
  command(
    "goal <project> <text>",
    "Change Goal & Intent; analysis remains work for an agent",
  ).action(
    host.run(
      async (ref: string, text: string, _opts: unknown, cmd: Command) => {
        const { io } = await context(cmd);
        const { item, project } = await loadProject(io, ref);
        await saveProject(io, item, { ...project, goalStatement: text });
      },
    ),
  );
  command(
    "brief <project> <file>",
    "Replace the narrative overview with a UTF-8 Markdown file",
  ).action(
    host.run(
      async (ref: string, file: string, _opts: unknown, cmd: Command) => {
        const { io } = await context(cmd);
        const { item, project } = await loadProject(io, ref);
        await saveProject(io, item, {
          ...project,
          brief: readFileSync(file, "utf8"),
        });
      },
    ),
  );
  command(
    "draft <project> <node>",
    "Read an editable concept with its version guard; save it with anatomy node",
  ).action(host.run(async (ref: string, nodeRef: string, _opts: unknown, cmd: Command) => {
    const { io } = await context(cmd);
    const { canvas, item, project } = await loadProject(io, ref);
    const native = nodesOn(canvas, item.id).find((i) => i.id === nodeRef || originId(i) === nodeRef);
    const node = project.nodes.find((n) => n.id === (native ? originId(native) : nodeRef));
    if (!native || !node) throw new Error(`Unknown concept: ${nodeRef}`);
    host.printJson({ node, base: { versionId: native.currentVersionId, title: native.title, properties: native.properties } });
  }));
  command(
    "node <project> <file>",
    "Create from concept JSON, or save a guarded anatomy draft",
  ).action(
    host.run(
      async (ref: string, file: string, _opts: unknown, cmd: Command) => {
        const { io, ctx } = await context(cmd);
        const { canvas, item, project } = await loadProject(io, ref);
        const input = JSON.parse(readFileSync(file, "utf8"));
        const node = nodeSchema.parse(input.node ?? input);
        const existing = project.nodes.some((n) => n.id === node.id);
        if (existing && (!input.base || typeof input.base.versionId !== "string" || typeof input.base.title !== "string" || !input.base.properties || typeof input.base.properties !== "object" || Array.isArray(input.base.properties)))
          throw new Error("Existing concepts require a guarded draft. Run anatomy draft <project> <node> and edit its node fields, preserving base.");
        const itemId = await saveNode(
            io,
            canvas,
            item,
            project,
            node,
            input.base,
          );
        if (ctx.json) host.printJson({ itemId });
        else console.log(itemId);
      },
    ),
  );
  command(
    "edge <project> <file>",
    "Upsert one directed edge from JSON, with original concept ids as endpoints",
  ).action(
    host.run(
      async (ref: string, file: string, _opts: unknown, cmd: Command) => {
        const { io } = await context(cmd);
        const { canvas, item, project } = await loadProject(io, ref);
        await saveEdge(
          io,
          canvas,
          item,
          project,
          JSON.parse(readFileSync(file, "utf8")),
        );
      },
    ),
  );
  command(
    "layout <project>",
    "Arrange concept cards by hierarchy, in one undoable operation",
  ).action(
    host.run(async (ref: string, _opts: unknown, cmd: Command) => {
      const { io } = await context(cmd);
      const { canvas, item } = await loadProject(io, ref);
      const moves = layoutProject(canvas, item.id);
      if (moves.length) await io.send([{ type: "items.move", moves }]);
    }),
  );
  command(
    "decisions <project>",
    "Read conflict, risk and missing concepts in concern order",
  ).action(
    host.run(async (ref: string, _opts: unknown, cmd: Command) => {
      const { io, ctx } = await context(cmd);
      const { project } = await loadProject(io, ref);
      const rows = decisions(project);
      if (ctx.json) host.printJson(rows);
      else
        for (const n of rows)
          console.log(
            `${n.id}  ${n.status}  ${n.title}\n  ${n.reason ?? n.knockOnReason ?? "No rationale recorded"}`,
          );
    }),
  );
  command(
    "coverage <project>",
    "Read discipline assessments and source evidence; null means not assessed",
  ).action(
    host.run(async (ref: string, _opts: unknown, cmd: Command) => {
      const { io } = await context(cmd);
      const { project } = await loadProject(io, ref);
      host.printJson(
        project.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          category: n.category,
          assessments: Object.fromEntries(
            DISCIPLINES.map((d) => [d, n.lenses?.[d] ?? null]),
          ),
          evidence: n.evidence,
        })),
      );
    }),
  );
  command(
    "source <project> <source-id> <file>",
    "Attach a cited UTF-8 source file to the canvas; never read paths implicitly",
  ).action(
    host.run(
      async (
        ref: string,
        sourceId: string,
        file: string,
        _opts: unknown,
        cmd: Command,
      ) => {
        const { io } = await context(cmd);
        const { canvas, item, project } = await loadProject(io, ref);
        console.log(
          await attachSource(
            io,
            canvas,
            item,
            project,
            sourceId,
            readFileSync(file, "utf8"),
            basename(file),
          ),
        );
      },
    ),
  );
  command(
    "propose <project> <node-id> <file>",
    "Attach an HTML mock proposal to a concept",
  )
    .option("--title <title>", "proposal title")
    .option("--constraints <text>", "semicolon-separated commitments")
    .action(
      host.run(
        async (
          ref: string,
          nodeId: string,
          file: string,
          opts: { title?: string; constraints?: string },
          cmd: Command,
        ) => {
          const { io } = await context(cmd);
          const { canvas, item, project } = await loadProject(io, ref);
          const node = project.nodes.find((n) => n.id === nodeId);
          if (!node) throw new Error(`No concept ${nodeId}`);
          await saveNode(io, canvas, item, project, {
            ...node,
            proposedMock: {
              title: opts.title ?? basename(file),
              htmlContent: readFileSync(file, "utf8"),
              proposedConstraints:
                opts.constraints
                  ?.split(";")
                  .map((s) => s.trim())
                  .filter(Boolean) ?? [],
              status: "draft",
              updatedAt: new Date().toISOString(),
            },
          });
        },
      ),
    );
  command(
    "promote <project> <node-id>",
    "Approve a draft mock, add its source item and settle the concept; one undo",
  ).action(
    host.run(
      async (ref: string, nodeId: string, _opts: unknown, cmd: Command) => {
        const { io } = await context(cmd);
        const { canvas, item, project } = await loadProject(io, ref);
        const node = project.nodes.find((n) => n.id === nodeId);
        if (!node) throw new Error(`No concept ${nodeId}`);
        await promoteMock(io, canvas, item, project, node);
      },
    ),
  );
  command(
    "checkpoint <project>",
    "List saved checkpoints, save one, inspect one, or explicitly restore concepts",
  )
    .option("--save <title>", "save current concepts and edges")
    .option("--show <id>", "print a checkpoint as JSON")
    .option(
      "--restore <id>",
      "restore its concepts and edges; preserve unrelated items",
    )
    .action(
      host.run(
        async (
          ref: string,
          opts: { save?: string; show?: string; restore?: string },
          cmd: Command,
        ) => {
          if ([opts.save, opts.show, opts.restore].filter(Boolean).length > 1)
            throw new Error("Choose one checkpoint action");
          const { io } = await context(cmd);
          const { canvas, item, project } = await loadProject(io, ref);
          if (opts.save) return saveCheckpoint(io, item, project, opts.save);
          const id = opts.show ?? opts.restore;
          if (id) {
            const checkpoint = project.checkpoints.find((c) => c.id === id);
            if (!checkpoint) throw new Error(`No checkpoint ${id}`);
            if (opts.restore)
              await restoreCheckpoint(io, canvas, item, checkpoint);
            else host.printJson(checkpoint);
          } else
            host.printJson(
              project.checkpoints.map(({ nodes, edges: _edges, ...c }) => ({
                ...c,
                concepts: nodes.length,
              })),
            );
        },
      ),
    );
  command(
    "sample <project>",
    "Print the JSON shape for a new concept without writing it",
  ).action(
    host.run(async (ref: string, _opts: unknown, cmd: Command) => {
      const { io } = await context(cmd);
      await loadProject(io, ref);
      host.printJson({
        id: newId("concept"),
        title: "New concept",
        category: "structure",
        status: "missing",
        summary: "What this concept is",
        reason: "Why it needs attention",
        conflictAxis: "goal",
        evidence: [],
        resolutionOptions: [],
        marginalia: [],
      });
    }),
  );
}

export const anatomyCli: CliModule = {
  core: anatomyModule,
  register,
  guide: readFileSync(
    fileURLToPath(new URL("../agent-guide.md", import.meta.url)),
    "utf8",
  ),
};
export default anatomyCli;
