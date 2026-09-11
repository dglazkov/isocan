import type { ContextPiece } from "./context.ts";
import type { CanvasContents, Item } from "./model.ts";
import type { Operation } from "./ops.ts";
import type { SlashCommand } from "./commands.ts";
import { inArea } from "./area.ts";

/**
 * **The module registry** (`docs/projects/modules/design.md`).
 *
 * A module is a package that contributes to both surfaces at once and can be
 * removed leaving every item it made still readable as a file. This is the
 * part of it core sees: a record naming what the module contributes to the
 * facts core already computes — the rows of `isocan context`, the edges the
 * canvas draws and JSON Canvas exports, and (phase 2) the kinds.
 *
 * **Core imports no module.** The web shell and the CLI each hold a list and
 * register every entry's record at start; a surface that does not load a
 * module gets a core that has never heard of it. That is the only way
 * "removed" can mean removed, and it is why the functions below read a
 * registry instead of calling anything by name.
 */

export interface ModuleEdge {
  from: Item;
  to: Item;
}

/**
 * **A kind a module adds** (phase 2): a mime first, because the file is the
 * truth — `itemKind()` asks the registry before its own mime tests, and with
 * the module gone the same file falls through to whatever the built-ins call
 * it. Extensions are how `isocan add diagram.mmd` and a dropped file learn
 * the mime.
 */
export interface ModuleKind {
  id: string;
  mimes: readonly string[];
  /** Bare, lower-case: `mmd`, not `.mmd`. */
  extensions?: readonly string[];
  /** The plural a list groups under, and the singular a tooltip uses. */
  label: string;
  noun: string;
  /** Which of the built-in marks this kind borrows for its icon — the icon
   *  set is the app's, drawn for 11px, and a module names one rather than
   *  shipping pixels. Unset, the kind wears the plain file mark. */
  icon?: string;
}

export interface CoreModule {
  /** The package name — `@isocan/<name>` — which is also how an item made by
   *  a module that is not installed can be named from its mime alone. */
  name: string;
  /** The property keys it owns. Namespaced, and forever: keys replay, and a
   *  removed module's keys must read as orphaned rather than be reused. */
  propertyKeys?: readonly string[];
  contextPieces?: (canvas: CanvasContents) => ContextPiece[];
  edges?: (canvas: CanvasContents) => ModuleEdge[];
  kinds?: readonly ModuleKind[];
  /**
   * **Slash commands** (phase 4): instructions an agent carries out, merged
   * under the built-ins and the home's own — a third source, `module`, that
   * is there while the module is and gone when it is not. Text, like every
   * command; a module's agent tool is a command plus a verb.
   */
  commands?: readonly SlashCommand[];
  /**
   * **Named lists this module reads, which other modules may add to**
   * (proposed: `points`, 11 Sep 2026 — `docs/projects/design-competition/module-gaps.md` §2).
   *
   * Until now contribution ran one way: a module added to core's registries
   * and nothing could add to a module's. A second package wanting to add a
   * fighter to the design competition would have had to import it, which the
   * removability guard forbids. A point is VS Code's extension point in this
   * registry's shape: the declaring module names it and says what it accepts,
   * and `contributions(id)` is the one reader.
   */
  points?: readonly ContributionPoint[];
  /**
   * **What this module adds to other modules' points**, by point id. DATA —
   * JSON-serialisable, so it rides the manifest and is known before any code
   * runs, the way `kinds` already are. A module whose whole content is this
   * plus `assets/` is a **data-only module**: a manifest and some files, which
   * runs nothing.
   */
  contributes?: Readonly<Record<string, readonly unknown[]>>;
  /**
   * **Vote rounds the curtain honours** (proposed: `rounds`). The sprint's
   * curtain hid counts and bylines on its own Vote sheet while a vote phase's
   * clock ran and knew nothing else; a module running a vote of its own on
   * another area names it here, and the same lens draws the same curtain.
   */
  rounds?: (canvas: CanvasContents) => readonly VoteRound[];
}

