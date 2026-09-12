import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import { newId } from "@isocan/core";
import {
  anatomyModule,
  convergence,
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
  requestAnalysis,
  promoteMock,
  restoreCheckpoint,
  saveCheckpoint,
  saveEdge,
  saveNode,
  saveProject,
  type AnatomyIO,
} from "./operations.ts";

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
      const { item } = await loadProject(io, ref);
      await io.send([
        {
          type: "project.update",
          patch: { properties: { [PROP.analysis]: item.id } },
        },
      ]);
    }),
  );
  command(
    "analyze [repository]",
    "Ask an agent in Chat to analyze the associated repository",
  ).action(
    host.run(
      async (repository: string | undefined, _opts: unknown, cmd: Command) => {
        const { io, ctx } = await context(cmd);
        const record = (
          await ctx.client.snapshot(
            await host.resolveCanvas(ctx).then((c) => c.id),
          )
        ).project;
        const linked = record.properties[PROP.analysis];
        const canvas = await io.snapshot();
        const analysis = projectsOn(canvas).find((p) => p.id === linked);
        await requestAnalysis(
          io,
          repository ??
            record.properties[PROP.repository] ??
            record.properties.repository ??
            "",
          analysis?.id,
        );
        console.log(
          "Analysis requested in Chat; an agent with repository access can pick it up.",
        );
      },
    ),
  );
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
        const { project } = await loadProject(io, ref);
        const view = opts.node
          ? projectNeighborhood(project, opts.node)
          : project;
        if (ctx.json) host.printJson(view);
        else {
          console.log(
            `${project.projectName}: ${convergence(project.nodes)}% settled\n${project.goalStatement}`,
          );
          for (const n of view.nodes)
            console.log(`${n.id}  ${n.category}  ${n.status}  ${n.title}`);
        }
      }),
    );
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
