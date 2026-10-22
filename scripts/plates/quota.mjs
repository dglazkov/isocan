// What plates's GitHub reads cost the owner, and how plates stops spending it
// (docs: the 2026-10-08 outage, when the owner's GraphQL allowance, 5000
// points an hour shared by every tool on their login, ran out twice in
// minutes and took their apps down with it).
//
//   quotaFloor(env)          QUOTA_FLOOR (1000), or PLATES_QUOTA_FLOOR
//   quotaNow(env, { known }) what is left: the newest rateLimit a plates query
//                            saw (`known`), else the last remembered (github/
//                            quota.json) when it settles it, else a probe of
//                            GraphQL's rateLimit (charged nothing); null when gh
//                            cannot say
//   quotaGuard(env, spend)   null when an optional read may go ahead, else
//                            "saving your GitHub quota (N left until HH:MM)":
//                            the board's reviews, loose-ends' reviews and the
//                            fleet's PR reads return n/a with it, never asking
//   quotaWarning(spend, env) plates review (an explicit request) still reads, and
//                            says so when it read under the floor
//   cachedRead(env, key, fn, { fresh, ttl })  a GitHub read kept GH_TTL (10
//                            minutes) in plates's cache ($PLATES_CACHE, else
//                            $XDG_CACHE_HOME/plates, else ~/.cache/plates; then
//                            github/<key>.json): the board's 60 s refresh
//                            never re-reads inside it; its Refresh button and
//                            --fresh do. A failed read is never kept.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { repoReviewArgs, prReviewArgs, readRepoReviews, unansweredPrs, graphqlData } from './lib.mjs';

export const QUOTA_FLOOR = 1000;
export const GH_TTL = 10 * 60_000;

/** The floor under which optional reads stop: PLATES_QUOTA_FLOOR (tests), else QUOTA_FLOOR. */
export function quotaFloor(env = process.env) {
  const raw = env.PLATES_QUOTA_FLOOR;
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 ? n : QUOTA_FLOOR;
}

/** plates's cache: $PLATES_CACHE, else $XDG_CACHE_HOME/plates, else ~/.cache/plates (every platform, macOS too). */
export const cacheDir = env => env.PLATES_CACHE || join(env.XDG_CACHE_HOME || join(env.HOME || homedir(), '.cache'), 'plates');

const exec = (cmd, args, env, timeout = 10_000) => new Promise(done => {
  execFile(cmd, args, { env, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) =>
    done(error ? { ok: false, why: String(stderr || error.message).trim().split('\n').filter(Boolean).pop() ?? 'failed' } : { ok: true, stdout }));
});

