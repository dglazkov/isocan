---
status: partial
since: 2026-11-19
see: modules, proactive-agent, durable-agents, multiuser, embed, browser-surface, workbench
note: "Open Stitch: isocan and OS1 (Perceptum Canvas, depot personal/openstitch) made one product. isocan is the body — the op log, the daemon, the CLI, two homes, bring-your-own-agent; OS1 is the nervous system — the feel of a canvas with an agent in it, the shell, voice, media, memory. Ten principles from the deck; the walk is phases.md."
---

# Open Stitch — the ideal

**19 November 2026.** Dion asked for an analysis of OS1 — the canvas Josh
built at `depot.code.corp.goog:personal/openstitch` (2,345 commits since
19 Sep, 312 decision records, live on Cloud Run behind ÜberProxy) — and what a
merge with isocan would look like. The deck *Open Stitch? We So Can!* holds the
vision; this page holds it as scenes isocan must play, and the principles the
scenes are measured against. The mechanism is in each phase of
[phases.md](phases.md); nothing here names a file.

## Ten principles, each a promise from day one

1. **Fully open source, open ecosystem.** Anyone runs their own: laptop, their
   cloud, their company. The code, the protocol and the specs are open.
2. **Isomorphic CLI all the things.** Every action a person can take in the
   UI is a command an agent can run, same vocabulary, same result, live on
   both surfaces.
3. **Bring your own agent.** Gemini and Antigravity are first-class, and any agent
   that can read a skill can join, get a name and a cursor, and do real work.
4. **Multiplayer and multiagent from the get go.** Presence, cursors, threads
   and turns are in the core, for people and agents alike.
5. **Context is key.** A rich graph of everything and the context around it;
   adding a source is a small, spec'd piece of work.
6. **A spatial map of everything.** Zoom out to the territory, in to the one
   thing — and so can your agents.
7. **Extensible nodes with rich views and devtools.** Anyone defines a kind;
   every item shows itself well and opens to show its data, history and what
   it is doing.
8. **A node is a running app you can share and use.** The real thing, live,
   with a link.
9. **Great voice.** Talk, point and steer; the system turns what you mean into
   actions on the map.
10. **3P and 1P from day one.** The same code at isocan.io and
    isocan.corp.goog, working natively with Antigravity.

Tactically: **not a software factory.** A broad, useful tool for people; the
software-factory pieces are one use among many, never the only one.

## What each half brings

isocan already keeps promises 1, 2, 3, 4 and 10 in code: one op vocabulary
and one reducer, a daemon the CLI and the web app are equal clients of, the
agent lap (`identity --session`, `wait`, `comment reply`), presence and
threads as core, and one code base at two homes. What it is thinnest on is
*feel* — reviews have gone metric-only, onboarding is doc-led, voice has never
been exercised by a person.

OS1 keeps promises 5, 6, 7, 8 and 9 better than isocan does, in a shape
isocan cannot import wholesale: it is built on React Flow, runs most of its
agent tools inside the browser tab, and keeps comments and memory in Postgres
beside the canvas document. What it has that isocan lacks is the rules — how
big an item is at zoom 1, when a label sheds, how neighbours slide aside, how
an agent shows what it is doing before it speaks, what the model is told about
the canvas, how memory is tiered and budgeted — and a production voice.

## The scenes

**A person arrives.** Home shows their canvases as previews and an Inbox of
what waits on them across all of them — a question an agent asked, a thread
that mentions them — answerable without opening anything. Canvases open in
tabs along the top; the tab shows when one is saving or an agent is working
in it.

**They drop a photo.** It lands beside what is there, at reading size, never
on top of anything, and an agent-readable description of it exists before any
agent is told about it.

**They type in the bar at the bottom.** Something answers within a second,
in the first person and the future tense — "I'll make three options" — and
the bar folds to a pill. Items appear, each with a cursor that says
*generating* and a handle, and only once each is on screen does the summary
say it was made. If one fails, the card says what happened, why, and what to
do next, in plain words; Retry does not need the agent.

**Two agents and a person.** Each agent is a named station on the canvas —
its trace, its checklist, what it made. Neither edits what the other is
holding; neither edits what the person made without a click. A person
double-clicks a face to follow it; says "follow me" and an agent sees what
they see.

**Antigravity on the canvas — and anything else.** A session running on the
person's workstation is an item: its turns, its artifacts as items with
provenance, the dev server it started as a live site. The same item hosts a
Gemini CLI session, a Claude Code session, or a shell. Each is also an agent:
a handle, a cursor, a station.

**Memory.** A reflection document per canvas — current intent, decisions, open
threads — written from the canvas's own history and citing it, versioned like
any item. A private canvas per person holds what the system has learned about
them, each observation with its confidence and its proof, placeable elsewhere
as a pointer that only its owner can read. `/learn` teaches; Forget forgets.

**Voice.** The microphone is on the canvas, not in a chat box. The agent
speaks only about what is already on screen, never narrates twice, and can
drive the video playing on an item while you talk about it.

**Two homes.** All of it at isocan.io with your own keys, and at
isocan.corp.goog with Google's, from one build.

## What the scenes force

- OS1's **rules** become core helpers and tables; its **agent semantics**
  become presence-protocol and comment-metadata conventions; its
  **integrations** become modules; its **agent** becomes a process that
  speaks the CLI like any other. Nothing of OS1's rendering or hosted harness
  crosses over.
- Two op changes at most: an `expect` precondition on item ops, and — if
  source-level Forget is in scope — a redaction op. Everything else is
  properties, metadata, presence and modules, inside the 47-op bound.
- Modules must be able to own a server route and spend a key before any
  media generator can be one; the home, not the browser, must poll a slow job.
- A default agent needs a home-owned runner on hosted homes; isocan's server
  spawns nothing today.
- The local daemon is already on the workstation; it is the bridge OS1 had to
  build separately.
- Every surface that lands must be a lazy chunk; the entry bundle and the hot
  files are already past their bounds.
