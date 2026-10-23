---
name: plates
description: Start here in any repo with a .plates/plates.json, or when asked about its phases, the roadmap, lessons, the night shift, evidence, or plates itself — it says what plates is and where its instructions live.
---

# isocan is run with plates

`plates` keeps a project's working practice in its files: one phase file per
piece of work, status in that file's front matter, lessons as a table, and
evidence before anything is called built. The `plates` CLI installs that
practice, checks it, and keeps it current.

**The instructions live in the tool.** Run this first, once per session, and
follow what it says:

```sh
plates --agent-help
```

It ships with the CLI, so it describes the version you are running; this file
cannot fall behind it.

## If `plates` isn't there

Run it from GitHub with nothing installed: wherever a command says `plates`,
say `npx -y github:dalmaer/plates`.

```sh
npx -y github:dalmaer/plates --agent-help
```

To install it instead:

```sh
git clone https://github.com/dalmaer/plates <dir>
npm install -g <dir>
```

## Before you change anything

Read `AGENTS.md`; it is this project's working guide. Never edit
`docs/ROADMAP.md`, which is generated. `npm test && npm run typecheck && node --test tests/loop.test.mjs` is the gate. Outward steps
(repos, secrets, issues on another repo, model spend) wait for the owner's yes.
