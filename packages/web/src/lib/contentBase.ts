import { useEffect, useState } from "react";
import { SIGN_BLOBS_LIMIT } from "@isocan/core";
import { getServing, signedBlobs } from "./api.ts";
import type { ContentOrigin } from "./frame.ts";
import { activateRuntimeModules } from "./runtimeModules.ts";
import { loadExperiments } from "../modules.ts";

/**
 * The content origin's base URL, as this tab knows it — the app half of
 * stages 1–2 of `docs/projects/atlas/content-origin-plan.md`, and from stage
 * 4b whether reads there have to be signed.
 *
 * `loadContentBase` asks `GET /api/serving` once, at boot, beside the color
 * and name loads — and the daemon advertises only an origin it actually
 * answers for. On a home with no content origin, and whenever the fetch fails
 * (an older daemon, a tab with no badge yet), the answer is null, and null
 * means exactly today's behavior: frames on the app origin, `allow-scripts`
 * alone. The fallback IS the current behavior, which is what makes every
 * stage of the plan stable on both shapes.
 *
 * A plain module variable rather than a store: the fetch resolves in the
 * time it takes the app to open a socket and load a snapshot, so every frame
 * that can render an item was mounted after the answer arrived. A frame from
 * the losing side of that race renders on the app origin — today's frame —
 * and corrects itself on its next mount.
 */

let base: string | null = null;
/** Whether reads on that base must carry a signature (stage 4b). Only ever
 * true alongside a base, and false is the safe reading: a tab that asks for
 * no signature on an origin that wants one sees an item that does not
 * render, never somebody else's canvas. */
let signed = false;

export function contentBase(): string | null {
  return base;
}

export function adoptContentBase(next: string | null, wantsSignature = false): void {
  base = next;
  signed = next !== null && wantsSignature;
  // A base change invalidates every signature this tab holds.
  if (next === null) tickets.clear();
}

export async function loadContentBase(): Promise<void> {
  try {
    const serving = await getServing();
    adoptContentBase(serving.contentBase ?? null, serving.contentSigned === true);
    // The same answer names the home's runtime modules (modules phase 3);
    // one fetch, two facts, and the modules arrive after first paint.
    void activateRuntimeModules(serving.modules ?? []);
    // And the experiments this browser already had on, from the same beat.
    void loadExperiments();
  } catch {
    adoptContentBase(null);
  }
}

// ---- the tickets (stage 4b) ----
//
// `docs/projects/multiuser/content-read-auth.md`, option A: on a home whose
// content origin serves strangers, a frame's URL carries a signature the
// badged app origin minted over `(canvasId, hash, expiry)`. This is the tab's
// half — ask for them in batches, hand them out while they work, and answer
// synchronously so `itemFrame` stays the one place that decides a frame's src
// and sandbox TOGETHER (invariant 2).

interface Ticket {
  /** The signed path, origin-less: `itemFrame` joins it to the base. */
  path: string;
  /**
   * When this tab should stop using it, on THIS tab's clock.
   *
   * Derived from the answer's `ttlSeconds` at the moment it arrived, never
   * from its `expiresAt` — the home's clock is what will judge the signature,
   * and a tab whose own clock runs slow would otherwise hand a frame a URL
   * the home has already buried. That failure is a blank screen with nothing
   * left to re-render it, so it is worth measuring from receipt instead.
   */
  goodUntil: number;
}

const tickets = new Map<string, Ticket>();
/** Hashes whose mint is in flight, so a canvas of forty screens rendering at
 * once asks for each exactly once. */
const inFlight = new Set<string>();
/** Every mounted frame that is waiting for a ticket, so one arriving batch
 * re-renders all of them and nothing polls. */
const waiting = new Set<() => void>();

const cell = (canvasId: string, blobHash: string) => `${canvasId}/${blobHash}`;

/**
 * How close to death a ticket may be and still be worth handing to a frame
 * that is ABOUT TO LOAD. Inside this margin it is re-minted; it is still
 * served meanwhile — see `usable` below for why those are different questions.
 */
const RENEW_MARGIN_SECONDS = 30;

/**
 * **Two questions, not one — and conflating them blanked every screen on the
 * canvas** (6 Sep 2026, found within an hour of the hosted flip).
 *
 * `usable` is "would this URL still be served": the home refuses at `exp`, so
 * anything before that works. `fresh` is "is it worth giving to a frame that
 * is about to load": inside the renewal margin it is not, because a frame
 * that starts loading at T+0 with a URL dying at T+2 is a broken screen for
 * no reason.
 *
 * The first version had only `fresh`, and `ticket()` used it. So four and a
 * half minutes after a canvas loaded, every mounted frame's ticket fell
 * inside the margin, `itemFrame` answered null, and every screen went white
 * and STAYED white — the effect that would have re-minted has `[canvasId,
 * key]` for deps and those had not changed, so nothing asked again until the
 * person clicked an item and remounted it. Which is exactly what was
 * reported.
 */
function usable(entry: Ticket | undefined): entry is Ticket {
  return entry !== undefined && entry.goodUntil > Date.now() / 1000;
}

function fresh(entry: Ticket | undefined): entry is Ticket {
  return entry !== undefined && entry.goodUntil - Date.now() / 1000 > RENEW_MARGIN_SECONDS;
}

/**
 * How a mint that did not answer is retried, and why it is bounded.
 *
 * The mint is a fetch, and a fetch fails — a dropped connection, a home
 * restarting, a badge being re-knocked. Nothing else would ask again: the
 * frames waiting on it are mounted and their effect has already run.
 *
 * Bounded rather than persistent because the other failure — a home that has
 * gone away — must not turn into a tab quietly retrying forever. Three tries
 * over about eight seconds, and then the next mount asks afresh.
 */
