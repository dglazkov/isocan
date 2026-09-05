/**
 * A canvas's address, spelled in exactly one place.
 *
 * This module exists because of a bug that cost a browser session to find.
 * The product used to be a **canvas** in the docs and a **project** in the
 * code, and the seam leaked into the one string a stranger pastes to another
 * stranger: the journey and the desk design both wrote `isocan.io/c/7f3a…`,
 * and nothing ever served `/c/` — the app has had exactly two routes, `/` and
 * `/p/:canvasId`, since it was written. A doc-shaped share link returned 200,
 * served the app shell, and rendered a blank page.
 *
 * Dimitri settled the address on 2026-08-23: **keep `/p/`**, correct the docs,
 * and take the rename itself later (it landed in phase 13.5, which is why the
 * code says canvas everywhere now). This file is the other half of that
 * ruling. The router
 * builds its path from `CANVAS_ROUTE`, the Share dialog builds its copyable URL
 * from `canvasUrl`, and `isocan open` and `isocan share` build theirs from the
 * same function — so the next time somebody changes their mind about the
 * prefix, there is one line to change and no second spelling to discover in
 * the wild.
 *
 * It lives in core rather than in either client for the ordinary reason (house
 * rule 4): the web app and the CLI both compute "where does this canvas live",
 * and a computation both clients do belongs to neither.
 */

/** The one prefix. Not `/c/`, and never both — a second URL shape for one
 * canvas is a cost that lasts forever. */
export const CANVAS_PATH_PREFIX = "/p";

/** The router's pattern, so the route and the links agree by construction. */
export const CANVAS_ROUTE = `${CANVAS_PATH_PREFIX}/:canvasId`;

/** The same canvas with one item filling the screen — see `itemPath`. */
export const ITEM_ROUTE = `${CANVAS_ROUTE}/i/:itemId`;

/** The path a canvas is served at, origin-relative. */
export function canvasPath(canvasId: string): string {
  return `${CANVAS_PATH_PREFIX}/${encodeURIComponent(canvasId)}`;
}

/**
 * **One item, filling the screen.**
 *
 * Full screen is a ROUTE and not an operation, and the distinction is the
 * whole design. Operations are mutations — the reducer applies them, they land
 * in the oplog, they undo, and both surfaces see them. What you are looking at
 * is none of those things: your zoom is not my zoom, and an `item.focus` op
 * would drag every open tab to the same screen because one person opened it.
 *
 * But it is not merely local state either, because then only the person whose
 * finger was on the key could ever reach it. A route makes it **addressable**:
 * the browser's Back button leaves it for free, the address bar holds the
 * thing you are looking at, a link to one screen is a link to one screen — and
 * `isocan open <item>` can hand somebody exactly the view it means, which is
 * how the CLI takes part in a feature that has no op to send.
 *
 * `/i/` for the same reason as `/p/`: short, and spelled once.
 */
const ITEM_PATH_SEGMENT = "i";

export function itemPath(canvasId: string, itemId: string): string {
  return `${canvasPath(canvasId)}/${ITEM_PATH_SEGMENT}/${encodeURIComponent(itemId)}`;
}

/** The whole address of one item, full screen: origin + path. */
export function itemUrl(origin: string, canvasId: string, itemId: string): string {
  return `${origin.replace(/\/+$/, "")}${itemPath(canvasId, itemId)}`;
}

/**
 * **The deck, laid out for paper** (`docs/research/2026-09-04-deck-export.md`).
 *
 * Every slide of a canvas stacked on one page, one per sheet when printed —
 * the view the browser's own Save-as-PDF turns into a document, and the
 * view the CLI's headless Chrome prints to `deck.pdf`, so both surfaces
 * produce the same pages from the same address. A route for the reason
 * full screen is one: it is an address either surface can hand you.
 */
const DECK_PATH_SEGMENT = "deck";
export const DECK_ROUTE = `${CANVAS_ROUTE}/${DECK_PATH_SEGMENT}`;

export function deckPath(canvasId: string): string {
  return `${canvasPath(canvasId)}/${DECK_PATH_SEGMENT}`;
}

export function deckUrl(origin: string, canvasId: string): string {
  return `${origin.replace(/\/+$/, "")}${deckPath(canvasId)}`;
}

