import type {
  Actor,
  Canvas,
  CanvasSnapshotResponse,
  ContextManifest,
  ContextContentPage,
  CommentThread,
  Item,
  ItemKind,
  MentionCandidate,
  NewComment,
  Operation,
  PostOpResponse,
  PresenceSession,
  WatchedLogEntry,
  WatchLogResponse,
  SourceRequestContext,
  PersonalSourcePolicy,
} from "@isocan/core";
import {
  actorNameIn,
  actorsAnswerTo,
  resolveActor,
  annotationsOf,
  groupChildren,
  groupDescendants,
  findArea,
  itemsIn,
  collectCanvasActors,
  collectCanvasNames,
  collectItemRefCandidates,
  extensionFor,
  extractItemRefs,
  extractMentions,
  filenameFromTitle,
  itemKind,
  mainThread,
  itemThread,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  recentActivity,
  type ActivityEntry,
  parseSourcePolicyHeader,
  sourcePolicyHeader,
} from "@isocan/core";
import { matchRef, resolveCanvas, resolveCanvasRef, resolveCtx, readHomeRecord, homeAddressOf, sourceContextForCanvas, type Ctx } from "./ctx.ts";
import { DaemonClient } from "./client.ts";
import { claimSessionIdentity, noIdentityHere, type ExplicitIdentity } from "./identity.ts";
import { readContextSummary, type ContextSummaryOptions } from "./context-summary.ts";
import { waitForFeedback, type FeedbackOptions, type FeedbackResult } from "./feedback.ts";
import type { ContextExtras, ContextLayer } from "@isocan/core";
import { ApiError, type DaemonRoutes } from "./routes.ts";
import { CanvasGroups, resolveCanvasGroupRef, type CanvasGroupCopyOptions, type CanvasGroupResult } from "./canvas-groups.ts";
import { readContextItem, type CommentContextOptions, type ContextReadOptions, type ContextPageOptions, type ContextBytesOptions, type ContextItemContent } from "./canvas-context.ts";

/**
 * **Unreachable is a typed refusal here, not a stack trace** (journey 1's
 * "unreachable is not empty"). A daemon that ANSWERS with a refusal already
 * throws `ApiError` with the wire's code; a connection that never got an
 * answer surfaces from `fetch` as a bare `TypeError`, which a script can only
 * string-match. On this surface it becomes `ApiError` with status 0 and code
 * `"unreachable"` — one type to catch, three cases (`refused`, `unreachable`,
 * and the door's own codes) told apart by `code`.
 *
 * On THIS surface only, deliberately: `isocan wait`'s reconnect loop treats
 * "an `ApiError` means somebody was there to say no" as the line between a
 * refusal and a blip, so the raw client keeps throwing what fetch threw.
 */
async function reaching<T>(base: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof TypeError) {
      const cause = (err as { cause?: { message?: string } }).cause?.message;
      throw new ApiError(0, `${base} did not answer: ${cause ?? err.message}`, "unreachable");
    }
    throw err;
  }
}

/**
 * **`connect()` — the API's front door** (iso-api phase 2, journey 1).
 *
 * Resolves exactly as the CLI resolves, because it IS that resolution: the
 * same directory marker walk, the same session-claim identity, the same
 * `homes.json`, the same daemon auto-start — `resolveCtx`, called with two
 * differences a script forces:
 *
 * - **It never prompts.** The CLI's first-run flow asks a person at a TTY for
 *   a name; a script that reaches this door with no identity is refused with
 *   the reason and the way in, eagerly, so the refusal lands at `connect()`
 *   rather than halfway through a run.
 * - **Identity can be a stated argument.** A script that is its own actor —
 *   the board — used to build environment variables so the CLI would resolve
 *   it; `identity: { session, harness }` is that gesture as a parameter. The
 *   actor must already be claimed (the claim stays a deliberate act:
 *   `isocan identity --name … --session` under that session), so a script
 *   and a CLI presenting the same key are the same collaborator.
 *
 * The moved layer's stderr voice (phase 1's finding) is kept, deliberately:
 * staleness notes, upgrade notes and binding notes are one-time courtesies
 * addressed to whoever reads the process's transcript, and a script's stderr
 * is exactly that channel. What `connect()` removes is the interactive half —
 * nothing here ever waits on a keyboard.
 */
