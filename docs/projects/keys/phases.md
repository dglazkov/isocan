---
status: designed
since: 2026-10-02
see: copy-edit, voice-agent
note: "the walk: close the voice harness door, the store and CLI, the settings area, owner-only spend, agents and the talk module."
---

# Model keys — the walk

**2 October 2026.** Held to [design.md](design.md).

**Where we are, 2 Oct 2026: nothing built. Next: keys phase 0, close the voice harness door.**

Rules for every phase, on top of `AGENTS.md`:

- **A key is never shown, logged or sent back** — not in a response, an error,
  a log line, or the web. A test in each phase greps for the value.
- **Machine-local routes only**, gated like `treeGate`; 404 on a hosted home.
- **Env wins** over the file, so CI and hosted homes are unchanged.

## Phase 0 — Close the voice harness door

**Status: NOT STARTED.**

**Outcome:** the voice harness's loopback HTTP door refuses a request whose
Origin is not its own page (or absent where a browser would send one), whose
Host is not a loopback name, or whose body is not `application/json`; the key
routes are covered.

**Proof:** tests that a cross-site `text/plain` POST to `/key` and a request
with a foreign Host are refused and the stored key is unchanged; the page's own
requests still work.

## Phase 1 — The store and the CLI

**Status: NOT STARTED.**

**Outcome:** `~/.isocan/keys.json` (0600, dir 0700, refused if not 0600), a
core provider registry, one resolver (env, then file) used per call by the
judge, the text model and the voice harness; `isocan keys ls|set|rm|test`
(value from stdin/prompt, never argv; `ls` shows last four only); the voice
harness's old `voice/key.json` migrated once.

**Proof:** tests of modes, refusal, env precedence, migration, and that the
value never appears in output; a real-daemon test that a key set with `isocan
keys set` is used by `/api/text` with no restart.

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