/**
 * **A module's page** (`docs/projects/modules/design.md`, phase 4): a whole
 * section a module adds — the Documents page is the first — under `x/`, so
 * a module's segment can never collide with a route the product adds later.
 * A cover route like the workbench and the deck view: an address either
 * surface can hand you, and `isocan open --page <segment>` does.
 */
const MODULE_PAGE_PATH_SEGMENT = "x";
export const MODULE_PAGE_ROUTE = `${CANVAS_ROUTE}/${MODULE_PAGE_PATH_SEGMENT}/:segment`;

export function modulePagePath(canvasId: string, segment: string): string {
  return `${canvasPath(canvasId)}/${MODULE_PAGE_PATH_SEGMENT}/${segment}`;
}

export function modulePageUrl(origin: string, canvasId: string, segment: string): string {
  return `${origin.replace(/\/+$/, "")}${modulePagePath(canvasId, segment)}`;
}

/**
 * **The workbench: the same canvas, flipped to the agent room.**
 *
 * A second projection of the canvas — the agent roster, the main thread, and
 * one artifact on a stage — and a ROUTE for every reason full screen is one
 * (see `ITEM_PATH_SEGMENT` above): what you are looking at is not a mutation,
 * but it has to be addressable or only the person at the keyboard could ever
 * reach it. `isocan open --workbench` hands somebody this exact view; Esc
 * pops one level, `/w/<item>` → `/w` → the canvas.
 *
 * The router's item segment is named `wbItemId`, not `itemId`, and that is
 * load-bearing rather than fussy: both cover routes mount the same
 * `CanvasPage` element, and `useParams` merges whatever the matched pattern
 * captured — one shared name would make "full screen or workbench?"
 * unanswerable from the params alone.
 *
 * `w` for the reason `i` and `p` are letters: short, and spelled once.
 */
const WORKBENCH_PATH_SEGMENT = "w";

export const WORKBENCH_ROUTE = `${CANVAS_ROUTE}/${WORKBENCH_PATH_SEGMENT}`;
export const WORKBENCH_ITEM_ROUTE = `${WORKBENCH_ROUTE}/:wbItemId`;

/** The workbench with nothing focused — the agent room itself. */
export function workbenchPath(canvasId: string): string {
  return `${canvasPath(canvasId)}/${WORKBENCH_PATH_SEGMENT}`;
}

/** The workbench with one artifact on the stage. */
export function workbenchItemPath(canvasId: string, itemId: string): string {
  return `${workbenchPath(canvasId)}/${encodeURIComponent(itemId)}`;
}

/** The whole address of a workbench view: origin + path, item optional. */
export function workbenchUrl(origin: string, canvasId: string, itemId?: string): string {
  const path = itemId ? workbenchItemPath(canvasId, itemId) : workbenchPath(canvasId);
  return `${origin.replace(/\/+$/, "")}${path}`;
}

/**
 * The whole invitation: origin + path.
 *
 * `origin` is whatever the caller is standing at — the home's address for a
 * CLI on a replica (people always enter through the one origin), or
 * `location.origin` in a tab. A trailing slash is tolerated because a home
 * address read out of a config file often has one.
 */
export function canvasUrl(origin: string, canvasId: string): string {
  return `${origin.replace(/\/+$/, "")}${canvasPath(canvasId)}`;
}

/**
 * The same address with an escalation pass on the end — Scene 5's one command
 * (`… setup isocan.io/p/7f3a…#<pass>`).
 *
 * **A fragment, not a query parameter**, and that is the whole reason this
 * lives in one function. A `#` fragment is never sent to a server: it does not
 * reach the home's access log, it does not reach a proxy's, and if somebody
 * pastes the whole command into a browser instead of a terminal, the home is
 * asked for the canvas and never sees the credential. A `?pass=` would be
 * logged by everything it passed through. The address carrying its own
 * credential is what collapses Priya's three setup steps into Jordan's one
 * line — "the address carries everything setup would otherwise ask".
 *
 * It is here, in core, for the reason `canvasUrl` is: the web dialog BUILDS
 * this string and the CLI's `setup` PARSES it, and one spelling in two clients
 * is the exact bug this module was created by.
 */
export function canvasUrlWithPass(origin: string, canvasId: string, token: string): string {
  return urlWithPass(canvasUrl(origin, canvasId), token);
}

