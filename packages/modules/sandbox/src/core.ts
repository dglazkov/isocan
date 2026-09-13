import type { CanvasContents, ContextPiece, CoreModule, Item, NewVersion, Operation, SlashCommand } from "@isocan/core";

/**
 * **Sandboxes** (`docs/projects/modules/phases.md`, phase 5 — the agent-side
 * half, started 12 Sep 2026 after the gate check).
 *
 * > A sandbox is a program that lives on the canvas as a file and runs on
 * > the machine that typed the verb, fenced, with what it printed posted
 * > back as a version.
 *
 * isocan still never runs compute — the [architecture](../../../../docs/architecture.md)'s
 * given. The home orders the ops; the program runs where a person already
 * trusts their own shell, the way `isocan edit` opens `$EDITOR` there.
 *
 * **No kind, no op, no mime of its own.** A sandbox is an ORDINARY file —
 * `build.mjs` is a text item before this module and a text item after it —
 * wearing one namespaced property that says how to run it. That is what
 * makes removal safe by construction rather than by promise: take the
 * module away and every program is still a file you can open, every
 * transcript is still a file you can read, and the property is an orphaned
 * key rather than a dangling kind.
 *
 * **What this module may never do**, stated here because a sandbox is the
 * module that would be tempted: it does not spawn anything itself (the
 * fence is `CliHost.runFenced`'s, not its own), it does not render a frame
 * or run a byte of a canvas's code in the browser (that is the shape the
 * extension-actors gate still binds), and it holds no state a file does not.
 */

/** The argv, as a person would type it: `node build.mjs --fast`. */
export const SANDBOX_RUN_PROP = "sandbox.run";

/** On a transcript: the id of the program it is the output of. The link
 *  points from the output to the program because the program is the thing a
 *  person edits, and an edit should not have to rewrite a pointer. */
export const SANDBOX_OF_PROP = "sandbox.of";

export const TRANSCRIPT_MIME = "text/plain";

/** A first transcript inherits its program's container; further runs own only its version stack. */
export function transcriptOperation(program: Item, existing: Item | null, version: NewVersion, itemId: string, groups: boolean): Operation {
  if (existing) return { type: "item.addVersion", itemId: existing.id, version };
  return { type: "item.add", itemId, version, width: 420, height: 300, placement: { anchorItemId: program.id }, title: `${program.title} — output`, properties: { [SANDBOX_OF_PROP]: program.id }, ...(groups ? { containerId: program.containerId ?? null, groupPlacement: "auto" as const } : {}) };
}

export function runOf(item: Item): string | null {
  const value = item.properties?.[SANDBOX_RUN_PROP];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isSandboxItem(item: Item): boolean {
  return runOf(item) !== null;
}

/** The programs on a canvas, newest edit first. */
export function sandboxesOn(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isSandboxItem)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

/** The transcript item a program's runs are versions of, if one exists yet. */
export function transcriptFor(canvas: CanvasContents, programId: string): Item | null {
  return Object.values(canvas.items).find((i) => i.properties?.[SANDBOX_OF_PROP] === programId) ?? null;
}

/**
 * The argv, split the way a shell would split it — except that there is no
 * shell. Quotes group, backslash escapes one character, and nothing else is
 * special: no globbing, no `$VAR`, no `|`, no `&&`. A person who wants a
 * pipeline writes a script and runs the script, which is the thing this
 * module is for.
 */
export function argvOf(run: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;
  for (let i = 0; i < run.length; i++) {
    const c = run[i]!;
    if (c === "\\" && i + 1 < run.length) {
      current += run[++i]!;
      started = true;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      else current += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (started) parts.push(current);
      current = "";
      started = false;
      continue;
    }
    current += c;
    started = true;
  }
  if (started) parts.push(current);
  return parts;
}

export interface RunResult {
  argv: readonly string[];
  stdout: string;
  stderr: string;
  code: number | null;
  signal?: string | null;
  ms: number;
  engine: string;
  timedOut?: boolean;
  truncated?: boolean;
}

/**
 * **The transcript, which is the version's bytes.**
 *
 * Plain text on purpose. The exit code and the duration could have been an
 * item description — two ops and a fact that only the app can read — and
 * instead they are the last line of a file, which `isocan cat`, the stage,
 * a diff between two runs and a person with no isocan at all can all read.
 * A version is the record; the record should not need us.
 */
export function transcriptOf(result: RunResult): string {
  const lines = [`$ ${result.argv.join(" ")}`, ""];
  if (result.stdout) lines.push(result.stdout.replace(/\n$/, ""));
  if (result.stderr) {
    if (result.stdout) lines.push("");
    lines.push("--- stderr ---", result.stderr.replace(/\n$/, ""));
  }
  if (!result.stdout && !result.stderr) lines.push("(printed nothing)");
  if (result.truncated) lines.push("", "(output truncated)");
  lines.push("", statusLine(result));
  return `${lines.join("\n")}\n`;
}

/** The one line that says how it went — the tail of the transcript, and what
 *  the terminal and the page both print. */
export function statusLine(result: RunResult): string {
  const how = result.timedOut
    ? "timed out"
    : result.code === 0
      ? "exit 0"
      : result.code === null
        ? `killed by ${result.signal ?? "a signal"}`
        : `exit ${result.code}`;
  return `${how} · ${formatMs(result.ms)} · fenced by ${result.engine}`;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** What a transcript is called. Beside the program, so a directory listing
 *  of a canvas export sorts them together. */
export function transcriptFilename(programFilename: string): string {
  return `${programFilename.replace(/\.[^./]*$/, "")}.out.txt`;
}

const RUN_COMMAND: SlashCommand = {
  name: "run",
  description: "Run a program that is on this canvas, fenced, on your own machine",
  usage: "/run <item>",
  source: "module",
  body: [
    "Run a sandboxed program from this canvas and post what it printed.",
    "",
    "1. `isocan sandbox ls` — the programs here, and the argv each one runs.",
    "2. `isocan sandbox run <item>` — runs it **on your machine**, inside the",
    "   fence, and posts the transcript as a version of the program's output",
    "   item. The version is stamped with YOUR actor, because you are the one",
    "   who ran it.",
    "",
    "The verb names the author before it runs. A program somebody ELSE wrote",
    "refuses until you pass `--yes` — read it first with `isocan show <item>`.",
    "The fence bounds what it can reach (no network at all, one scratch",
    "directory, nothing of your home) and bounds nothing about whether running",
    "it was a good idea. \"Somebody put it on the canvas\" is not a reason.",
    "",
    "If the machine cannot build a fence, the verb refuses and says what is",
    "missing. Do not work around that: there is no unfenced path, deliberately.",
  ].join("\n"),
};

export const sandboxModule: CoreModule = {
  name: "@isocan/sandbox",
  propertyKeys: [SANDBOX_RUN_PROP, SANDBOX_OF_PROP],
  commands: [RUN_COMMAND],
  contextPieces: (canvas: CanvasContents): ContextPiece[] => {
    const programs = sandboxesOn(canvas);
    if (programs.length === 0) return [];
    const ran = programs.filter((p) => transcriptFor(canvas, p.id) !== null).length;
    return [
      {
        name: "Sandboxes",
        source: "canvas",
        present: true,
        size:
          `${programs.length} program${programs.length === 1 ? "" : "s"}, ` +
          (ran === 0 ? "none run yet" : `${ran} with a transcript`),
        updatedAt: programs[0]!.updatedAt,
      },
    ];
  },
};

export default sandboxModule;