export interface ConnectOptions {
  /**
   * The session this script speaks as, instead of the ambient walk. The
   * resolution is what the CLI does with `ISOCAN_SESSION_ID` (and
   * `ISOCAN_HARNESS`) in its environment; the actor must already be claimed
   * under the key, and an unclaimed one is refused with the claim gesture.
   */
  identity?: ExplicitIdentity;
  /** The daemon port, when it is not `ISOCAN_PORT`/the default. */
  port?: number;
  /** Optional lifetime for this connection, including identity and admission IO. */
  signal?: AbortSignal;
}

export async function connect(options: ConnectOptions = {}): Promise<Home> {
  const ctx = await resolveCtx({
    interactive: false,
    ...(options.port !== undefined ? { port: options.port } : {}),
    ...(options.identity !== undefined ? { identity: options.identity } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  options.signal?.throwIfAborted();
  // Refused with a reason, at the door (the phases' settled answer to the
  // harness-less environment — mint-and-warn stays a closed door). The lazy
  // getter is the CLI's shape, where `ls` should not demand a name; a script
  // that connected is going to act, and refusing here names the remedy
  // before anything is half-done.
  try {
    void ctx.actor;
  } catch {
    if (options.identity) {
      const harness = options.identity.harness ?? "isocan";
      throw new Error(
        `no actor is claimed under session "${harness}:${options.identity.session}" — claim it once: ` +
          `ISOCAN_HARNESS=${harness} ISOCAN_SESSION_ID=${options.identity.session} ` +
          `isocan identity --name "Your Name" --session`,
      );
    }
    throw new Error(await noIdentityHere(ctx.client, ctx.home));
  }
  return new Home(ctx);
}

/** Deliberately claim a stable caller session without changing process-wide identity. */
export async function claimSession(options: ConnectOptions & { identity: ExplicitIdentity; name: string }): Promise<Actor> {
  if (!options.identity.session.trim() || !options.name.trim()) throw new Error("a session key and agent name are required");
  const ctx = await resolveCtx({ interactive: false, ...(options.port === undefined ? {} : { port: options.port }), ...(options.signal ? { signal: options.signal } : {}), identity: options.identity });
  options.signal?.throwIfAborted();
  const result = await claimSessionIdentity(ctx.client, ctx.home, { identity: options.identity, name: options.name, ...(ctx.binding ? { canvasId: ctx.binding.canvasId } : {}) });
  return result.actor;
}

/**
 * **A home handle, not only a directory handle** — what journey 1 forces: the
 * board cannot be written against "this directory's canvas" alone. The
 * directory's canvas is the default reach; any other opens by ref, with the
 * same matching `--canvas` uses, off the same client.
 */
export class Home {
  constructor(readonly ctx: Ctx) {}

  /** Who this connection speaks as. */
  get actor(): Actor {
    return this.ctx.actor;
  }

  /** Restrict one caller without changing the shared badge or any other tool's client. */
  withSourcePolicy(policy: PersonalSourcePolicy, signal?: AbortSignal): Home {
    signal?.throwIfAborted();
    if (policy.mode === "direct" && policy.actorId !== this.actor.id) throw new Error("Source policy must name this call's selected actor.");
    const sourceContext: SourceRequestContext = Object.freeze({
      ...parseSourcePolicyHeader(sourcePolicyHeader({ policy })), ...(signal ? { signal } : {}),
    });
    return new Home(this.sourceScoped(sourceContext));
  }

  private sourceScoped(sourceContext: SourceRequestContext): Ctx {
    const client = new DaemonClient(this.ctx.client.base, this.ctx.home, sourceContext.signal, sourceContext);
    this.ctx.reclaimOn?.(client);
    let record: ReturnType<typeof readHomeRecord> | undefined;
    const homes = () => record ??= readHomeRecord(client, this.ctx.birthHome);
    return { ...this.ctx, client, sourceContext, homes, homeOf: async (id) => homeAddressOf(await homes(), id) };
  }

  /**
   * A canvas to work: no ref means the directory's canvas resolved the way
   * every CLI command resolves it (marker walk, home default, only-one); a
   * ref is an id or unique title prefix, `--canvas`'s own matching.
   */
  async canvas(ref?: string): Promise<CanvasHandle> {
    return reaching(this.ctx.client.base, async () => {
      const ctx = this.ctx.sourceContext ? this.sourceScoped(await sourceContextForCanvas(this.ctx, ref)) : this.ctx;
      const record =
        ref === undefined
          ? await resolveCanvas(ctx)
          : await resolveCanvasRef(ctx.client, ref, ctx.sourceContext);
      return new CanvasHandle(ctx, record);
    });
  }
}

/** What add and edit take: the content itself, as a value — a string or a
 * buffer with its mime type. No file, no temp directory; a path convenience
 * can sit atop this the day a consumer reaches for one. */
export interface ContentSpec {
  content: string | Buffer;
  /** Required on `add`; `edit` inherits the current version's when omitted. */
  mime?: string;
  /** The name the bytes leave the canvas under (`isocan get`, downloads).
   * Defaults from the title and the mime's extension on `add`, and from the
   * current version on `edit`. */
  filename?: string;
}

export interface AddSpec extends ContentSpec {
  mime: string;
  title?: string;
  description?: string;
  /** World coordinates. Omitted, the item lands left of the leftmost item —
   * the CLI's own default placement. */
  at?: { x: number; y: number };
  size?: { width: number; height: number };
  properties?: Record<string, string>;
  /** Explicit group ID or unique reference; insertion and any frame growth are one act. */
  in?: string;
  containerId?: string | null;
  cell?: { row: number; column: number };
  groupPlacement?: "auto" | "preserve" | "exact";
}

/** The metadata half of `isocan set`, sized to what a script reaches for. */
export interface SetSpec {
  properties?: Record<string, string>;
  removeProperties?: string[];
  size?: { width: number; height: number };
}

export interface PostedComment {
  threadId: string;
  commentId: string;
  /** Authoritative writer provenance, when this message supplied group context. */
  context?: ContextManifest;
}

function postedComment(threadId: string, commentId: string, receipt: PostOpResponse): PostedComment {
  const op = receipt.envelope.op;
  const context = op.type === "thread.create" || op.type === "thread.reply" ? op.comment.context : undefined;
  return { threadId, commentId, ...(context ? { context } : {}) };
}

/** A name in use on a canvas — from a live session or from its history. Keyed
 * by NAME, not actor: one person can have worked under several, and every one
 * of them still answers to `@Name`. */
export interface KnownName {
  name: string;
  /** Who answers to it. */
  id: string;
  /** They are on the canvas right now, under this name. */
  live: boolean;
}

/** One act on the canvas, with who did it — `isocan activity`'s row. */
export interface ActivityRow extends ActivityEntry {
  who: string;
}

/** The rows for a set of actors, newest first under one budget — the one
 * assembly behind `CanvasHandle.activity()` and `isocan activity` (which
 * also filters WHO before asking, so the shaping is shared, not copied). */
export function activityRows(
  snapshot: CanvasSnapshotResponse,
  actors: Actor[],
  limit: number,
): ActivityRow[] {
  return actors
    .flatMap((actor) =>
      recentActivity(snapshot.canvas, actor.id, limit).map((entry) => ({
        who: actorNameIn(snapshot.names, actor),
        ...entry,
      })),
    )
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

/** An item as the reads hand it out: the record plus its derived kind, the
 * same pairing `isocan --json ls` prints. */
export type ListedItem = Item & { kind: ItemKind };

/** What `tail()` takes: where to resume, and how to stop. */
export interface TailOptions {
  /**
   * Yield entries with seq greater than this — the seq of the last entry the
   * caller handled, which every yielded entry carries as `entry.seq`. Omitted,
   * the tail starts at the canvas's current tip: entries that land after the
   * iteration begins. `since: 0` replays the whole live log.
   */
  since?: number;
  /** Ends the iteration — cleanly, no throw — when aborted, including one
   * blocked in a held poll or in a retry pause. */
  signal?: AbortSignal;
}

/** What `tail()` yields: the log entry itself (its `seq` is the cursor to
 * resume from), with the op's type flattened to the one field a reaction
 * switches on. Who wrote it is `entry.envelope.actor` — a watcher that also
 * writes skips its own. */
export interface TailEntry extends WatchedLogEntry {
  opType: Operation["type"];
}

/** A pause that ends early when the signal fires — so an aborted tail is not
 * stuck sleeping out its retry backoff. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done);
  });
}

/** The default display size for content nobody sized — the CLI's own. */
const DEFAULT_SIZE = { width: 480, height: 360 };

/**
 * **One canvas, held open** — the reads a script leans on and the ops it
 * sends, each the CLI's own act without the argv. Items are named by their
 * exact id: a script holds ids because every op returns what it made; the
 * prefix-and-title matching is the CLI's affordance for a person typing.
 */
export class CanvasHandle {
  constructor(
    readonly ctx: Ctx,
    readonly record: Canvas,
  ) {}

  get id(): string {
    return this.record.id;
  }

  get title(): string {
    return this.record.title;
  }

  /** Membership verbs share the CLI's typed canvas-group helper and atomic writer boundary. */
  get groups(): CanvasGroups { return new CanvasGroups(this.ctx.client, this.id, () => this.ctx.actor); }

  /** Copy a selected graph and both content faces in one writer act. */
  async copy(refs: string[], options: CanvasGroupCopyOptions & { to?: string } = {}): Promise<CanvasGroupResult> {
    return this.reach(async () => {
      const target = options.to ? matchRef(await this.ctx.client.listCanvases(), options.to) : this.record;
      return new CanvasGroups(this.ctx.client, target.id, () => this.ctx.actor).copyFrom(this.id, refs, options);
    });
  }

  private snapshot(): Promise<CanvasSnapshotResponse> {
    return this.reach(() => this.ctx.client.snapshot(this.id));
  }

  /** Every network act on this handle throws `ApiError` — see {@link reaching}. */
  private reach<T>(work: () => Promise<T>): Promise<T> {
    return reaching(this.ctx.client.base, work);
  }

  /** Every live item, each carrying its derived kind — `--json ls`. */
  async items(options: { in?: string | undefined; recursive?: boolean | undefined } = {}): Promise<ListedItem[]> {
    const { project, canvas } = await this.snapshot();
    let items = Object.values(canvas.items);
    if (options.in !== undefined) {
      if (project.groupMode === "groups") {
        const parent = resolveCanvasGroupRef(canvas, options.in, true);
        items = options.recursive ? groupDescendants(canvas, parent.id) : groupChildren(canvas, parent.id);
      } else {
        const area = findArea(canvas, options.in);
        if (!area) throw new Error(`no area called "${options.in}"`);
        items = itemsIn(canvas, area);
      }
    }
    return items.map((item) => ({ ...item, kind: itemKind(item) }));
  }

  /** Complete current hierarchy at one revision; omission reads ambient pins. */
  async context(options: ContextReadOptions = {}): Promise<ContextManifest> {
    return this.reach(async () => {
      if (options.in === undefined && options.rootIds === undefined) {
        if (options.includeExcluded !== undefined || options.expectedRevision !== undefined) throw new Error("includeExcluded and expectedRevision require explicit context roots or in");
        return this.ctx.client.contextManifest(this.id);
      }
      const snapshot = await this.snapshot();
      const roots = [...(options.rootIds ?? []).map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref).id)];
      if (options.in !== undefined) roots.push(resolveCanvasGroupRef(snapshot.canvas, options.in, true).id);
      return this.ctx.client.contextManifest(this.id, { rootIds: [...new Set(roots)], ...(options.includeExcluded !== undefined ? { includeExcluded: options.includeExcluded } : {}), ...(options.expectedRevision !== undefined ? { expectedRevision: options.expectedRevision } : {}) });
    });
  }

  contextOfComment(threadId: string, commentId: string): Promise<ContextManifest> {
    return this.reach(() => this.ctx.client.commentContext(this.id, threadId, commentId));
  }

  /** Live ambient layers, distinct from a current item manifest or saved request. */
  contextSummary(extras: ContextExtras = {}, options: ContextSummaryOptions = {}): Promise<ContextLayer[]> {
    return this.reach(() => readContextSummary(this.ctx, this.id, extras, options));
  }

  /** Bounded addressed feedback with a caller-owned cursor; never marks work seen. */
  waitForFeedback(options: FeedbackOptions = {}): Promise<FeedbackResult> {
    return this.reach(() => waitForFeedback(this.ctx.client, this.id, this.ctx.actor, options));
  }

  contextPage(options: ContextPageOptions): Promise<ContextContentPage> {
    return this.reach(() => this.ctx.client.contextContentPage(this.id, options));
  }

  contextItem(threadId: string, commentId: string, itemId: string, options: ContextBytesOptions = {}): Promise<ContextItemContent> {
    return this.reach(() => readContextItem(this.ctx.client, this.id, threadId, commentId, itemId, options));
  }

  /** One item, by exact id, fresh from the store. */
  async item(itemId: string): Promise<Item> {
    const { canvas } = await this.snapshot();
    const item = canvas.items[itemId];
    if (!item) throw new Error(`no item ${itemId} on ${this.record.title}`);
    return item;
  }

  /** Every comment thread — `--json comment list`. */
  async threads(): Promise<CommentThread[]> {
    const { canvas } = await this.snapshot();
    return Object.values(canvas.threads);
  }

  /** Everyone who has touched this canvas, and whether they are here now —
   * `--json who --all`. */
  async who(): Promise<KnownName[]> {
    const sessions = await this.ctx.client.listSessions(this.id).catch(() => [] as PresenceSession[]);
    const { canvas, joined } = await this.snapshot();
    const known = new Map<string, KnownName>();
    const add = (name: string, stamped: string, live: boolean) => {
      // An actor folded into somebody else (`actor.join`, multi-identity
      // phase 5) is listed as that person: one row, the person's id. The
      // name as written still gets its row, because `who --all` lists names
      // the canvas remembers and a folded actor's old name is one of them.
      const id = resolveActor(joined, stamped);
      const key = name.toLowerCase();
      const prior = known.get(key);
      if (!prior) known.set(key, { name, id, live });
      else if (live) known.set(key, { ...prior, live: true });
    };
    // The canvas's own author counts: they named it before touching it.
    for (const actor of [this.record.createdBy, this.record.updatedBy]) {
      add(actor.name, actor.id, false);
    }
    for (const candidate of collectCanvasNames(canvas)) add(candidate.name, candidate.id, false);
    for (const session of sessions) {
      add(session.actor.name, session.actor.id, true);
      if (session.label) add(session.label, session.actor.id, true);
    }
    return [...known.values()].sort(
      (a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name),
    );
  }

  /** What everyone has been doing, newest first — `--json activity`. */
  async activity(limit = 10): Promise<ActivityRow[]> {
    const snapshot = await this.snapshot();
    return activityRows(snapshot, collectCanvasActors(snapshot.canvas), limit);
  }

  /**
   * **The log as an iterator** (iso-api phase 3, journey 2): every entry that
   * lands on this canvas, in order, as an async iterator over the daemon's
   * long-poll — the same `watchLog` laps `isocan wait` lives on, without the
   * park row, the dispatch rules, or the self-filter. A raw tail: the caller
   * decides what an entry means.
   *
   * **The cursor stays with the caller.** `{ since }` in; each yielded entry
   * carries its `seq` out. A tail that dies resumes by handing back the last
   * seq it handled — the seq-cursor gesture every replica uses — and the
   * first entry the new tail yields is the one after it. Nothing here stores
   * anything: where "handled" is recorded is the caller's business.
   *
   * **A dropped connection is a pause, never an entry.** A daemon restart, an
   * upgrade, a laptop waking up — the poll fails at the connection level, the
   * cursor is unchanged, and the loop retries (starting the daemon again if
   * it is gone, `isocan wait`'s own gesture). Nothing is yielded for the
   * reconnect, so a consumer cannot mistake it for activity — the
   * auto-upgrade project's standing lesson, inherited. Ops written while the
   * connection was down are still in the log and arrive as themselves. The
   * daemon ANSWERING with a refusal is different: an `ApiError` means
   * somebody was there to say no, and it is thrown, not retried.
   */
  async *tail(options: TailOptions = {}): AsyncGenerator<TailEntry, void, undefined> {
    const { signal } = options;
    let cursor = options.since;
    let offlineSince: number | null = null;
    let complained = false;
    for (;;) {
      if (signal?.aborted) return;
      let batch: WatchLogResponse;
      try {
        // No `since` yet: a cursor-less lap, which the daemon answers
        // immediately with the tip and no entries — "from now on", seeded on
        // the same call the loop lives on, retried like every other lap.
        batch = await this.ctx.client.watchLog(
          cursor === undefined
            ? { only: [this.id] }
            : { cursors: { [this.id]: cursor }, waitMs: 30_000, only: [this.id] },
          signal,
        );
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof ApiError) throw err;
        if (offlineSince === null) offlineSince = Date.now();
        // Pause first, then bring the daemon back: `ensureDaemon` no-ops when
        // something is answering, and after an `isocan restart` something
        // usually is by the time the pause ends — the spawn is for a daemon
        // that is genuinely gone, not one mid-restart.
        await pause(400, signal);
        if (signal?.aborted) return;
        await this.ctx.client.ensureDaemon().catch(() => {});
        // Say it once, after long enough that a restart is not worth
        // mentioning — on stderr, the script's transcript, never as a yield.
        if (!complained && Date.now() - offlineSince > 3_000) {
          complained = true;
          console.error(
            "tail: the daemon stopped answering — retrying, and starting it if it is gone. " +
              "The cursor is unchanged; nothing that lands meanwhile is missed.",
          );
        }
        continue;
      }
      if (offlineSince !== null) {
        const gap = Math.round((Date.now() - offlineSince) / 1000);
        if (complained) console.error(`tail: daemon back after ${gap}s — still tailing, nothing missed`);
        offlineSince = null;
        complained = false;
      }
      cursor = batch.cursors[this.id] ?? cursor ?? 0;
      for (const entry of batch.entries) {
        yield { ...entry, opType: entry.envelope.op.type };
      }
    }
  }

  /**
   * A new item from content held in hand, returning the item the store now
   * holds — its version stack, its `blobHash`, its resolved position. The
   * call that created it is the call that hands it back, which is what lets
   * a publisher compare bytes next run without re-listing anything.
   */
  async add(spec: AddSpec): Promise<Item> {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const containerId = spec.in !== undefined ? resolveCanvasGroupRef(snapshot.canvas, spec.in, true).id : spec.containerId;
      if (spec.cell && !containerId) throw new Error("a cell requires a destination group");
      const data = typeof spec.content === "string" ? Buffer.from(spec.content) : spec.content;
      const filename = spec.filename ?? defaultFilename(spec.title, spec.mime);
      const upload = await this.ctx.client.uploadBlob(this.id, data, spec.mime, filename);
      const itemId = newItemId();
      const { width, height } = spec.size ?? DEFAULT_SIZE;
      const placement = spec.at ?? this.defaultPlacement(snapshot);
      const accepted = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "item.add",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: spec.mime,
          filename,
          size: upload.size,
        },
        width,
        height,
        placement,
        ...(containerId !== undefined ? { containerId, groupPlacement: spec.groupPlacement ?? (spec.at ? "exact" : "auto") } : {}),
        ...(spec.cell ? { cell: spec.cell } : {}),
        ...(spec.title !== undefined ? { title: spec.title } : {}),
        ...(spec.description !== undefined ? { description: spec.description } : {}),
        ...(spec.properties && Object.keys(spec.properties).length > 0
          ? { properties: spec.properties }
          : {}),
      }, undefined, undefined, undefined, snapshot.project.groupMode ?? "legacy");
      const written = accepted.envelope.op;
      if (written.type === "group.change" && written.action.kind === "apply") {
        const created = written.action.change.writes.find((write) => write.kind === "create" && write.item.id === itemId);
        if (created?.kind === "create") return created.item;
      }
      return this.item(itemId);
    });
  }

  /** The CLI's default: left of the leftmost item, origin on an empty canvas. */
  private defaultPlacement({ canvas }: CanvasSnapshotResponse): { x: number; y: number } | { anchorItemId: string } {
    const leftmost = Object.values(canvas.items).reduce<Item | null>(
      (best, item) => (best === null || item.x < best.x ? item : best),
      null,
    );
    return leftmost ? { anchorItemId: leftmost.id } : { x: 0, y: 0 };
  }

  /**
   * A new version of an existing item, from content in hand. Mime and
   * filename default from the version being succeeded. Returns the item with
   * its grown stack — the new version is `currentVersionId`.
   */
  async edit(itemId: string, spec: ContentSpec): Promise<Item> {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const before = snapshot.canvas.items[itemId];
      if (!before) throw new Error(`no item ${itemId} on ${this.record.title}`);
      const current = before.versions.find((v) => v.id === before.currentVersionId);
      const mime = spec.mime ?? current?.mimeType;
      const filename = spec.filename ?? current?.filename;
      if (!mime || !filename) {
        throw new Error(`item ${itemId} has no current version to inherit from`);
      }
      const data = typeof spec.content === "string" ? Buffer.from(spec.content) : spec.content;
      const upload = await this.ctx.client.uploadBlob(this.id, data, mime, filename);
      await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "item.addVersion",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: mime,
          filename,
          size: upload.size,
        },
      }, undefined, undefined, undefined, snapshot.project.groupMode ?? "legacy");
      return this.item(itemId);
    });
  }

  /**
   * **Into the trash, not out of existence** — `item.delete` is the soft one,
   * so `isocan restore` and undo both still reach it.
   *
   * Added for the docket (#206 phase 2), which is the first consumer that had
   * to take something OFF a canvas: a question somebody has answered is no
   * longer a question, the run page keeps the record, and a card that stays
   * forever is the silting `docs/research/2026-08-30-repo-admin-canvas.md`
   * names as the way this goes wrong in week two. `add` and `edit` had been
   * enough for every earlier caller because a board only ever grew.
   */
  async remove(itemId: string): Promise<void> {
    return this.reach(async () => {
      await this.ctx.client.sendOp(this.id, this.ctx.actor, { type: "item.delete", itemId });
    });
  }

  /** Properties on, properties off, a resize — the slice of `isocan set` a
   * script reaches for. Same ops, so the same undo. */
  async set(itemId: string, patch: SetSpec): Promise<void> {
    const meta = {
      ...(patch.properties && Object.keys(patch.properties).length > 0
        ? { properties: patch.properties }
        : {}),
      ...(patch.removeProperties && patch.removeProperties.length > 0
        ? { removeProperties: patch.removeProperties }
        : {}),
    };
    let did = false;
    await this.reach(async () => {
      const snapshot = await this.snapshot();
      if (snapshot.project.groupMode === "groups") {
        if (!Object.keys(meta).length && !patch.size) throw new Error("nothing to change");
        await this.groups.update(itemId, { patch: meta, ...(patch.size ? { size: patch.size } : {}) });
        did = true;
        return;
      }
      if (Object.keys(meta).length > 0) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "item.update",
          itemId,
          patch: meta,
        }, undefined, undefined, undefined, "legacy");
        did = true;
      }
      if (patch.size) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "item.resize",
          itemId,
          width: patch.size.width,
          height: patch.size.height,
        }, undefined, undefined, undefined, "legacy");
        did = true;
      }
    });
    if (!did) throw new Error("nothing to change");
  }

  /** Move an item — and what is drawn on it travels with it, the same rule
   * the CLI's `mv` and the web app's drag follow. */
  async move(itemId: string, x: number, y: number): Promise<void> {
    await this.reach(async () => {
      const snapshot = await this.snapshot();
      if (snapshot.project.groupMode === "groups") { await this.groups.move(itemId, { at: { x, y } }); return; }
      const { canvas } = snapshot;
      const item = canvas.items[itemId];
      if (!item) throw new Error(`no item ${itemId} on ${this.record.title}`);
      const dx = x - item.x;
      const dy = y - item.y;
      const marks = annotationsOf(canvas, itemId);
      const moves = [
        { itemId, x, y },
        ...marks.map((mark) => ({ itemId: mark.id, x: mark.x + dx, y: mark.y + dy })),
      ];
      await this.ctx.client.sendOp(
        this.id,
        this.ctx.actor,
        moves.length === 1 ? { type: "item.move", ...moves[0]! } : { type: "items.move", moves },
        undefined, undefined, undefined, "legacy",
      );
    });
  }

  /**
   * Start a thread on an item — `isocan comment add --item`'s act. A bot
   * with something to say every commit says it HERE, on the panel it is
   * about, not in the Chat: on 3 Sep 2026 one board's 137 build notices
   * were a third of the request corpus and had made the Chat unusable as a
   * channel — it noticed itself, mid-run, that it had posted 80 of a
   * thread's 96 messages.
   */
  async comment(itemId: string, message: string, options: CommentContextOptions = {}): Promise<PostedComment> {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message, options);
      const threadId = newThreadId();
      const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: itemId,
        comment,
      }, undefined, undefined, undefined, snapshot.project.groupMode ?? "legacy");
      return postedComment(threadId, comment.id, receipt);
    });
  }

  /** Reply in a thread that exists — `isocan comment reply`'s act. */
  async reply(threadId: string, message: string, options: CommentContextOptions = {}): Promise<PostedComment> {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message, options);
      const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, { type: "thread.reply", threadId, comment }, undefined, undefined, undefined, snapshot.project.groupMode ?? "legacy");
      return postedComment(threadId, comment.id, receipt);
    });
  }

  /**
   * Say something in the Chat — `isocan notify`'s act: the main thread gets
   * the reply, or is born from the first message, with `@Name` mentions and
   * `#Title` references resolved the way every comment resolves them.
   */
  async notify(message: string, options: CommentContextOptions = {}): Promise<PostedComment> {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message, options);
      const main = mainThread(snapshot.canvas);
      if (main) {
        const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "thread.reply",
          threadId: main.id,
          comment,
        }, undefined, undefined, undefined, snapshot.project.groupMode ?? "legacy");
        return postedComment(main.id, comment.id, receipt);
      }
      const threadId = newThreadId();
      const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: null,
        main: true,
        comment,
      }, undefined, undefined, undefined, snapshot.project.groupMode ?? "legacy");
      return postedComment(threadId, comment.id, receipt);
    });
  }

  say(message: string, options: CommentContextOptions = {}): Promise<PostedComment> {
    return this.notify(message, options);
  }

  async ask(question: string, options: CommentContextOptions & { itemId?: string } = {}): Promise<PostedComment> {
    const words = question.trim();
    if (!words) throw new Error("ask what?");
    const body = words.startsWith("/ask") ? words : `/ask ${words}`;
    if (options.itemId) {
      const snapshot = await this.snapshot();
      const existing = itemThread(snapshot.canvas, options.itemId);
      return existing ? this.reply(existing.id, body, options) : this.comment(options.itemId, body, options);
    }
    return this.notify(body, options);
  }

  private newComment(snapshot: CanvasSnapshotResponse, body: string, options: CommentContextOptions = {}): Promise<NewComment> {
    return buildComment(this.ctx.client, this.id, snapshot, body, options);
  }
}

