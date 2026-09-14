# @isocan/voice-agent

A voice agent you can talk to: **a page** you speak into, and **a harness** that holds
the provider session, calls the tools, and keeps the state. They live together here and
run themselves — nothing in this package needs the web app or the CLI.

## Start it

From the repository root:

```bash
npm start -w @isocan/voice-agent
```

Or run the entry point directly:

```bash
node packages/voice-agent/bin/voice-agent.js
```

Either way you get the same thing: **the harness starts and serves the page.** You should
see it print the canvas it is attached to, the agent identity it resolved, the daemon it
is speaking to and the model it will use — then the address to open, which is
**`http://127.0.0.1:7654/`** by default. Open it, press **Listen**, and talk.

`npm start` builds the page first (`vite build` → `dist/`, which is what the harness
serves) and the harness's own TypeScript is imported directly — the entry point registers
`tsx`, so there is no build step between an edit to the harness and a run. The page is
different: **run `npm run build -w @isocan/voice-agent`** if you started the entry point
by hand without one, or the harness answers with the command instead of a blank page.
`npm run dev -w @isocan/voice-agent` starts Vite instead, for working on the page itself
with HMR — same page, same routes, proxied to the harness.

**The same entry point is what `isocan rc` starts**, and it needs no configuration to do
it: when the harness starts it writes its own declaration into
`~/.isocan/config.json` (`acpAdapters.voice` → this file, `--acp`), which is where
`isocan rc` resolves a harness from. One entry, two ways in — a person starting it
directly and rc starting it as a managed agent run identical code. A `voice` declaration
you wrote yourself is left alone.

## What it is

- **The page** — `voice.html` with `src/main.ts`, `src/voice.ts` and `src/voiceAudio.ts`.
  Three modules that import **nothing but browser globals**: no React, no router, no app
  state. Mic waveform inside the ring for the person, around the outside for the model.
- **The harness** — `src/voice-harness.ts`. It holds the provider session, exposes the
  tools the model can call, brokers the ones that need the page, writes the log, serves
  the built page (`dist/`, at `/` and under `/harness` — the Vite dev proxy's path, so
  dev and served are one page), and declares itself as the machine's `voice` harness.

## How it works

```
  browser page  ──socket──▶  harness  ──▶  provider (Live API)
       │                        │
       │                        └────────▶  daemon  ──▶  canvases, actors, projects
       │
       └── OPFS: memories, the folder handle, your theme
```

**Where state actually lives**, because this is the part people get wrong:

| what | where | survives |
|---|---|---|
| memories | the **page's own storage** (OPFS, per origin) | page reload and browser restart |
| a granted folder | a handle **the page holds**; the harness sees only its name | re-granted by you after a restart |
| provider key, system prompt, model choice | the harness's directory (`~/.isocan/voice/`) | everything |
| canvas contents | the **daemon** | everything |

**The harness never reads your disk and never holds your address book.** File questions go
*to the page*, which answers from the handle you chose. That's why a folder pick is a
click rather than a path.

## Reaching it

- **Talk to it**: open the page, press Listen.
- **Supervise it**: `npx isocan rc` — it resolves the agent from the enrolment record and
  starts this same entry point (the declaration this harness wrote for itself).
- **Default port**: 7654. The daemon it attaches to is chosen when the harness starts.

## What it needs

1. **A provider key** — pasted in the settings cog, validated by the provider itself.
2. **A canvas** — the project it works on, chosen in the cog or passed at startup.
3. **A daemon** — `packages/server`, which is where canvases and actors live.

Missing any of these is reported in the page rather than silently ignored: an unconfigured
agent shows a *"needs setup"* callout pointing at the cog.

## Test it

```bash
npm test -w @isocan/voice-agent        # unit tests (one of them runs a real vite build)
npm run typecheck -w @isocan/voice-agent
```

## What it does not do

- **`open_url` is page-side only.** The page can open a link; the harness has no route for
  the model to ask it to, so this is not an end-to-end tool yet.
- **Memory is per-origin and per-browser.** A different browser, or a different port, sees
  a different store. The inspector shows which one you are looking at, and says so when a
  store cannot be read rather than reporting it as empty.
- **Not verified on physical devices** — the layout is measured in emulated Chrome with
  touch and device pixel ratio, not on a phone.
- **No provider spend guarantees.** Session cost limits are a separate, unbuilt item.
