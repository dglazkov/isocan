import type { Command } from "commander";
import type { CanvasSnapshotResponse } from "@isocan/core";
import type { Canvas, CanvasContents, CoreModule, GroupBox, Item, Operation, Placement } from "@isocan/core";
import type { CopyEdit } from "@isocan/core/copy-deck";
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
   * **Run one of this copy's own scripts** (module API 0.2.11, 22 Oct 2026;
   * motion phase 1) — the question `runFenced` says to ask out loud. The
   * script is isocan's, shipped with the CLI the person installed (`script`
   * is its path in the package, `scripts/…` and nothing else), never bytes
   * off a canvas; it is what `canvas shot` and the deck's PDF export run,
   * through the same `runPackageScript`, so a missing file, a broken install
   * and a failed run are the same three sentences. `isocan motion render`
   * runs `scripts/motion-render.mjs`, the headless browser and the render
   * page. Optional, so a module can tell an older host by its absence.
   */
  runPackageScript?: (script: string, args: readonly string[], opts: { what: string; input?: string; quiet?: boolean }) => void;
  /**
   * **Enrol an agent on a canvas, from this machine** (proposed: `templates`,
   * 11 Sep 2026) — what `isocan rc add` does, promoted rather than imported:
   * the `agent.enroll` op, and the machine-local row the rc dispatches from.
   * With a `template`, the named template (from a module loaded HERE)
   * prepares the agent's working directory first, and that directory is the
   * row's cwd.
   */
  enrol: (ctx: Ctx, canvasId: string, ask: EnrolRequest) => Promise<{ actorId: string; dir: string | null; reused: boolean }>;
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
  /**
   * **What one run of this agent may spend** (module API 0.2.9) — turns and
   * dollars, the persona's `PersonaBudget`; the rc stops a run at either cap
   * and says so in the thread. A run is the turns one thread summons.
   */
  budget?: { turnsPerRun?: number; usdPerRun?: number };
  /**
   * **Reuse a standing enrolment** (module API 0.2.9): when an agent of this
   * name already stands on the canvas with its rc half on this machine, write
   * its directory afresh from the template and refresh its budget, and send
   * no op. `reused` in the answer says which happened.
   */
  reuse?: boolean;
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
  /**
   * Writes the directory. May answer with what the agent IS as well as where
   * it starts (module API 0.2.10): a `harness`, what one run may `budget`, and
   * the `color` its face wears. The rc applies the last two when it enrols
   * from a web ask, which carries nothing but the template's id and strings —
   * so a critic asked from the browser is bounded by its card exactly as one
   * asked from a terminal.
   */
  prepare: (args: Readonly<Record<string, string>>, into: string) => Promise<{ harness?: string; budget?: { turnsPerRun?: number; usdPerRun?: number }; color?: string } | void>;
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
  /** The writer for a copy-deck kind whose words this module owns. */
  copy?: CopyWriter;
  /** What this module adds to the desk check before a share (proactive-agent phase 8). */
  deskCheck?: ModuleDeskCheck;
}

/**
 * **What a module adds to the desk check** (proactive-agent phase 8, design
 * §9 "Before you share"). `isocan share` and `isocan present` read the
 * screens before they act; a part only a module knows is asked of the module
 * that knows it, as a copy-deck kind's words are (`CopyWriter`), so removing
 * the module removes its line from the check and nothing else. Each part is
 * optional, and none may block: a part that throws is left out.
 */
export interface ModuleDeskCheck {
  /** Wires drawn from an older version of their design system — the wireframe module's reading. */
  behind?: (canvas: CanvasContents, readText: (blobHash: string) => Promise<string>) => Promise<{ title: string; system: string }[]>;
  /**
   * The critics set to *before I share*, asked of the canvas's lead over
   * these screens with the check's findings, once per screen version — or
   * each saying why it waits. The critique module's room.
   */
  critics?: (host: CliHost, ctx: Ctx, canvas: Canvas, snapshot: CanvasSnapshotResponse, screens: readonly string[], findings: readonly string[]) => Promise<{ agentName: string; asked: boolean; why?: string }[]>;
}

/**
 * **Who writes a screen's words, when the screen is not just HTML**
 * (copy-edit phase 1).
 *
 * `isocan words <item> --apply` splices plain HTML itself (`applyCopyDeck`).
 * A wireframe's words are its embedded spec's: the rendered text is a join
 * of several words, and the next re-render would undo a splice. So the
 * module that renders a kind writes its words — the same writer its own
 * verb uses (`wire copy --apply`), one version, one op group — and the CLI
 * routes by the deck's `kind`. Without the module loaded, that kind's apply
 * is refused rather than spliced.
 */
export interface CopyWriter {
  /** The `CopyDeck.kind` this writes: `"wire"`. */
  kind: string;
  apply: (host: CliHost, ctx: Ctx, canvasId: string, itemId: string, edits: readonly CopyEdit[], by: string) => Promise<CopyWritten>;
  /**
   * A copy variant's file (`isocan words vary`, copy-edit phase 2): the
   * screen's HTML with one voice's words, as this kind writes them, and the
   * properties a screen of this kind carries. Nothing is sent — the CLI adds
   * the variant beside every other one (`copyVariantOps`).
   */
  variant?: (html: string, edits: readonly CopyEdit[], by: string, sourceId: string) => Promise<{ html: string; properties: Record<string, string> }>;
}

export interface CopyWritten {
  /** The addresses that changed; empty when the words were already these. */
  changed: string[];
  group?: string;
  versionId?: string;
  /** One line the CLI adds to its receipt ("prototype rebuilt"). */
  note?: string;
}
