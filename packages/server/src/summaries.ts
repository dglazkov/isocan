import { promises as fs } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { atLeast } from "@isocan/core";
import { ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import type { CanvasContents, Item } from "@isocan/core";
import {
  checkSummary, semanticZoomPrompt, SEMANTIC_ZOOM_PROMPT_VERSION, summarisableText, summariesRoute, summaryKey, summaryMemberKind, summaryMembers, summaryReadsWords, summaryStatsRoute,
  SUMMARY_BAD_ANSWER, SUMMARY_EXCLUDED, SUMMARY_MIN_WORDS, SUMMARY_MODEL, SUMMARY_NO_SOURCE, SUMMARY_OVER_BUDGET, SUMMARY_QUIET, SUMMARY_QUIET_MS, SUMMARY_SCHEMA, SUMMARY_SYSTEM,
  textSummaryKey, wordCount, type SummaryEntry, type SummaryMake, type SummaryMember, type SummaryRead, type SummaryStats,
} from "@isocan/core/semantic-zoom";
import { TEXT_MAX_BYTES, TEXT_RATE_LIMITED, TEXT_UNAVAILABLE } from "@isocan/core/text";
import type { Engine } from "./engine.ts";
import { capabilityIn, type ViewOnlyError } from "./grants.ts";
import type { HomeLinks } from "./home-links.ts";
import type { Store } from "./store.ts";
import { SummaryLedger } from "./summary-ledger.ts";
import { RefusedError, TakenDownError, type Refusals } from "./takedowns.ts";
import type { TextModel } from "./text.ts";

/**
 * **Semantic Zoom's summaries, at the home** (`docs/projects/semantic-zoom/`,
 * design §5 and §6; text nodes since phase 1, groups and areas since phase 2).
 *
 * A summary is derived, regenerable and nobody's act, so it is not an op: it
 * lives in a cache beside the snapshots, `<home>/summaries/<canvasId>/<key>.json`,
 * and never in undo, the timeline, the oplog or a replica's history. Two
 * routes:
 *
 * - `GET  /api/projects/:id/summaries?keys=…&for=…` — the cached entries for
 *   the keys asked about. View is enough: a summary says nothing a viewer
 *   could not read by zooming in. With `for` (the source ids, in the keys'
 *   order), a key with no entry is answered with the newest entry for that
 *   source, marked `stale` — the old summary keeps showing while the new
 *   content waits to be summarised.
 * - `POST /api/projects/:id/summaries` `{ kind, sourceId }` — make one. The
 *   home, not the client, collects the content and builds the prompt, so a
 *   client cannot ask about what it cannot see or slip excluded words in. It
 *   then passes `/api/text`'s guards in-process — edit capability, owner-only
 *   spend unless shared, the badge's rate, the size — and asks the text model
 *   with its own system line and its own model (the cheap tier), so what
 *   `/api/text`'s callers get is unchanged. A group or an area is collected
 *   here too (`summaryMembers`): a client names the container, never its
 *   members, and over the size bound the longest members' words are left
 *   out first, their titles kept, and the prompt says so.
 *
 * A source changed in the last 30 s is not summarised yet (202,
 * `summary-quiet`, with how long to wait); one make per key is in flight at a time, and a second
 * request for the same key waits for the first and spends nothing.
 *
 * Since phase 3, a canvas has a budget — 60 model calls an hour across
 * everyone, beyond the badge's rate; over it a make is a 429
 * (`summary-budget`) and nothing is asked, while reads keep answering, stale
 * included — and a cost record per day (`summary-ledger.ts`), read by the
 * canvas's editors at `GET …/summaries/stats`. The cache evicts what nobody
 * can reach before what nobody has read lately.
 */

/** How the summaries are configured: every field has a production default; the fields exist so a test can hold a clock and a small bound. */
export interface SummaryOptions {
  /** The quiet period. Default `ISOCAN_SUMMARY_QUIET_MS`, else `SUMMARY_QUIET_MS`. */
  quietMs?: number;
  /** The model. Default `ISOCAN_SUMMARY_MODEL`, else `SUMMARY_MODEL` for a Claude key and the text model's own default for any other. */
  model?: () => string | undefined;
  /** Entries kept per canvas before the least recently read is evicted. Default 2,000. */
  maxEntries?: number;
  /** Model calls per canvas per rolling hour, across everyone. Default `ISOCAN_SUMMARY_PER_HOUR`, else 60. */
  perHour?: number;
  now?: () => number;
}

const MAX_ENTRIES = 2_000;
/** A canvas's summaries an hour, across everyone (design §6). */
const PER_HOUR = 60;
/** The stats route's span: a month by default, a quarter at most (what the ledger keeps). */
const STATS_DAYS = 30;
const STATS_MAX_DAYS = 90;
/** At most this many keys in one read: a settled viewport asks about what is on screen, not the whole canvas. */
const MAX_KEYS = 200;
/** The words a prompt may carry, under `/api/text`'s request bound with room for the instruction. */
const MAX_SOURCE_BYTES = TEXT_MAX_BYTES - 4_096;
const KEY = /^[0-9a-f]{64}$/;

interface Indexed {
  kind: SummaryEntry["kind"];
  sourceIds: string[];
  madeAt: string;
  /** Last read or written, for least-recently-read eviction. */
  touched: number;
}

/**
 * The current key of each source still on the canvas (by its id): what a
 * reader would ask about now. A source gone, or now excluded, is absent.
 */
type Current = (canvasId: string, sources: Map<string, SummaryEntry["kind"]>) => Promise<Map<string, string>>;

/**
 * **The cache, one directory per canvas.** An in-memory index (key → kind,
 * source ids, when made, when last read) is loaded from the directory the
 * first time a canvas is touched, so a stale lookup by source and an eviction
 * need no scan; the files are the truth and survive a restart.
 */
class SummaryCache {
  /** The load promise, not the map, so two first touches at once share one index instead of each filling its own. */
  private readonly index = new Map<string, Promise<Map<string, Indexed>>>();

  constructor(private readonly root: string, private readonly max: number, private readonly now: () => number, private readonly current: Current) {}

  /** How many entries a canvas holds now. */
  async size(canvasId: string): Promise<number> {
    return (await this.load(canvasId)).size;
  }

  private dir(canvasId: string): string {
    return path.join(this.root, encodeURIComponent(canvasId));
  }

  private load(canvasId: string): Promise<Map<string, Indexed>> {
    let held = this.index.get(canvasId);
    if (!held) this.index.set(canvasId, (held = this.read(canvasId)));
    return held;
  }

  private async read(canvasId: string): Promise<Map<string, Indexed>> {
    const fresh = new Map<string, Indexed>();
    const names = await fs.readdir(this.dir(canvasId)).catch(() => [] as string[]);
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const full = path.join(this.dir(canvasId), name);
      const [entry, stat] = await Promise.all([this.file(full), fs.stat(full).catch(() => null)]);
      if (entry) fresh.set(entry.key, { kind: entry.kind, sourceIds: entry.sourceIds, madeAt: entry.madeAt, touched: stat?.mtimeMs ?? 0 });
    }
    return fresh;
  }

  private async file(full: string): Promise<SummaryEntry | null> {
    try {
      const entry = JSON.parse(await fs.readFile(full, "utf8")) as SummaryEntry;
      return entry && typeof entry.key === "string" && Array.isArray(entry.sourceIds) ? entry : null;
    } catch {
      return null;
    }
  }

  /** One entry by key, marked as read. */
  async get(canvasId: string, key: string): Promise<SummaryEntry | null> {
    const index = await this.load(canvasId);
    const row = index.get(key);
    if (!row) return null;
    const entry = await this.file(path.join(this.dir(canvasId), `${key}.json`));
    if (!entry) {
      index.delete(key);
      return null;
    }
    row.touched = this.now();
    return entry;
  }

  /**
   * The newest entry made for this source, whatever its key — what a reader
   * shows while the current content waits. The source is an entry's first
   * id: a note's own, a group's or an area's container (its members follow).
   */
  async newestFor(canvasId: string, sourceId: string): Promise<SummaryEntry | null> {
    const index = await this.load(canvasId);
    let best: [string, Indexed] | null = null;
    for (const row of index) {
      if (row[1].sourceIds[0] !== sourceId) continue;
      if (!best || row[1].madeAt > best[1].madeAt) best = row;
    }
    return best ? this.get(canvasId, best[0]) : null;
  }

  /**
   * Keep one, and beyond the bound evict (design §5): first what nobody can
   * reach, then the least recently read. An entry is reachable when its key
   * is its source's current key, or when it is the newest for a source whose
   * current key has no entry yet — the stale summary a reader is shown while
   * the new content waits. Everything else — an old version's, a source
   * deleted or now excluded, a container whose members moved on — is
   * unreachable, however recently somebody read it.
   */
  async put(canvasId: string, entry: SummaryEntry): Promise<void> {
    const index = await this.load(canvasId);
    await fs.mkdir(this.dir(canvasId), { recursive: true });
    const full = path.join(this.dir(canvasId), `${entry.key}.json`);
    const temp = `${full}.${process.pid}.${this.now()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(entry));
    await fs.rename(temp, full);
    index.set(entry.key, { kind: entry.kind, sourceIds: entry.sourceIds, madeAt: entry.madeAt, touched: this.now() });
    if (index.size <= this.max) return;
    const sources = new Map<string, SummaryEntry["kind"]>();
    const newest = new Map<string, [string, Indexed]>();
    for (const row of index) {
      const source = row[1].sourceIds[0]!;
      sources.set(source, row[1].kind);
      const best = newest.get(source);
      if (!best || row[1].madeAt > best[1].madeAt) newest.set(source, row);
    }
    const current = await this.current(canvasId, sources);
    const unreachable = (key: string, row: Indexed): boolean => {
      const source = row.sourceIds[0]!;
      const now = current.get(source);
      if (now === undefined) return true;
      return key !== now && (index.has(now) || newest.get(source)?.[0] !== key);
    };
    const ranked = [...index].map((row) => ({ row, gone: unreachable(...row) }));
    const oldest = ranked
      .sort((a, b) => Number(b.gone) - Number(a.gone) || a.row[1].touched - b.row[1].touched)
      .slice(0, index.size - this.max)
      .map(({ row }) => row);
    for (const [key] of oldest) {
      index.delete(key);
      await fs.rm(path.join(this.dir(canvasId), `${key}.json`), { force: true });
    }
  }
}

/** The words of a blob, up to `limit` bytes, and whether there were more. */
async function readWords(stream: Readable, limit: number): Promise<{ text: string; cut: boolean }> {
  const chunks: Buffer[] = [];
  let size = 0;
  let cut = false;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    if (size + buffer.length > limit) {
      chunks.push(buffer.subarray(0, limit - size));
      cut = true;
      stream.destroy();
      break;
    }
    chunks.push(buffer);
    size += buffer.length;
  }
  return { text: Buffer.concat(chunks).toString("utf8"), cut };
}

/** What `registerModelRoutes` hands over: its closures, its text model and its owner-only rule. */
interface SummaryRouteScope {
  engine: Engine;
  store: Store;
  homes: HomeLinks | null | undefined;
  refusals: Refusals;
  admit: (req: FastifyRequest, canvasId: string) => Promise<unknown>;
  viewOnly: (canvasId: string) => Promise<ViewOnlyError>;
  textModel: TextModel;
  /** Whose key pays: null when this badge may spend it, else the owner's name (`notTheOwners`). */
  notTheOwners: (req: FastifyRequest) => Promise<{ owner: string | null } | null>;
  /** This machine's person, for `madeFor` when the stored key paid. */
  keyOwner: () => Promise<string | null>;
  /** The home directory the cache lives under. */
  home: string;
  options: SummaryOptions;
}

type Made = { status: number; body: unknown };

/** The kinds a summary may be asked for. */
const KINDS: readonly string[] = ["text", "group", "area"];

/**
 * What one make needs, whatever it is of: the key, the sources the entry
 * names, when the content last changed (for the quiet period), and how to
 * collect the prompt — run only once nothing cached answers and the quiet
 * period has passed, so a cache hit reads no blob. `prompt: null` means
 * nothing to summarise.
 */
interface Plan {
  kind: SummaryEntry["kind"];
  key: string;
  sourceIds: string[];
  changedAt: number;
  collect: () => Promise<{ prompt: string | null } | Made>;
}

/** `GET` and `POST /api/projects/:id/summaries`, on `app`. */
export function registerSummaryRoutes(app: FastifyInstance, scope: SummaryRouteScope): void {
  const { engine, store, homes, refusals, admit, viewOnly, textModel, notTheOwners, keyOwner, options } = scope;
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  /** Each source's current key, from the canvas as it is now: what eviction keeps. */
  const current: Current = async (canvasId, sources) => {
    const { canvas } = await engine.getSnapshot(canvasId);
    const keys = new Map<string, string>();
    for (const [sourceId, kind] of sources) {
      if (kind === "text") {
        const item = summarisableText(canvas, sourceId);
        if (item && item !== "excluded") keys.set(sourceId, await textSummaryKey(item));
        continue;
      }
      const held = summaryMembers(canvas, kind, sourceId);
      if (held && held !== "excluded") keys.set(sourceId, await summaryKey(kind, [held.container, ...held.members]));
    }
    return keys;
  };
  const cache = new SummaryCache(path.join(scope.home, "summaries"), maxEntries, now, current);
  const perHour = () => options.perHour ?? (Number(process.env.ISOCAN_SUMMARY_PER_HOUR) || PER_HOUR);
  const ledger = new SummaryLedger(path.join(scope.home, "summaries"), perHour, now);
  const inFlight = new Map<string, Promise<Made>>();
  const quietMs = () => options.quietMs ?? (Number(process.env.ISOCAN_SUMMARY_QUIET_MS) || SUMMARY_QUIET_MS);
  const ask: Parameters<TextModel["write"]>[1] = {
    system: SUMMARY_SYSTEM,
    // Haiku has no server-side refusal fallback; asking for one would fail the cheap tier outright.
    fallbacks: false,
    model: (provider) => options.model?.() ?? (process.env.ISOCAN_SUMMARY_MODEL?.trim() || (provider === "anthropic" ? SUMMARY_MODEL : undefined)),
  };
  const route = summariesRoute(":id");

  /** A note's plan: its one item, quiet since its current version was made, and its words read only when a summary is to be made. */
  const textPlan = async (canvasId: string, canvas: CanvasContents, sourceId: string): Promise<Plan | Made> => {
    const item = summarisableText(canvas, sourceId);
    if (item === null) return { status: 404, body: { error: `there is no text node ${sourceId} on this canvas`, code: SUMMARY_NO_SOURCE } };
    if (item === "excluded") return { status: 422, body: { error: "this text is excluded from context, so it is never sent to a model", code: SUMMARY_EXCLUDED } };
    const version = item.versions.find((v) => v.id === item.currentVersionId);
    if (!version) return { status: 404, body: { error: `${item.id} has no current version`, code: SUMMARY_NO_SOURCE } };
    return {
      kind: "text", key: await textSummaryKey(item), sourceIds: [item.id], changedAt: Date.parse(version.createdAt),
      collect: async () => {
        const stream = await store.openBlob(canvasId, version.blobHash);
        if (!stream) return { status: 404, body: { error: `the words of ${item.id} are not at this home`, code: SUMMARY_NO_SOURCE } };
        const { text, cut } = await readWords(stream, MAX_SOURCE_BYTES);
        if (!cut && wordCount(text) <= SUMMARY_MIN_WORDS) return { prompt: null };
        return { prompt: semanticZoomPrompt({ kind: "text", title: item.title, body: cut ? `${text}\n(The note is longer; this is its opening.)` : text }) };
      },
    };
  };

  /**
   * A group's or an area's plan: the container and what it holds
   * (`summaryMembers`, excluded members already gone), keyed by all of them.
   * Quiet once nothing it holds — nor anything its last summary held, which
   * is how a card just dragged OUT of an area still counts — has changed in
   * the quiet period. A move is a change here, unlike for a note: it is how
   * an area's membership moves.
   */
  const containerPlan = async (canvasId: string, canvas: CanvasContents, kind: "group" | "area", sourceId: string): Promise<Plan | Made> => {
    const found = summaryMembers(canvas, kind, sourceId);
    if (found === null) return { status: 404, body: { error: `there is no ${kind} ${sourceId} on this canvas`, code: SUMMARY_NO_SOURCE } };
    if (found === "excluded") return { status: 422, body: { error: `this ${kind} is excluded from context, so it is never sent to a model`, code: SUMMARY_EXCLUDED } };
    const { container, members } = found;
    const before = await cache.newestFor(canvasId, container.id);
    const touched = [container, ...members, ...(before?.sourceIds ?? []).map((one) => canvas.items[one]).filter((one): one is Item => !!one)];
    return {
      kind, key: await summaryKey(kind, [container, ...members]), sourceIds: [container.id, ...members.map((m) => m.id)],
      changedAt: Math.max(...touched.map((one) => Date.parse(one.updatedAt) || 0)),
      collect: async () => {
        if (members.length === 0) return { prompt: null };
        // Titles always go; words go shortest first while they fit, so the longest are the ones given by title only.
        let room = MAX_SOURCE_BYTES - members.reduce((sum, m) => sum + Buffer.byteLength(m.title) + 32, 0);
        const words = new Map<string, string>();
        const read = await Promise.all(members.filter(summaryReadsWords).map(async (m) => {
          const version = m.versions.find((v) => v.id === m.currentVersionId);
          const stream = version ? await store.openBlob(canvasId, version.blobHash) : null;
          return { id: m.id, text: stream ? (await readWords(stream, MAX_SOURCE_BYTES)).text.trim() : "" };
        }));
        let left = 0;
        for (const one of read.sort((a, b) => Buffer.byteLength(a.text) - Buffer.byteLength(b.text) || (a.id < b.id ? -1 : 1))) {
          const size = Buffer.byteLength(one.text);
          if (size <= room) {
            words.set(one.id, one.text);
            room -= size;
          } else left++;
        }
        const shown = members.map((m): SummaryMember => {
          const body = words.get(m.id);
          return { kind: summaryMemberKind(m), title: m.title, ...(body ? { body } : {}) };
        });
        return { prompt: semanticZoomPrompt({ kind, title: container.title, members: shown, left }) };
      },
    };
  };

  app.get(route, async (req) => {
    const { id } = req.params as { id: string };
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest("GET", req.url);
    await engine.getSnapshot(id);
    const query = req.query as { keys?: string; for?: string };
    const keys = String(query.keys ?? "").split(",").filter((key) => KEY.test(key)).slice(0, MAX_KEYS);
    const sources = String(query.for ?? "").split(",");
    const summaries: SummaryRead["summaries"] = {};
    const hits = new Map<SummaryEntry["kind"], number>();
    let stale = 0;
    for (const [n, key] of keys.entries()) {
      const exact = await cache.get(id, key);
      if (exact) {
        summaries[key] = exact;
        if (!exact.short) hits.set(exact.kind, (hits.get(exact.kind) ?? 0) + 1);
        continue;
      }
      const sourceId = sources[n];
      const older = sourceId ? await cache.newestFor(id, sourceId) : null;
      if (older) {
        summaries[key] = { ...older, stale: true };
        stale++;
      }
    }
    for (const [kind, count] of hits) await ledger.record(id, { what: "hit", kind, count });
    if (stale) await ledger.record(id, { what: "stale", count: stale });
    return { summaries } satisfies SummaryRead;
  });

  /**
   * **`GET …/summaries/stats` — what this canvas's summaries cost.** The
   * canvas's editors only: a summary says nothing a viewer could not read by
   * zooming in, but its cost says what somebody's key spent, and on a public
   * canvas a viewer is anybody. Editors are the people who can cause a
   * summary, so they are the people who may see what causing one costs.
   * `?days=N` (default 30, at most 90). A canvas homed elsewhere is answered
   * by its home, which holds the record.
   */
  app.get(summaryStatsRoute(":id"), async (req) => {
    const { id } = req.params as { id: string };
    await admit(req, id);
    if (!atLeast(capabilityIn(req.badge!, id) ?? "edit", "edit")) throw await viewOnly(id);
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest("GET", req.url);
    await engine.getSnapshot(id);
    const asked = Math.floor(Number((req.query as { days?: string }).days));
    const span = Number.isFinite(asked) && asked > 0 ? Math.min(asked, STATS_MAX_DAYS) : STATS_DAYS;
    return (await ledger.stats(id, span, { held: await cache.size(id), max: maxEntries })) satisfies SummaryStats;
  });

  app.post(route, { bodyLimit: 4096 }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<SummaryMake> | null;
    if (!body || typeof body !== "object" || !KINDS.includes(body.kind as string) || typeof body.sourceId !== "string" || !body.sourceId) {
      return reply.status(400).send({ error: "a summary is asked for by `kind` (\"text\", \"group\" or \"area\") and `sourceId`", code: SUMMARY_NO_SOURCE });
    }
    const down = refusals.of(id);
    if (down) throw new TakenDownError(down);
    const refusedBadge = refusals.refusingAttestation(req.badge?.attestations ?? []);
    if (refusedBadge) throw new RefusedError(refusedBadge);
    await admit(req, id);
    if (!atLeast(capabilityIn(req.badge!, id) ?? "edit", "edit")) throw await viewOnly(id);
    // A canvas homed elsewhere is summarised there, with that home's key and cache.
    const home = homes?.for(id) ?? null;
    if (home) return home.personalRequest("POST", req.url, { kind: body.kind, sourceId: body.sourceId });

    const { canvas } = await engine.getSnapshot(id);
    const plan = body.kind === "text" ? await textPlan(id, canvas, body.sourceId) : await containerPlan(id, canvas, body.kind!, body.sourceId);
    if ("status" in plan) return reply.status(plan.status).send(plan.body);
    const { key } = plan;
    const cached = await cache.get(id, key);
    if (cached) {
      if (!cached.short) await ledger.record(id, { what: "hit", kind: cached.kind });
      return cached;
    }
    const quietFor = now() - plan.changedAt;
    if (quietFor < quietMs()) {
      const retryAfterMs = quietMs() - quietFor;
      // 202, not a refusal: the ask is right, only early. The reader keeps the old summary and asks again after `retryAfterMs`.
      return reply.status(202).send({ code: SUMMARY_QUIET, retryAfterMs, message: `this ${body.kind === "text" ? "text" : body.kind} changed moments ago — its summary waits for it to go quiet` });
    }
    const running = inFlight.get(key);
    if (running) {
      const made = await running;
      return reply.status(made.status).send(made.body);
    }
    const making = (async (): Promise<Made> => {
      const collected = await plan.collect();
      if ("status" in collected) return collected;
      const base = { key, kind: plan.kind, sourceIds: plan.sourceIds, promptVersion: SEMANTIC_ZOOM_PROMPT_VERSION, madeAt: new Date(now()).toISOString() };
      if (collected.prompt === null) {
        // Nothing to summarise: a short note's opening words are most of it, an empty group is its title. Remembered, so nobody asks again; no model, no key.
        const entry: SummaryEntry = { ...base, summary: null, short: true, words: 0, model: null, madeFor: null };
        await cache.put(id, entry);
        return { status: 200, body: entry };
      }
      const source = textModel.keySource();
      const refused = source === "file" ? await notTheOwners(req) : null;
      if (refused) return { status: 403, body: { error: ownerOnlySentence(refused.owner), code: TEXT_OWNER_ONLY } };
      if (!source) return { status: 503, body: { error: "this home has no text model — summaries can't be made here", code: TEXT_UNAVAILABLE } };
      // The canvas's hour before the badge's minute, so a refusal for the canvas spends none of the badge's rate.
      const retryAfterMs = ledger.overBudget(id);
      if (retryAfterMs > 0) {
        await ledger.record(id, { what: "over-budget" });
        return { status: 429, body: { error: `this canvas has made its ${perHour()} summaries for the hour — the ones it has keep showing`, code: SUMMARY_OVER_BUDGET, retryAfterMs } };
      }
      if (!textModel.take(req.badge!.badgeId)) return { status: 429, body: { error: "this badge has asked for enough words this minute — wait a moment", code: TEXT_RATE_LIMITED } };
      ledger.spend(id);
      const written = await textModel.write({ prompt: collected.prompt, schema: SUMMARY_SCHEMA }, ask);
      const called = (kept: boolean, model: string) => ledger.record(id, { what: "call", kind: plan.kind, model, kept, ...(written.usage ? { tokens: written.usage } : {}) });
      if (written.status !== 200) {
        await called(false, written.model ?? "unknown");
        return written;
      }
      const { model, value } = written.body as { model: string; value: { summary?: unknown } | null };
      const summary = typeof value?.summary === "string" ? value.summary.trim() : value?.summary;
      const reasons = checkSummary(summary);
      await called(reasons.length === 0, model);
      if (reasons.length > 0) return { status: 502, body: { error: `the summary broke the answer rule (${reasons.join(", ")}) and was not kept`, code: SUMMARY_BAD_ANSWER } };
      const entry: SummaryEntry = { ...base, summary: summary as string, words: wordCount(summary as string), model, madeFor: source === "file" ? await keyOwner() : "home" };
      await cache.put(id, entry);
      return { status: 200, body: entry };
    })();
    inFlight.set(key, making);
    try {
      const made = await making;
      return reply.status(made.status).send(made.body);
    } finally {
      inFlight.delete(key);
    }
  });
}