/**
 * **One vote in progress, on one area** — what the curtain needs to know and
 * nothing more: WHERE (the area whose contents are behind it), WHICH marks are
 * the votes, and UNTIL when. The record is never hidden; this is etiquette the
 * lens keeps, and the chip says so.
 */
export interface VoteRound {
  /** The area item whose contents are curtained. */
  areaId: string;
  /** The reactions that are votes in this round — 🥇, 🔴, ⭐… */
  marks: readonly string[];
  /** ISO time the curtain lifts. */
  until: string;
}

/** A named list a module reads and other modules may add to. */
export interface ContributionPoint {
  /** Namespaced like a property key, and forever: `design-competition.fighters`. */
  id: string;
  /** One line, printed by `isocan module ls`. */
  describe: string;
  /** What is wrong with one contributed value; empty means accepted. */
  validate: (value: unknown) => string[];
}

/** One accepted contribution, tagged with the module it came from — which is
 *  how a reader finds that module's assets. */
export interface Contribution<T> {
  module: string;
  value: T;
}

/** A contribution a point refused, or one to a point nobody declares. */
export interface RefusedContribution {
  module: string;
  point: string;
  /** Why: the validator's sentences, or that no loaded module declares the point. */
  problems: string[];
}

function declaredPoint(id: string): ContributionPoint | null {
  for (const m of modules()) {
    const hit = (m.points ?? []).find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

/**
 * **Every accepted contribution to a point**, in module order. A value the
 * declaring module's validator refuses is left out here and listed by
 * `refusedContributions()`; a point no loaded module declares has no
 * contributions at all, which is what removing the module that owns it means.
 */
export function contributions<T>(pointId: string): Contribution<T>[] {
  const point = declaredPoint(pointId);
  if (!point) return [];
  const out: Contribution<T>[] = [];
  for (const m of modules()) {
    for (const value of m.contributes?.[pointId] ?? []) {
      if (point.validate(value).length === 0) out.push({ module: m.name, value: value as T });
    }
  }
  return out;
}

/** What `isocan module ls` says about contributions that did not land. */
export function refusedContributions(): RefusedContribution[] {
  const out: RefusedContribution[] = [];
  for (const m of modules()) {
    for (const [pointId, values] of Object.entries(m.contributes ?? {})) {
      const point = declaredPoint(pointId);
      if (!point) {
        out.push({ module: m.name, point: pointId, problems: [`no loaded module declares ${pointId} — orphaned, not an error`] });
        continue;
      }
      values.forEach((value, i) => {
        const problems = point.validate(value);
        if (problems.length > 0) out.push({ module: m.name, point: pointId, problems: problems.map((p) => `#${i + 1}: ${p}`) });
      });
    }
  }
  return out;
}

/** Every vote round a loaded module says is running on this canvas. */
export function moduleRounds(canvas: CanvasContents): VoteRound[] {
  return modules().flatMap((m) => [...(m.rounds?.(canvas) ?? [])]);
}

/**
 * **The rounds an item is IN** — its centre inside the round's area, the same
 * geometry every area uses — running or finished. Running ones curtain it;
 * finished ones still say which marks are votes, so the heat map draws at the
 * bell and stays drawn.
 */
export function roundsOn(canvas: CanvasContents, item: Item): VoteRound[] {
  return moduleRounds(canvas).filter((round) => {
    const area = canvas.items[round.areaId];
    return area !== undefined && inArea(area, item);
  });
}

/** Is this round's clock still running — the curtain's half of it. */
export function roundRunning(round: VoteRound, nowMs: number): boolean {
  return Date.parse(round.until) > nowMs;
}

/**
 * **Where a module's files are reached from** (proposed: `assets`).
 *
 * A build-time module reaches its own `assets/` with `new URL("../assets/…",
 * import.meta.url)`, which Vite rewrites and a runtime build leaves for the
 * browser to resolve against `/modules/<slug>/dist/web.js` — the same relative
 * path in both layouts, the trick `agent-guide.md` already relies on. What
 * that cannot do is reach ANOTHER module's files, which is exactly what a
 * contribution needs: a fighter contributed by a data-only module names its
 * avatar relative to that module. So the loaders record each runtime module's
 * base here — a URL prefix on the web, a directory on the CLI — and a reader
 * resolves a contribution's paths against its module's base.
 */
const BASES = new Map<string, string>();

export function registerModuleBase(name: string, base: string): void {
  BASES.set(name, base.endsWith("/") ? base : `${base}/`);
}

/** The base a module's relative paths resolve against, or null for a module
 *  that reaches its own files itself (every build-time module). */
export function moduleBase(name: string): string | null {
  return BASES.get(name) ?? null;
}

/** Every loaded module's slash commands, in name order. */
export function moduleCommands(): SlashCommand[] {
  return modules()
    .flatMap((m) => (m.commands ?? []).map((c) => ({ ...c, source: "module" as const })))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A command list with the loaded modules' commands laid UNDER it: a built-in
 * or a home command of the same name wins, so a module cannot shadow what the
 * product or the person wrote. Both surfaces call this on whatever list they
 * hold — the daemon's, or the compiled built-ins — because the daemon
 * registers no module and the list it serves cannot know them.
 */
export function withModuleCommands(commands: readonly SlashCommand[]): SlashCommand[] {
  const byName = new Map<string, SlashCommand>();
  for (const command of moduleCommands()) byName.set(command.name, command);
  for (const command of commands) byName.set(command.name, command);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const REGISTRY = new Map<string, CoreModule>();

/** Idempotent by name, so a surface that registers twice (HMR, a test) holds one. */
export function registerModule(record: CoreModule): void {
  REGISTRY.set(record.name, record);
}

export function unregisterModule(name: string): void {
  REGISTRY.delete(name);
}

export function modules(): CoreModule[] {
  return [...REGISTRY.values()];
}

export function moduleContextPieces(canvas: CanvasContents): ContextPiece[] {
  return modules().flatMap((m) => m.contextPieces?.(canvas) ?? []);
}

export function moduleEdges(canvas: CanvasContents): ModuleEdge[] {
  return modules().flatMap((m) => m.edges?.(canvas) ?? []);
}

export function moduleKinds(): ModuleKind[] {
  return modules().flatMap((m) => m.kinds ?? []);
}

/** The module kind that owns a mime, if a loaded module claims it. */
export function moduleKindOf(mime: string): ModuleKind | null {
  return moduleKinds().find((k) => k.mimes.includes(mime)) ?? null;
}

/**
 * **What a module's components are handed to CHANGE anything** (9 Sep 2026).
 *
 * The web twin of `CliHost`, and it exists for the same reason that one does.
 * Until now `ModuleAction.run` returning `readonly Operation[]` was the only
 * place in this whole file that produced an operation: underlays, renderers,
 * inspectors and pages were read-only by construction, and four of those five
 * are components a person interacts with. The one that could write was a
 * palette entry with no UI of its own.
 *
 * That was invisible while the modules were a mind map, a Mermaid renderer and
 * a documents inspector, none of which changes anything from inside a
 * component. It stopped being invisible the moment somebody built a tray you
 * drag things out of (#156, romannurik's stickers), because dragging a sticker
 * onto the canvas IS a write made from a panel.
 *
 * It also contradicted a rule the design already states — *"a hidden store:
 * module state is an item, visible and versioned"* — since most of the places
 * a module could put UI could not write an item.
 *
 * ## Two members, and why not more
 *
 * `send` is the same door `ModuleAction.run` returns into, so a write from a
 * component is an `item.add` or an `item.update` like any other: echoed,
 * undoable, groupable, and visible to the terminal as the same op. No new
 * authority — the palette could already send these.
 *
 * `putBlob` is the one thing an operation cannot say. `item.add` and
 * `item.addVersion` both name a `blobHash`, and a blob is minted through a
 * channel that is not an op — so a module could express every canvas change
 * EXCEPT the ones that need new content, which is what a node-type module
 * spends its life doing.
 *
 * ## Deliberately not `dropFile(file, placement)`
 *
 * The exploration that found this asked for exactly that, and for an
 * `addVersion` beside it. Both bundle decisions that belong to the module:
 * mint the bytes, choose the placement, send the op. A module given `dropFile`
 * cannot set its own title, size or properties, cannot group two writes into
 * one undo, and needs a second helper the day it wants a version instead of an
 * item — which is how a per-slot helper list starts. `putBlob` plus ops
 * composes, and it is one member instead of a growing family.
 *
 * ## Who gets it
 *
 * The slots a person interacts with: overlays, inspectors and pages.
 * Underlays and renderers DRAW, and nothing has needed to write from one yet
 * — so they do not get it, and the day a module needs that it is a review
 * question rather than a private import, which is the rule `CliHost` already
 * carries and the reason this interface exists at all.
 */
export interface WebHost {
  /** Sent as the viewer, through the door the palette already uses. One
   *  `group` for one undo, exactly as a multi-op action groups today. */
  send: (ops: readonly Operation[], group?: string) => Promise<void>;
  /** Bytes in, a hash out — the half no operation carries. What a module does
   *  with the hash is an `item.add` or an `item.addVersion` of its own. */
  putBlob: (
    bytes: Blob,
    filename: string,
  ) => Promise<{ blobHash: string; size: number }>;
  /**
   * **Ask the parked rc to enrol an agent** (proposed: `templates`, 11 Sep
   * 2026). The web cannot enrol by sending `agent.enroll` — the actor is born
   * first-claim on the machine that answers for it (agent custody) — so this
   * rides the same ask `AddAgent` makes, and resolves when the op lands.
   *
   * **The canvas names a template; the machine runs it.** `template` is an id
   * and `args` are strings: the rc honours ids from modules its operator
   * installed and refuses the rest by name, so nothing that arrives from a
   * canvas becomes code on anybody's machine. Refused with a sentence when no
   * rc is parked — which the component already knew, from `rcParked`.
   */
  enrol: (ask: EnrolAsk) => Promise<{ actorId: string }>;
}

/** What a component asks the parked rc to enrol. */
export interface EnrolAsk {
  name: string;
  /** A template id a module on the rc's machine registered: `design-competition.fighter`. */
  template?: string;
  args?: Readonly<Record<string, string>>;
}

/** A template id: `<module>.<name>`, lowercase, the shape a property key has. */
export const TEMPLATE_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$/;

/**
 * **The template half of an ask, or why not** — read once, where the ask
 * enters the home (`/api/projects/:id/agents/ask`), and never trusted
 * further down: an id in the template shape, and at most sixteen string args
 * of at most 512 characters. What crosses from a canvas to a machine is a
 * name and some strings, and this is the line that keeps it so.
 */
export function askTemplate(
  raw: { template?: unknown; args?: unknown },
): { template?: string; args?: Record<string, string> } | { error: string } {
  if (raw.template === undefined && raw.args === undefined) return {};
  if (typeof raw.template !== "string" || !TEMPLATE_ID.test(raw.template)) {
    return { error: "a template is named by an id like `module.name`" };
  }
  const args: Record<string, string> = {};
  if (raw.args !== undefined) {
    if (!raw.args || typeof raw.args !== "object" || Array.isArray(raw.args)) return { error: "template args are an object of strings" };
    const entries = Object.entries(raw.args as Record<string, unknown>);
    if (entries.length > 16) return { error: "at most 16 template args" };
    for (const [k, v] of entries) {
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(k)) return { error: `template arg "${k}" is not a plain key` };
      if (typeof v !== "string" || v.length > 512) return { error: `template arg "${k}" is not a string of at most 512 characters` };
      args[k] = v;
    }
  }
  return { template: raw.template, ...(Object.keys(args).length ? { args } : {}) };
}

/**
 * **What the web shell mounts** — the slots, as data. Generic over the
 * component type so this file stays free of React: the shell narrows `C` to
 * `ComponentType<UnderlayFacts>`, and a module's `web.tsx` types its export
 * the same way, so the two agree by construction without either importing
 * the other.
 */
export interface UnderlayFacts {
  canvas: CanvasContents;
  /** The live drag, so a line can ride the gesture before the replica moves. */
  drag: { itemIds: readonly string[]; dx: number; dy: number } | null;
}

/**
 * **A palette action a module adds**, as data over facts: the shell reads
 * its stores, hands the module the canvas and the selection, and SENDS the
 * ops the module returns — so a module never holds a store or a socket, and
 * an action that writes is an `items.move` or an `item.update` like any
 * other, echoed, undoable, and visible to the terminal as the same op.
 */
export interface ModuleActionFacts {
  canvas: CanvasContents;
  selection: readonly string[];
}

export interface ModuleAction {
  id: string;
  name: string;
  hint?: string;
  /** Offered only when this says so — a menu that lists what it cannot do lies. */
  available?: (facts: ModuleActionFacts) => boolean;
  /** The ops to send, in order; nothing means nothing to do. */
  run?: (facts: ModuleActionFacts) => readonly Operation[] | void;
  /**
   * **Open one of this module's dialogs instead** (proposed: `dialogs`) — by
   * its id. An action that opens is a door, not a write: it is offered on a
   * read-only canvas too, and the dialog decides what it can do there.
   */
  opens?: string;
}

/**
 * **What a dialog is handed** (proposed: `dialogs`, 11 Sep 2026).
 *
 * Overlays are edges and pages are cover routes; neither is a thing that
 * opens over where you are because you asked — a picker. So an eighth slot,
 * and the shell owns the box: one dialog at a time, mounted in the app's own
 * `Modal`, Esc and the backdrop close it, focus is trapped and returned. A
 * module fills the inside and cannot position, stack or re-open itself.
 *
 * It opens only from a door a person used — a slash command they typed, a
 * palette entry they chose — never on load, from a renderer, or from an op
 * arriving. That is the whole of its risk budget.
 */
export interface DialogFacts {
  canvasId: string;
  canvas: CanvasContents;
  selection: readonly string[];
  /** What followed the slash command that opened it; "" from the palette. */
  args: string;
  /** Whether an rc is parked here — the `AddAgent` gate, as a fact. */
  rcParked: boolean;
  /** Whether the viewer may write here — a read-only canvas opens the dialog
   *  and the dialog says what it cannot do. */
  canEdit: boolean;
  host: WebHost & { close: () => void };
}

export interface ModuleDialog<D> {
  /** Unique within the module: an action's or a command's `opens` names it. */
  id: string;
  /** The Modal's heading, and its accessible name. */
  title: string;
  /** The Modal's wider width. The shell owns both. */
  wide?: boolean;
  component: D;
}

/**
 * **What a renderer is handed** (phase 2): the version's identity, the two
 * ways to reach its bytes, and whether the item is entered. The shell builds
 * `url` and `readText` from its own blob client; a module never spells a
 * blob path.
 */
export interface RendererFacts {
  canvasId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  entered: boolean;
  url: string;
  readText: () => Promise<string>;
}

export interface ModuleRenderer<R> {
  /** The mimes this draws — the same list the module's kind claims. */
  mimes: readonly string[];
  component: R;
}

/**
 * **What an inspector is handed** (phase 4): the open item, and its bytes on
 * request. The workbench mounts a module's inspector beside the stage when
 * the item's kind is one the inspector names — the slot the extensions
 * design called for and nothing had asked for until documents did.
 */
export interface InspectorFacts {
  canvasId: string;
  item: Item;
  readText: () => Promise<string>;
  /** Changing the thing you are inspecting is the point of inspecting it.
   *  An `item.addVersion` naming a hash from `host.putBlob` is how. */
  host: WebHost;
}

export interface ModuleInspector<I> {
  /** The kinds it inspects — built-in ids or a module's. */
  kinds: readonly string[];
  label: string;
  component: I;
}

/**
 * **What a page is handed** (phase 4): the canvas, whole. A page is a cover
 * route of its own — `x/<segment>` under the canvas's path — the same kind of thing the
 * workbench and the deck view are: an address either surface can hand you,
 * mounted inside the canvas page so the replica underneath stays open.
 */
export interface PageFacts {
  canvasId: string;
  canvas: CanvasContents;
  host: WebHost;
}

export interface ModulePage<P> {
  /** The path segment: lowercase letters, digits, dashes. */
  segment: string;
  label: string;
  hint?: string;
  component: P;
}

/**
 * **What an overlay is handed**: the canvas, and the way to change it.
 *
 * An overlay is screen-space chrome above the viewport — a tray, a dock, a
 * palette of things to drag out. The sixth slot, and the one the design
 * anticipated when it said *"panel, page, inspector, tool: each lands when a
 * module asks"*.
 *
 * **It is also the one with real risk, and the region is why.** `underlays`
 * is safe because it is beneath everything in world space, where a module can
 * only draw under the work. An overlay is the app's own chrome space, and N
 * modules mounting floating panels wherever they like is how a shell turns
 * into a mess — the failure the rail's and the dock's fixed lists exist to
 * prevent. So an overlay names a REGION rather than positioning itself, the
 * shell owns where that region is, and two modules in one region stack in
 * module order instead of overlapping.
 */
export type OverlayRegion = "left" | "right";

/** What an overlay draws with: the canvas, and the way to change it. */
export interface OverlayFacts {
  canvasId: string;
  canvas: CanvasContents;
  host: WebHost;
}

/**
 * **A drag a module claims** (#156).
 *
 * The canvas's drop handler read `dataTransfer.files` and `text/uri-list`,
 * both spelled into the handler, so a module could put a tray on the screen
 * and had no way to catch what you dragged out of it.
 *
 * The shape is the one the module system already uses rather than a second
 * one: a module claims MIMES for its kinds, and a drag carries mimes, so a
 * module claims the drag mimes it accepts and is handed the data. What it
 * returns is ops, like everything else — and with `host.putBlob` it can mint
 * the content those ops name.
 *
 * Native OS file drops are not offered here. They are the shell's, they have
 * a hundred handlers' worth of behaviour behind them (versions onto an item,
 * a row laid out rather than a stack, the notice when one fails), and a
 * module intercepting them would be taking over the app's own gesture rather
 * than adding one of its own.
 */
export interface DropFacts {
  canvasId: string;
  /** The dragged payload, by the mime this drop matched. */
  data: string;
  mimeType: string;
  /** Where it landed, in world units. */
  at: { x: number; y: number };
  host: WebHost;
}

/** One claim on a dragged mime, and what to do with what arrives. */
export interface ModuleDrop {
  /** The `dataTransfer` types this claims. First match wins, module order. */
  mimes: readonly string[];
  /** Returns the ops to send, or nothing when it decides this is not for it
   *  after all — a claim on a mime is not a promise to handle every payload
   *  carried under it. */
  run: (facts: DropFacts) => Promise<readonly Operation[] | void>;
}

/** A tray or dock a module hangs against one edge of the canvas. Not
 *  exported: a module names its overlays through `WebModule`, the way it
 *  names its renderers, and nothing outside core has needed the type itself. */
interface ModuleOverlay<O> {
  /** Which edge it sits against. The shell decides where that is. */
  region: OverlayRegion;
  /** For the chrome registry, so a person can turn it off like any other
   *  floating thing — an overlay nobody chose is chrome nobody chose. */
  label: string;
  component: O;
}

export interface WebModule<C, R = never, I = never, P = never, O = never, D = never> {
  core: CoreModule;
  /** Drawn inside `.world`, under the items, in world units. */
  underlays?: readonly C[];
  /** Entries in the ⌘K palette's Canvas group. Every one of them writes. */
  actions?: readonly ModuleAction[];
  /** How a version of one of this module's kinds is drawn on the card and
   *  the stage — ahead of the built-in chain, lazily loaded by the module. */
  renderers?: readonly ModuleRenderer<R>[];
  /** Beside the workbench's stage, for items of the kinds it names. */
  inspectors?: readonly ModuleInspector<I>[];
  /** Whole sections of the app, each a cover route with an address. */
  pages?: readonly ModulePage<P>[];
  /** Screen-space chrome above the viewport, against a named edge. */
  overlays?: readonly ModuleOverlay<O>[];
  /** Drags this module catches on the canvas, by mime. */
  drops?: readonly ModuleDrop[];
  /** Popups a person opens by a command or a palette entry. */
  dialogs?: readonly ModuleDialog<D>[];
}

/**
 * **A runtime module's manifest** (phase 3): what `isocan module add` prints
 * before `--yes`, what the daemon lists on `/api/serving`, and what the CLI
 * reads before it imports any code. Written by `scripts/module-build.mjs`
 * from the package and its core record, so the declaration and the code come
 * from one place; the registry is filled from the manifest, so a module's
 * kinds are known to both surfaces without executing its web half at all.
 *
 * Paths are relative to the module's directory: `~/.isocan/modules/<name>/`.
 */
export interface ModuleManifest {
  name: string;
  version: string;
  description?: string;
  /** The isocan version range this was built against — refused with a
   *  sentence, never crashed on. `>=0.1.0`, `^0.1`, or `*`. */
  engines?: string;
  kinds?: readonly ModuleKind[];
  propertyKeys?: readonly string[];
  /** The web half, an ES module the daemon serves under `/modules/<name>/`. */
  web?: string;
  /** The CLI half, an ES module the CLI imports before it parses argv. */
  cli?: string;
  /** The guide section, printed after the base guide while loaded. */
  guide?: string;
  /**
   * The unstable parts of the API this module uses (`PROPOSED`). A module
   * naming any is refused unless the person adding it says yes — the same
   * bargain VS Code's proposed API makes, and the reason we can keep changing
   * these slots without breaking somebody who never asked for them.
   */
  proposed?: readonly string[];
  /**
   * **What else lands on disk** (proposed: `assets`): every file under the
   * module's `assets/`, with its size, so `module add` can print what arrives
   * as well as what runs. Paths are relative to the module's directory.
   */
  assets?: readonly { path: string; size: number }[];
  /** The module's contributions to other modules' points — data, read before
   *  any code runs. A manifest with these and no `web` or `cli` is a
   *  data-only module. */
  contributes?: Readonly<Record<string, readonly unknown[]>>;
}

/** A manifest that runs nothing: no web half, no CLI half. */
export function isDataOnly(manifest: ModuleManifest): boolean {
  return !manifest.web && !manifest.cli;
}

/**
 * **The module API's own version, which is not the app's** (9 Sep 2026).
 *
 * It was `ISOCAN_VERSION`, pinned by a test to the root package's version,
 * which is 0.1.0 and has never moved. So the engines check — real, enforced on
 * `module add`, refused with a sentence by the daemon — could never refuse
 * anything, because the number it compares against was a constant. A bound
 * that exists and does not bind, which is this repo's oldest shape.
 *
 * **Decoupled because ours will break and VS Code's does not.** VS Code can
 * judge `engines.vscode` against the app version because their stable API has
 * essentially never broken since 1.0: every app release is compatible, so the
 * app version is a safe proxy for the API version. isocan's module API is
 * pre-1.0 and changing weekly. Tying it to the app would mean either bumping
 * the app for an API change nobody outside a module can see, or never bumping
 * at all — which is what happened.
 *
 * So this moves when the module API moves, and only then.
 *
 * **0.1.0 → 0.2.0 on 9 Sep 2026**, and it is a break rather than an addition:
 * `InspectorFacts` and `PageFacts` gained a required `host`, so a module built
 * against 0.1 no longer compiles. Under semver's pre-1.0 rule a minor bump is
 * exactly how you say that, and `^0.1.0` is refused by the check below — which
 * is the first time it has ever refused anything.
 *
 * **0.2.0 → 0.2.1 on 11 Sep 2026**, and it is an addition, not a break: the
 * design competition's six asks (assets, contribution points, dialogs,
 * templates and `host.enrol`, vote rounds) are all new optional fields or new
 * members a module is HANDED, never one it must provide. A module built for
 * `^0.2.0` still loads; one that uses the new parts says `^0.2.1` and names
 * them in `proposed`.
 */
export const MODULE_API_VERSION = "0.2.1";

/**
 * **The parts of the API we intend to change**, named so a module can say it
 * is using one and a home can say yes before it runs.
 *
 * VS Code's proposed API in the shape this codebase can afford: an extension
 * names the proposals it uses, only runs where somebody enabled them, and
 * cannot be published to the marketplace at all. Fast on one side of the line,
 * frozen on the other, and the line is a list a person opts into.
 *
 * Everything here landed on 9 Sep for one module's sake and has had exactly
 * one caller. That is not stability, and calling it stable because it shipped
 * is how an API gets frozen by accident.
 */
export const PROPOSED = ["overlays", "drops", "host", "assets", "points", "dialogs", "templates", "rounds"] as const;

/** Which of a manifest's proposals this build does not recognise. A module
 *  asking for something that no longer exists is a refusal with a name, not a
 *  module that quietly loads without the thing it needed. */
export function unknownProposals(wanted: readonly string[] | undefined): string[] {
  return (wanted ?? []).filter((one) => !(PROPOSED as readonly string[]).includes(one));
}

/** The name a module is addressed by on disk and in a URL: the package
 *  name's last segment — `@isocan/<name>` → `<name>`. */
export function moduleSlug(name: string): string {
  return name.split("/").pop() ?? name;
}

/** Where the daemon serves a module's web half from: `/modules/<slug>/<web>`.
 *  Spelled once, here, for the daemon that serves it and the shell that asks. */
export function moduleWebPath(manifest: ModuleManifest): string | null {
  return manifest.web ? `/modules/${moduleSlug(manifest.name)}/${manifest.web}` : null;
}

/** The registry record a manifest declares — the code-free half of a module. */
export function manifestRecord(manifest: ModuleManifest): CoreModule {
  return {
    name: manifest.name,
    ...(manifest.kinds ? { kinds: manifest.kinds } : {}),
    ...(manifest.propertyKeys ? { propertyKeys: manifest.propertyKeys } : {}),
    ...(manifest.contributes ? { contributes: manifest.contributes } : {}),
  };
}

function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

/**
 * Does this build's MODULE API satisfy a module's `engines`? Three shapes, on purpose
 * no more: `*` (or nothing) is anything; `>=a.b.c` is at least; `^a.b.c` is
 * at least and the same major (same minor while the major is 0, as npm
 * reads it). A range this cannot read is a refusal that says so, because a
 * module that cannot state what it needs is not a module a home should run.
 */
export function enginesSatisfied(range: string | undefined, version: string = MODULE_API_VERSION): { ok: true } | { ok: false; why: string } {
  const have = parseVersion(version);
  if (!have) return { ok: false, why: `this build's module API version "${version}" cannot be read` };
  const r = (range ?? "*").trim();
  if (r === "*" || r === "") return { ok: true };
  const m = /^(>=|\^)?\s*(.+)$/.exec(r);
  const want = m ? parseVersion(m[2]!) : null;
  if (!m || !want) return { ok: false, why: `cannot read the engines range "${r}" — use >=a.b.c, ^a.b.c or *` };
  const op = m[1] ?? "^";
  if (compare(have, want) < 0) return { ok: false, why: `needs module API ${r}, and this build is ${version}` };
  if (op === "^") {
    const sameLine = want[0] === 0 ? have[0] === 0 && have[1] === want[1] : have[0] === want[0];
    if (!sameLine) return { ok: false, why: `needs module API ${r}, and this build is ${version}` };
  }
  return { ok: true };
}
