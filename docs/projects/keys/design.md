---
status: built
since: 2026-10-02
see: copy-edit, voice-agent, judge
note: "Model keys in one place on your machine: ~/.isocan/keys.json (0600), set from a Model keys settings area or `isocan keys`, read per call by everything that spends a key — the judge, the text model, voice, the rc's agents — with env as an override. Write-only in the UI, machine-local routes only, owner-only spend by default. Phase 0 closes a hole the survey found: the voice harness's loopback door had no Origin or Host check."
---

# Model keys, in one place on your machine

**2 October 2026.** Dion: *"We have the ability to add model keys… e.g. google
live for voice. can we make a key settings area where we can start to
aggregate these and store locally?"*

## What is true today

Keys live in five places, found five ways:

| Key | Who spends it | Where it comes from |
| --- | --- | --- |
| `TYPESAFE_API_KEY` (Jev) | daemon `/api/judgment`, CLI, scripts | the env of whichever shell spawned the daemon (`api/src/client.ts:287-291`) |
| `ISOCAN_TEXT_API_KEY` (+ provider, model) | daemon `/api/text`, CLI `wire copy` | the same env |
| Gemini (voice harness) | `packages/voice-agent` | `~/.isocan/voice/key.json`, 0600 — set through the harness's loopback page |
| Gemini (talk module) | the browser, straight to Google | `localStorage` — against the "no key in the browser" rule |
| `ANTHROPIC_*`, `OPENAI_*`, `GEMINI_API_KEY` | agents an `rc` summons | the `rc` process's env, by prefix allowlist (`cli/src/acp.ts:110-143`) |

The consequences: a daemon started from anywhere but the right shell silently
has no judge and no text model; the Gemini key is stored twice; nothing shows
which keys a machine has; and `~/.isocan/config.json` and the directory are
world-readable (0644/0755), so the obvious place to add secrets is the wrong one.

**And a hole.** The voice harness listens on `127.0.0.1:7654` with no Origin and
no Host check, and parses any body starting with `{` whatever its content type
(`voice-harness.ts:3054,3069`). A page on any site the person visits can likely
`POST /harness/key` with `text/plain` and replace or forget the voice key, and
DNS rebinding is undefended. Inferred from the code, not exploited.

## The design

**One file, `~/.isocan/keys.json`, mode 0600** (the directory tightened to
0700), refused on read if it is not 0600 — the rule `readVoiceKey` already has.
One entry per **provider** (`anthropic`, `openai`, `gemini`, `typesafe`), each
`{ key, model?, addedAt }`. A provider registry in core says which features
use which provider (text → anthropic/openai, voice → gemini, judge → typesafe,
agents → whichever their harness reads), so the settings area can say *"used
for: copy, wireframe names"* rather than a variable name.

**Read per call, env wins.** Every spender asks one resolver: env first (CI,
hosted homes, a person who prefers their shell), then the file. Nothing needs a
restart; a key added at noon is used at 12:01.

**Write-only everywhere.** The UI and `isocan keys ls` show the provider,
*set / not set*, the last four characters, when it was added and what uses it —
never the value. Setting reads the key from stdin or a prompt, never argv (shell
history). `isocan keys test <provider>` makes one cheap call and says yes or why
not.

**Machine-local only.** The routes copy the tree/bind gate: loopback-bound
daemon, loopback peer, an Origin and Host check, 404 on a hosted home. On
isocan.io the settings area says the truth: *your keys live on your machine;
this home's keys are set by whoever runs it.*

**Owner-only spend, by default.** `/api/judgment` and `/api/text` today let any
editor on a canvas this machine holds spend this machine's key. Local keys serve
the machine's own person (through `actor.join`) unless the owner turns on
*Let collaborators on my canvases use my keys* — the same shape as owner-only
summons.

**What it does not swallow:** `ISOCAN_AUTH_API_KEY` (a public browser key),
CI secrets, `agent-secret` (identity), and a hosted home's keys (Secret
Manager). A hosted home keeps reading env.

## The walk

0. **Close the voice harness door.** Origin and Host checks, a JSON
   content-type requirement, and a test that a cross-site `text/plain` POST is
   refused.
1. **The store and the CLI.** `keys.json` with the mode rules, the resolver,
   the provider registry, `isocan keys ls|set|rm|test`; the judge, text model
   and voice harness read through it (the harness's `voice/key.json` migrated
   once).
2. **The settings area.** *Model keys…* in the identity menu, under a *This
   machine* group, shown when the page is served by this machine's daemon;
   set, replace, remove, test; write-only.
3. **Owner-only spend** and the switch that widens it.
4. **Agents and the talk module.** The rc injects stored keys into the agents
   it summons (`adapterEnv`); the talk module stops keeping Gemini in
   localStorage and gets a short-lived token from the daemon instead.