/**
 * The general form: any address of ours, with a pass on the end.
 *
 * Extracted when `isocan open` learned to target one ITEM — the pass has to
 * follow the whole path, because a fragment is only a fragment if nothing
 * comes after it, and `canvasUrlWithPass` could only ever build the canvas
 * shape. Everything the doc above says about WHY it is a fragment rather than
 * a query parameter is said about this line; that function is now its
 * canvas-shaped caller.
 */
export function urlWithPass(url: string, token: string): string {
  return `${url}#${token}`;
}

/**
 * Split an address into the address and the pass it carries, if any.
 *
 * Everything after the FIRST `#` is the token — a pass token is
 * `<passId>.<secret>` with a base64url secret, so it contains no `#` of its
 * own, and taking the remainder rather than splitting again means a mangled
 * paste is refused by the desk (as an unknown pass) instead of being silently
 * truncated into a different, wrong one.
 *
 * An empty fragment (`…/p/7f3a…#`) is NO pass, not an empty one: a trailing
 * `#` is what a copy-paste leaves behind, and asking the home to redeem the
 * empty string would turn a harmless typo into a refusal.
 */
export function splitPassFragment(address: string): { address: string; pass?: string } {
  const hash = address.indexOf("#");
  if (hash < 0) return { address };
  const pass = address.slice(hash + 1);
  const rest = address.slice(0, hash);
  return pass ? { address: rest, pass } : { address: rest };
}

/** A canvas address taken apart: where the canvas lives, which canvas, and
 * the pass it was carrying (if any). */
export interface CanvasAddress {
  /** The home's origin — `https://isocan.io`, `http://127.0.0.1:4441`. */
  origin: string;
  canvasId: string;
  /** The `#fragment`, when one rode along. Never logged, never printed. */
  pass?: string;
}

/**
 * **The inverse of `canvasUrl` — the one reader of an address a person typed.**
 *
 * `canvasUrl` has always been the one writer; phase 8 is when something has to
 * READ one back, because Scene 5's whole payoff is a person pasting an address
 * into `isocan setup`. Both halves belong to the same file for the reason the
 * file exists at all: the `/c/` bug was one spelling drifting from another,
 * and a parser that knew about `/p/` independently of `canvasPath` would be
 * that bug wearing a different hat.
 *
 * **A missing scheme is filled in, because the journey's own command has
 * none.** Scene 5 writes `setup isocan.io/p/7f3a…#<pass>`, and a person
 * copying a canvas address out of a browser's address bar gets the same thing
 * — Chrome and Safari both hide `https://` on display. `https` is the default;
 * loopback gets `http`, because nobody runs TLS on `127.0.0.1` and the one
 * place a scheme-less loopback address is typed is a developer's terminal.
 * Refusing instead would be technically defensible and would fail the exact
 * paste the scene is built around.
 *
 * **Null rather than a throw**, and rather than a partial answer: the caller
 * (`isocan setup`) has to decide between "this is an address" and "this is a
 * directory", and a function that threw would force that decision to be made
 * by catching. What is NOT null-tolerant is the shape — `origin/p/<id>` with a
 * non-empty id and nothing after it — because an address that is nearly right
 * is exactly the case phase 7's cheerful-wrong-address finding is about.
 */
