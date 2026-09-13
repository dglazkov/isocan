import type { Command } from "commander";
import type { CanvasSnapshotResponse } from "@isocan/core";
import type { Canvas, CoreModule, GroupBox, Item, Operation, Placement } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import type { FencedRequest, FencedRun } from "./sandbox.ts";

export type { Ctx, FencedRequest, FencedRun };

/**
 * **What a module's verbs are handed** (`docs/projects/modules/design.md`).
 *
 * The helpers the CLI's own verbs use, and nothing else: a module hangs its
 * family on the same program, resolves canvases and items the same way, and
 * sends ops through the same door — so `--json`, the narration and the
 * error shapes are the CLI's, not a second CLI's. A module that wants a
 * helper not listed here is asking for one to be promoted, which is a review
 * question and not a private import.
 */
export interface CliHost {
  program: Command;
  /** Wraps an action so its errors print as the CLI prints them. */
  run: (fn: (...args: any[]) => Promise<void>) => (...args: any[]) => Promise<void>;
  ctxOf: (cmd: Command) => Promise<Ctx>;
  resolveCanvas: (ctx: Ctx) => Promise<Canvas>;
  resolveItem: (snapshot: CanvasSnapshotResponse, ref: string) => Item;
  sendOp: (ctx: Ctx, canvasId: string | null, op: Operation, group?: string) => Promise<{ envelope: { op: Operation } }>;
  /** Preserve ordinary placement JSON; group insertions report their accepted complete frame. */
  insertionReceiptPlacement: (op: Operation, itemId: string) => GroupBox | Extract<Placement, { x: number }>;
  printJson: (value: unknown) => void;
  sizeFor: (spec: string | undefined, fallback: { width: number; height: number }) => { width: number; height: number };
  placementFor: (
    snapshot: CanvasSnapshotResponse,
    opts: { at?: string; anchor?: string; in?: string; cell?: string },
    size?: { width: number; height: number },
  ) => unknown;
  truncate: (text: string, max: number) => string;
  /**
   * **The only way a module starts a process** (modules phase 5, 12 Sep
   * 2026) — and it is fenced or it is a refusal.
   *
   * The promotion `design.md` describes rather than a private import of
   * `sandbox.ts`, and the trust classes are why it is here at all. A module
   * is trusted like the CLI you installed; the bytes it runs, when they came
   * off a canvas, are a collaborator's. Keeping the fence in the app means a
   * module cannot build a weaker one, cannot skip it, and cannot be talked
   * into an unfenced run by a flag — there is no flag. On a machine that
   * cannot fence, this throws with what is missing, the wording `isocan rc
   * --sandbox` already uses.
   *
   * A module that wants to run a program of its OWN — a binary it shipped,
   * which the person installed when they installed the module — is asking a
   * different question, and should ask it out loud rather than reaching past
   * this.
   */
  runFenced: (request: FencedRequest) => Promise<FencedRun>;
  /**
   * **Enrol an agent on a canvas, from this machine** (proposed: `templates`,
   * 11 Sep 2026) — what `isocan rc add` does, promoted rather than imported:
   * the `agent.enroll` op, and the machine-local row the rc dispatches from.
   * With a `template`, the named template (from a module loaded HERE)
   * prepares the agent's working directory first, and that directory is the
   * row's cwd.
   */
  enrol: (ctx: Ctx, canvasId: string, ask: EnrolRequest) => Promise<{ actorId: string; dir: string | null }>;
  /** Take an agent's standing back — what `isocan rc rm` does. The log keeps
   *  everything; the working directory is left where it is. */
  withdraw: (ctx: Ctx, canvasId: string, actorId: string) => Promise<void>;
}

export interface EnrolRequest {
  name: string;
  template?: string;
  args?: Readonly<Record<string, string>>;
  /** A harness name `isocan harness` knows; unset, the machine's default. */
  harness?: string;
}

/**
 * **A template: what a new agent's working directory holds** (proposed:
 * `templates`).
 *
 * The gap `AddAgent` deferred on 30 Aug — *"persona templates deliberately
 * absent… until the personas machinery can say what a template defaults,
 * rather than a picker that decorates without deciding"* — answered in the
 * narrowest shape that decides something: a template writes files into a
 * directory, and that directory is where the agent's harness starts, so an
 * `AGENTS.md` in it is what the agent reads first.
 *
 * **Only code a person installed runs.** A web ask names a template by id;
 * the rc looks the id up among modules loaded on its own machine and refuses
 * one it does not have. A template writes files. It does not start a
 * harness, choose a model, or run anything.
 */
export interface EnrolTemplate {
  /** Namespaced: `<module>.<name>`. */
  id: string;
  describe: string;
  prepare: (args: Readonly<Record<string, string>>, into: string) => Promise<{ harness?: string } | void>;
}

export interface CliModule {
  core: CoreModule;
  /** The verbs, hung on `host.program`. */
  register: (host: CliHost) => void;
  /** The section `isocan --agent-help` prints after the base guide, while
   *  this module is loaded. Every verb `register` adds must be named in it. */
  guide: string;
  /** Working-directory templates this module offers the rc. */
  templates?: readonly EnrolTemplate[];
}
