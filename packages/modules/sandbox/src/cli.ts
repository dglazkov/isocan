import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { actorNameIn } from "@isocan/core";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import {
  SANDBOX_OF_PROP,
  SANDBOX_RUN_PROP,
  TRANSCRIPT_MIME,
  argvOf,
  formatMs,
  isSandboxItem,
  runOf,
  sandboxModule,
  sandboxesOn,
  statusLine,
  transcriptFilename,
  transcriptFor,
  transcriptOf,
} from "./core.ts";

/**
 * **Sandboxes, from the terminal.** The whole of the module's acting half is
 * here, because the acting happens where the typing happens: the web can
 * READ a program and its transcripts, and it cannot run one, which is not an
 * asymmetry to fix but the architecture's own line — isocan never runs
 * compute, and the browser shape of a sandbox is still behind the
 * extension-actors gate (`docs/projects/modules/phases.md`).
 *
 * Four verbs, no op, no kind. `set` and `clear` are `item.update` patches;
 * `run` is a fenced spawn through the host plus an ordinary `item.add` or
 * `item.addVersion` for what it printed.
 */

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson, truncate } = host;
  const family = host.program
    .command("sandbox")
    .description("Programs on the canvas: what they run, and running one here, fenced");

  family
    .command("ls", { isDefault: true })
    .description("Every program on this canvas, the argv it runs, and when it last ran")
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const rows = sandboxesOn(snapshot.canvas).map((item) => {
          const out = transcriptFor(snapshot.canvas, item.id);
          return {
            id: item.id,
            title: item.title,
            run: runOf(item)!,
            transcriptId: out?.id ?? null,
            runs: out?.versions.length ?? 0,
            lastRunAt: out?.updatedAt ?? null,
          };
        });
        if (ctx.json) return printJson(rows);
        if (rows.length === 0) {
          return console.log(
            "no programs here — `isocan add build.mjs` brings a file, `isocan sandbox set <item> --run \"node build.mjs\"` makes it one",
          );
        }
        for (const r of rows) {
          const ran = r.runs === 0 ? "never run" : `${r.runs} run${r.runs === 1 ? "" : "s"}`;
          console.log(`${r.id}  ${truncate(r.title, 24).padEnd(24)}  ${truncate(r.run, 34).padEnd(34)}  ${ran}`);
        }
      }),
    );

  family
    .command("set <item>")
    .description('Make an item a program: say the argv that runs it — `--run "node build.mjs"`')
    .requiredOption("--run <argv>", "the command line, as you would type it")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, opts: { run: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        const argv = argvOf(opts.run);
        if (argv.length === 0) throw new Error("--run needs a command, e.g. --run \"node build.mjs\"");
        await sendOp(ctx, p.id, {
          type: "item.update",
          itemId: item.id,
          patch: { properties: { [SANDBOX_RUN_PROP]: opts.run.trim() } },
        });
        if (ctx.json) return printJson({ itemId: item.id, run: opts.run.trim(), argv });
        console.log(`"${item.title}" runs \`${opts.run.trim()}\` — \`isocan sandbox run ${item.id}\``);
      }),
    );

  family
    .command("clear <item>")
    .description("Stop an item being a program — the file stays exactly as it is")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        if (!isSandboxItem(item)) throw new Error(`"${item.title}" is not a program`);
        await sendOp(ctx, p.id, {
          type: "item.update",
          itemId: item.id,
          patch: { removeProperties: [SANDBOX_RUN_PROP] },
        });
        if (ctx.json) return printJson({ itemId: item.id, run: null });
        console.log(`"${item.title}" is an ordinary file again — its transcripts are still here`);
      }),
    );

  family
    .command("run <item>")
    .description("Run it on THIS machine, fenced, and post what it printed as a version")
    .option("--canvas <canvas>")
    .option("--timeout <seconds>", "give up after this long", "60")
    .option("--yes", "run a program somebody else wrote")
    .action(
      run(async (ref: string, opts: { timeout?: string; yes?: boolean }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        const line = runOf(item);
        if (!line) {
          throw new Error(
            `"${item.title}" is not a program — \`isocan sandbox set ${item.id} --run "node ${item.title}"\` says how to run it`,
          );
        }
        const argv = argvOf(line);
        const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
        if (!current) throw new Error(`"${item.title}" has no version to run`);

        /**
         * **Whose program this is, said before it runs** — and a `--yes` when
         * the answer is *not you*.
         *
         * The canvas knows who wrote the version; running it is a person
         * choosing to execute somebody's code on their own machine, and that
         * choice cannot be informed if the line never says whose. Same
         * instinct as `isocan tool add` printing capabilities before `--yes`.
         *
         * **The ceremony sits at the trust boundary, not on every run.**
         * Asking `--yes` for a program you wrote yourself would be the kind of
         * confirmation that gets learned away in a week — and it is the
         * confirmation for somebody ELSE's code that then gets learned away
         * with it. So your own program runs on the verb alone, and anybody
         * else's refuses once, by name, until you say `--yes`. An agent
         * carrying out `/run` meets the same fence: it must choose the flag
         * deliberately, with the author in front of it.
         */
        const author = actorNameIn(snapshot.names, current.createdBy);
        const mine = current.createdBy.id === ctx.actor.id;
        const version = item.versions.indexOf(current) + 1;
        const wrote = `v${version}, ${mine ? "yours" : `written by ${author}`}, ${current.createdAt.slice(0, 10)}`;
        if (!mine && !opts.yes) {
          throw new Error(
            `"${item.title}" (${wrote}) runs \`${line}\` on THIS machine. ` +
              `${author} wrote it, not you — pass --yes to run somebody else's program. ` +
              `\`isocan show ${item.id}\` reads it first.`,
          );
        }
        console.error(`${item.title} — ${wrote} — \`${line}\``);

        // The scratch is the program's whole world: it is unpacked here, it
        // is the cwd, it is the one writable path in the policy, and it is
        // gone before the verb returns. Under the OS temp directory rather
        // than under ~/.isocan, because the isocan home holds the badge and
        // the policy denies it.
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-sandbox-"));
        try {
          const bytes = await ctx.client.downloadBlob(p.id, current.blobHash);
          const filename = path.basename(current.filename || `${item.id}.txt`);
          await fs.writeFile(path.join(dir, filename), bytes);

          // The interpreter has to be readable inside the fence or nothing
          // runs. `node` is the one we can name without guessing — it is the
          // node running this CLI — and anything else the person names is
          // theirs to allow through `config.json`'s sandboxRead.
          const nodeRoot = path.dirname(path.dirname(process.execPath));
          const result = await host.runFenced({
            command: argv[0]!,
            args: argv.slice(1),
            dir,
            toolchain: [nodeRoot],
            key: `run-${item.id}`,
            timeoutMs: Math.max(1, Number(opts.timeout ?? 60)) * 1000,
          });
          const text = transcriptOf({ ...result, argv });
          const status = statusLine({ ...result, argv });

          const existing = transcriptFor(snapshot.canvas, item.id);
          const outName = transcriptFilename(filename);
          const upload = await ctx.client.uploadBlob(p.id, Buffer.from(text, "utf8"), TRANSCRIPT_MIME, outName);
          const version = {
            id: id("ver"),
            blobHash: upload.blobHash,
            mimeType: TRANSCRIPT_MIME,
            filename: outName,
            size: upload.size,
          };
          let transcriptId: string;
          if (existing) {
            transcriptId = existing.id;
            await sendOp(ctx, p.id, { type: "item.addVersion", itemId: existing.id, version });
          } else {
            transcriptId = id("itm");
            await sendOp(ctx, p.id, {
              type: "item.add",
              itemId: transcriptId,
              version,
              width: 420,
              height: 300,
              // Beside the program it belongs to, which is a chosen spot: a
              // transcript read anywhere else is a file with no subject.
              placement: { anchorItemId: item.id },
              title: `${item.title} — output`,
              properties: { [SANDBOX_OF_PROP]: item.id },
            } as never);
          }

          if (ctx.json) {
            return printJson({
              itemId: item.id,
              transcriptId,
              argv,
              author: { id: current.createdBy.id, name: author, mine },
              programVersion: version,
              code: result.code,
              ms: result.ms,
              timedOut: result.timedOut,
              engine: result.engine,
              stdout: result.stdout,
              stderr: result.stderr,
            });
          }
          if (result.stdout) process.stdout.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
          if (result.stderr) process.stderr.write(result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
          console.error(`${status} → ${transcriptId} (${formatMs(result.ms)})`);
        } finally {
          await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        }
      }),
    );
}

export const sandboxCli: CliModule = {
  core: sandboxModule,
  register,
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};

export default sandboxCli;
