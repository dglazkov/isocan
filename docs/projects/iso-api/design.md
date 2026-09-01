# The isomorphic API

**31 August 2026.** Design (#78). Nothing built. The project's status
lives in [journey.md](journey.md)'s front matter — the journeys are the
acceptance suite, this doc is the argument.

The thesis in one line: **the API already exists — it is the CLI's private
middle layer, and the work is to name it, move it, and make the CLI its
first consumer.**

## What "isomorphic API" means here

isocan has two surfaces that speak the same operation vocabulary: the web
app and the CLI. #78 asks for a third — a way for an agent to script the
canvas from code, without spawning a process per action.

The isomorphism contract today has three layers, all in `@isocan/core`:

1. **The op vocabulary** (`ops.ts`) — every mutation either surface can
   perform is one `Operation`.
2. **The routes and wire types** (`protocol.ts`) — `POST /api/ops` and its
   siblings, with request and response types both clients import.
3. **The reducer** — the same state transition applied everywhere.

On top of that contract each surface carries its own transport code: the
web app's `lib/api.ts` (945 lines, browser, cookie-carried badge) and the
CLI's `client.ts` (790 lines, Node, token-carried badge). Those two exist
because a browser and a terminal genuinely differ; they are not drift.

What an agent scripting isocan needs is not layer 1–3 — it could `fetch`
`/api/ops` today. It needs everything the CLI wraps *around* those layers,
which is where the CLI's actual value lives:

- **`client.ts`** — `DaemonClient`: every route, typed; daemon lifecycle
  (`ensureDaemon`, health probes); blob upload/download; the park and rc
  machinery (`parkClaim`, `rcHold`, `watchLog`).
- **`ctx.ts`** — which home, which canvas: the directory marker walk,
  `~/.isocan/homes.json`, `resolveCanvas` with id/prefix/title matching.
- **`identity.ts`** — which actor: session claims, the person/agent split,
  reincarnation.
- **`direct.ts`** — speaking to a canvas's own home when it lives
  elsewhere.

An agent that hand-rolls HTTP re-derives all four and gets identity wrong
in exactly the case the guide warns about (an agent launched by an agent
sees both sets of harness variables). An agent that shells out pays a
process per action — measured 31 Aug: ~150–210 ms per `isocan` invocation
on a warm laptop, node plus tsx registration plus commander — and, worse,
gets strings where it wanted the typed data the CLI had one line earlier.

## The shape

A new workspace, **`packages/api`** (`@isocan/api`). The four files above
move into it; `@isocan/cli` depends on it and keeps what is genuinely
CLI: commander wiring, `output.ts`, help text, `main.ts`'s presentation.
`makeCtx` splits at the line that is already visible in its signature —
the half that reads a `Command`'s flags stays in the CLI; the half that
resolves home, daemon, badge, actor and canvas from a directory and an
environment becomes the API's front door:

```ts
import { connect } from "isocan";

const canvas = await connect();           // this directory's canvas,
                                          // this session's actor —
                                          // identical to the CLI's own
                                          // resolution, because it IS it
await canvas.op({ type: "item.add", ... });
for await (const entry of canvas.tail()) { ... }
```

The exact surface is settled during extraction, not here — it is
`DaemonClient`'s surface, which exists and is tested. Two rules bound it:

- **`connect()` resolves exactly as the CLI resolves.** Same directory
  marker walk, same session-claim identity, same `homes.json`, same
  daemon auto-start. An agent using the API and an agent using the CLI in
  the same directory are the same actor on the same canvas. Anything else
  makes the third surface a liar.
- **The API is a client of the daemon, full stop.** No in-process engine,
  no store access, no second writer. The daemon stays the single writer;
  the API removes process spawns from the *client* side only.

## How the surfaces stay in lockstep (the first comment)

Structurally, not procedurally. After the extraction there are two client
implementations in the repo, same as today — the browser's and the Node
one — but the Node one has exactly one copy, and the CLI is its consumer
rather than its owner. A third Node-side copy cannot drift because it
does not exist; the CLI cannot drift from the API because the CLI is the
API plus argv parsing.

Held by a test in the house pattern (`address.ts`'s grep test is the
precedent): **no file in `packages/cli` constructs a request to the
daemon** — no `fetch` of an `/api/` path outside `packages/api`. The
packaging test's precedent applies too: `@isocan/api` becomes the one
place Node-side transport lives, asserted, not remembered.

The browser client stays where it is. It shares layers 1–3 from core —
ops, routes, wire types, reducer — and that remains the cross-surface
contract; it does not consume this package, because a browser needs none
of daemon lifecycle, homes.json, or session-claim identity, and carries
its badge in a cookie the page never sees. The honest statement of
lockstep is: **core is the contract all three surfaces import; the API
package is the Node transport both terminal surfaces share.**

That statement is where this design stops, not where the idea does:
[journey.md](journey.md)'s second unsolved twist asks what happens if
the web app consumed a browser build of this API's transport kernel —
one client worn three ways, with the replica layer (IndexedDB, service
worker, queue) remaining the browser's own. Unsolved there, on purpose;
the extraction should merely avoid foreclosing it, which mostly means
keeping the Node-only half (daemon lifecycle, `homes.json`, the marker
walk) separable from the typed route surface.

## Distribution (the second comment's "let me ... what?")

Same channel as the CLI: the release branch. `npm i
github:dglazkov/isocan#release` — locally, in the agent's project, not
`-g` — and the root manifest gains an `exports` entry, so the import
specifier is the package the agent already knows the name of: `isocan`.

The wrinkle, named rather than discovered later: the release branch ships
TypeScript sources, run through tsx — that is what `bin/isocan.js` does
(register tsx, register the workspace loader, import `main.ts`). A
consumer's `import { connect } from "isocan"` must get the same
treatment, so the export entry points at a small `.mjs` mirror of the bin
that registers the loaders and re-exports `@isocan/api`'s entry module.
Registration is process-global; for an agent's script that is acceptable
and stated. If it ever bites a real consumer, the lever is already in the
release pipeline: `release.mjs` builds the web app at publish time and
could compile `packages/api` to `.js` plus `.d.ts` the same way. Start
with the mirror, because it is the bin's own trick and adds no build
machinery.

## How an agent learns it exists

The door that already exists: **`isocan --agent-help`**. `agent-guide.md`
gains a short "Scripting" section — when to reach past the CLI (a loop, a
watcher, a tool that composes many ops), the install line, `connect()`,
and where the types are. The guide ships as a skill via `isocan setup`,
so every readied directory already carries the pointer.

The reference manual is the types. The package is TypeScript source;
`DaemonClient`'s signatures and `ops.ts`'s doc comments are the API doc,
and they cannot go stale because they are the implementation. No
generated reference, no second document to keep honest.

## What this is not

- **Not an in-process engine.** The daemon's judgment stays in the
  daemon; commitment 2 and the single-writer rule are untouched.
- **Not a browser library.** The web app keeps its client; the contract
  they share is core, as it always was.
- **Not a second protocol.** No new routes, no new ops. If building the
  API surfaces a gap in the vocabulary, the vocabulary changes in core
  and every surface gets it — that is what the contract is for.

## Doors

Settled 31 Aug 2026, by Dimitri:

- **Typed library with the CLI atop it** — over documenting the HTTP
  protocol as the API. The protocol doc remains available as a later,
  language-agnostic floor; nothing here forecloses it.
- **Distribution via the release branch** — no npm registry account, one
  release pipeline, one install spec everywhere.
- **A project of its own** — this directory.

Open, to be settled by the work:

- Where `connect()`'s surface draws the line between "the client" and
  "conveniences" — e.g. whether `resolveCanvas`'s ref matching is on the
  canvas handle or stays a helper. Settled by extracting and looking.
- Whether the park/rc machinery is exported or kept internal until
  [on-demand](../on-demand/design.md) builds `isocan rc` and the shape
  stops moving.
- The session-identity story for a script that is not under a harness —
  the guide's `ISOCAN_SESSION_ID` advice, translated into what
  `connect()` does when it finds no session in the environment: refuse,
  or mint-and-warn. The CLI refuses today (`--session` is explicit);
  the API should probably match, and the door stays open until a real
  consumer says otherwise.