export function parseCanvasAddress(raw: string): CanvasAddress | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const { address, pass } = splitPassFragment(trimmed);
  const schemed = /^[a-z][a-z0-9+.-]*:\/\//i.test(address)
    ? address
    : `${/^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(address) ? "http" : "https"}://${address}`;
  let url: URL;
  try {
    url = new URL(schemed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  // The path must be exactly one canvas: `/p/<id>`, nothing before it and
  // nothing after. A trailing slash is forgiven (browsers add them); a deeper
  // path is a different page and must not be mistaken for a canvas.
  //
  // `/p/<id>/i/<itemId>` is now a real page, and it is deliberately NOT
  // accepted here. This function's caller is `isocan setup`, which enrols a
  // machine on a canvas — and an address pointing at one screen inside a
  // canvas is a thing to LOOK at, not a thing to set a machine up from. A
  // parser that quietly widened to the item address would be answering a
  // question nobody asked with a canvas nobody named.
  const parts = url.pathname.replace(/\/+$/, "").split("/");
  if (parts.length !== 3 || parts[0] !== "" || `/${parts[1]}` !== CANVAS_PATH_PREFIX) return null;
  const canvasId = decodeURIComponent(parts[2] ?? "");
  if (!canvasId) return null;
  return { origin: url.origin, canvasId, ...(pass !== undefined ? { pass } : {}) };
}

/**
 * **One address, one spelling** — the home half of what this file does for a
 * canvas.
 *
 * Phase 10.3 forced this out of the CLI, where it grew up, and the forcing is
 * worth reading because it is a good example of a cost that was invisible
 * while a number was one. Four spellings of a home address existed side by
 * side: `HomeLink`'s constructor stripped trailing slashes, `resolveHomeUrl`
 * trimmed whitespace, `badge-store` keyed by whatever string it was handed,
 * and the CLI's own normalizer returned `new URL(raw).origin`. With ONE home
 * per daemon a divergence between them was undetectable — every caller was
 * handed the same string from the same config key, so any two spellings agreed
 * by never meeting.
 *
 * With MANY homes per daemon they meet constantly, and **two spellings of one
 * address are two links, two badges, two presence mirror keys, and the same
 * person's face twice in one roster.** So the computation lives in core, house
 * rule 4's ordinary case: the daemon keys its links and its badges by this,
 * the CLI parses what a person typed with this, and neither owns it.
 *
 * **Normalization is `URL.origin`**: scheme, lowercased host, port only when
 * it is not the scheme's default — no path, no query, no fragment, no trailing
 * slash. That is exactly the granularity a browser gives a page's storage, and
 * a home IS an origin (the one-origin rule is the whole reason).
 *
 * **Total, never throwing**, which is the difference between this and the
 * CLI's `normalizeHomeUrl` wrapper. This one is called on values already
 * committed to disk — `config.json`'s `home`, a marker's `home`,
 * `identity.json`'s `auth` keys — where the only alternatives to "hand it back
 * as it came" are a crash at boot and a daemon that silently forgets a home.
 * Judging what a PERSON typed is a different job with different answers (a
 * bare hostname is a typo; a canvas link pasted from a browser bar deserves to
 * be named as one), and it stays where the person is, in the CLI.
 */
export function normalizeHomeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return trimmed.replace(/\/+$/, "");
    return url.origin;
  } catch {
    // Not parseable as an address at all. Stripping the trailing slash is the
    // one normalization that can still be applied without inventing anything,
    // and it is the one that actually bit (`{ home: "http://127.0.0.1:9/" }`
    // sits in this repo's own fixtures).
    return trimmed.replace(/\/+$/, "");
  }
}

/**
 * **How to get this CLI without a registry**, in the one place that spells it.
 *
 * The repo is the package and the `release` branch is the installable face of
 * it: installing from `main` puts an EMPTY directory on your disk and a
 * dangling `isocan` on your PATH (#47 — `scripts/release.mjs` has the whole
 * story), so every spec this product prints, runs or documents ends in
 * `#release`.
 *
 * It lives in core, beside the address, because phase 8 made the two into one
 * string: the command a person pastes is `npx <spec> setup <address>#<pass>`,
 * and the CLI's `isocan pass` and the web app's "Bring your own agent…"
 * dialog both hand it over. Two surfaces printing one string is house rule 4's
 * definition of a computation that belongs to neither of them — and a second
 * copy in the web app would be a branchless spec waiting to happen, in the one
 * place `test/packaging.test.ts` could not see it. It sees this one.
 */
export const INSTALL_SPEC = "github:dglazkov/isocan#release";