const RETRY_DELAYS_MS = [1500, 6000];

/**
 * **What this tab knows about the content origin right now** — the value
 * `itemFrame` takes, built here so that the ticket lookup is synchronous at
 * render time and asynchronous everywhere else.
 */
export function contentOrigin(): ContentOrigin | null {
  if (base === null) return null;
  if (!signed) return { base, ticket: null };
  return {
    base,
    ticket: (canvasId, blobHash) => {
      // `usable`, deliberately: a ticket inside the renewal margin still
      // works, and handing it over beats blanking the frame while a fresher
      // one is on its way. Null means "none at all", which is the only case
      // where there is nothing honest to render.
      const entry = tickets.get(cell(canvasId, blobHash));
      return usable(entry) ? entry.path : null;
    },
  };
}

// ---- one call per tick, not one per screen ----
//
// **Every item on the canvas is its own component asking for its own hash.**
// `ItemView` renders an `HtmlItemView` per screen and `DeckPrint` a
// `DeckSlide` per slide, so a canvas of forty screens made forty calls to
// `ensureTickets`, each with one hash, each its own round trip. The decision
// doc's argument for a five-minute TTL was that the mint is "one batched call
// per canvas visit" — true of the route, false of the caller, and this is
// what makes it true of both.
//
// Sibling effects run in one commit, so a microtask scheduled by the first
// runs after the last has registered: collecting there turns N calls into
// one, with no timer and no debounce interval to tune.

const pendingHashes = new Map<string, Set<string>>();
let flushing: Promise<void> | null = null;

/**
 * Mint whatever these hashes are missing, batched with everything else asked
 * for in the same tick.
 *
 * Silent on failure, and that is the right noise: a canvas whose items are
 * fine must not grow an error banner because one credential fetch blipped.
 * It retries a bounded number of times and then stops; the frames that never
 * got one stay blank until something mounts them again, which is honest about
 * a home that has gone away.
 */
export function ensureTickets(canvasId: string, hashes: readonly string[]): Promise<void> {
  if (base === null || !signed) return Promise.resolve();
  const want = [
    ...new Set(
      hashes.filter((hash) => {
        const key = cell(canvasId, hash);
        return !fresh(tickets.get(key)) && !inFlight.has(key);
      }),
    ),
  ];
  if (want.length === 0) return flushing ?? Promise.resolve();

  const set = pendingHashes.get(canvasId) ?? new Set<string>();
  for (const hash of want) set.add(hash);
  pendingHashes.set(canvasId, set);

  flushing ??= new Promise<void>((resolve) => {
    queueMicrotask(() => {
      const batch = [...pendingHashes.entries()];
      pendingHashes.clear();
      flushing = null;
      void Promise.all(batch.map(([id, want]) => mint(id, [...want]))).then(() => resolve());
    });
  });
  return flushing;
}

async function mint(canvasId: string, hashes: string[], attempt = 0): Promise<void> {
  if (hashes.length === 0) return;
  for (const hash of hashes) inFlight.add(cell(canvasId, hash));
  let failed = false;
  try {
    // The home refuses more than `SIGN_BLOBS_LIMIT` at once — a URL nothing
    // between here and it would forward is not a service to anybody — so a
    // big canvas is a handful of calls rather than one impossible one.
    for (let i = 0; i < hashes.length; i += SIGN_BLOBS_LIMIT) {
      const chunk = hashes.slice(i, i + SIGN_BLOBS_LIMIT);
      const answer = await signedBlobs(canvasId, chunk);
      const goodUntil = Date.now() / 1000 + answer.ttlSeconds;
      for (const [hash, path] of Object.entries(answer.urls)) {
        tickets.set(cell(canvasId, hash), { path, goodUntil });
      }
    }
  } catch {
    failed = true;
  } finally {
    for (const hash of hashes) inFlight.delete(cell(canvasId, hash));
    for (const wake of [...waiting]) wake();
  }
  const delay = failed ? RETRY_DELAYS_MS[attempt] : undefined;
  if (delay !== undefined) {
    setTimeout(() => void mint(canvasId, hashes, attempt + 1), delay);
  }
}

/**
 * **The content origin, with these hashes' tickets minted** — what a component
 * about to render a frame asks for.
 *
 * On every home but a signing one this is a plain synchronous read and there
 * is no effect worth the name. On a signing home the first render has no
 * ticket, `itemFrame` answers null, the mint lands and this re-renders — one
 * blank beat on a cold canvas, none afterwards.
 *
 * **There is deliberately NO renewal timer here**, and the first version's
 * was removed rather than fixed. Two reasons, and the second is the one that
 * matters. Browsers throttle and eventually freeze timers in a background
 * tab, so it fired late — typically at the moment somebody came back to the
 * tab, which is the worst possible time. And with `useFrameSrc` freezing a
 * loaded frame's src (see `frame.ts`), renewal buys a mounted frame nothing:
 * the signature gates the initial GET, the content CSP allows no remote
 * subresources, and a loaded document never asks that origin for anything
 * again. A frame that mounts late mints on mount, which is one round trip in
 * the only case that needs one.
 */
export function useContentOrigin(canvasId: string, hashes: readonly string[]): ContentOrigin | null {
  const [, bump] = useState(0);
  const key = hashes.join(",");
  useEffect(() => {
    if (base === null || !signed) return;
    const wake = () => bump((n) => n + 1);
    waiting.add(wake);
    void ensureTickets(canvasId, key.length > 0 ? key.split(",") : []);
    return () => {
      waiting.delete(wake);
    };
    // `key` rather than the array: a caller that rebuilds the list on every
    // render must not re-run this on every render.
  }, [canvasId, key]);
  return contentOrigin();
}
