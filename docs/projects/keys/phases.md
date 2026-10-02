---
status: partial
since: 2026-10-02
see: copy-edit, voice-agent
note: "the walk: close the voice harness door, the store and CLI, the settings area, owner-only spend, agents and the talk module."
---

# Model keys — the walk

**2 October 2026.** Held to [design.md](design.md).

**Where we are, 2 Oct 2026: phases 0 and 1 are CLOSED — the harness door is shut, and keys live in `~/.isocan/keys.json` behind `isocan keys`. Next: keys phase 2, the settings area.**

Rules for every phase, on top of `AGENTS.md`:

- **A key is never shown, logged or sent back** — not in a response, an error,
  a log line, or the web. A test in each phase greps for the value.
- **Machine-local routes only**, gated like `treeGate`; 404 on a hosted home.
- **Env wins** over the file, so CI and hosted homes are unchanged.

## Phase 0 — Close the voice harness door

**Status: CLOSED, 2 October 2026.** Every request to the voice harness's loopback door must carry a loopback Host, a loopback Origin when it has one, and a JSON body when it changes state; WebSocket upgrades are held to the same Host and Origin — proved by refusing a cross-site `text/plain` POST, a rebound Host and a foreign-Origin socket while the page's own requests still set and forget the key.

**Outcome:** the voice harness's loopback HTTP door refuses a request whose
Origin is not its own page (or absent where a browser would send one), whose
Host is not a loopback name, or whose body is not `application/json`; the key
routes are covered.

**Proof:** tests that a cross-site `text/plain` POST to `/key` and a request
with a foreign Host are refused and the stored key is unchanged; the page's own
requests still work.

### Trajectory

- **2026-10-02** — WebSocket upgrades were open too: CORS does not cover them, so before this any site could open the harness's audio socket. Now the same Host and Origin rule refuses the upgrade.
- **2026-10-02** — Open: two GETs with side effects stay reachable by a top-level navigation from another site — `GET /open` mints a pass and redirects, `GET /models` spends a provider call. Low risk (the response is unreadable); fold into phase 1's gated routes.
- **2026-10-02** — Open: any loopback origin counts as the harness's own page, so another local web app (isocan's on 4441 included) can drive it — pinned no tighter because the Vite dev proxy keeps its own origin.

## Phase 1 — The store and the CLI

**Status: CLOSED, 2 October 2026.** `~/.isocan/keys.json` (0600, atomic, refused if loose) behind one resolver read per call by the judge, the text model, `words vary` and the voice harness; `isocan keys ls|set|rm|test` never shows or takes a key on the command line — proved by a key set on stdin reaching the same running daemon's `/api/text` with no restart, and every output scanned for the value.

**Outcome:** `~/.isocan/keys.json` (0600, dir 0700, refused if not 0600), a
core provider registry, one resolver (env, then file) used per call by the
judge, the text model and the voice harness; `isocan keys ls|set|rm|test`
(value from stdin/prompt, never argv; `ls` shows last four only); the voice
harness's old `voice/key.json` migrated once.

**Proof:** tests of modes, refusal, env precedence, migration, and that the
value never appears in output; a real-daemon test that a key set with `isocan
keys set` is used by `/api/text` with no restart.

### Trajectory

- **2026-10-02** — The resolver's default home gained a test seam (`ISOCAN_KEYS_HOME`, set per worker in test/setup.ts): without it an in-process test would read and spend the developer's real keys once they had run `isocan keys set`.
- **2026-10-02** — Only the variables isocan already read override the file; an `ANTHROPIC_API_KEY` exported for another tool does not become the text model's key. The daemon reads its own home's keys (`keysHome`), as `rosterHome` does.
- **2026-10-02** — `voice/key.json` is removed on migration, not renamed: a second copy of a secret is a second thing to leak.
- **2026-10-02** — Open: `writeKey` is atomic per write but has no lock; two writers at once could lose one.
- **2026-10-02** — Open: `GEMINI_API_KEY` in the env now overrides the voice key too, so *forget* removes the file entry while a key still resolves.

## Phase 2 — The settings area

**Status: NOT STARTED.**

**Outcome:** *Model keys…* in the identity menu under *This machine*, shown when
the page is served by this machine's daemon: each provider with set/not set,
last four, what uses it, Set/Replace/Remove/Test; write-only; on a hosted home
the honest sentence instead.

**Proof:** a journey that sets a key, sees it as `…abcd`, tests it against a
fake provider, removes it; the value never in the DOM after save.

## Phase 3 — Owner-only spend

**Status: NOT STARTED.**

**Outcome:** `/api/judgment` and `/api/text` spend this machine's stored keys
only for its own person (through joins) unless the owner turns on sharing; a
collaborator is refused in words naming the owner.

**Proof:** real-daemon tests for owner, joined identity, collaborator refused,
collaborator allowed after the switch.

## Phase 4 — Agents and the talk module

**Status: NOT STARTED.**

**Outcome:** the rc injects stored keys into summoned agents; the talk module
gets a short-lived Gemini token from the daemon instead of a localStorage key.

**Proof:** an rc test that a summoned agent sees the stored key; a talk test
that no key is in localStorage and a token is minted per session.