/** HH:MM, local time, of an ISO instant (or '?'). */
export const clock = iso => {
  const d = new Date(iso ?? NaN);
  return Number.isNaN(d.getTime()) ? '?' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// One probe at a time per process: a board's twelve repos ask once.
let probe = null;
export const PROBE_MS = 60_000;
const quotaFile = env => join(cacheDir(env), 'github', 'quota.json');

/** Keep what a read or probe said was left, so the next run (the board's next refresh) need not ask. */
export async function rememberQuota(env, q, now = Date.now()) {
  if (!Number.isFinite(q?.remaining)) return;
  try {
    await mkdir(join(cacheDir(env), 'github'), { recursive: true });
    const path = quotaFile(env);
    await writeFile(`${path}.${process.pid}.tmp`, JSON.stringify({ remaining: q.remaining, resetAt: q.resetAt ?? null, at: new Date(now).toISOString() }));
    await rename(`${path}.${process.pid}.tmp`, path);
  } catch { /* only slower */ }
}
/** What was last known to be left (rememberQuota), or null. */
export async function lastQuota(env) {
  try { const q = JSON.parse(await readFile(quotaFile(env), 'utf8')); return Number.isFinite(q?.remaining) ? q : null; } catch { return null; }
}

/** The probe: GraphQL's own rateLimit, the number that governs (it answers even at 0, and was charged nothing on 2026-10-08); a query refused for the limit is 0 left. */
export const PROBE_QUERY = 'query { rateLimit { remaining resetAt } }';
async function probeQuota(env) {
  const r = await exec(env.PLATES_GH || 'gh', ['api', 'graphql', '-f', `query=${PROBE_QUERY}`], env);
  if (!r.ok) return /rate limit/i.test(r.why) ? { remaining: 0, resetAt: null, from: 'GitHub refused a query for the limit' } : null;
  try {
    const rl = JSON.parse(r.stdout)?.data?.rateLimit;
    return Number.isFinite(rl?.remaining) ? { remaining: rl.remaining, resetAt: rl.resetAt ?? null, from: 'a rateLimit probe' } : null;
  } catch { return null; }
}

/**
 * What is left of the GraphQL allowance: { remaining, resetAt, from } or null
 * when gh cannot say. In order: `known` (this run's tally, lib.mjs rateSpend)
 * once it has seen a query and its hour has not reset; the last remembered
 * when it is under the floor (others' spending only lowers it) or under a
 * minute old; else a probe (GraphQL's rateLimit, charged nothing; not REST's
 * rate_limit, whose graphql count disagreed with GraphQL's on 2026-10-08).
 */
export async function quotaNow(env = process.env, { known, now = Date.now() } = {}) {
  const live = t => !t || Date.parse(t) > now;
  if (Number.isFinite(known?.remaining) && known.queries !== 0 && live(known.resetAt)) return { remaining: known.remaining, resetAt: known.resetAt, from: 'this run\'s reads' };
  const last = await lastQuota(env);
  if (last && live(last.resetAt) && last.resetAt && (last.remaining < quotaFloor(env) || now - Date.parse(last.at) < PROBE_MS)) return { remaining: last.remaining, resetAt: last.resetAt, from: 'the last read' };
  if (probe && probe.env === env && now - probe.at < PROBE_MS) return probe.result;
  const result = probeQuota(env).then(async q => { if (q) await rememberQuota(env, q, now); return q; });
  probe = { env, at: now, result };
  return result;
}

/** The words for a read skipped under the floor. */
export const savingWords = q => `saving your GitHub quota (${q.remaining} left${q.resetAt ? ` until ${clock(q.resetAt)}` : '; it resets within the hour'})`;

/**
 * Whether an optional read may go ahead: null, or the reason it may not
 * ("saving your GitHub quota (N left until HH:MM)"). Unknown (gh cannot say)
 * goes ahead: the read itself says what it cost.
 */
export async function quotaGuard(env = process.env, spend) {
  const q = await quotaNow(env, { known: spend });
  if (q && Number.isFinite(q.remaining) && q.remaining < quotaFloor(env)) return savingWords(q);
  return null;
}

/** plates review reads anyway (it was asked for); under the floor it says so. */
export function quotaWarning(spend, env = process.env) {
  if (!Number.isFinite(spend?.remaining) || spend.remaining >= quotaFloor(env)) return null;
  return `your GitHub quota is low: ${spend.remaining} left until ${clock(spend.resetAt)} (plates's own optional reads stop under ${quotaFloor(env)})`;
}

const keyFile = (env, key) => join(cacheDir(env), 'github', `${String(key).replace(/[^\w.-]+/g, '__')}.json`);

/**
 * A GitHub read through the cache: { value, at, cached }. Inside `ttl` the
 * kept value is returned and fn never runs; `fresh` reads anyway. Only a read
 * that succeeded is kept (fn throwing passes through, nothing written).
 */
export async function cachedRead(env, key, fn, { fresh = false, ttl = GH_TTL, now = Date.now() } = {}) {
  const path = keyFile(env, key);
  if (!fresh) {
    try {
      const kept = JSON.parse(await readFile(path, 'utf8'));
      const at = Date.parse(kept?.at ?? '');
      if (Number.isFinite(at) && now - at < ttl && now >= at && 'value' in kept) return { value: kept.value, at: kept.at, cached: true };
    } catch { /* nothing kept, or unreadable: read */ }
  }
  const value = await fn();
  const at = new Date(now).toISOString();
  try {
    await mkdir(join(cacheDir(env), 'github'), { recursive: true });
    await writeFile(`${path}.${process.pid}.tmp`, JSON.stringify({ at, value }));
    await rename(`${path}.${process.pid}.tmp`, path);
  } catch { /* a cache that cannot be written is only slower */ }
  return { value, at, cached: false };
}

/** Thrown when a read was skipped to save the owner's quota: its message says so, with what is left. */
export class Saving extends Error { constructor(message) { super(message); this.saving = true; } }

// Optional reads sharing quota must check it after the previous read publishes
// its charge. Key by the shared store, not an env object's identity. A rejected
// read releases its successor too; unrelated stores do not wait on one another.
const readQueues = new Map();
async function orderedRead(env, read) {
  const key = resolve(cacheDir(env));
  const result = (readQueues.get(key) ?? Promise.resolve()).then(read);
  const tail = result.then(() => {}, () => {});
  readQueues.set(key, tail);
  try { return await result; }
  finally { if (readQueues.get(key) === tail) readQueues.delete(key); }
}

/**
 * A GitHub read the board and loose-ends share: kept GH_TTL in plates's cache
 * (cachedRead), read again only when older or `fresh`; when it must be read
 * and `guard` (quotaGuard, for an optional read) gives a reason, nothing is
 * asked and Saving is thrown. { value, at, cached }.
 */
export async function githubRead(env, key, fn, { fresh = false, guard, now } = {}) {
  const read = () => cachedRead(env, key, async () => {
    const why = guard ? await guard() : null;
    if (why) throw new Saving(why);
    return fn();
  }, { fresh, now });
  // Keep cache lookup inside the ordering too: concurrent reads of the same
  // key can reuse the first result without another guard or query.
  return guard ? orderedRead(env, read) : read();
}

/**
 * The night's repo-wide review read of one repo, live (lib.mjs
 * readRepoReviews, a PR the window does not cover read alone): its PRs with
 * comments unanswered a day or more (unansweredPrs), each query's rateLimit
 * in `spend`.
 */
export const readRepoUnanswered = async (x, opts) => (await readRepoReviewState(x, opts)).prs;

/**
 * The same one read, with what the board also shows (phase 71): { prs,
 * rounds }, `rounds` each open PR with a review round or more (its count and
 * open findings). plates loose-ends and the board keep it under one cache key.
 */
export async function readRepoReviewState({ repo, reviewers = [] }, { env = process.env, today, spend, timeout = 15_000 } = {}) {
  const graphql = async args => {
    const r = await exec(env.PLATES_GH || 'gh', args, env, timeout);
    if (!r.ok) throw new Error(r.why);
    return graphqlData(r.stdout, spend);
  };
  const read = async vars => (await graphql(repoReviewArgs(repo, vars)))?.repository;
  const readPr = async number => (await graphql(prReviewArgs(repo, number)))?.repository?.pullRequest;
  const { prs, rounds } = unansweredPrs(await readRepoReviews(read, today, { readPr, reviewers }), reviewers, today);
  return { prs, rounds };
}

/**
 * What is left, for showing (never a probe): this run's reads when they said
 * (and remembered for the next run), else the last remembered, else null.
 */
export async function quotaShown(env, spend) {
  if (spend?.queries && Number.isFinite(spend.remaining)) { await rememberQuota(env, spend); return { remaining: spend.remaining, resetAt: spend.resetAt }; }
  const last = await lastQuota(env);
  return last && (!last.resetAt || Date.parse(last.resetAt) > Date.now()) ? last : null;
}

/** The GitHub report a board or loose-ends gives: { readAt (the oldest kept read shown), cost, queries, remaining, resetAt }. */
export function githubReport(spend, { oldest = null, quota = null } = {}) {
  return { readAt: oldest, cost: spend.cost, queries: spend.queries, remaining: quota?.remaining ?? spend.remaining, resetAt: quota?.resetAt ?? spend.resetAt };
}