/**
 * Build a comment payload, resolving @Name mentions against everyone the
 * author can see (canvas actors plus the live presence roster, labels too)
 * and #Title references against the live items. One spelling, consumed by
 * `CanvasHandle.notify()` and every CLI comment verb — a mention that
 * resolves differently depending on which surface posted it would summon
 * nobody.
 */
export async function buildComment(
  client: DaemonRoutes,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  body: string,
  options: CommentContextOptions = {},
): Promise<NewComment> {
  // What the canvas remembers, plus what everyone goes by NOW — otherwise
  // "@Di" resolves to nobody the moment Dion 2 renames, and the summons that
  // was meant for her is a comment nobody wakes for.
  const candidates: MentionCandidate[] = actorsAnswerTo(
    collectCanvasActors(snapshot.canvas),
    snapshot.names,
    snapshot.joined,
  );
  const sessions = await client.listSessions(canvasId).catch(() => []);
  for (const session of sessions) {
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
  }
  const mentions = extractMentions(body, candidates);
  const items = [...new Set([
    ...extractItemRefs(body, collectItemRefCandidates(snapshot.canvas)),
    ...(options.items ?? []).map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref).id),
    ...(options.rootIds ?? []).map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref).id),
    ...(options.in !== undefined ? [resolveCanvasGroupRef(snapshot.canvas, options.in, true).id] : []),
  ])];
  const explicit = options.in !== undefined || options.rootIds !== undefined || options.includeExcluded !== undefined || options.expectedRevision !== undefined;
  if (explicit && snapshot.project.groupMode !== "groups") throw new Error("group context requires a group-enabled canvas");
  return {
    id: newCommentId(),
    body,
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(explicit ? { contextRequest: { rootIds: items, ...(options.includeExcluded !== undefined ? { includeExcluded: options.includeExcluded } : {}), ...(options.expectedRevision !== undefined ? { expectedRevision: options.expectedRevision } : {}) } } : {}),
  };
}

/** "Build" + text/html → "build.html"; nameless content is filed by mime. */
function defaultFilename(title: string | undefined, mime: string): string {
  const fallback = `content.${extensionFor("", mime)}`;
  return title ? filenameFromTitle(title, fallback) : fallback;
}
