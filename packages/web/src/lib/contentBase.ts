import { useEffect, useState } from "react";
import { SIGN_BLOBS_LIMIT } from "@isocan/core";
import { getServing, signedBlobs } from "./api.ts";
import type { ContentOrigin } from "./frame.ts";
import { activateRuntimeModules } from "./runtimeModules.ts";

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
  if (next === null) tickets.clear();
}

export async function loadContentBase(): Promise<void> {
  try {
    const serving = await getServing();
    adoptContentBase(serving.contentBase ?? null, serving.contentSigned === true);
    // The same answer names the home's runtime modules (modules phase 3);
    // one fetch, two facts, and the modules arrive after first paint.
    void activateRuntimeModules(serving.modules ?? []);
  } catch {
    adoptContentBase(null);
  }
}

// ---- the tickets (stage 4b) ----
//
// `docs/projects/multiuser/content-read-auth.md`, option A: on a home whose
// content origin serves strangers, a frame's URL carries a signature the
// badged app origin minted over `(canvasId, hash, expiry)`. This is the tab's
// half — ask for them in batches, hold them until they are nearly dead, and
// answer synchronously so `itemFrame` stays the one place that decides a
// frame's src and sandbox TOGETHER (invariant 2).

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
 * How close to death a ticket may be and still be handed to a frame.
 *
 * A frame that loads at T+0 with a URL dying at T+2s is a broken screen for
 * no reason, so a ticket inside this margin is treated as absent and
 * re-minted. It also means a tab left open across a TTL boundary re-mints on
 * the next render rather than serving one dead URL first.
 */
const RENEW_MARGIN_SECONDS = 30;

function live(entry: Ticket | undefined): entry is Ticket {
  return entry !== undefined && entry.goodUntil - Date.now() / 1000 > RENEW_MARGIN_SECONDS;
}

/**
 * How a mint that did not answer is retried, and why it is bounded.
 *
 * The mint is a fetch, and a fetch fails — a dropped connection, a home
 * restarting, a badge being re-knocked. Nothing else would ask again: the
 * frames waiting on it are mounted and their effect has already run, so
 * without a timer here a single blip leaves a canvas of blank cards until
 * something unrelated re-renders it.
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
      const entry = tickets.get(cell(canvasId, blobHash));
      return live(entry) ? entry.path : null;
    },
  };
}

/**
 * Mint whatever these hashes are missing, in as few round trips as the home
 * allows.
 *
 * Silent on failure, and that is the right noise: a canvas whose items are
 * fine must not grow an error banner because one credential fetch blipped.
 * What it does instead is retry a bounded number of times
 * (`RETRY_DELAYS_MS`) and then stop; the frames stay blank until something
 * mounts them again, which is honest about a home that has gone away.
 */
export async function ensureTickets(
  canvasId: string,
  hashes: readonly string[],
  attempt = 0,
): Promise<void> {
  if (base === null || !signed) return;
  const wanted = [
    ...new Set(
      hashes.filter((hash) => {
        const key = cell(canvasId, hash);
        return !live(tickets.get(key)) && !inFlight.has(key);
      }),
    ),
  ];
  if (wanted.length === 0) return;
  for (const hash of wanted) inFlight.add(cell(canvasId, hash));
  let failed = false;
  try {
    // The home refuses more than `SIGN_BLOBS_LIMIT` at once — a URL nothing
    // between here and it would forward is not a service to anybody — so a
    // big canvas is a handful of calls rather than one impossible one.
    for (let i = 0; i < wanted.length; i += SIGN_BLOBS_LIMIT) {
      const chunk = wanted.slice(i, i + SIGN_BLOBS_LIMIT);
      const answer = await signedBlobs(canvasId, chunk);
      const goodUntil = Date.now() / 1000 + answer.ttlSeconds;
      for (const [hash, path] of Object.entries(answer.urls)) {
        tickets.set(cell(canvasId, hash), { path, goodUntil });
      }
    }
  } catch {
    // Expelled, offline, or a home that signs nothing: nothing to hold, and
    // the retry below decides whether it was worth asking again.
    failed = true;
  } finally {
    for (const hash of wanted) inFlight.delete(cell(canvasId, hash));
    for (const wake of [...waiting]) wake();
  }
  const delay = failed ? RETRY_DELAYS_MS[attempt] : undefined;
  if (delay !== undefined) {
    setTimeout(() => void ensureTickets(canvasId, wanted, attempt + 1), delay);
  }
}

/**
 * **The content origin, with these hashes' tickets minted** — what a
 * component that is about to render a frame asks for.
 *
 * On every home but a signing one this is a plain synchronous read and there
 * is no effect worth the name: `ensureTickets` returns immediately, and the
 * frame renders on its first paint exactly as it did before stage 4b. On a
 * signing home the first render has no ticket, `itemFrame` answers null, the
 * mint lands and this re-renders — one blank beat on a cold canvas, none
 * afterwards, because a ticket covers every frame on the canvas for its TTL.
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
