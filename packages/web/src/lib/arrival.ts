import {
  PASS_EXPIRED,
  PASS_SPENT,
  PASS_TTL_MS,
  PASS_UNKNOWN,
  parseCanvasAddress,
} from "@isocan/core";
import { ApiError, redeemPass } from "./api.ts";
import { adoptHandedIdentity } from "./identity.ts";

/**
 * **A tab that arrived carrying a pass** — the redeeming half of Scene 5, and
 * the far end of `isocan open` (mechanism 2: "`isocan open` appends a pass
 * minted by her daemon's badge — Scene 5's outward flow, pointed the other
 * way").
 *
 * The tab comes up **already being that person**: it spends the pass, the home
 * writes the handed claim onto this browser's badge, and the actor goes into
 * `lib/identity.ts` — the one place that owns what "this browser's identity"
 * means. Without that last step the person would be admitted to the canvas and
 * still standing at the door, which is the shape this codebase keeps rebuying.
 *
 * **The credential rides in a `#fragment`, and only a fragment will do.** A
 * fragment is never sent to a server: it is not in the request line, not in
 * the home's access log, not in a proxy's, not in a `Referer` to anywhere the
 * page later links. `?pass=` would be in all four. It is also why a person who
 * pastes the whole `setup` command into a browser instead of a terminal simply
 * gets the canvas: the home is asked for the canvas path and never sees the
 * secret at all.
 *
 * **Nothing here throws.** A refusal is an answer to render, not an error to
 * swallow: an expired or spent pass has to produce copy a person can act on,
 * and the three refusal codes exist at the daemon precisely because the three
 * remedies differ. A blank page or a silent fall back to being a stranger is
 * the failure this phase inherited a standing finding about.
 */
export interface ArrivalRefused {
  /** The daemon's `PassRefusal` code when there was one — absent when the home
   * could not be reached at all. Carried so a test can name the case. */
  code?: string;
  /** What happened, in one sentence. */
  note: string;
  /** What to do about it. */
  hint: string;
}

/** A redemption in flight — started before React exists, resolved to null on
 * success (there is nothing to say: the person is simply themselves). */
export type Arrival = Promise<ArrivalRefused | null> | null;

/**
 * Read the pass out of the address, take it out of the address bar, and start
 * redeeming it. Null when this tab arrived carrying nothing, which is almost
 * every tab.
 *
 * **Called from `main.tsx`, outside React, exactly once.** Under StrictMode an
 * effect body runs twice in development — and the second run of a single-use
 * redemption would meet its own spent pass and report "somebody already used
 * this" to the person it just admitted. Starting the promise at the entry
 * point makes that unrepresentable rather than guarded against.
 *
 * **The fragment is stripped BEFORE the answer comes back**, deliberately. It
 * is the only way a reload cannot re-spend a spent pass, and it gets a live
 * credential out of the address bar (and out of what a screen share or a
 * bookmark would capture) at the first possible instant. The cost is that a
 * redemption lost to a dead network takes the token with it — which is the
 * cheap failure of the two, because a pass that never reached the home was
 * never spent and the person can be handed another in one click.
 */
export function beginArrival(): Arrival {
  const here = read();
  if (!here) return null;
  strip();
  return settle(here);
}

/**
 * **A pass that lands in the bar of a page that is already open.**
 *
 * Measured in Chrome, phase 8: navigating an open canvas tab to its own
 * address with `#<pass>` on the end is a SAME-DOCUMENT navigation. Nothing
 * reloads, `main.tsx` never runs again, and the credential just sits in the
 * address bar doing nothing — the cheerful wrong address in its quietest
 * form. `isocan open` usually escapes this by spawning a new tab, but "usually"
 * is not a property: a person pasting the line into the bar of the tab they
 * already have open lands here every time, and so does any browser that
 * answers `open` by switching to an existing tab.
 *
 * A reload is the whole fix, and it is deliberately not a second redemption
 * path: the page comes back through `beginArrival` with the fragment still
 * attached, and everything after that is the arrival it always was. It cannot
 * loop, because the pass is stripped with `replaceState`, which fires no
 * `hashchange`.
 */
export function reloadOnLatePass(): void {
  try {
    addEventListener("hashchange", () => {
      if (read()) location.reload();
    });
  } catch {
    // No window to listen on (a test, a worker): nothing arrives late either.
  }
}

/** The pass in this tab's address, if it has one. Uses core's own parser, so
 * "what a canvas address looks like" has one spelling — the `/c/` bug was two
 * spellings drifting, and this is the same file's warning. */
function read(): string | null {
  try {
    return parseCanvasAddress(location.href)?.pass ?? null;
  } catch {
    return null; // no document: a test, a worker. Nothing arrived anywhere.
  }
}

function strip(): void {
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  } catch {
    // No history API to speak of. The redemption still happens; the worst case
    // is a reload that meets `pass-spent`, which says so in words.
  }
}

async function settle(token: string): Promise<ArrivalRefused | null> {
  try {
    const answer = await redeemPass(token);
    // An admission-only pass hands over nobody, and that is a real shape (the
    // CLI's `--admit-only`, and `isocan open` on a machine with no human in
    // `identity.json`). The tab is admitted and stays whoever it was — or
    // meets the door, which is the right next thing to see.
    if (answer.actor) adoptHandedIdentity(answer.actor);
    return null;
  } catch (err) {
    return refusalOf(err);
  }
}

/** One sentence and one remedy per refusal. They are genuinely different
 * places to send somebody, which is why the daemon spends three codes on them
 * rather than one. */
function refusalOf(err: unknown): ArrivalRefused {
  const minutes = Math.round(PASS_TTL_MS / 60_000);
  // Whoever minted it is the only one who can mint another, and the two ways
  // that happens are the two surfaces — so the remedy names both rather than
  // guessing which of them this tab was opened by.
  const fresh =
    "Nothing was handed over, so this tab is whoever it already was. For a fresh one: " +
    "“Work from your terminal…” under your own face on the canvas that gave you this link, " +
    "or `isocan open` on your own machine.";
  if (err instanceof ApiError && err.code === PASS_EXPIRED) {
    return {
      code: err.code,
      note: `The pass in that address had expired — a pass is good for about ${minutes} minutes.`,
      hint: fresh,
    };
  }
  if (err instanceof ApiError && err.code === PASS_SPENT) {
    return {
      code: err.code,
      note: "That pass had already been used — a pass works exactly once.",
      hint:
        "If that was you, on this browser or another, you are already let in there. " +
        `Otherwise: ${fresh}`,
    };
  }
  if (err instanceof ApiError && err.code === PASS_UNKNOWN) {
    return {
      code: err.code,
      note: "This canvas's home did not recognise the pass in that address.",
      hint:
        "Check the whole link was copied — a pass ends where the line does — and that this " +
        `is the home that gave it to you. ${fresh}`,
    };
  }
  // Not one of the three refusals: the home was unreachable, or it is older
  // than the route (phase 7.5 made an unmatched `/api/` path say so in JSON
  // instead of cheerfully serving the app shell). Both of those the daemon
  // states better than this function could guess, so its own words go through.
  return {
    ...(err instanceof ApiError && err.code ? { code: err.code } : {}),
    note: `The pass in that address could not be redeemed: ${(err as Error).message}`,
    hint: fresh,
  };
}
