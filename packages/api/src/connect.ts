import type {
  Actor,
  Canvas,
  CanvasSnapshotResponse,
  CommentThread,
  Item,
  ItemKind,
  MentionCandidate,
  NewComment,
  Operation,
  PresenceSession,
  WatchedLogEntry,
  WatchLogResponse,
} from "@isocan/core";
import {
  actorNameIn,
  actorsAnswerTo,
  annotationsOf,
  collectCanvasActors,
  collectCanvasNames,
  collectItemRefCandidates,
  extensionFor,
  extractItemRefs,
  extractMentions,
  filenameFromTitle,
  itemKind,
  mainThread,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  recentActivity,
  type ActivityEntry,
} from "@isocan/core";
import { matchRef, resolveCanvas, resolveCtx, type Ctx } from "./ctx.ts";
import { noIdentityHere, type ExplicitIdentity } from "./identity.ts";
import { ApiError, type DaemonRoutes } from "./routes.ts";

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
}

export async function connect(options: ConnectOptions = {}): Promise<Home> {
  const ctx = await resolveCtx({
    interactive: false,
    ...(options.port !== undefined ? { port: options.port } : {}),
    ...(options.identity !== undefined ? { identity: options.identity } : {}),
  });
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

  /**
   * A canvas to work: no ref means the directory's canvas resolved the way
   * every CLI command resolves it (marker walk, home default, only-one); a
   * ref is an id or unique title prefix, `--canvas`'s own matching.
   */
  async canvas(ref?: string): Promise<CanvasHandle> {
    return reaching(this.ctx.client.base, async () => {
      const record =
        ref === undefined
          ? await resolveCanvas(this.ctx)
          : matchRef(await this.ctx.client.listCanvases(), ref);
      return new CanvasHandle(this.ctx, record);
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
}

/** The metadata half of `isocan set`, sized to what a script reaches for. */
export interface SetSpec {
  properties?: Record<string, string>;
  removeProperties?: string[];
  size?: { width: number; height: number };
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

  private snapshot(): Promise<CanvasSnapshotResponse> {
    return this.reach(() => this.ctx.client.snapshot(this.id));
  }

  /** Every network act on this handle throws `ApiError` — see {@link reaching}. */
  private reach<T>(work: () => Promise<T>): Promise<T> {
    return reaching(this.ctx.client.base, work);
  }

  /** Every live item, each carrying its derived kind — `--json ls`. */
  async items(): Promise<ListedItem[]> {
    const { canvas } = await this.snapshot();
    return Object.values(canvas.items).map((item) => ({ ...item, kind: itemKind(item) }));
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
    const { canvas } = await this.snapshot();
    const known = new Map<string, KnownName>();
    const add = (name: string, id: string, live: boolean) => {
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
      const data = typeof spec.content === "string" ? Buffer.from(spec.content) : spec.content;
      const filename = spec.filename ?? defaultFilename(spec.title, spec.mime);
      const upload = await this.ctx.client.uploadBlob(this.id, data, spec.mime, filename);
      const itemId = newItemId();
      const { width, height } = spec.size ?? DEFAULT_SIZE;
      const placement = spec.at ?? (await this.defaultPlacement());
      await this.ctx.client.sendOp(this.id, this.ctx.actor, {
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
        ...(spec.title !== undefined ? { title: spec.title } : {}),
        ...(spec.description !== undefined ? { description: spec.description } : {}),
        ...(spec.properties && Object.keys(spec.properties).length > 0
          ? { properties: spec.properties }
          : {}),
      });
      return this.item(itemId);
    });
  }

  /** The CLI's default: left of the leftmost item, origin on an empty canvas. */
  private async defaultPlacement(): Promise<
    { x: number; y: number } | { anchorItemId: string }
  > {
    const { canvas } = await this.snapshot();
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
      const before = await this.item(itemId);
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
      });
      return this.item(itemId);
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
      if (Object.keys(meta).length > 0) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "item.update",
          itemId,
          patch: meta,
        });
        did = true;
      }
      if (patch.size) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "item.resize",
          itemId,
          width: patch.size.width,
          height: patch.size.height,
        });
        did = true;
      }
    });
    if (!did) throw new Error("nothing to change");
  }

  /** Move an item — and what is drawn on it travels with it, the same rule
   * the CLI's `mv` and the web app's drag follow. */
  async move(itemId: string, x: number, y: number): Promise<void> {
    await this.reach(async () => {
      const { canvas } = await this.snapshot();
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
      );
    });
  }

  /**
   * Say something in the Chat — `isocan notify`'s act: the main thread gets
   * the reply, or is born from the first message, with `@Name` mentions and
   * `#Title` references resolved the way every comment resolves them.
   */
  async notify(message: string): Promise<{ threadId: string; commentId: string }> {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message);
      const main = mainThread(snapshot.canvas);
      if (main) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "thread.reply",
          threadId: main.id,
          comment,
        });
        return { threadId: main.id, commentId: comment.id };
      }
      const threadId = newThreadId();
      await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: null,
        main: true,
        comment,
      });
      return { threadId, commentId: comment.id };
    });
  }

  private newComment(snapshot: CanvasSnapshotResponse, body: string): Promise<NewComment> {
    return buildComment(this.ctx.client, this.id, snapshot, body);
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
): Promise<NewComment> {
  // What the canvas remembers, plus what everyone goes by NOW — otherwise
  // "@Di" resolves to nobody the moment Dion 2 renames, and the summons that
  // was meant for her is a comment nobody wakes for.
  const candidates: MentionCandidate[] = actorsAnswerTo(
    collectCanvasActors(snapshot.canvas),
    snapshot.names,
  );
  const sessions = await client.listSessions(canvasId).catch(() => []);
  for (const session of sessions) {
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
  }
  const mentions = extractMentions(body, candidates);
  const items = extractItemRefs(body, collectItemRefCandidates(snapshot.canvas));
  return {
    id: newCommentId(),
    body,
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}

/** "Build" + text/html → "build.html"; nameless content is filed by mime. */
function defaultFilename(title: string | undefined, mime: string): string {
  const fallback = `content.${extensionFor("", mime)}`;
  return title ? filenameFromTitle(title, fallback) : fallback;
}