/**
 * **Where a canvas is born on a machine nobody has configured** — phase 14's
 * one line, and the flip phases 7.5 and 10.3 both deferred to here.
 *
 * The address alone is unremarkable; WHERE IT IS CONSULTED is the whole
 * decision, and two placements were rejected before this one.
 *
 * **Not a fallback in `resolveHomeUrl`.** A compiled-in default there would
 * change where every existing daemon's next canvas landed on the day it
 * shipped — no gesture, no report, no way for a person who had been working
 * locally for months to know their next canvas went to somebody else's
 * server. `packages/server/src/config.ts` refused it in those words, and the
 * refusal stands: that function still has no compiled-in default, and a
 * daemon with nothing configured still births locally.
 *
 * **Not a flag either**, for `ISOCAN_BIND` and `ISOCAN_STORE`'s reason: where
 * canvases are born is innkeeper configuration, not a per-invocation choice an
 * agent reaches for.
 *
 * **It is consulted by `isocan setup`, once, on a machine that has never held
 * a canvas** — where "setup" is the gesture and the report says what it did.
 * That is what `config.ts` predicted ("that default belongs to phase 14, where
 * setup writes the address down on purpose") and what Scene 0 needs: Priya
 * runs three steps, and the canvas she makes a minute later is at the hosted
 * home rather than trapped on her laptop. `isocan home --clear` is the whole
 * of the way back, and setup's own report names it.
 *
 * **Why flipping it is safe now, which it was not before phase 10.3.** A birth
 * default used to be a whole-daemon property: setting one demoted every canvas
 * on the disk to a replica of somewhere else. It decides one thing now — where
 * the NEXT canvas goes — and which home an existing canvas belongs to is a row
 * written at binding and never inferred. So a shipped default is consulted
 * only at a birth and can never re-point work that already exists.
 *
 * It lives here beside `INSTALL_SPEC` and `SKILL_INSTALL_COMMAND` because it
 * is the third member of that set: the strings a stranger meets before they
 * have decided anything, each spelled in exactly one place.
 */
export const DEFAULT_HOME_URL = "https://isocan.io";

/**
 * **Scene 0's first step**, in the one place that spells it.
 *
 * A different command from `INSTALL_SPEC`'s and deliberately so: that one
 * installs the CLI, this one installs only the *skill* — the doorway file that
 * tells an agent what isocan is and that `npx github:dglazkov/isocan#release
 * setup` is how it gets hands. A stranger who has never run isocan has no
 * reason to install a CLI yet; they have an agent, and the agent installs the
 * rest itself. So this is the line the front page hands over, and the line
 * `README.md` and the skill's own `SKILL.md` already advertise.
 *
 * It is here rather than in the web app for `INSTALL_SPEC`'s reason: three
 * copies of an install line already exist in prose, and the fourth — the one
 * a stranger actually pastes — must not be a fourth INDEPENDENT copy. It
 * carries no `#release` because it names a *repo* to `npx skills`, not a
 * package to npm, so the branchless-spec hazard (#47) does not apply.
 */
export const SKILL_INSTALL_COMMAND = "npx skills add dglazkov/isocan";

/**
 * **Scene 5's one command, built rather than written.**
 *
 *     npx github:dglazkov/isocan#release setup isocan.io/p/7f3a…#<pass>
 *
 * "Priya's three steps collapsed to a line, because the address carries
 * everything setup would otherwise ask." `npx` and not `npm i -g` on purpose:
 * the person pasting this has, by construction, never installed isocan — the
 * whole point of the scene is that they were thin a second ago — and `setup`
 * installs the CLI properly on its way through.
 *
 * The token is optional so that the same builder produces the *pass-less*
 * command, which is what a person is handed when the canvas's link grant is
 * open and no credential is needed to arrive.
 */
export function setupCommand(origin: string, canvasId: string, token?: string): string {
  const address = token ? canvasUrlWithPass(origin, canvasId, token) : canvasUrl(origin, canvasId);
  return `npx ${INSTALL_SPEC} setup ${address}`;
}

/**
 * **Scene 5's line — what Jordan pastes into the prompt box of the agent she
 * already has running.**
 *
 *     use isocan. Run this in the current directory to join the canvas:
 *       npx github:dglazkov/isocan#release setup isocan.io/p/7f3a…#<pass>
 *     Then run `isocan --agent-help` and follow its instructions.
 *
 * The same pass as {@link setupCommand}, in the shape
 * {@link cloudAgentInstructions} established: **addressed to an agent, because
 * that is who reads it.** The dialog used to hand over the bare shell command
 * and then ask, in prose underneath, for two more things — start your agent in
 * that directory, tell it to use isocan. Giving the agent the line instead
 * makes the paste BE those steps, and the paragraph is gone.
 *
 * **It ends at the guide, and says nothing the guide says.** Both lines used to
 * close on "park with `isocan wait`", which is step 6 of a protocol the agent
 * has not read — and the step most likely to be reached without the ones that
 * make it mean anything (name yourself, post the receipt, one waiter per name).
 * `setup` installs the skill that points at `isocan --agent-help`, but skills
 * are enumerated when a session starts and in both scenes the session started
 * BEFORE setup ran, so neither agent can be relied on to find it. So the line
 * names the guide — and then stops, because repeating one of its steps here is
 * a second copy that can go stale, and the guide ships with the build that
 * answers it.
 *
 * **It says where and it says why, because the reader is cold.** "Set this
 * directory up first" was the first draft and it fails a plain reading: *which*
 * directory is never named, so an agent asked to "set up a directory" may well
 * make one; "set up" is an open-ended task rather than "run the line below";
 * and with no outcome in the sentence, an agent whose `setup` fails has nothing
 * to recover toward. "Run this in the current directory to join the canvas"
 * answers all three in the same breath. The cloud sibling survives the same
 * verb only because a constraint precedes it — *this workspace is disposable,
 * so* — which supplies the reason this one had to state.
 *
 * **It carries no `ISOCAN_DIRECT=1`, which is the whole difference from its
 * cloud sibling.** This machine is the person's own, and it wants the daemon,
 * the replica and the marker — that is what Scene 5 is for. The cloud line
 * declares direct mode because the workspace it lands in is disposable;
 * declaring it here would throw away the local copy the scene exists to make.
 *
 * **`setupCommand` did not go away, and this is not a second spelling of it.**
 * `isocan pass` prints that one, and its reader is a person standing at a
 * shell; this one's reader is an agent. One pass, two wrappers, each shaped
 * for who reads it. The string that must never be written twice is the install
 * spec, and neither of them writes it (`INSTALL_SPEC`, #47,
 * `test/packaging.test.ts`).
 */
export function localAgentInstructions(origin: string, canvasId: string, token?: string): string {
  const address = token ? canvasUrlWithPass(origin, canvasId, token) : canvasUrl(origin, canvasId);
  return [
    "use isocan. Run this in the current directory to join the canvas:",
    "",
    `  npx ${INSTALL_SPEC} setup ${address}`,
    "",
    "Then run `isocan --agent-help` and follow its instructions.",
  ].join("\n");
}

/**
 * **Scene 6's line — what Inna pastes into a cloud session's prompt box.**
 *
 *     use isocan. This workspace is disposable, so set up with no local copy:
 *       ISOCAN_DIRECT=1 npx github:dglazkov/isocan#release setup isocan.io/p/7f3a…#<pass>
 *     Then run `isocan --agent-help` and follow its instructions.
 *
 * The sibling of {@link setupCommand}, and deliberately a different KIND of
 * artifact. Scene 5's is a shell command for a person at a terminal; this one
 * is addressed to an **agent**, because that is who reads it — the person's
 * four clicks are New session, pick the repo, paste, Start, and the paste goes
 * into a prompt box rather than a shell.
 *
 * **It carries `ISOCAN_DIRECT=1`, and that is not a guess leaking in.** A
 * disposable workspace wants no daemon and no local copy, and the ordinary way
 * a machine learns that is by being told. Here the person told us: they picked
 * "Run an agent in the cloud…" out of a menu, which is a declaration, so the
 * line declares. Nothing sniffs the vendor — the same line works in any
 * harness that can run a shell, which is the whole reason it names none. (A
 * narrow guess used to stand in for this and was deleted the day it shipped;
 * `direct.ts` carries that story.)
 *
 * **The address appears exactly once**, which it did not at first. The line
 * opened `use isocan — the canvas is at <address>` and then repeated the whole
 * address inside the command, because the prose had been written before the
 * command was. `setup` takes the address, so the first copy told the agent
 * nothing the second did not — and a pass token is eighty characters, printed
 * twice, in a box a person is asked to read. What the opening keeps is the
 * PHRASE: "use isocan" is how Scene 0 hands this product to an agent, and it
 * is worth a line on its own.
 *
 * **Vendor-free on purpose.** The journey says "claude.ai/code" as *one*
 * concrete instantiation and this string must not: it goes to whatever cloud
 * the person already has, and a line naming somebody's product would be wrong
 * for every other reader of it.
 */
export function cloudAgentInstructions(origin: string, canvasId: string, token?: string): string {
  const address = token ? canvasUrlWithPass(origin, canvasId, token) : canvasUrl(origin, canvasId);
  return [
    "use isocan. This workspace is disposable, so set up with no local copy:",
    "",
    `  ISOCAN_DIRECT=1 npx ${INSTALL_SPEC} setup ${address}`,
    "",
    "Then run `isocan --agent-help` and follow its instructions.",
  ].join("\n");
}
